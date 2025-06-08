import type { InterpolationData } from '../types.js';

/**
 * Parse key=value data arguments
 */
export async function parseDataArgs(dataArgs: string[]): Promise<InterpolationData> {
  const data: InterpolationData = {};

  for (const arg of dataArgs) {
    const [key, ...valueParts] = arg.split('=');
    const value = valueParts.join('=');

    if (!key) continue;

    // Try to parse as JSON first
    try {
      data[key] = JSON.parse(value);
    } catch {
      // Smart type conversion
      if (value === 'true') data[key] = true;
      else if (value === 'false') data[key] = false;
      else if (value === 'null') data[key] = null;
      else if (value === 'undefined') data[key] = undefined;
      else if (/^-?\d+$/.test(value)) data[key] = Number.parseInt(value, 10);
      else if (/^-?\d+\.\d+$/.test(value)) data[key] = Number.parseFloat(value);
      else data[key] = value;
    }
  }

  return data;
}

/**
 * Read JSON from stdin
 */
export async function readStdinJson(): Promise<InterpolationData> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(input);
}

/**
 * Parse tool list from CLI input
 */
export function parseTools(toolString: string): string[] {
  if (toolString.includes(',')) {
    return toolString.split(',').map((t) => t.trim());
  } else {
    return toolString.split(/\s+/).filter((t) => t);
  }
}

/**
 * Parse Docker environment variables
 */
export function parseDockerEnv(envArgs: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const envVar of envArgs) {
    const [key, ...valueParts] = envVar.split('=');
    if (key) {
      env[key] = valueParts.join('=');
    }
  }
  return env;
}

/**
 * Format session list for display
 */
export function formatSessionList(
  sessions: Array<{
    name: string;
    messageCount: number;
    lastActive: Date;
  }>,
  format: 'table' | 'json' | 'simple' = 'table'
): string {
  if (format === 'json') {
    return JSON.stringify(sessions, null, 2);
  }

  if (sessions.length === 0) {
    return 'No saved sessions found.';
  }

  if (format === 'simple') {
    return sessions.map((s) => s.name).join('\n');
  }

  // Table format
  let output = 'Saved sessions:\n';
  for (const sess of sessions) {
    output += `  ${sess.name} - ${sess.messageCount} messages (last active: ${sess.lastActive.toLocaleDateString()})\n`;
  }
  return output;
}

/**
 * Format worktree list for display
 */
export function formatWorktreeList(
  worktrees: Array<{
    branch: string;
    path: string;
    commit?: string;
  }>,
  format: 'table' | 'json' | 'simple' = 'table'
): string {
  if (format === 'json') {
    return JSON.stringify(worktrees, null, 2);
  }

  if (worktrees.length === 0) {
    return 'No git worktrees found.';
  }

  if (format === 'simple') {
    return worktrees.map((w) => w.branch).join('\n');
  }

  // Table format
  let output = 'Git worktrees:\n';
  for (const wt of worktrees) {
    output += `  ${wt.branch} - ${wt.path}`;
    if (wt.commit) {
      output += ` (${wt.commit.substring(0, 7)})`;
    }
    output += '\n';
  }
  return output;
}
