# Worktree SDK Architecture

## Overview

This document defines the git worktree management architecture for ChannelCoder. The design follows the same composable, Unix-like philosophy as other SDK features, treating worktrees as isolated workspaces that can be seamlessly integrated with sessions, Docker, streaming, and templates.

## Design Principles

### 1. **Simple by Default**
```typescript
// Just works - auto-detects branch and creates worktree if needed
await claude('Implement feature X', { worktree: 'feature/auth' });
```

### 2. **Progressive Enhancement**
```typescript
// Start simple
await claude('Fix bug', { worktree: 'hotfix/memory-leak' });

// Add configuration as needed
await worktree('feature/complex', async (wt) => {
  await claude('Implement part 1');
  await claude('Add tests');
  return wt.info;
}, { base: 'develop', cleanup: false });
```

### 3. **Composable Functions**
- Standalone `worktree()` function for complex workflows
- Option-based integration with existing functions
- Utility functions for advanced use cases
- No hidden magic or implicit state

### 4. **Upsert Behavior**
- Create worktree if it doesn't exist
- Use existing worktree if it does
- Handle edge cases gracefully
- Maintain clean separation between branches

## Architecture Components

### WorktreeManager (`src/worktree/manager.ts`)

Handles git worktree operations using simple-git:
- **Auto-detection**: Find existing worktrees for branches
- **Upsert logic**: Create or reuse worktrees intelligently
- **Path management**: Generate logical paths for worktrees
- **Cleanup handling**: Remove worktrees when appropriate

```typescript
class WorktreeManager {
  async ensureWorktree(branch: string, options?: WorktreeOptions): Promise<WorktreeInfo>
  async findExistingWorktree(branch: string): Promise<WorktreeInfo | null>
  async listWorktrees(): Promise<WorktreeInfo[]>
  async removeWorktree(path: string, force?: boolean): Promise<void>
  async executeInWorktree<T>(worktree: WorktreeInfo, fn: () => Promise<T>): Promise<T>
}
```

### Process Integration (`src/process.ts`)

Extends CCProcess with worktree-aware execution:
- `executeInWorktree()`: Runs commands in specific worktree
- `streamInWorktree()`: Streams output from worktree context
- Maintains working directory isolation
- Preserves all existing functionality

### SDK Functions (`src/functions.ts`)

Worktree options integrated seamlessly:
```typescript
interface ClaudeOptions {
  // ... existing options
  worktree?: boolean | string | WorktreeOptions;
}
```

### Type System (`src/types.ts`)

Well-typed worktree configuration:
```typescript
interface WorktreeOptions {
  branch?: string;              // Target branch (required for creation)
  base?: string;                // Base branch for new worktree
  path?: string;                // Custom path (auto-generated if not provided)
  cleanup?: boolean;            // Remove worktree after execution
  create?: boolean;             // Force creation vs. error if exists
}

interface WorktreeInfo {
  branch: string;               // Branch name
  path: string;                 // Absolute path to worktree
  exists: boolean;              // Whether worktree existed before operation
  originalPath: string;         // Original working directory
  commit?: string;              // Current commit hash
}
```

## Core API

### Level 1: Basic Worktree Function

```typescript
// src/worktree/worktree.ts

/**
 * Execute a callback within a git worktree context
 * @param branch - Branch name for the worktree
 * @param callback - Function to execute in worktree context
 * @param options - Worktree configuration options
 * @returns Result of the callback function
 */
export async function worktree<T>(
  branch: string,
  callback: (info: WorktreeInfo) => Promise<T>,
  options?: WorktreeOptions
): Promise<T> {
  const manager = new WorktreeManager();
  const worktreeInfo = await manager.ensureWorktree(branch, options);
  
  return manager.executeInWorktree(worktreeInfo, async () => {
    return callback(worktreeInfo);
  });
}
```

### Level 2: Utility Functions

```typescript
// src/worktree/utils.ts

export const worktreeUtils = {
  /**
   * Create a new worktree
   */
  async create(branch: string, options?: Omit<WorktreeOptions, 'branch'>): Promise<WorktreeInfo> {
    const manager = new WorktreeManager();
    return manager.ensureWorktree(branch, { ...options, create: true });
  },

  /**
   * List all existing worktrees
   */
  async list(): Promise<WorktreeInfo[]> {
    const manager = new WorktreeManager();
    return manager.listWorktrees();
  },

  /**
   * Remove a worktree
   */
  async remove(pathOrBranch: string, force = false): Promise<void> {
    const manager = new WorktreeManager();
    // Handle both path and branch inputs
    const worktrees = await manager.listWorktrees();
    const target = worktrees.find(wt => 
      wt.path === pathOrBranch || wt.branch === pathOrBranch
    );
    
    if (target) {
      await manager.removeWorktree(target.path, force);
    }
  },

  /**
   * Check if a worktree exists for a branch
   */
  async exists(branch: string): Promise<boolean> {
    const manager = new WorktreeManager();
    const existing = await manager.findExistingWorktree(branch);
    return existing !== null;
  },

  /**
   * Get current worktree info (if in a worktree)
   */
  async current(): Promise<WorktreeInfo | null> {
    const manager = new WorktreeManager();
    const worktrees = await manager.listWorktrees();
    const cwd = process.cwd();
    
    return worktrees.find(wt => cwd.startsWith(wt.path)) || null;
  }
};
```

