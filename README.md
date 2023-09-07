# Langchain AWS Lambda Service
This project uses NodeJS 18 with AWS Lambda in conjunction with the AWS SDK v3 via the Serverless Framework. 

This service is designed to process text files with Langchain allowing us to use these text files to ask questions with OpenAI. This script uses GPT-Turbo-3.5 but you may specify GPT-4.

Updated to include a prompt and system template that you can send in with your request.

If you want to follow a full tutorial and see the end result go [here](https://medium.com/gitconnected/deploying-an-ai-powered-q-a-bot-on-aws-with-langchainjs-and-serverless-9361d0778fbd).

## Outcomes

Upon successful deployment, you will have two primary API endpoints:

1. **Text Transformation Endpoint**: Transforms `.txt` files located in an S3 bucket into a Faiss store. This data is then stored under a folder named `embeddings` within the same bucket.
   
   Sample request:
   ```bash
   curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/process" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "bucketName": "my-langchain-bucket", "key": "customer_service_questions.txt" }'
    ```
    Successful response:
    ```json
    {
        "message": "Embeddings generated and uploaded successfully",
        "bucket": "my-langchain-bucket",
        "directory": "embeddings"
    }
    ```

2. **Question-Answering Endpoint**: Enables you to ask questions based on the processed .txt file. The system can also consider past chat history for context.
   
   Sample request:
   ```bash
   curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/question" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "question": "can I pay with paypal?", "chatHistory": "", "bucketName": "my-langchain-bucket" }'
    ```
    Successful response:
    ```json
    {
        "text": "Yes, you can pay with PayPal. You can find this option on the payment section during checkout."
    }
    ```

## Setup

### Prerequisites

- **NodeJS:** Ensure you have NodeJS 18.x installed.
- **Serverless Framework:** This is used to deploy the project to AWS.
- **AWS Account:** Ensure you have an AWS account and have set up an IAM user with the necessary permissions.
- **OpenAI API Key:** You'll get an API key via platform.openai.com.
- **A Formatted Text File:** See the two examples `customer_service_questions.txt` and `customer_service_questions2.txt`
- **S3 Bucket:** Create a new bucket directly in S3 with your .txt file and then add an empty folder called `/embeddings` in this bucket.

#### AWS Account

1. If you don't have an account, create one and enable MFA. Then create a new IAM user and give it the appropriate permissions.
   
    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "cloudformation:*",
                    "lambda:*",
                    "apigateway:*",
                    "logs:*",
                    "s3:*",
                    "iam:GetRole",
                    "iam:CreateRole",
                    "iam:PassRole",
                    "iam:PutRolePolicy",
                    "iam:AttachRolePolicy"
                ],
                "Resource": "*"
            }
        ]
    }
    
3. Download the CSV files containing AWS keys. We'll need these to give the Serverless Framework the ability to create our application.

#### S3 Bucket

This was the easiest choice but possible to tweak the processEmbeddings.mjs to allow to create a bucket, send in the .txt file and create the embeddings folder. However if you are using as is then:

1. Create a new bucket in S3, name it what you wish. I named it my-langchain-bucket.

2. Add your .txt file following a good format. See the attached customer_service_questions.txt file as an example. **Tip:** You can use ChatGPT to get help to create this file.

