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
FROM base as build

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Create monorepo directory structure
RUN mkdir -p /app/packages/web-bg-common
RUN mkdir -p /app/packages/shared-common
RUN mkdir -p /app/apps/bg

# Copy package files first for better caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy the shared-common package
COPY packages/shared-common/package.json packages/shared-common/tsconfig.json packages/shared-common/index.js /app/packages/shared-common/
COPY packages/shared-common/src /app/packages/shared-common/src/

# Copy the web-bg-common package
COPY packages/web-bg-common/package.json packages/web-bg-common/tsconfig.json packages/web-bg-common/index.js /app/packages/web-bg-common/
COPY packages/web-bg-common/src /app/packages/web-bg-common/src/

# Copy the bg app source
COPY apps/bg/src /app/apps/bg/src/
COPY apps/bg/package.json apps/bg/tsconfig.json /app/apps/bg/

# Install dependencies using pnpm (skip postinstall scripts)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build the shared-common package first
RUN pnpm --filter @kit/shared-common build

# Build the web-bg-common package
RUN pnpm --filter @kit/web-bg-common build

# Build the bg app
RUN pnpm --filter bg build

################ Production Stage ################
FROM base as prod

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json files for production
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared-common/package.json /app/packages/shared-common/
COPY packages/web-bg-common/package.json /app/packages/web-bg-common/
COPY apps/bg/package.json ./package.json

# Copy the built shared-common package with its index.js
COPY --from=build /app/packages/shared-common/dist /app/packages/shared-common/dist
COPY --from=build /app/packages/shared-common/index.js /app/packages/shared-common/index.js

# Copy the built web-bg-common package with its index.js
COPY --from=build /app/packages/web-bg-common/dist /app/packages/web-bg-common/dist
COPY --from=build /app/packages/web-bg-common/index.js /app/packages/web-bg-common/index.js

# Copy the built application
COPY --from=build /app/apps/bg/dist ./dist

# Install production dependencies
# Use --ignore-scripts to skip postinstall scripts that require manypkg
# Use --no-frozen-lockfile, otherwise problems with "overrides" configuration
RUN pnpm install --prod --no-frozen-lockfile --ignore-scripts

# Set up pnpm cache directory with proper permissions
RUN mkdir -p /home/node/.pnpm-store && \
    mkdir -p /home/node/.local/share/pnpm

# Set non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app /home/node
USER appuser

# Configure pnpm to use a directory with proper permissions
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Expose health check port if needed
EXPOSE 8080

# Use pnpm start for proper module resolution
CMD ["pnpm", "start"]
