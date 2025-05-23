import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
  // Ensure proper extensions for Node.js compatibility
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
  // External dependencies that shouldn't be bundled
  external: ['commander', 'gray-matter', 'zod'],
  // Ensure Node.js compatibility
  platform: 'node',
  target: 'node18',
  // We'll handle shebang differently since tsup doesn't support conditional banners
});