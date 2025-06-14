import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import type { DockerOptions, ResolvedDockerConfig } from './types.js';

/**
 * Manages Docker-specific functionality for Claude execution
 */
export class DockerManager {
  private dockerAvailable?: boolean;

  /**
   * Check if Docker is available on the system
   */
  async checkDockerAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== undefined) {
      return this.dockerAvailable;
    }

    try {
      const result = spawnSync('docker', ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.dockerAvailable = result.status === 0;
      return this.dockerAvailable;
    } catch {
      this.dockerAvailable = false;
      return false;
    }
  }

  /**
   * Resolve Docker configuration with auto-detection
   */
  async resolveDockerConfig(options: boolean | DockerOptions): Promise<ResolvedDockerConfig> {
    // Normalize boolean to options object
    const dockerOpts: DockerOptions = typeof options === 'boolean' ? { auto: true } : options;

    // If manual image specified, use it directly
    if (dockerOpts.image) {
      return {
        mode: 'image',
        image: dockerOpts.image,
        mounts: this.getAllMounts(dockerOpts),
        env: dockerOpts.env || {},
      };
    }

    // Auto-detection is enabled by default
    if (dockerOpts.auto !== false) {
      // Check for Dockerfile
      const dockerfilePath = dockerOpts.dockerfile || './Dockerfile';
      if (existsSync(dockerfilePath)) {
        const imageName = await this.generateImageName(dockerfilePath, dockerOpts.cwd);
        return {
          mode: 'dockerfile',
          image: imageName,
          mounts: this.getAllMounts(dockerOpts),
          env: dockerOpts.env || {},
          needsBuild: true,
          dockerfilePath,
        };
      }
    }

    throw new Error(
      'No Docker configuration found. Please specify an image or create a Dockerfile.'
    );
  }

  /**
   * Build Docker arguments for execution
   */
  buildDockerArgs(config: ResolvedDockerConfig, interactive = false): string[] {
    const args = ['run', '--rm'];

    // Add interactive flags
    if (interactive) {
      args.push('-it');
    } else {
      args.push('-i');
    }

    // Add all volume mounts
    for (const mount of config.mounts) {
      args.push('-v', mount);
    }

    // Set working directory
    args.push('-w', '/workspace');

    // Add environment variables
    for (const [key, value] of Object.entries(config.env)) {
      args.push('-e', `${key}=${value}`);
    }

    // Add the image
    args.push(config.image);

    return args;
  }

  /**
   * Build Docker image if needed
   */
  async buildImage(dockerfilePath: string, imageName: string): Promise<boolean> {
    console.error(`Building Docker image ${imageName} from ${dockerfilePath}...`);

    const result = spawnSync('docker', ['build', '-t', imageName, '-f', dockerfilePath, '.'], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error(`Failed to build Docker image: exit code ${result.status}`);
    }

    return true;
  }

  /**
   * Check if Docker image exists
   */
  async imageExists(imageName: string): Promise<boolean> {
    const result = spawnSync('docker', ['image', 'inspect', imageName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return result.status === 0;
  }

  /**
   * Get all volume mounts
   */
  private getAllMounts(options: DockerOptions): string[] {
    const mounts: string[] = [];

    // Add working directory mount
    const workDir = options.cwd || process.cwd();
    mounts.push(`${workDir}:/workspace:rw`);

    // Add user-specified mounts
    if (options.mounts) {
      mounts.push(...options.mounts);
    }

    return mounts;
  }

  /**
   * Generate a unique image name for a Dockerfile
   */
  private async generateImageName(dockerfilePath: string, cwd?: string): Promise<string> {
    // Use project directory name and dockerfile name
    const projectName = path
      .basename(cwd || process.cwd())
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    const dockerfileName = path.basename(dockerfilePath, path.extname(dockerfilePath));

    // Create a simple hash from the dockerfile path
    const hash = dockerfilePath.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);

    const shortHash = Math.abs(hash).toString(16).substring(0, 6);

    return `channelcoder-${projectName}-${dockerfileName}-${shortHash}`.toLowerCase();
  }
}