### Level 3: Option Integration

```typescript
// Integration with existing functions

interface ClaudeOptions {
  // ... existing options
  worktree?: boolean | string | WorktreeOptions;
}

// In process.ts - command execution logic
async function executeWithWorktree(
  fn: Function,
  prompt: string,
  options: ClaudeOptions & { worktree: WorktreeOptions }
): Promise<CCResult<any>> {
  const manager = new WorktreeManager();
  const worktreeInfo = await manager.ensureWorktree(
    options.worktree.branch || 'feature/temp',
    options.worktree
  );

  return manager.executeInWorktree(worktreeInfo, async () => {
    return fn(prompt, { ...options, worktree: undefined });
  });
}
```

## Execution Flow

### 1. Configuration Resolution
```
User Options → WorktreeManager → ResolvedWorktreeConfig
```

### 2. Worktree Upsert Logic
```
Check Existing → Create if Needed → Return WorktreeInfo
```

### 3. Execution Modes

#### Standalone Function
```typescript
await worktree('feature/auth', async (wt) => {
  const result = await claude('Implement OAuth');
  await claude('Add tests');
  return { branch: wt.branch, result };
});
```

#### Option Integration
```typescript
await claude('Fix critical bug', { 
  worktree: 'hotfix/security-patch' 
});
```

#### Manual Management
```typescript
const wt = await worktreeUtils.create('experiment/new-arch');
// Manual work in worktree
await worktreeUtils.remove('experiment/new-arch');
```

## Composability Examples

### With Sessions
```typescript
const s = session();
await s.claude('Start OAuth feature', { worktree: 'feature/oauth' });
await s.claude('Add Google provider'); // Automatically in oauth worktree
await s.claude('Add GitHub provider'); // Still in oauth worktree

// Session tracks worktree context
console.log(s.metadata.worktree); // 'feature/oauth'
```

### With Docker
```typescript
await claude('Test in isolated environment', {
  docker: true,
  worktree: 'experiment/risky-change'
  // Docker mounts the worktree as workspace
});
```

### With Streaming
```typescript
await worktree('feature/large-change', async () => {
  for await (const chunk of stream('Generate complex feature')) {
    console.log(`[${chunk.timestamp}] ${chunk.content}`);
  }
});
```

### With Templates
```typescript
// Template has access to worktree context
await claude('prompts/continue-feature.md', {
  worktree: 'feature/api',
  data: {
    currentBranch: '{worktree.branch}',
    workingDir: '{worktree.path}'
  }
});
```

### Complex Workflow
```typescript
// Multi-worktree development workflow
const features = ['auth', 'payments', 'notifications'];

for (const feature of features) {
  await worktree(`feature/${feature}`, async (wt) => {
    const s = session({ name: `${feature}-development` });
    
    await s.claude(`Plan ${feature} feature implementation`);
    
    // Work with streaming feedback
    for await (const chunk of s.stream(`Implement ${feature} feature`)) {
      console.log(`[${wt.branch}] ${chunk.content}`);
    }
    
    // Test in Docker
    await s.claude('Run comprehensive tests', { 
      docker: true,
      tools: ['Bash(npm:*)', 'Read', 'Write']
    });
    
    await s.save(`${feature}-session`);
    return wt.branch;
  });
}
```

## Implementation Details

### Path Generation Strategy

```typescript
function generateWorktreePath(branch: string, options?: WorktreeOptions): string {
  if (options?.path) return path.resolve(options.path);
  
  // Generate logical path based on branch name
  const safeBranch = branch.replace(/[\/\\:*?"<>|]/g, '-');
  const projectRoot = findProjectRoot();
  
  return path.join(path.dirname(projectRoot), `${projectRoot}-${safeBranch}`);
}

// Example outputs:
// feature/auth → ../channelcoder-feature-auth
// hotfix/security → ../channelcoder-hotfix-security
```

### Working Directory Management

```typescript
async function executeInWorktree<T>(
  worktreeInfo: WorktreeInfo,
  callback: () => Promise<T>
): Promise<T> {
  const originalCwd = process.cwd();
  
  try {
    process.chdir(worktreeInfo.path);
    return await callback();
  } finally {
    process.chdir(originalCwd);
    
    // Optional cleanup
    if (worktreeInfo.cleanup !== false) {
      await this.cleanupWorktree(worktreeInfo);
    }
  }
}
```

