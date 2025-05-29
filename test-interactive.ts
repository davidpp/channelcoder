import { interactive } from './src/index.js';

// Test interactive mode with a simple prompt
interactive("Say 'Hello from interactive mode!' and then exit.", {
  maxTurns: 1
}).then(result => {
  console.log('Interactive session completed with exit code:', result.exitCode);
  process.exit(result.exitCode || 0);
}).catch(error => {
  console.error('Error in interactive mode:', error);
  process.exit(1);
});