# ChannelCoder SDK Runner for Docker Mode
FROM node:20-slim

# Install dependencies
WORKDIR /app
COPY package.json .
RUN npm install @anthropic-ai/claude-code-sdk

# Copy the SDK runner script
COPY sdk-runner.js .

# Set up non-root user for security
RUN useradd -m -s /bin/bash ccuser && \
    chown -R ccuser:ccuser /app

USER ccuser

# The runner will read options from environment and prompt from stdin
ENTRYPOINT ["node", "sdk-runner.js"]