/**
 * CC SDK - Claude Code SDK
 *
 * A thin SDK for interacting with Claude Code CLI
 */

import { CC } from './cc.js';
import { type Frontmatter, FrontmatterSchema } from './loader.js';
import type { CCOptions, CCResult, PromptConfig } from './types.js';

// Default instance for convenience
export const cc = new CC();

// Export main class and types
export { CC, type CCResult, type CCOptions, type PromptConfig };

// Export schema and types for frontmatter validation
export { FrontmatterSchema, type Frontmatter };
