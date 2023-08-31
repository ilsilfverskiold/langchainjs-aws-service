import { OpenAI } from "langchain/llms/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';

const s3 = new S3Client({ region: "eu-central-1" }); // Adjust the region if necessary
const openaiKey = process.env.OPENAI_API_KEY;

export const handler = async (event) => {
    try {
        const requestBody = JSON.parse(event.body);
        const { question, chatHistory, bucketName } = requestBody;

        // Create a directory in /tmp to store the embeddings files
        const embeddingsDir = "/tmp/embeddings";
        if (!fs.existsSync(embeddingsDir)) {
            fs.mkdirSync(embeddingsDir);
        }

        // these are the files we're looking for
        const fileKeys = ["faiss.index", "docstore.json"];
        
        for (const key of fileKeys) {
            const getObjectCommand = new GetObjectCommand({
                Bucket: bucketName,
                Key: `embeddings/${key}`
            });
            const objectData = await s3.send(getObjectCommand);
            const writeStream = fs.createWriteStream(`${embeddingsDir}/${key}`);
            
            await new Promise((resolve, reject) => {
                objectData.Body.pipe(writeStream)
                    .on('finish', resolve)
                    .on('error', reject);
            });
        }

        const model = new OpenAI({
            openAIApiKey: openaiKey,
            temperature: 0
        });

        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: openaiKey
        });

        const vectorStore = await FaissStore.load(embeddingsDir, embeddings);
        
        const chain = ConversationalRetrievalQAChain.fromLLM(
            model,
            vectorStore.asRetriever()
        );
        
        // Use the chatHistory to decide the type of call
        let response;
        if (chatHistory && chatHistory.trim() !== "") {
            response = await chain.call({ question, chat_history: chatHistory });
        } else {
            response = await chain.call({ question, chat_history: "" });
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3000',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error("Error processing the request:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "An error occurred while processing the request.",
                error: error.message
            }),
        };
    }
};
