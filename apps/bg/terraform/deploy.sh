#!/bin/bash
# MyPraxis Background Worker Terraform Deployment Script

set -e

# Default to production environment
ENV=${1:-production}
ACTION=${2:-plan}

echo "🚀 MyPraxis Background Worker to $ENV environment"
echo "📂 Using Terraform configuration in environments/$ENV"

# Navigate to the environment directory
cd "$(dirname "$0")/environments/$ENV"

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

# Run the specified action
case $ACTION in
  plan)
    echo "📝 Planning deployment..."
    terraform plan
    ;;
  apply)
    echo "🚀 Applying changes..."
    terraform apply
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
