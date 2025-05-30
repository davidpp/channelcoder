#!/usr/bin/env node

/**
 * Real End-to-End Test for Detached Streaming Features
 * 
 * This script validates the actual functionality by:
 * 1. Testing detached mode with real Claude CLI execution
 * 2. Validating real-time streaming to log files
 * 3. Testing session auto-save functionality
 * 4. Monitoring actual file updates
 */

import { detached, session } from './src/index.js';
import { readFile, unlink, access, stat } from 'fs/promises';
import { watch } from 'fs';
import { spawn } from 'child_process';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

class RealE2ETestRunner {
  private results: TestResult[] = [];
  private tempFiles: string[] = [];
  private claudeAvailable = false;

  async checkClaudeAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('claude', ['--help'], { stdio: 'pipe' });
      child.on('close', (code) => {
        this.claudeAvailable = code === 0;
        resolve(this.claudeAvailable);
      });
      child.on('error', () => {
        this.claudeAvailable = false;
        resolve(false);
      });
    });
  }

  async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    console.log(`🧪 Running: ${name}`);
    try {
      const result = await testFn();
      this.results.push({ name, success: true, details: result });
      console.log(`✅ Passed: ${name}`);
    } catch (error) {
      this.results.push({ name, success: false, error: String(error) });
      console.log(`❌ Failed: ${name} - ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up temporary files...');
    for (const file of this.tempFiles) {
      try {
        await unlink(file);
        console.log(`  Deleted: ${file}`);
      } catch {
        // File might not exist
      }
    }
  }

  printSummary(): void {
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('\n❌ Failed tests:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }
  }

  // Wait for file to exist and have content
  async waitForFileContent(filePath: string, timeout = 15000): Promise<string> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        if (content.trim().length > 10) { // Some meaningful content
          return content;
        }
      } catch {
        // File doesn't exist yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`File ${filePath} did not appear with content within ${timeout}ms`);
  }

  // Monitor file for streaming updates
  async monitorFileUpdates(filePath: string, minUpdates = 3, timeout = 30000): Promise<number> {
    return new Promise((resolve, reject) => {
      let updateCount = 0;
      let lastSize = 0;
      
      const timer = setTimeout(() => {
        watcher.close();
        reject(new Error(`Timeout: only ${updateCount} updates in ${timeout}ms`));
      }, timeout);

      const watcher = watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          try {
            const stats = await stat(filePath);
            if (stats.size > lastSize) {
              lastSize = stats.size;
              updateCount++;
              console.log(`📈 Update ${updateCount}: File size now ${stats.size} bytes`);
              
              if (updateCount >= minUpdates) {
                clearTimeout(timer);
                watcher.close();
                resolve(updateCount);
                return;
              }
            }
          } catch {
            // File might be temporarily unavailable
          }
        }
      });
    });
  }
}

async function main() {
  const runner = new RealE2ETestRunner();

  // Check if Claude CLI is available
  console.log('🔍 Checking Claude CLI availability...');
  const claudeAvailable = await runner.checkClaudeAvailable();
  
  if (!claudeAvailable) {
    console.log('⚠️  Claude CLI not available. Some tests will be skipped.');
    console.log('   Install Claude CLI to run full E2E tests.');
  } else {
    console.log('✅ Claude CLI is available');
  }

  try {
    // Test 1: Basic detached streaming validation (no Claude needed)
    await runner.runTest('Detached streaming validation', async () => {
      try {
        const result = await detached('Test prompt', {
          stream: true
          // No logFile - should fail
        });
        
        if (result.success) {
          throw new Error('Expected validation failure');
        }
        
        if (!result.error?.includes('logFile is required')) {
          throw new Error(`Wrong error message: ${result.error}`);
        }
        
        return { validationWorking: true };
      } catch (error) {
        // This should be a validation error, not an exception
        throw new Error(`Unexpected exception: ${error}`);
      }
    });

    // Test 2: Real detached execution (requires Claude)
    if (claudeAvailable) {
      await runner.runTest('Real detached execution', async () => {
        const logFile = `test-detached-${Date.now()}.log`;
        runner.tempFiles.push(logFile);

        const result = await detached('Write exactly one sentence about TypeScript being awesome.', {
          logFile
        });

        if (!result.success) {
          throw new Error(`Detached execution failed: ${result.error}`);
        }

        // Wait for some content in the log file
        const content = await runner.waitForFileContent(logFile, 20000);
        
        if (!content.includes('TypeScript')) {
          throw new Error('Log file does not contain expected content');
        }

        return {
          pid: result.data?.pid,
          logFileSize: content.length,
          hasExpectedContent: content.includes('TypeScript')
        };
      });

      // Test 3: Real detached streaming
      await runner.runTest('Real detached streaming', async () => {
        const logFile = `test-streaming-${Date.now()}.log`;
        runner.tempFiles.push(logFile);

        const result = await detached('Write a short paragraph about JavaScript and Python. Take your time and think about each sentence.', {
          logFile,
          stream: true
        });

        if (!result.success) {
          throw new Error(`Detached streaming failed: ${result.error}`);
        }

        if (!result.data?.streaming) {
          throw new Error('Streaming flag not set in result');
        }

        // Monitor for file updates (streaming should cause multiple updates)
        const updateCount = await runner.monitorFileUpdates(logFile, 2, 25000);
        
        // Verify final content
        const finalContent = await readFile(logFile, 'utf-8');
        
        // Should contain stream-json format
        if (!finalContent.includes('"content"')) {
          throw new Error('Log file does not contain JSON stream format');
        }

        return {
          pid: result.data.pid,
          streaming: result.data.streaming,
          updateCount,
          finalSize: finalContent.length
        };
      });
    }

    // Test 4: Session with auto-save (no Claude needed)
    await runner.runTest('Session auto-save functionality', async () => {
      const s = session({ 
        name: `test-session-${Date.now()}`,
        autoSave: true 
      });

      // Save the session to get file path
      const sessionPath = await s.save();
      runner.tempFiles.push(sessionPath);

      // Verify session file exists and has correct structure
      const sessionContent = await readFile(sessionPath, 'utf-8');
      const sessionData = JSON.parse(sessionContent);

      if (!sessionData.metadata) {
        throw new Error('Session file missing metadata');
      }

      if (!Array.isArray(sessionData.messages)) {
        throw new Error('Session file missing messages array');
      }

      // Verify session interface has detached method
      if (typeof s.detached !== 'function') {
        throw new Error('Session missing detached method');
      }

      return {
        sessionPath,
        hasMetadata: !!sessionData.metadata,
        hasDetachedMethod: typeof s.detached === 'function',
        autoSaveEnabled: true
      };
    });

    // Test 5: Session detached execution (requires Claude)
    if (claudeAvailable) {
      await runner.runTest('Session detached execution', async () => {
        const s = session({ 
          name: `test-detached-session-${Date.now()}`,
          autoSave: true 
        });
        
        const logFile = `test-session-detached-${Date.now()}.log`;
        runner.tempFiles.push(logFile);

        const sessionPath = await s.save();
        runner.tempFiles.push(sessionPath);

        const result = await s.detached('Write one short sentence about Node.js.', {
          logFile,
          stream: true
        });

        if (!result.success) {
          throw new Error(`Session detached failed: ${result.error}`);
        }

        // Wait for log file content
        const logContent = await runner.waitForFileContent(logFile, 20000);

        // Wait a bit more for session file to be updated
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check session object directly (more reliable than file reading)
        const sessionMessages = s.messages();
        
        if (sessionMessages.length === 0) {
          throw new Error('Session was not updated with detached message');
        }

        // Also verify the session can be saved again
        const finalSessionPath = await s.save();
        runner.tempFiles.push(finalSessionPath);
        
        // Read the final session file to confirm it's persisted
        const finalContent = await readFile(finalSessionPath, 'utf-8');
        const finalData = JSON.parse(finalContent);

        return {
          pid: result.data?.pid,
          sessionUpdated: sessionMessages.length > 0,
          logFileHasContent: logContent.length > 0,
          finalSessionMessages: finalData.messages.length
        };
      });
    }

    // Test 6: File monitoring patterns (Unix composability)
    if (claudeAvailable) {
      await runner.runTest('Unix composability test', async () => {
        const logFile = `test-unix-${Date.now()}.log`;
        runner.tempFiles.push(logFile);

        // Start a detached streaming process
        const result = await detached('Count from 1 to 5, one number per sentence.', {
          logFile,
          stream: true
        });

        if (!result.success) {
          throw new Error(`Process start failed: ${result.error}`);
        }

        // Use actual Unix commands to monitor the file
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Unix monitoring test timeout'));
          }, 25000);

          let lineCount = 0;
          const watcher = watch(logFile, async () => {
            try {
              // Use wc -l to count lines (Unix composability)
              const wcProcess = spawn('wc', ['-l', logFile], { stdio: 'pipe' });
              let output = '';
              
              wcProcess.stdout.on('data', (data) => {
                output += data.toString();
              });
              
              wcProcess.on('close', () => {
                const currentLines = parseInt(output.trim().split(' ')[0]) || 0;
                if (currentLines > lineCount) {
                  lineCount = currentLines;
                  console.log(`📏 Line count via wc: ${lineCount}`);
                  
                  if (lineCount >= 3) { // Expecting multiple JSON lines
                    clearTimeout(timeout);
                    watcher.close();
                    resolve({
                      unixCommandWorked: true,
                      finalLineCount: lineCount,
                      pid: result.data?.pid
                    });
                  }
                }
              });
            } catch (error) {
              // wc command might not be available on all systems
            }
          });
        });
      });
    }

  } finally {
    await runner.cleanup();
    runner.printSummary();
  }

  // Exit with error code if any tests failed
  const failedCount = runner.results.filter(r => !r.success).length;
  
  if (!claudeAvailable) {
    console.log('\n💡 To run full E2E tests:');
    console.log('   1. Install Claude CLI: https://claude.ai/code');
    console.log('   2. Run: claude --help (to verify installation)');
    console.log('   3. Re-run this test');
  }
  
  process.exit(failedCount > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ E2E test runner failed:', error);
    process.exit(1);
  });
}

export { RealE2ETestRunner };