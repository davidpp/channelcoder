#!/usr/bin/env node
/**
 * Example: Parsing Claude log files
 * 
 * This example demonstrates how to use the stream parser SDK
 * to parse and analyze Claude's detached session logs.
 */

import { parseLogFile, streamParser } from '../src/index.js';
import { parseLogStream, getLogSummary } from '../src/stream-parser/index.js';

// Example 1: Parse a complete log file
async function parseCompleteLog(logPath: string) {
  console.log('\n📄 Parsing complete log file...\n');
  
  const parsed = await parseLogFile(logPath);
  
  console.log(`Session ID: ${parsed.sessionId}`);
  console.log(`Total events: ${parsed.events.length}`);
  console.log(`Messages: ${parsed.messages.length}`);
  console.log(`Total cost: $${parsed.metadata.totalCost || 0}`);
  console.log(`Duration: ${parsed.metadata.duration || 0}ms`);
  
  if (parsed.metadata.toolsUsed) {
    console.log(`Tools used: ${parsed.metadata.toolsUsed.join(', ')}`);
  }
  
  console.log('\nAssistant responses:');
  parsed.messages
    .filter(m => m.role === 'assistant')
    .forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.content.substring(0, 100)}...`);
    });
}

// Example 2: Stream through a large log file
async function streamLargeLog(logPath: string) {
  console.log('\n🌊 Streaming through log file...\n');
  
  let eventCount = 0;
  let messageCount = 0;
  
  for await (const event of parseLogStream(logPath)) {
    eventCount++;
    
    if (streamParser.isAssistantEvent(event)) {
      messageCount++;
      const text = streamParser.extractAssistantText(event);
      console.log(`Message ${messageCount}: ${text.substring(0, 50)}...`);
    }
    
    // Could break early for very large files
    if (eventCount > 100) {
      console.log('(Stopping after 100 events)');
      break;
    }
  }
  
  console.log(`\nProcessed ${eventCount} events`);
}

// Example 3: Get quick summary without loading full file
async function getQuickSummary(logPath: string) {
  console.log('\n📊 Getting log summary...\n');
  
  const summary = await getLogSummary(logPath);
  
  console.log('Summary:');
  console.log(`- Session: ${summary.sessionId || 'unknown'}`);
  console.log(`- Events: ${summary.eventCount}`);
  console.log(`- Messages: ${summary.messageCount}`);
  console.log(`- Has errors: ${summary.hasErrors ? 'Yes' : 'No'}`);
  console.log(`- Cost: $${summary.totalCost || 0}`);
  console.log(`- Duration: ${(summary.duration || 0) / 1000}s`);
}

// Example 4: Extract specific information
async function extractSpecificInfo(logPath: string) {
  console.log('\n🔍 Extracting specific information...\n');
  
  const parsed = await parseLogFile(logPath);
  
  // Find all tool uses
  const toolUses = parsed.events.filter(streamParser.isToolUseEvent);
  console.log(`Tools used ${toolUses.length} times:`);
  toolUses.forEach(event => {
    console.log(`- ${event.tool}: ${JSON.stringify(event.input).substring(0, 50)}...`);
  });
  
  // Find any errors
  const errors = parsed.events.filter(e => 
    e.type === 'error' || (streamParser.isResultEvent(e) && e.subtype === 'error')
  );
  
  if (errors.length > 0) {
    console.log('\nErrors found:');
    errors.forEach(error => {
      if ('error' in error) {
        console.log(`- ${error.error}`);
      }
    });
  }
  
  // Calculate token usage
  const assistantEvents = parsed.events.filter(streamParser.isAssistantEvent);
  const totalTokens = assistantEvents.reduce((sum, event) => {
    const usage = event.message.usage;
    if (usage) {
      return sum + (usage.input_tokens || 0) + (usage.output_tokens || 0);
    }
    return sum;
  }, 0);
  
  console.log(`\nTotal tokens used: ${totalTokens}`);
}

// Example 5: Custom processing pipeline
async function customPipeline(logPath: string) {
  console.log('\n⚙️  Custom processing pipeline...\n');
  
  // Use composition to create a custom pipeline
  const lines = streamParser.readLogLines(logPath);
  const events = streamParser.parseEventStream(lines);
  const assistantOnly = streamParser.filterEventType(events, 'assistant');
  const first5 = streamParser.take(assistantOnly, 5);
  
  console.log('First 5 assistant messages:');
  for await (const event of first5) {
    const text = streamParser.extractAssistantText(event);
    console.log(`- ${text.substring(0, 60)}...`);
  }
}

// Main function
async function main() {
  const logPath = process.argv[2];
  
  if (!logPath) {
    console.error('Usage: bun run examples/parse-logs.ts <log-file-path>');
    console.error('\nExample:');
    console.error('  bun run examples/parse-logs.ts task-123.log');
    process.exit(1);
  }
  
  // Check if file is valid
  const isValid = await streamParser.isValidLogFile(logPath);
  if (!isValid) {
    console.error(`Error: ${logPath} is not a valid Claude log file`);
    process.exit(1);
  }
  
  // Run all examples
  await parseCompleteLog(logPath);
  await getQuickSummary(logPath);
  await extractSpecificInfo(logPath);
  await streamLargeLog(logPath);
  await customPipeline(logPath);
}

main().catch(console.error);