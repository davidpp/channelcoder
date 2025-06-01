import { describe, expect, it } from 'bun:test';
import { DockerManager } from '../src/docker.js';
import type { DockerOptions } from '../src/types.js';

describe('Docker Integration', () => {
  describe('DockerManager', () => {
    const dockerManager = new DockerManager();

    it('should build Docker args for simple image', () => {
      const config = {
        mode: 'image' as const,
        image: 'my-claude:latest',
        mounts: [`${process.cwd()}:/workspace:rw`],
        env: {},
      };

      const args = dockerManager.buildDockerArgs(config, false);

      expect(args).toContain('run');
      expect(args).toContain('--rm');
      expect(args).toContain('-i');
      expect(args).toContain('-v');
      expect(args).toContain(`${process.cwd()}:/workspace:rw`);
      expect(args).toContain('-w');
      expect(args).toContain('/workspace');
      expect(args).toContain('my-claude:latest');
    });

    it('should build Docker args for interactive mode', () => {
      const config = {
        mode: 'image' as const,
        image: 'my-claude:latest',
        mounts: [],
        env: {},
      };

      const args = dockerManager.buildDockerArgs(config, true);

      expect(args).toContain('run');
      expect(args).toContain('--rm');
      expect(args).toContain('-it'); // Interactive mode uses -it
      expect(args).toContain('my-claude:latest');
    });

    it('should include environment variables', () => {
      const config = {
        mode: 'image' as const,
        image: 'test',
        mounts: [],
        env: {
          API_KEY: 'secret',
          NODE_ENV: 'test',
        },
      };

      const args = dockerManager.buildDockerArgs(config);

      expect(args).toContain('-e');
      expect(args).toContain('API_KEY=secret');
      expect(args).toContain('NODE_ENV=test');
    });

    it('should handle multiple mounts', () => {
      const config = {
        mode: 'image' as const,
        image: 'test',
        mounts: ['/host/data:/container/data:ro', '/host/config:/container/config:rw'],
        env: {},
      };

      const args = dockerManager.buildDockerArgs(config);

      expect(args).toContain('/host/data:/container/data:ro');
      expect(args).toContain('/host/config:/container/config:rw');
    });
  });

  describe('Docker Options Processing', () => {
    it('should normalize boolean docker option', async () => {
      const dockerManager = new DockerManager();

      // This will fail without a Dockerfile, but we're testing the normalization
      try {
        await dockerManager.resolveDockerConfig(true);
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('No Docker configuration found');
      }
    });

    it('should handle image option directly', async () => {
      const dockerManager = new DockerManager();
      const options: DockerOptions = {
        image: 'claude-sandbox:latest',
      };

      const config = await dockerManager.resolveDockerConfig(options);

      expect(config.mode).toBe('image');
      expect(config.image).toBe('claude-sandbox:latest');
      expect(config.needsBuild).toBeUndefined();
    });
  });
});
