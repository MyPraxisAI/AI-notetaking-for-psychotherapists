#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if environment is provided
ENVIRONMENT=${1:-"production"}
if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: Environment not specified. Usage: $0 <environment>${NC}"
    exit 1
fi

# Set variables
APP_NAME="mypraxis-bg-worker"
AWS_REGION="eu-west-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text --profile "$AWS_PROFILE")
ECR_REPOSITORY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/mypraxis/bg-worker"

# Use IMAGE_TAG from environment or generate a new one based on timestamp
if [ -z "$IMAGE_TAG" ]; then
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  IMAGE_TAG="$TIMESTAMP"
fi

# Write the tag to a file that can be read by other scripts
# Write to the apps/bg directory
TAG_FILE="$(cd "$(dirname "$0")/.." && pwd)/.latest-image-tag"
echo "$IMAGE_TAG" > "$TAG_FILE"
echo -e "${GREEN}Wrote image tag to file: $TAG_FILE${NC}"
echo -e "${GREEN}File content: $(cat "$TAG_FILE")${NC}"

echo -e "${GREEN}Using image tag: ${IMAGE_TAG}${NC}"

# Export the tag as an environment variable for Terraform to use
export TF_VAR_image_tag="$IMAGE_TAG"

echo -e "${GREEN}Pushing Docker image to ECR for ${APP_NAME} in ${ENVIRONMENT} environment${NC}"
echo -e "${YELLOW}Using AWS profile: ${AWS_PROFILE}${NC}"
echo -e "${YELLOW}Using AWS region: ${AWS_REGION}${NC}"
echo -e "${YELLOW}ECR repository: ${ECR_REPOSITORY}${NC}"

# Login to ECR
echo -e "${YELLOW}Logging in to ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Check if repository exists, create if it doesn't
if ! aws ecr describe-repositories --repository-names "mypraxis/bg-worker" --region "$AWS_REGION" --profile "$AWS_PROFILE" &> /dev/null; then
    echo -e "${YELLOW}Creating ECR repository...${NC}"
    aws ecr create-repository --repository-name "mypraxis/bg-worker" --region "$AWS_REGION" --profile "$AWS_PROFILE"
fi

# Build for AMD64 platform (AWS Fargate runs on x86_64/amd64)
echo -e "${YELLOW}Building Docker image for AMD64 platform...${NC}"

# Navigate to the monorepo root directory
cd "$(dirname "$0")/../../.."

# Build using the monorepo root as context
docker buildx build --platform linux/amd64 --target prod -t "mypraxis/bg-worker:$IMAGE_TAG" --load -f apps/bg/Dockerfile .

# Tag the image with both the unique tag and latest
echo -e "${YELLOW}Tagging image...${NC}"
docker tag "mypraxis/bg-worker:$IMAGE_TAG" "$ECR_REPOSITORY:$IMAGE_TAG"
docker tag "mypraxis/bg-worker:$IMAGE_TAG" "$ECR_REPOSITORY:latest"

# Push both tags to ECR
echo -e "${YELLOW}Pushing image to ECR...${NC}"
docker push "$ECR_REPOSITORY:$IMAGE_TAG"
docker push "$ECR_REPOSITORY:latest"

echo -e "${GREEN}Image successfully pushed to ECR!${NC}"
