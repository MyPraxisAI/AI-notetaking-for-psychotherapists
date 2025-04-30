#!/bin/bash
set -e

# Print environment information for debugging
echo "Node version: $(node --version)"
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"
echo "Node modules: $(ls -la node_modules | grep openai)"

# Wait a moment to ensure all volumes are properly mounted
sleep 1

# Verify OpenAI module can be loaded
node -e "try { require('openai'); console.log('OpenAI module loaded successfully'); } catch(e) { console.error('Error loading OpenAI:', e); process.exit(1); }"

# Start the application
echo "Starting application..."
exec npx ts-node src/index.ts
