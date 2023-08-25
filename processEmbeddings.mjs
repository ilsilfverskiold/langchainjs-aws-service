import { Document } from "langchain/document";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { FaissStore } from "langchain/vectorstores/faiss";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

const s3 = new S3Client({ region: "eu-central-1" });
const openaiKey = process.env.OPENAI_API_KEY;

export const handler = async (event) => {
    try {

        // Parse the body of the request
        const requestBody = JSON.parse(event.body);
        
        // Extract bucket name and key from the parsed body
        const { bucketName, key } = requestBody;
        
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });
        
        const file = await s3.send(command);
        const fileContent = await getStreamContent(file.Body);

        // Create a Document with the content and optional metadata
        const docs = new Document({ 
            pageContent: fileContent, 
            metadata: { source: "s3" }
        });

        const splitter = new CharacterTextSplitter({
            chunkSize: 200,
            chunkOverlap: 50,
        });
    
        const documents = await splitter.splitDocuments([docs]);
    
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: openaiKey,
        });
    
        const vectorStore = await FaissStore.fromDocuments(documents, embeddings);

        // Save the embeddings and other files locally
        const tempPath = '/tmp/embeddings';
        await vectorStore.save(tempPath);

        // Upload each file in the /tmp/embeddings directory to the embeddings directory in S3
        const files = fs.readdirSync(tempPath);
        for (const file of files) {
            const filePath = path.join(tempPath, file);
            const fileBuffer = fs.readFileSync(filePath);
            const s3Key = `embeddings/${file}`; // Set the destination key with the "embeddings" prefix

            const putCommand = new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                Body: fileBuffer
            });

            await s3.send(putCommand);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Embeddings generated and uploaded successfully!",
                bucket: bucketName,
                directory: "embeddings"
            }),
        };
    } catch (error) {
        console.error("Error processing the file:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "An error occurred while processing the file.",
                error: error.message
            }),
        };
    }
};

const getStreamContent = async (stream) => {
    return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => {
            data += chunk;
        });
        stream.on('end', () => {
            resolve(data);
        });
        stream.on('error', reject);
    });
};