3. Create an embeddings folder within this bucket (this is where we'll set the faiss.index and docstore.json that will be created with the .txt file)

## Deployment

1. **Clone the Repository**: If you haven't already, clone the repository to your local machine:
   
    ```bash
    git clone https://github.com/ilsilfverskiold/langchain-embeddings-serverless.git
    ```

2. **Navigate to the Directory**: Once cloned, navigate to the project directory:
   
    ```bash
    cd langchain-embeddings-serverless
    ```

3. **Install Dependencies**:
- First, ensure you have Node.js installed. This project requires Node.js 18.x.
- Install the necessary project dependencies:
  
  ```bash
  npm install
  ```
  
- If you haven't installed the Serverless Framework globally, do so with:
  
  ```bash
  npm install -g serverless
  ```

4. **Environment Variables**: 

- Set your OpenAI API key (get yours at platform.openai.com):

    ```bash
    export OPENAI_API_KEY="yourkeyhere"
    ```

5. **AWS Credentials**: Configure the Serverless Framework with your AWS credentials (the CSV file you downloaded from AWS):

    ```bash
    serverless config credentials --provider aws --key YOUR_AWS_KEY --secret YOUR_AWS_SECRET
    ```

6. **(Optional) Tweak the YAML File**: 
- I've set the permissions for the lambda functions to my-langchain-bucket. This means the lambdas will be able to access this bucket. You need to change this accordingly. See the serverless.yml file.
  
    ```YAML
    iamRoleStatements:
    - Effect: Allow
      Action:
        - s3:GetObject
        - s3:PutObject
      Resource: "arn:aws:s3:::my-langchain-bucket/*"
    ```
   
- We're setting an API key as well here that you'll recieve along with your endpoints once the application has been deployed successfully. See the Serverless docs on API Key [here](https://www.serverless.com/framework/docs/providers/aws/events/apigateway#setting-api-keys-for-your-rest-api)

    ```YAML
    apiGateway:
    apiKeys:
      - langchainAPIKey
    ```

- I've set the usage plan of these endpoints, be sure to change it accordingly.

    ```YAML
    apiGateway:
    ...
    usagePlan:
      quota:
        limit: 1000
        offset: 2
        period: MONTH
      throttle:
        burstLimit: 10
        rateLimit: 1
    ```


7. **(Optional) Tweak the Code If Necessary**: 

- Look through the script processQuestion.mjs
    - To set your CORS headers. As of now you'll be able to access it via localhost:3000.

        ```javascript
        headers: {
            'Access-Control-Allow-Origin': 'http://localhost:3000',
            'Access-Control-Allow-Credentials': true,
        }
        ```
    - Set the correct region of your S3 bucket

        ```javascript
        const s3 = new S3Client({ region: "eu-central-1" }); // Adjust the region if necessary
        ```
    - Set up the LLM Model (use either gpt-4, gpt-3.5-turbo-16k, gpt-3.5-turbo-32k) it is by default using gpt-3.5-turbo-16k.

        ```javascript
        const model = new OpenAI({
            model_name: "gpt-3.5-turbo-16k",
            openAIApiKey: openaiKey,
            temperature: 0,
        });
        ```

8. **Deployment**: Deploy your service to AWS. This will take a minute or two.
   
    ```bash
    serverless deploy
    ```

9. **Add Node-Faiss Layer**: You need to go in directly to the AWS console and add a layers to your created lambda functions if you're getting node-faiss errors. A very annoying workaround. See the zip file in the /layer folder. This layer has been provided directly [ewfian](https://github.com/ewfian). Look at this thread [here.](https://github.com/hwchase17/langchainjs/issues/1930#issuecomment-1646500643) for more information. It should be set via your Serverless function but if you are still having issues, set it manually.

10. **Test it out**: via CURL, Postman or within your application. 

    ```bash
    curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/process" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "bucketName": "my-langchain-bucket", "key": "customer_service_questions.txt" }'
     ```

    ```bash
    curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/question" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "question": "can I pay with paypal?", "bucketName": "my-langchain-bucket" }'
     ```

    Remember you have additional options of "systemTemplate" and "promptTemplate". 
     ```json
        {
            "promptTemplate": "Use the following pieces of context to answer the question at the end. \n {context} \n Question: {question} \nHelpful Answer:",
            "systemTemplate": "I want you to act as a customer service bot called Socky the Happy bot that I am having a conversation with.\nYou are a bot that will provide funny answers to the customer. \n If you can't answer the question say I don't know."
        }
    ```
    
    If you are sending in "chatHistory" be sure to structure it correctly. 
    ```json
    {
        "chatHistory": "human: {human_message}?\nbot: {bot_message}\nhuman: {human_message}?\nbot: {bot_message}"
    }
    ```

## Debugging

Set up a NodeJS environment to debug. Use `verbose: true` in your chain to log all events to the console. This will allow you to see step by step what the chain is doing and tweak if necessary.

    ```javascript
    const chain = ConversationalRetrievalQAChain.fromLLM(
        model,
        vectorStore.asRetriever(),
        {
            memory: memory,
            // this is by default set to false
            verbose: true,
            qaChainOptions: {
                ...
            }
        }
    );
    ```

## Additional Notes 

1. The Serverless Framework doesn't seem to allow for ES6 modules so there is a workaround using two handlers, one that processes the .mjs file which seemed to work well.

## Caution
Monitor your AWS usage to avoid unexpected charges. Set up billing alerts in the AWS Billing Console.
Limit the request rate to your API, as illustrated in the serverless.yml file, to prevent abuse. If you are using the same serverless.yml file it should limit the requests to 1000 per month with the API key provided. 
