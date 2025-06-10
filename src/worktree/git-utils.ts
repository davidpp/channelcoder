import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * Check if a directory is inside a git worktree
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns true if in a worktree, false if in main repo
 */
export async function isInWorktree(cwd?: string): Promise<boolean> {
  const git = simpleGit(cwd);
  try {
    const [gitDir, gitCommonDir] = await git
      .raw(['rev-parse', '--git-dir', '--git-common-dir'])
      .then((r) => r.trim().split('\n'));

    // In main repo, these are equal
    // In worktree, git-dir points to .git/worktrees/name
    return gitDir !== gitCommonDir;
  } catch {
    // Not a git repository
    return false;
  }
}

/**
 * Find the main repository root from any location
 * @param cwd - Directory to start from (defaults to process.cwd())
 * @returns absolute path to the main repository root
 * @throws Error if not in a git repository
 */
export async function findMainRepository(cwd?: string): Promise<string> {
  const git = simpleGit(cwd);
  try {
    // Get the common git directory (always points to main repo's .git)
    const gitCommonDir = await git.raw(['rev-parse', '--git-common-dir']).then((r) => r.trim());

    // If it ends with /.git, remove it to get repo root
    if (gitCommonDir.endsWith('/.git')) {
      return gitCommonDir.slice(0, -5);
    }

    // For bare repos or edge cases, get the toplevel of the main repo
    // First check if we're in a worktree
    const inWorktree = await isInWorktree(cwd);
    if (inWorktree) {
      // We need to find the main repo from the git-common-dir
      // Parse the first worktree in the list (which is always the main repo)
      const worktrees = await git.raw(['worktree', 'list', '--porcelain']);
      const lines = worktrees.split('\n');
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          return line.substring(9); // Return first worktree path (main repo)
        }
      }
    }

    // If we're in the main repo, just return the toplevel
    return await git.raw(['rev-parse', '--show-toplevel']).then((r) => r.trim());
  } catch (error) {
    throw new Error(`Not in a git repository: ${cwd || process.cwd()}`);
  }
}

/**
 * Get git instance for the main repository
 * @param cwd - Directory to start from (defaults to process.cwd())
 * @returns git instance and the main repository root path
 */
export async function getMainRepoGit(cwd?: string): Promise<{ git: SimpleGit; root: string }> {
  const root = await findMainRepository(cwd);
  return { git: simpleGit(root), root };
}