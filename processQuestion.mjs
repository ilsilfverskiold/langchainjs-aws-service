import { OpenAI } from "langchain/llms/openai";
import { HumanMessage, AIMessage } from "langchain/schema";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { PromptTemplate } from "langchain/prompts";
import fs from "fs";

const s3 = new S3Client({ region: "eu-central-1" }); // Adjust the region if necessary
const openaiKey = process.env.OPENAI_API_KEY;

export const handler = async (event) => {
  try {
    // get variables from the request body
    const requestBody = JSON.parse(event.body);
    const {
      question,
      chatHistory = "",
      bucketName,
      promptTemplate = "",
      systemTemplate = "",
    } = requestBody;

    // check if the required variables are provided
    if (!question || !bucketName) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Both 'question' and 'bucketName' are required in the request body.",
        }),
      };
    }

    // Create a directory in /tmp to store the embeddings files
    const embeddingsDir = "/tmp/embeddings";
    if (!fs.existsSync(embeddingsDir)) {
      fs.mkdirSync(embeddingsDir);
    }

    // these are the files we're looking for
    const fileKeys = ["faiss.index", "docstore.json"];

    // download the files from S3
    for (const key of fileKeys) {
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: `embeddings/${key}`,
      });
      const objectData = await s3.send(getObjectCommand);
      const writeStream = fs.createWriteStream(`${embeddingsDir}/${key}`);

      await new Promise((resolve, reject) => {
        objectData.Body.pipe(writeStream)
          .on("finish", resolve)
          .on("error", reject);
      });
    }

    // load the model, vector store, and memory
    const model = new OpenAI({
      model_name: "gpt-4",
      openAIApiKey: openaiKey,
      temperature: 0,
    });

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiKey,
    });

    const vectorStore = await FaissStore.load(embeddingsDir, embeddings);
    const memory = await initializeMemory(chatHistory);

    // add your chain options here
    const chainOptions = {
      memory: memory,
    };

    // look if the prompt and system templates are provided otherwise don't add it to the options
    if (
      promptTemplate &&
      promptTemplate.trim() !== "" &&
      systemTemplate &&
      systemTemplate.trim() !== ""
    ) {
      chainOptions.qaChainOptions = {
        type: "stuff",
        prompt: PromptTemplate.fromTemplate(
          `${systemTemplate}\n${promptTemplate}`
        ),
      };
    }

    // create the chain
    const chain = ConversationalRetrievalQAChain.fromLLM(
      model,
      vectorStore.asRetriever(),
      chainOptions
    );

    // call the chain
    const response = await chain.call({ question });

    // Clean up /tmp directory - this could be optimized to be reused later if needed
    fileKeys.forEach((key) => {
      const filePath = `${embeddingsDir}/${key}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // return the response (will only accept origin http://localhost:3000 if not changed)
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error processing the request:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while processing the request.",
        error: error.message,
      }),
    };
  }
};

const initializeMemory = async (history) => {
  let messages;
  if (history === "") {
    messages = [];
  } else {
    messages = history.split("\n").map((msg) => {
      const [role, text] = msg.split(": ");
      if (role === "human") return new HumanMessage(text);
      return new AIMessage(text);
    });
  }

  return new BufferMemory({
    chatHistory: new ChatMessageHistory(messages),
    memoryKey: "chat_history",
  });
};
