################ Base Stage ################
FROM ubuntu:22.04 as base

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Update and install common dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

################ Build Stage ################
FROM node:18 as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies for build
RUN npm install

# Install ts-node globally for running TypeScript directly
RUN npm install -g ts-node typescript

# Copy source code
COPY src ./src

# Build TypeScript code
RUN npm run build

################ Development Stage ################
FROM base as dev

# Install ts-node globally for running TypeScript directly
RUN npm install -g ts-node typescript

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies from package.json
RUN npm install

################ Production Stage ################
FROM base as prod

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Set non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose health check port if needed
EXPOSE 8080

# Default command
CMD ["node", "dist/index.js"]
