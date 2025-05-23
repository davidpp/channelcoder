/**
 * CC SDK - Claude Code SDK
 * 
 * A thin SDK for interacting with Claude Code CLI
 */

import { CC } from './cc.js';
import type { CCResult, CCOptions, PromptConfig } from './types.js';

// Default instance for convenience
export const cc = new CC();

// Export main class and types
export { CC, CCResult, CCOptions, PromptConfig };

// Re-export common schemas from existing claude-helper
export { 
  VersionAnalysisSchema, 
  ChangelogGenerationSchema,
  type VersionAnalysisResult,
  type ChangelogGenerationResult
} from '../../scripts/utils/claude-helper.js';