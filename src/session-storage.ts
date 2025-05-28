import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { SessionInfo, SessionState, SessionStorage } from './session.js';

/**
 * File-based session storage implementation
 */
export class FileSessionStorage implements SessionStorage {
  private basePath: string;

  constructor(basePath?: string) {
    // Default to .channelcoder/sessions in home directory
    this.basePath = basePath || join(homedir(), '.channelcoder', 'sessions');
  }

  /**
   * Ensure directory exists
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory might already exist, ignore
    }
  }

  /**
   * Save session state to file
   */
  async save(state: SessionState, name?: string): Promise<string> {
    await this.ensureDir(this.basePath);

    // Generate filename
    const filename = name
      ? name.endsWith('.json')
        ? name
        : `${name}.json`
      : `session-${Date.now()}.json`;

    const filepath = join(this.basePath, filename);

    // Save state as JSON
    await fs.writeFile(filepath, JSON.stringify(state, null, 2), 'utf-8');

    return filepath;
  }

  /**
   * Load session state from file
   */
  async load(nameOrPath: string): Promise<SessionState> {
    let filepath: string;

    // Handle both names and full paths
    if (nameOrPath.includes('/') || nameOrPath.includes('\\')) {
      // Full path provided
      filepath = nameOrPath;
    } else {
      // Just a name, look in base path
      const filename = nameOrPath.endsWith('.json') ? nameOrPath : `${nameOrPath}.json`;
      filepath = join(this.basePath, filename);
    }

    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const state = JSON.parse(data) as SessionState;

      // Convert date strings back to Date objects
      state.metadata.created = new Date(state.metadata.created);
      state.metadata.lastActive = new Date(state.metadata.lastActive);
      for (const msg of state.messages) {
        msg.timestamp = new Date(msg.timestamp);
      }

      return state;
    } catch (error) {
      throw new Error(`Failed to load session from ${filepath}: ${error}`);
    }
  }

  /**
   * List all saved sessions
   */
  async list(): Promise<SessionInfo[]> {
    await this.ensureDir(this.basePath);

    const files = await fs.readdir(this.basePath);
    const sessions: SessionInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = join(this.basePath, file);

      try {
        const data = await fs.readFile(filepath, 'utf-8');
        const state = JSON.parse(data) as SessionState;

        sessions.push({
          name: state.metadata.name || basename(file, '.json'),
          path: filepath,
          created: new Date(state.metadata.created),
          lastActive: new Date(state.metadata.lastActive),
          messageCount: state.messages.length,
        });
      } catch (error) {
        // Skip invalid session files
        console.warn(`Skipping invalid session file ${file}:`, error);
      }
    }

    // Sort by last active date (newest first)
    sessions.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());

    return sessions;
  }

  /**
   * Delete a session file
   */
  async delete(nameOrPath: string): Promise<void> {
    let filepath: string;

    if (nameOrPath.includes('/') || nameOrPath.includes('\\')) {
      filepath = nameOrPath;
    } else {
      const filename = nameOrPath.endsWith('.json') ? nameOrPath : `${nameOrPath}.json`;
      filepath = join(this.basePath, filename);
    }

    await fs.unlink(filepath);
  }

  /**
   * Check if a session exists
   */
  async exists(name: string): Promise<boolean> {
    const filename = name.endsWith('.json') ? name : `${name}.json`;
    const filepath = join(this.basePath, filename);

    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}
