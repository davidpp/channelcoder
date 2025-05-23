#!/bin/bash

echo "🧪 Testing CC SDK CLI"
echo "===================="

# Make CLI executable
chmod +x src/cli.ts

echo -e "\n1. Testing help command..."
./src/cli.ts --help

echo -e "\n2. Testing inline prompt with data..."
./src/cli.ts -p "Hello \${name}, you are \${age} years old" -d name=Alice -d age=30 -v

echo -e "\n3. Testing file-based prompt..."
./src/cli.ts examples/analyze-task.md -d taskId=TEST-123 -d context="Test task" -v

echo -e "\n4. Testing JSON data..."
./src/cli.ts -p "Items: \${items}" -d 'items=["apple","banana","orange"]' -v

echo -e "\n5. Testing with system prompt..."
./src/cli.ts -p "Summarize: \${text}" -d text="Long text here..." -s "Be very concise"

echo -e "\n6. Testing streaming (if Claude is available)..."
./src/cli.ts -p "Count to 5 slowly" --stream

echo -e "\n✅ CLI tests complete!"