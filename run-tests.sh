#!/bin/bash

echo "🧪 Running CC SDK Tests"
echo "======================"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  bun install
fi

# Run tests with different modes
echo -e "\n🏃 Running unit tests..."
bun run test

# Run with coverage
echo -e "\n📊 Running with coverage..."
bun run test:coverage

# Open coverage report (optional)
echo -e "\n📈 Coverage report generated at ./coverage/index.html"

# Run specific test file
if [ "$1" ]; then
  echo -e "\n🎯 Running specific test: $1"
  bun test "$1"
fi