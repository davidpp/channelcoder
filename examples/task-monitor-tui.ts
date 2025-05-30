#!/usr/bin/env bun

import { session } from '../src/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import * as readline from 'readline';
import { homedir } from 'os';

// Task state
interface TaskState {
  sessionName: string;
  status: 'idle' | 'running' | 'waiting_feedback' | 'completed';
  pid?: number;
  logFile?: string;
  sessionPath: string;
  lastUpdate: Date;
  outputBuffer: string[];
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

// Read last lines from log file
async function readLogTail(logFile: string, lines: number = 10): Promise<string[]> {
  try {
    const content = await fs.readFile(logFile, 'utf-8');
    const allLines = content.split('\n').filter(Boolean);
    const lastLines = allLines.slice(-lines);
    
    // Parse JSON chunks to extract content
    return lastLines.map(line => {
      try {
        const chunk = JSON.parse(line);
        if (chunk.content) return chunk.content;
        if (chunk.error) return `❌ ${chunk.error}`;
        return line;
      } catch {
        return line;
      }
    });
  } catch {
    return [];
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
      completed: '✅'
    }[currentTask.status];
    
    const statusColor = {
      idle: colors.dim,
      running: colors.blue,
      waiting_feedback: colors.yellow,
      completed: colors.green
    }[currentTask.status];
    
    console.log(`${statusIcon} Status: ${statusColor}${currentTask.status}${colors.reset}`);
    console.log(`📁 Session: ${colors.cyan}${currentTask.sessionName}${colors.reset}`);
    if (currentTask.pid) {
      console.log(`🔧 PID: ${currentTask.pid}`);
    }
    console.log(`⏰ Last Update: ${currentTask.lastUpdate.toLocaleTimeString()}`);
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
  console.log(`  ${colors.red}/stop${colors.reset} - Stop current task`);
  console.log(`  ${colors.dim}/quit${colors.reset} - Exit`);
  console.log(`\n> `);
}

// Start a new task
async function startTask(prompt: string) {
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
    outputBuffer: []
  };
  
  // Start detached process
  console.log(`${colors.yellow}Starting detached process...${colors.reset}`);
  
  try {
    const result = await s.detached(prompt, {
      logFile: currentTask.logFile,
      stream: true,
      outputFormat: 'stream-json'
    });
    
    console.log(`Result:`, result);
    
    if (result.success) {
      if (result.pid) {
        currentTask.pid = result.pid;
        console.log(`${colors.green}✅ Task started with PID ${result.pid}${colors.reset}`);
      } else if (result.detached) {
        console.log(`${colors.green}✅ Task started in detached mode${colors.reset}`);
      }
      console.log(`Log file: ${currentTask.logFile}`);
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
  
  // Load session
  const s = await session.load(currentTask.sessionName);
  
  currentTask.status = 'running';
  currentTask.logFile = `${currentTask.sessionName}-continue.log`;
  
  const result = await s.detached(feedback, {
    logFile: currentTask.logFile,
    stream: true,
    outputFormat: 'stream-json'
  });
  
  if (result.success && result.pid) {
    currentTask.pid = result.pid;
    console.log(`${colors.green}✅ Task continued with PID ${result.pid}${colors.reset}`);
  }
}

// Check task status
async function updateTaskStatus() {
  if (!currentTask || !currentTask.logFile) return;
  
  // Check if log file exists
  if (!existsSync(currentTask.logFile)) {
    console.log(`${colors.dim}Waiting for log file: ${currentTask.logFile}${colors.reset}`);
    return;
  }
  
  // Update output buffer
  const newLines = await readLogTail(currentTask.logFile, 20);
  currentTask.outputBuffer = newLines;
  currentTask.lastUpdate = new Date();
  
  // Update session content
  sessionContent = await readSessionFile(currentTask.sessionPath) || {};
  
  // Check if waiting for feedback
  if (currentTask.status === 'running') {
    const lastLines = newLines.join('\n').toLowerCase();
    if (lastLines.includes('feedback') || lastLines.includes('should i') || lastLines.includes('please confirm')) {
      currentTask.status = 'waiting_feedback';
    } else if (existsSync(currentTask.logFile)) {
      try {
        const content = await fs.readFile(currentTask.logFile, 'utf-8');
        if (content.includes('"type":"result"')) {
          currentTask.status = 'completed';
        }
      } catch {}
    }
  }
}

// Main loop
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  // Auto-refresh
  const refreshInterval = setInterval(async () => {
    await updateTaskStatus();
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
          await updateTaskStatus();
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
            // In real implementation, would kill the process
            currentTask.status = 'completed';
            console.log(`${colors.yellow}Task stopped${colors.reset}`);
          }
          break;
          
        case 'quit':
        case 'q':
        case 'exit':
          clearInterval(refreshInterval);
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
    await updateTaskStatus();
    await displayUI();
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(refreshInterval);
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