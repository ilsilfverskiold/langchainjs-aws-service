# Langchain AWS Lambda Service
This project uses NodeJS 18 with AWS Lambda in conjunction with the AWS SDK v3 via the Serverless Framework. 

This service is designed to process text files with Langchain allowing us to use these text files to ask questions with OpenAI. Langchain will default to GPT-Turbo-3.5 but you may specify GPT-4.

It's worth noting that there might be challenges with very large text files due to the current workarounds. However, for most cases it will work well.

## Outcomes

Upon successful deployment, you will have two primary API endpoints:

1. **Text Transformation Endpoint**: Transforms `.txt` files located in an S3 bucket into a Faiss store. This data is then stored under a folder named `embeddings` within the same bucket.
   
   Sample request:
   ```bash
   curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/process" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "bucketName": "my-langchain-bucket", "key": "customer_service_questions.txt" }'

    Sample result:
    ```json
    {
        "message": "Embeddings generated and uploaded successfully",
        "bucket": "my-langchain-bucket",
        "directory": "embeddings"
    }

2. **Question-Answering Endpoint**: Enables you to ask questions based on the processed .txt file. The system can also consider past chat history for context.
   
   Sample request:
   ```bash
   curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/question" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "question": "can I pay with paypal?", "chatHistory": "", "bucketName": "my-langchain-bucket" }'

    Sample result:
    ```json
    {
        "text": "Yes, you can pay with PayPal. You can find this option on the payment section during checkout."
    }


## Setup

### Prerequisites

- **NodeJS:** Ensure you have NodeJS 18.x installed.
- **Serverless Framework:** This is used to deploy the project to AWS.
- **AWS Account:** Ensure you have an AWS account and have set up an IAM user with the necessary permissions.
- **OpenAI API Key:** You'll get an API key via platform.openai.com.
- **S3 Bucket:** Create a new bucket directly in S3 with your .txt file.

#### AWS Account

1. If you don't have an account, create one and enable MFA. Then create a new IAM user and give it the appropriate permissions.
   
    ```bash
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

3. **Navigate to the Directory**: Once cloned, navigate to the project directory:
   
    ```bash
    cd langchain-embeddings-serverless

5. **Install Dependencies**:
- First, ensure you have Node.js installed. This project requires Node.js 18.x.
- Install the necessary project dependencies:
  
  ```bash
  npm install
  
- If you haven't installed the Serverless Framework globally, do so with:
  
  ```bash
  npm install -g serverless

4. **Environment Variables**: 

- Create an `.env` file at the root of your project directory and set your OpenAI API key:

    ```bash
    OPENAI_API_KEY=your_openai_api_key_here

- If you are having issues with your environment variables please use the terminal to set them instead.

    ```bash
    export OPENAI_API_KEY="yourkeyhere"

6. **AWS Credentials**: Configure the Serverless Framework with your AWS credentials:

    ```bash
    serverless config credentials --provider aws --key YOUR_AWS_KEY --secret YOUR_AWS_SECRET

7. **Tweak the YAML File**: 
- I've set the permissions of the lambda to only my-langchain-bucket. You need to change this accordingly. See the serverless.yml file.
  
    ```YAML
    Resource: "arn:aws:s3:::my-langchain-bucket/*"
   
- We're setting an API key as well here that you'll recieve along with your endpoints once the application has been deployed successfully. See the Serverless docs on API Key [here](https://www.serverless.com/framework/docs/providers/aws/events/apigateway#setting-api-keys-for-your-rest-api)

7. **Deployment**: Deploy your service to AWS.
   
    ```bash
    serverless deploy

9. **API Endpoints**: After a successful deployment, you'll receive the base URLs for your API endpoints along with an API key (set in the header as x-api-key)
    
    ```bash
    api keys:
        langchainAPIKey: xxxxxxx
    endpoints:
        POST - https://xxxxxx.execute-api.eu-central-1.amazonaws.com/dev/process
        POST - https://xxxxxx.execute-api.eu-central-1.amazonaws.com/dev/question
    functions:
        processFile: langchain-service-dev-processFile (13 MB)
        processQuestion: langchain-service-dev-processQuestion (13 MB)

8. **Test it out**: via CURL, Postman or within your application.

    ```bash
    curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/process" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "bucketName": "my-langchain-bucket", "key": "customer_service_questions.txt" }'

    curl -X POST "https://YOUR_AWS_POST_URL_HERE/dev/question" \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{ "question": "can I pay with paypal?", "chatHistory": "", "bucketName": "my-langchain-bucket" }'

9. **Add Layer**: You need to go in directly to the AWS console and add a layers to your created lambda functions if you're getting node-faiss errors. A very annoying workaround. See the zip file in the /layer folder. This layer has been provided directly [ewfian](https://github.com/ewfian).

## Notes 

1. The Serverless Framework doesn't seem to allow for ES6 modules so there is a workaround using two handlers, one that processes the .mjs file which seemed to work well.

2. Please remember to add in the faiss-node layer to both functions or you will run into trouble. Look at this thread [here.](https://github.com/hwchase17/langchainjs/issues/1930#issuecomment-1646500643)

## Caution
Monitor your AWS usage to avoid unexpected charges. Set up billing alerts in the AWS Billing Console.
Limit the request rate to your API, as illustrated in the serverless.yml file, to prevent abuse. If you are using the same serverless.yml file it should limit the requests to 1000 per month with the API key provided. 
