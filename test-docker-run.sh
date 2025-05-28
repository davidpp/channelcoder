#!/bin/bash
# Docker Claude Test Runner

echo "=== Building Docker Image ==="
docker build -f Dockerfile.claude-test -t claude-test:latest .

if [ $? -ne 0 ]; then
  echo "Failed to build Docker image"
  exit 1
fi

echo -e "\n=== Running Test Script ==="
# Update the test script to use our test image
sed -i.bak "s|anthropic/claude-code:latest|claude-test:latest|g" test-docker-prototype.ts

# Run the test
bun test-docker-prototype.ts

# Restore original
mv test-docker-prototype.ts.bak test-docker-prototype.ts