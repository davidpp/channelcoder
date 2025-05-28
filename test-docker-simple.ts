#!/usr/bin/env bun
/**
 * Simple Docker output capture test
 * Tests if we can properly capture stdout/stderr from Docker
 */

import { spawn } from 'child_process';

async function testDockerOutput() {
  console.log('Testing Docker output capture...\n');
  
  // Test 1: Simple echo through Docker
  console.log('--- Test 1: Basic output ---');
  const proc1 = spawn('docker', [
    'run', '--rm', '-i',
    'node:20-slim',
    'node', '-e', 'console.log("Hello from Docker")'
  ]);
  
  proc1.stdout.on('data', (data) => {
    console.log(`STDOUT: ${data.toString().trim()}`);
  });
  
  proc1.stderr.on('data', (data) => {
    console.log(`STDERR: ${data.toString().trim()}`);
  });
  
  await new Promise(resolve => proc1.on('exit', resolve));
  
  // Test 2: Streaming output
  console.log('\n--- Test 2: Streaming output ---');
  const proc2 = spawn('docker', [
    'run', '--rm', '-i',
    'node:20-slim',
    'node', '-e', `
      for (let i = 1; i <= 3; i++) {
        console.log(\`Count: \${i}\`);
        require('child_process').execSync('sleep 0.5');
      }
    `
  ]);
  
  proc2.stdout.on('data', (data) => {
    console.log(`STREAM: ${data.toString().trim()}`);
  });
  
  await new Promise(resolve => proc2.on('exit', resolve));
  
  // Test 3: JSON output
  console.log('\n--- Test 3: JSON output ---');
  const proc3 = spawn('docker', [
    'run', '--rm', '-i',
    'node:20-slim',
    'node', '-e', 'console.log(JSON.stringify({success: true, message: "Docker works!"}))'
  ]);
  
  let jsonOutput = '';
  proc3.stdout.on('data', (data) => {
    jsonOutput += data.toString();
  });
  
  await new Promise(resolve => proc3.on('exit', resolve));
  
  try {
    const parsed = JSON.parse(jsonOutput);
    console.log('Parsed JSON:', parsed);
  } catch (e) {
    console.log('Failed to parse JSON:', e);
  }
  
  // Test 4: Stdin input
  console.log('\n--- Test 4: Stdin input ---');
  const proc4 = spawn('docker', [
    'run', '--rm', '-i',
    'node:20-slim',
    'node', '-e', `
      process.stdin.on('data', (data) => {
        console.log('Received:', data.toString().trim());
      });
    `
  ]);
  
  proc4.stdout.on('data', (data) => {
    console.log(`STDIN TEST: ${data.toString().trim()}`);
  });
  
  proc4.stdin.write('Hello from host!\n');
  proc4.stdin.end();
  
  await new Promise(resolve => proc4.on('exit', resolve));
  
  console.log('\n--- All tests complete ---');
}

testDockerOutput().catch(console.error);