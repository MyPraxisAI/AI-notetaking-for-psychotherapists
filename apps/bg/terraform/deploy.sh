#!/bin/bash
# MyPraxis Background Worker Terraform Deployment Script

set -e

# Default to production environment
ENV=${1:-production}
ACTION=${2:-plan}

echo "🚀 MyPraxis Background Worker to $ENV environment"
echo "📂 Using Terraform configuration in environments/$ENV"

# Store the path to the tag file before changing directories
SCRIPT_DIR="$(dirname "$0")"
# The tag file is in the apps/bg directory
TAG_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.latest-image-tag"

# Debug information
echo "🔍 Script directory: $SCRIPT_DIR"
echo "🔍 Tag file path: $TAG_FILE"
echo "🔍 Current directory: $(pwd)"
echo "🔍 Tag file exists? $([ -f "$TAG_FILE" ] && echo "Yes" || echo "No")"

# Read the tag file content early, before changing directories
if [ -f "$TAG_FILE" ]; then
  TAG_CONTENT=$(cat "$TAG_FILE")
  echo "🔍 Tag file content: $TAG_CONTENT"
  # Set the environment variable right away
  export TF_VAR_image_tag="$TAG_CONTENT"
fi

# Navigate to the environment directory
cd "$SCRIPT_DIR/environments/$ENV"

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
  echo "🔧 Initializing Terraform..."
  terraform init
else
  # Check if we need to reconfigure
  if [ "$ACTION" == "init-reconfigure" ]; then
    echo "🔧 Reconfiguring Terraform backend..."
    terraform init -reconfigure
    exit 0
  fi
fi

# Set AWS profile for production environment
if [ "$ENV" == "production" ]; then
  export AWS_PROFILE=mypraxis-terraform
  echo "🔑 Using AWS profile: $AWS_PROFILE"
fi

# Check if we need to read the image tag from file
if [ -z "$TF_VAR_image_tag" ]; then
  echo "⚠️ No image tag found in environment or file. Using default 'latest'."
else
  echo "📋 Using image tag: $TF_VAR_image_tag"
fi

# Run the specified action
case $ACTION in
  plan)
    echo "📝 Planning deployment..."
    terraform plan
    ;;
  apply)
    echo "🚀 Applying changes..."
    IMAGE_TAG=${TF_VAR_image_tag:-latest}
    echo "🏷️ Using image tag: $IMAGE_TAG"
    # Explicitly pass the image_tag variable to ensure Terraform sees it
    terraform apply -var="image_tag=$IMAGE_TAG"
    ;;
  destroy)
    echo "❌ Destroying infrastructure..."
    terraform destroy
    ;;
  output)
    echo "📊 Fetching outputs..."
    terraform output
    ;;
  init-reconfigure)
    echo "🔧 Reconfiguring Terraform backend..."
    terraform init -reconfigure
    ;;
  *)
    echo "❓ Unknown action: $ACTION"
    echo "Usage: $0 [environment] [plan|apply|destroy]"
    exit 1
    ;;
esac

echo "✅ Done!"