### Session Integration

```typescript
// Session tracks worktree context
interface SessionState {
  // ... existing fields
  worktreeContext?: {
    branch: string;
    path: string;
    autoCreated: boolean;
  };
}

// Session wrapper functions become worktree-aware
async function sessionClaude(
  session: Session,
  prompt: string,
  options: ClaudeOptions
): Promise<CCResult<any>> {
  // If session has worktree context and no new worktree specified
  if (session.state.worktreeContext && !options.worktree) {
    options.worktree = session.state.worktreeContext.branch;
  }
  
  const result = await claude(prompt, options);
  
  // Track worktree usage in session
  if (options.worktree && result.success) {
    session.state.worktreeContext = {
      branch: typeof options.worktree === 'string' ? options.worktree : options.worktree.branch,
      path: result.metadata?.worktreePath,
      autoCreated: result.metadata?.worktreeCreated
    };
  }
  
  return result;
}
```

### Error Handling

```typescript
class WorktreeError extends Error {
  constructor(
    message: string,
    public code: 'BRANCH_NOT_FOUND' | 'PATH_CONFLICT' | 'GIT_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'WorktreeError';
  }
}

// Graceful error handling in manager
async ensureWorktree(branch: string, options?: WorktreeOptions): Promise<WorktreeInfo> {
  try {
    // Check if branch exists
    const branches = await this.git.branch();
    if (!branches.all.includes(branch) && !options?.base) {
      throw new WorktreeError(
        `Branch '${branch}' does not exist and no base branch specified`,
        'BRANCH_NOT_FOUND'
      );
    }
    
    // Rest of implementation...
  } catch (error) {
    if (error instanceof WorktreeError) throw error;
    
    throw new WorktreeError(
      `Failed to manage worktree: ${error.message}`,
      'GIT_ERROR',
      error
    );
  }
}
```

## Export Strategy

```typescript
// src/index.ts (additions)

// High-level utilities
export { worktree } from './worktree/index.js';

// Building blocks for advanced users
export * as worktreeUtils from './worktree/index.js';

// Types always exported
export type {
  WorktreeOptions,
  WorktreeInfo
} from './worktree/types.js';
```

## CLI Integration

```bash
# Start work in a worktree
channelcoder "Implement auth feature" --worktree feature/auth

# Continue work in existing worktree
channelcoder "Add tests" --worktree feature/auth

# Use with sessions
channelcoder "Plan feature" --worktree feature/api --session api-development

# Combined with other features
channelcoder "Test changes" --worktree experiment/risky --docker --tools Bash,Read,Write

# Utility commands
channelcoder --list-worktrees
channelcoder --cleanup-worktrees
```

## Testing Strategy

### Unit Tests
- Worktree creation and detection
- Path generation logic
- Error handling scenarios
- Cleanup behavior

### Integration Tests
- Session + worktree workflows
- Docker + worktree mounting
- Template variable access
- CLI flag processing

### E2E Tests
- Multi-worktree development scenarios
- Long-running session workflows
- Error recovery and cleanup
- Cross-platform path handling

## Implementation Phases

### Phase 1: Core Worktree Management
- [ ] Implement WorktreeManager with simple-git
- [ ] Add basic `worktree()` function
- [ ] Implement upsert logic and path generation
- [ ] Add comprehensive error handling

### Phase 2: SDK Integration
- [ ] Add worktree option to ClaudeOptions
- [ ] Integrate with process execution
- [ ] Add utility functions (create, list, remove, etc.)
- [ ] Update TypeScript types

### Phase 3: Advanced Features
- [ ] Session integration and context tracking
- [ ] Docker volume mounting for worktrees
- [ ] Template variable access
- [ ] CLI flag support

### Phase 4: Polish & Documentation
- [ ] Comprehensive test suite
- [ ] Performance optimization
- [ ] Documentation and examples
- [ ] Migration guide for existing workflows

## Design Rationale

1. **Function-first approach**: Maintains ChannelCoder's functional philosophy
2. **Upsert behavior**: Reduces friction for iterative development
3. **Composable design**: Works seamlessly with existing features
4. **Path isolation**: Prevents cross-worktree contamination
5. **Session integration**: Natural workflow for long-running tasks
6. **No lock-in**: Users can mix worktree and non-worktree workflows

## Future Compatibility

The design supports future enhancements without breaking changes:

- **Worktree templates**: Pre-configured worktree setups
- **Shared worktrees**: Team collaboration features
- **Worktree synchronization**: Keep worktrees in sync with remote
- **Performance optimization**: Caching and reuse strategies
- **IDE integration**: VS Code workspace management

## Conclusion

This worktree architecture enables powerful branch-based development workflows while maintaining ChannelCoder's core philosophy of simplicity and composability. It provides essential isolation capabilities without compromising ease of use, allowing developers to work on multiple features simultaneously with full context preservation.