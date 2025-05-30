#!/usr/bin/env bun

import { session, monitorLog, parseLogFile, streamParser } from '../src/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import * as readline from 'readline';
import { homedir } from 'os';
import type { ClaudeEvent, StreamChunk } from '../src/stream-parser/types.js';

// Task state
interface TaskState {
  sessionName: string;
  status: 'idle' | 'running' | 'waiting_feedback' | 'completed' | 'error';
  pid?: number;
  logFile?: string;
  sessionPath: string;
  lastUpdate: Date;
  outputBuffer: string[];
  events: ClaudeEvent[];
  sessionId?: string;
  totalCost?: number;
  model?: string;
  toolsUsed: Set<string>;
  monitor?: () => void; // Cleanup function for monitor
}

// Global state
let currentTask: TaskState | null = null;
let sessionContent: any = {};

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Clear screen
function clearScreen() {
  console.clear();
  console.log('\x1b[H\x1b[2J');
}

// Read session file
async function readSessionFile(path: string) {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Process events to update task state
function processEvent(event: ClaudeEvent) {
  if (!currentTask) return;
  
  // Update events list
  currentTask.events.push(event);
  currentTask.lastUpdate = new Date();
  
  // Extract session ID
  const sessionId = streamParser.extractSessionId(event);
  if (sessionId && !currentTask.sessionId) {
    currentTask.sessionId = sessionId;
  }
  
  // Convert to chunk for output buffer
  const chunk = streamParser.eventToChunk(event);
  if (chunk && chunk.content) {
    currentTask.outputBuffer.push(chunk.content);
    // Keep only last 50 lines
    if (currentTask.outputBuffer.length > 50) {
      currentTask.outputBuffer = currentTask.outputBuffer.slice(-50);
    }
  }
  
  // Track tool usage
  if (streamParser.isToolUseEvent(event)) {
    currentTask.toolsUsed.add(event.tool);
  }
  
  // Update status based on events
  if (streamParser.isResultEvent(event)) {
    currentTask.status = event.subtype === 'error' ? 'error' : 'completed';
    currentTask.totalCost = event.total_cost;
  } else if (streamParser.isAssistantEvent(event)) {
    currentTask.model = event.message.model;
    
    // Check for feedback requests
    const text = streamParser.extractAssistantText(event).toLowerCase();
    if (text.includes('should i') || text.includes('would you like') || 
        text.includes('continue?') || text.includes('proceed?')) {
      currentTask.status = 'waiting_feedback';
    }
  } else if (streamParser.isErrorEvent(event)) {
    currentTask.status = 'error';
    currentTask.outputBuffer.push(`❌ Error: ${event.error}`);
  }
}

// Display UI
async function displayUI() {
  clearScreen();
  
  // Header
  console.log(`${colors.cyan}${colors.bright}┌─────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}│               🚀 Task Monitor with Session TUI              │${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}└─────────────────────────────────────────────────────────────┘${colors.reset}`);
  
  // Task Status Section
  console.log(`\n${colors.bright}═══ Task Status ═══${colors.reset}`);
  
  if (!currentTask) {
    console.log(`${colors.dim}No task running. Type a prompt to start.${colors.reset}`);
  } else {
    const statusIcon = {
      idle: '⏸️',
      running: '⚡',
      waiting_feedback: '⏳',
      completed: '✅',
      error: '❌'
    }[currentTask.status];
    
    const statusColor = {
      idle: colors.dim,
      running: colors.blue,
      waiting_feedback: colors.yellow,
      completed: colors.green,
      error: colors.red
    }[currentTask.status];
    
    console.log(`${statusIcon} Status: ${statusColor}${currentTask.status}${colors.reset}`);
    console.log(`📁 Session: ${colors.cyan}${currentTask.sessionName}${colors.reset}`);
    if (currentTask.sessionId) {
      console.log(`🆔 Session ID: ${colors.dim}${currentTask.sessionId}${colors.reset}`);
    }
    if (currentTask.pid) {
      console.log(`🔧 PID: ${currentTask.pid}`);
    }
    if (currentTask.model) {
      console.log(`🤖 Model: ${colors.magenta}${currentTask.model}${colors.reset}`);
    }
    if (currentTask.toolsUsed.size > 0) {
      console.log(`🔨 Tools Used: ${Array.from(currentTask.toolsUsed).join(', ')}`);
    }
    if (currentTask.totalCost !== undefined) {
      console.log(`💰 Cost: $${currentTask.totalCost.toFixed(4)}`);
    }
    console.log(`⏰ Last Update: ${currentTask.lastUpdate.toLocaleTimeString()}`);
    console.log(`📊 Events: ${currentTask.events.length}`);
  }
  
  // Output Preview Section
  console.log(`\n${colors.bright}═══ Claude Output (last 5 lines) ═══${colors.reset}`);
  
  if (currentTask && currentTask.outputBuffer.length > 0) {
    const recent = currentTask.outputBuffer.slice(-5);
    recent.forEach(line => {
      console.log(`${colors.dim}│${colors.reset} ${line.substring(0, 60)}${line.length > 60 ? '...' : ''}`);
    });
  } else {
    console.log(`${colors.dim}No output yet...${colors.reset}`);
  }
  
  // Session File Content Section
  console.log(`\n${colors.bright}═══ Session File Content ═══${colors.reset}`);
  
  if (sessionContent && sessionContent.messages) {
    console.log(`${colors.magenta}Messages:${colors.reset} ${sessionContent.messages.length}`);
    console.log(`${colors.magenta}Session IDs:${colors.reset} ${sessionContent.sessionChain?.join(' → ') || 'None'}`);
    
    // Show last message
    if (sessionContent.messages.length > 0) {
      const lastMsg = sessionContent.messages[sessionContent.messages.length - 1];
      console.log(`\n${colors.magenta}Last Message (${lastMsg.role}):${colors.reset}`);
      const preview = lastMsg.content.substring(0, 200);
      console.log(`${colors.dim}${preview}${lastMsg.content.length > 200 ? '...' : ''}${colors.reset}`);
    }
  } else {
    console.log(`${colors.dim}No session data yet...${colors.reset}`);
  }
  
  // Commands
  console.log(`\n${colors.bright}═══ Commands ═══${colors.reset}`);
  console.log(`  ${colors.green}Type any text${colors.reset} - Start a new task`);
  if (currentTask?.status === 'waiting_feedback') {
    console.log(`  ${colors.yellow}/continue <feedback>${colors.reset} - Continue with feedback`);
  }
  console.log(`  ${colors.blue}/status${colors.reset} - Refresh display`);
  console.log(`  ${colors.blue}/logs${colors.reset} - Show recent events`);
  console.log(`  ${colors.red}/stop${colors.reset} - Stop current task`);
  console.log(`  ${colors.dim}/quit${colors.reset} - Exit`);
  console.log(`\n> `);
}

// Start a new task
async function startTask(prompt: string) {
  // Clean up any existing monitor
  if (currentTask?.monitor) {
    currentTask.monitor();
  }
  
  const taskId = `test-${Date.now()}`;
  const sessionName = `task-${taskId}`;
  
  // Create session
  const s = session({ 
    name: sessionName,
    autoSave: true
  });
  
  // Set up task state
  currentTask = {
    sessionName,
    status: 'running',
    sessionPath: path.join(homedir(), '.channelcoder', 'sessions', `${sessionName}.json`),
    logFile: `${taskId}.log`,
    lastUpdate: new Date(),
    outputBuffer: [],
    events: [],
    toolsUsed: new Set()
  };
  
  // Start detached process
  console.log(`${colors.yellow}Starting detached process...${colors.reset}`);
  
  try {
    const result = await s.detached(prompt, {
      logFile: currentTask.logFile,
      stream: true,
      outputFormat: 'stream-json'
    });
    
    if (result.success) {
      if (result.pid) {
        currentTask.pid = result.pid;
        console.log(`${colors.green}✅ Task started with PID ${result.pid}${colors.reset}`);
      } else if (result.detached) {
        console.log(`${colors.green}✅ Task started in detached mode${colors.reset}`);
      }
      console.log(`📄 Log file: ${currentTask.logFile}`);
      
      // Start real-time monitoring
      const cleanup = monitorLog(currentTask.logFile, processEvent, {
        onError: (error) => {
          if (currentTask) {
            currentTask.status = 'error';
            currentTask.outputBuffer.push(`❌ Monitor error: ${error.message}`);
          }
        }
      });
      
      currentTask.monitor = cleanup;
      console.log(`📡 Real-time monitoring started`);
    } else {
      console.log(`${colors.red}❌ Failed to start task: ${result.error}${colors.reset}`);
      currentTask = null;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error starting task: ${error}${colors.reset}`);
    currentTask = null;
  }
}

// Continue task with feedback
async function continueTask(feedback: string) {
  if (!currentTask || currentTask.status !== 'waiting_feedback') {
    console.log(`${colors.red}No task waiting for feedback${colors.reset}`);
    return;
  }
  
  // Clean up existing monitor
  if (currentTask.monitor) {
    currentTask.monitor();
  }
  
  // Load session
  const s = await session.load(currentTask.sessionName);
  
  currentTask.status = 'running';
  currentTask.logFile = `${currentTask.sessionName}-continue.log`;
  
  const result = await s.detached(feedback, {
    logFile: currentTask.logFile,
    stream: true,
    outputFormat: 'stream-json'
  });
  
  if (result.success) {
    if (result.pid) {
      currentTask.pid = result.pid;
      console.log(`${colors.green}✅ Task continued with PID ${result.pid}${colors.reset}`);
    }
    
    // Restart monitoring
    const cleanup = monitorLog(currentTask.logFile, processEvent, {
      onError: (error) => {
        if (currentTask) {
          currentTask.status = 'error';
          currentTask.outputBuffer.push(`❌ Monitor error: ${error.message}`);
        }
      }
    });
    
    currentTask.monitor = cleanup;
  }
}

// Update session content
async function updateSessionContent() {
  if (!currentTask) return;
  
  // Update session content from file
  sessionContent = await readSessionFile(currentTask.sessionPath) || {};
}

// Main loop
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  // Auto-refresh display (session content only)
  const refreshInterval = setInterval(async () => {
    await updateSessionContent();
    await displayUI();
  }, 2000);
  
  // Initial display
  await displayUI();
  
  // Command loop
  rl.on('line', async (input) => {
    const trimmed = input.trim();
    
    if (trimmed.startsWith('/')) {
      const [cmd, ...args] = trimmed.substring(1).split(' ');
      
      switch (cmd) {
        case 'status':
          await updateSessionContent();
          break;
          
        case 'continue':
          if (args.length > 0) {
            await continueTask(args.join(' '));
          } else {
            console.log(`${colors.yellow}Usage: /continue <feedback>${colors.reset}`);
          }
          break;
          
        case 'stop':
          if (currentTask) {
            // Clean up monitor
            if (currentTask.monitor) {
              currentTask.monitor();
            }
            currentTask.status = 'completed';
            console.log(`${colors.yellow}Task stopped${colors.reset}`);
          }
          break;
          
        case 'logs':
          // Show raw events for debugging
          if (currentTask && currentTask.events.length > 0) {
            console.log(`\n${colors.bright}═══ Recent Events ═══${colors.reset}`);
            currentTask.events.slice(-5).forEach(event => {
              console.log(`${colors.dim}${event.type}: ${JSON.stringify(event).substring(0, 100)}...${colors.reset}`);
            });
          }
          break;
          
        case 'quit':
        case 'q':
        case 'exit':
          clearInterval(refreshInterval);
          if (currentTask?.monitor) {
            currentTask.monitor();
          }
          rl.close();
          process.exit(0);
          
        default:
          console.log(`${colors.red}Unknown command: /${cmd}${colors.reset}`);
      }
    } else if (trimmed.length > 0) {
      // Start new task
      await startTask(trimmed);
    }
    
    // Refresh display
    await updateSessionContent();
    await displayUI();
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(refreshInterval);
    if (currentTask?.monitor) {
      currentTask.monitor();
    }
    rl.close();
    process.exit(0);
  });
}

// Example prompts for testing
console.log(`${colors.cyan}Example test prompts:${colors.reset}`);
console.log(`1. "TEST: Calculate 2+2 and then ask if you should continue"`);
console.log(`2. "TEST: List 3 colors, then ask which one to explain"`);
console.log(`3. "TEST: Say hello and immediately finish"\n`);

// Run
main().catch(console.error);