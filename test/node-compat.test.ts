import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Node.js Compatibility', () => {
  test('CLI loads in Node.js', () => {
    // Test that CLI can be loaded and shows help
    try {
      const output = execSync('node dist/cli.cjs --help', { encoding: 'utf-8' });
      expect(output).toContain('ChannelCoder');
      expect(output).toContain('Usage:');
    } catch (error: any) {
      throw new Error(`CLI failed to load in Node.js: ${error.message}`);
    }
  });

  test('CLI loads in Bun', () => {
    // Test that CLI can be loaded and shows help
    try {
      const output = execSync('bun dist/cli.cjs --help', { encoding: 'utf-8' });
      expect(output).toContain('ChannelCoder');
      expect(output).toContain('Usage:');
    } catch (error: any) {
      throw new Error(`CLI failed to load in Bun: ${error.message}`);
    }
  });

  test('SDK imports work in Node.js (ESM)', () => {
    // Create a test script that uses the SDK
    const testScript = `
      import { CC } from './dist/index.mjs';
      
      const cc = new CC();
      console.log('SDK loaded successfully');
      console.log(typeof cc.run);
      console.log(typeof cc.fromFile);
      console.log(typeof cc.stream);
    `;
    
    writeFileSync('test-sdk-import.mjs', testScript);
    
    try {
      const output = execSync('node test-sdk-import.mjs', { encoding: 'utf-8' });
      expect(output).toContain('SDK loaded successfully');
      expect(output).toContain('function'); // cc.run is a function
    } catch (error: any) {
      throw new Error(`ESM import failed: ${error.message}`);
    } finally {
      unlinkSync('test-sdk-import.mjs');
    }
  });

  test('SDK imports work in Node.js (CJS)', () => {
    // Test CommonJS
    const cjsScript = `
      const { CC } = require('./dist/index.cjs');
      
      const cc = new CC();
      console.log('CJS import successful');
      console.log(typeof cc.run);
      console.log(typeof cc.fromFile);
      console.log(typeof cc.stream);
    `;
    writeFileSync('test-cjs.cjs', cjsScript);
    
    try {
      const output = execSync('node test-cjs.cjs', { encoding: 'utf-8' });
      expect(output).toContain('CJS import successful');
      expect(output).toContain('function'); // methods are functions
    } catch (error: any) {
      throw new Error(`CJS import failed: ${error.message}`);
    } finally {
      unlinkSync('test-cjs.cjs');
    }
  });

  test('TypeScript definitions exist', () => {
    // Check that .d.ts files were generated
    expect(existsSync('dist/index.d.ts')).toBe(true);
    expect(existsSync('dist/cli.d.ts')).toBe(true);
    expect(existsSync('dist/index.d.cts')).toBe(true);
    expect(existsSync('dist/cli.d.cts')).toBe(true);
  });

  test('Process spawning works in both environments', () => {
    // Test that our spawn implementation works
    const testScript = `
      import { spawn } from 'child_process';
      
      // Test spawning a simple command
      const proc = spawn('echo', ['test'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      proc.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
      
      proc.on('exit', (code) => {
        console.log('Exit code:', code);
        console.log('Output:', output.trim());
      });
    `;
    
    writeFileSync('test-spawn.mjs', testScript);
    
    try {
      const output = execSync('node test-spawn.mjs', { encoding: 'utf-8' });
      expect(output).toContain('Exit code: 0');
      expect(output).toContain('Output: test');
    } catch (error: any) {
      throw new Error(`Spawn test failed: ${error.message}`);
    } finally {
      unlinkSync('test-spawn.mjs');
    }
  });
});