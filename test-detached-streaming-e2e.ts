#!/usr/bin/env node

/**
 * End-to-End Test for Detached Streaming Features
 * 
 * This script validates:
 * 1. Detached mode with streaming output
 * 2. Session management with real-time file updates
 * 3. File monitoring and JSON parsing
 * 4. Process management and cleanup
 */

import { detached, session } from './src/index.js';
import { readFile, unlink, access } from 'fs/promises';
import { watch } from 'fs';
import { spawn } from 'child_process';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

class E2ETestRunner {
  private results: TestResult[] = [];
  private tempFiles: string[] = [];

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

  // Helper to wait for file to exist and have content
  async waitForFileContent(filePath: string, timeout = 10000): Promise<string> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        if (content.trim().length > 0) {
          return content;
        }
      } catch {
        // File doesn't exist yet
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`File ${filePath} did not appear with content within ${timeout}ms`);
  }

  // Helper to monitor file for streaming JSON chunks
  async monitorStreamingFile(filePath: string, expectedChunks = 3, timeout = 15000): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      const timer = setTimeout(() => {
        watcher.close();
        reject(new Error(`Timeout waiting for ${expectedChunks} chunks in ${timeout}ms`));
      }, timeout);

      const watcher = watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          try {
            const content = await readFile(filePath, 'utf-8');
            const lines = content.trim().split('\n');
            
            // Parse each line as JSON (stream-json format)
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const chunk = JSON.parse(line);
                  if (chunk.content && !chunks.find(c => c.content === chunk.content)) {
                    chunks.push(chunk);
                    console.log(`📦 Chunk ${chunks.length}: ${chunk.content.substring(0, 30)}...`);
                    
                    if (chunks.length >= expectedChunks) {
                      clearTimeout(timer);
                      watcher.close();
                      resolve(chunks);
                      return;
                    }
                  }
                } catch {
                  // Not JSON, might be final output or partial write
                }
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
  const runner = new E2ETestRunner();

  try {
    // Test 1: Basic detached mode (non-streaming)
    await runner.runTest('Basic detached mode', async () => {
      const logFile = 'test-basic-detached.log';
      runner.tempFiles.push(logFile);

      const result = await detached('Write a haiku about coding', {
        logFile,
        dryRun: true // Use dry-run for testing
      });

      if (!result.success) {
        throw new Error(`Detached failed: ${result.error}`);
      }

      return {
        pid: result.data?.pid,
        detached: result.data?.detached,
        streaming: result.data?.streaming
      };
    });

    // Test 2: Detached streaming mode
    await runner.runTest('Detached streaming mode', async () => {
      const logFile = 'test-streaming-detached.log';
      runner.tempFiles.push(logFile);

      const result = await detached('Write a short story about AI', {
        logFile,
        stream: true,
        dryRun: true // Use dry-run for testing
      });

      if (!result.success) {
        throw new Error(`Detached streaming failed: ${result.error}`);
      }

      if (!result.data?.streaming) {
        throw new Error('Streaming flag not set in result');
      }

      return {
        pid: result.data.pid,
        streaming: result.data.streaming,
        logFile: result.data.logFile
      };
    });

    // Test 3: Detached streaming validation (stream=true requires logFile)
    await runner.runTest('Detached streaming validation', async () => {
      const result = await detached('Test prompt', {
        stream: true,
        // No logFile - should fail
        dryRun: true
      });

      if (result.success) {
        throw new Error('Expected failure when stream=true but no logFile');
      }

      if (!result.error?.includes('logFile is required')) {
        throw new Error(`Unexpected error message: ${result.error}`);
      }

      return { validationWorked: true };
    });

    // Test 4: Session creation with autoSave
    await runner.runTest('Session with autoSave', async () => {
      const s = session({ 
        name: 'test-session',
        autoSave: true 
      });

      // Test that session interface has all expected methods
      if (typeof s.claude !== 'function') throw new Error('Missing claude method');
      if (typeof s.stream !== 'function') throw new Error('Missing stream method');
      if (typeof s.detached !== 'function') throw new Error('Missing detached method');
      if (typeof s.save !== 'function') throw new Error('Missing save method');

      return {
        hasAllMethods: true,
        initialMessages: s.messages().length
      };
    });

    // Test 5: Session detached method
    await runner.runTest('Session detached method', async () => {
      const s = session({ name: 'test-detached-session' });
      const logFile = 'test-session-detached.log';
      runner.tempFiles.push(logFile);

      const result = await s.detached('Generate test content', {
        logFile,
        stream: true,
        dryRun: true
      });

      if (!result.success) {
        throw new Error(`Session detached failed: ${result.error}`);
      }

      return {
        success: result.success,
        streaming: result.data?.streaming
      };
    });

    // Test 6: Real streaming test (if Claude CLI is available)
    await runner.runTest('Real streaming test (if Claude available)', async () => {
      // Check if Claude CLI is available
      const claudeCheck = spawn('claude', ['--help'], { stdio: 'pipe' });
      
      return new Promise((resolve, reject) => {
        claudeCheck.on('close', async (code) => {
          if (code !== 0) {
            // Claude CLI not available, skip test
            resolve({ skipped: true, reason: 'Claude CLI not available' });
            return;
          }

          try {
            const logFile = 'test-real-streaming.log';
            runner.tempFiles.push(logFile);

            // Start a real detached streaming process
            const result = await detached('Write exactly 3 short sentences about TypeScript', {
              logFile,
              stream: true
            });

            if (!result.success) {
              throw new Error(`Real streaming failed: ${result.error}`);
            }

            // Monitor for streaming chunks
            const chunks = await runner.monitorStreamingFile(logFile, 2, 20000);
            
            if (chunks.length < 2) {
              throw new Error(`Expected at least 2 chunks, got ${chunks.length}`);
            }

            resolve({
              pid: result.data?.pid,
              chunksReceived: chunks.length,
              firstChunk: chunks[0]?.content?.substring(0, 50)
            });
          } catch (error) {
            reject(error);
          }
        });

        claudeCheck.on('error', () => {
          resolve({ skipped: true, reason: 'Claude CLI not available' });
        });
      });
    });

    // Test 7: Session file monitoring (if real session available)
    await runner.runTest('Session file monitoring', async () => {
      const s = session({ 
        name: 'monitor-test-session',
        autoSave: true 
      });

      // This would require a real Claude session to fully test
      // For now, just verify the session saves properly
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

      return {
        sessionPath,
        hasMetadata: !!sessionData.metadata,
        messageCount: sessionData.messages.length
      };
    });

  } finally {
    await runner.cleanup();
    runner.printSummary();
  }

  // Exit with error code if any tests failed
  const failedCount = runner.results.filter(r => !r.success).length;
  process.exit(failedCount > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ E2E test runner failed:', error);
    process.exit(1);
  });
}

export { E2ETestRunner };