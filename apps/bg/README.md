# Audio Transcription Background Worker

This is a Node.js daemon that polls an AWS SQS queue for audio transcription requests. It's containerized using Docker, includes FFmpeg for audio processing, and is optimized for running on AWS Fargate with Supabase integration.

## Prerequisites

- Docker
- AWS account with SQS queue set up
- AWS credentials with appropriate permissions
- AWS CLI (for Fargate deployment)

## Features

- Polls AWS SQS queue for audio transcription requests
- Processes audio files using FFmpeg
- Stores transcription results in Supabase
- Health check endpoint for Fargate container monitoring
- Secure container configuration with non-root user
- Modular architecture with clean separation of concerns

## Local Setup

1. Copy the `.env.example` file to `.env` and fill in your AWS credentials and SQS queue URL:

```
cp .env.example .env
```

2. Edit the `.env` file with your actual AWS credentials and SQS queue URL.

## Building the Docker Image

```
docker build -t bg-workers .
```

## Running Locally

### Using Docker

```
docker run --env-file .env -p 8080:8080 bg-workers
```

### Using Docker Compose with LocalStack

This project includes a Docker Compose configuration that sets up LocalStack to emulate AWS SQS locally for development:

```
docker-compose up
```

This will start:
1. LocalStack container with SQS service
2. Your application container configured to use the local SQS queue

The application will automatically create the SQS queue on startup when running in development mode.

### Testing with LocalStack

To send a test message to your local SQS queue:

```
node scripts/send-test-message.js
```

## SQS Queue Management

### Queue Naming

SQS queue names only need to be unique within your AWS account and region (unlike S3 bucket names which must be globally unique). For production environments, consider using a naming convention that includes:

- Your company or project name
- The application name
- The environment (prod, staging, dev)

Examples:
- `company-name-mypraxis-background-tasks-prod`
- `project-name-media-processing-queue-staging`

You can set the queue name using the `SQS_QUEUE_NAME` environment variable.

### Queue Creation

- **Development**: In development mode with LocalStack, the application will automatically create the queue if it doesn't exist.
- **Production**: In production, queues should be created through infrastructure as code (e.g., AWS CloudFormation, Terraform) before deploying the application. The application will not attempt to create queues in production environments.

## Deploying to AWS Fargate

1. Push your Docker image to Amazon ECR:

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Create ECR repository (if it doesn't exist)
aws ecr create-repository --repository-name bg-workers --region us-east-1

# Tag the image
docker tag bg-workers:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bg-workers:latest

# Push the image
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bg-workers:latest
```

2. Create a task definition for Fargate (example using AWS CLI):

```bash
aws ecs register-task-definition \
  --family bg-workers \
  --requires-compatibilities FARGATE \
  --network-mode awsvpc \
  --cpu 1024 \
  --memory 2048 \
  --execution-role-arn arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/ecsTaskExecutionRole \
  --task-role-arn arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/ecsTaskRole \
  --container-definitions "[{\"name\":\"bg-workers\",\"image\":\"YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bg-workers:latest\",\"essential\":true,\"portMappings\":[{\"containerPort\":8080,\"hostPort\":8080}],\"environment\":[{\"name\":\"AWS_REGION\",\"value\":\"us-east-1\"},{\"name\":\"SQS_QUEUE_NAME\",\"value\":\"your-production-queue-name\"},{\"name\":\"SQS_QUEUE_URL\",\"value\":\"YOUR_SQS_QUEUE_URL\"}],\"healthCheck\":{\"command\":[\"CMD-SHELL\",\"curl -f http://localhost:8080/health || exit 1\"],\"interval\":30,\"timeout\":5,\"retries\":3,\"startPeriod\":60}}]"
```

3. Create a Fargate service:

```bash
aws ecs create-service \
  --cluster YOUR_CLUSTER_NAME \
  --service-name bg-workers \
  --task-definition bg-workers \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[YOUR_SUBNET_ID],securityGroups=[YOUR_SECURITY_GROUP_ID],assignPublicIp=ENABLED}"
```

## IAM Permissions

Your Fargate task will need the following permissions:

- `sqs:ReceiveMessage`
- `sqs:DeleteMessage`
- `sqs:GetQueueAttributes`

Create a task role with these permissions and assign it to your Fargate task.

## Development

To run locally without Docker:

1. Install dependencies:

```
npm install
```

2. Run the application:

```
npm start
```

## Message Processing

The worker processes messages with the type `audio:transcribe`. Each message should include:

- `audioUrl`: URL to the audio file to transcribe
- `userId`: ID of the user who owns the audio file
- `metadata` (optional): Additional metadata about the audio file

The worker will:
1. Download the audio file
2. Process it with FFmpeg if needed
3. Transcribe the audio
4. Store the results in Supabase

To customize the transcription logic, edit the `processAudioTranscription` method in `lib/messageProcessor.js`.
