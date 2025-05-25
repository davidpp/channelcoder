+++
id = "FEAT-CREATECCPROMPT-0525-PB"
title = "Create cc-prompt CLI for prompt-only processing"
type = "🌟 Feature"
status = "🟡 To Do"
priority = "▶️ Medium"
created_date = "2025-05-25"
updated_date = "2025-05-25"
assigned_to = "dev-team"
phase = "release-v2"
tags = [ "cli", "security", "unix-philosophy", "trust" ]
+++

# Create cc-prompt CLI for prompt-only processing

## Problem Statement

Some developers are hesitant to use third-party wrappers around Claude CLI, preferring to maintain direct control over how Claude is invoked. They want our template processing and prompt engineering features but need to see exactly what's being sent to Claude and control the execution themselves.

This creates a trust barrier for adoption, especially in security-conscious environments where developers need to audit every tool in their pipeline.

## User Stories

1. **As a security-conscious developer**, I want to use ChannelCoder's template system while maintaining full control over Claude CLI invocation, so I can audit what's being sent and use my own execution environment.

2. **As a DevOps engineer**, I need to preprocess prompts in CI/CD pipelines and pipe them to Claude with custom flags and environment configurations that ChannelCoder might not support.

3. **As a developer evaluating ChannelCoder**, I want to see exactly what prompt processing it does before committing to using it as a full wrapper, allowing gradual adoption.

4. **As a power user**, I want to combine ChannelCoder's template system with Unix pipes and my own scripts for custom workflows.

## Solution Overview

Create a minimal `cc-prompt` CLI that only handles prompt preparation (template interpolation, file loading, variable substitution) and outputs the processed prompt to stdout. Users can then pipe this to Claude CLI with their own flags and configurations.

## Technical Design

### 1. New CLI Entry Point

Create `src/cli-prompt.ts`:
```typescript
#!/usr/bin/env node

import { program } from 'commander';
import { CC } from './cc';
import { readFileSync } from 'fs';

program
  .name('cc-prompt')
  .description('Prepare prompts for Claude CLI without executing')
  .argument('<prompt>', 'Prompt text or path to prompt file')
  .option('-d, --data <json>', 'JSON data for template variables')
  .option('--data-file <path>', 'Path to JSON file with template data')
  .option('-f, --format', 'Pretty-print output for readability')
  .option('-s, --system <prompt>', 'System prompt to prepend')
  .option('--show-metadata', 'Output YAML frontmatter as JSON comment')
  .action(async (promptInput, options) => {
    try {
      const result = await processPrompt(promptInput, options);
      process.stdout.write(result);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
```

### 2. Prompt Processing Logic

```typescript
async function processPrompt(input: string, options: any): Promise<string> {
  const cc = new CC();
  
  // Determine if input is a file or inline prompt
  const isFile = !input.includes(' ') && existsSync(input);
  
  // Parse data
  let data = {};
  if (options.data) {
    data = JSON.parse(options.data);
  } else if (options.dataFile) {
    data = JSON.parse(readFileSync(options.dataFile, 'utf-8'));
  }
  
  // Process the prompt
  let processedPrompt: string;
  let metadata: any = null;
  
  if (isFile) {
    // Use our existing file loading with frontmatter parsing
    const loaded = await cc.loadFile(input, data);
    processedPrompt = loaded.prompt;
    metadata = loaded.frontmatter;
  } else {
    // Process inline prompt with template interpolation
    processedPrompt = cc.processTemplate(input, data);
  }
  
  // Build final output
  let output = '';
  
  // Add system prompt if provided
  if (options.system) {
    output += cc.processTemplate(options.system, data) + '\n\n';
  }
  
  // Add metadata as comment if requested
  if (options.showMetadata && metadata) {
    output += `# Metadata from frontmatter:\n`;
    output += `# ${JSON.stringify(metadata, null, 2).replace(/\n/g, '\n# ')}\n\n`;
  }
  
  // Add main prompt
  output += processedPrompt;
  
  // Format if requested
  if (options.format) {
    // Add nice formatting/line breaks
    output = output.trim() + '\n';
  }
  
  return output;
}
```

### 3. Package.json Updates

```json
{
  "bin": {
    "cc": "./dist/cli.js",
    "cc-prompt": "./dist/cli-prompt.js"
  }
}
```

### 4. Usage Examples

```bash
# Example 1: Simple template interpolation
cc-prompt "Hello {name}, please analyze {file}" --data '{"name":"Alice","file":"main.ts"}'
# Output: Hello Alice, please analyze main.ts

# Example 2: File-based prompt with data
cc-prompt analyze.md --data '{"version":"1.2.3","breaking":true}'

# Example 3: Pipe to Claude
cc-prompt "Explain this code" --system "Be concise" | claude --output-format json

# Example 4: Save processed prompt for inspection
cc-prompt template.md --data-file config.json --format > prompt.txt
cat prompt.txt  # Review it
cat prompt.txt | claude

# Example 5: Complex pipeline
cc-prompt review.md \
  --data "{\"pr\":$PR_NUMBER,\"files\":$CHANGED_FILES}" \
  --show-metadata | \
  tee prompt-log.txt | \
  claude --output-format json --max-turns 5 > result.json

# Example 6: Using in scripts
PROMPT=$(cc-prompt "Analyze {code}" --data "{\"code\":\"$(cat src/main.ts)\"}")
echo "$PROMPT" | claude --allowedTools Read,Write

# Example 7: With frontmatter metadata shown
cc-prompt examples/analyze.md --show-metadata
# Output:
# # Metadata from frontmatter:
# # {
# #   "allowedTools": ["Read", "Grep"],
# #   "outputFormat": "json"
# # }
# 
# [actual prompt content here]
```

### 5. Build Process Updates

Update `tsup.config.ts`:
```typescript
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'cli-prompt': 'src/cli-prompt.ts', // New entry point
  },
  // ... rest of config
});
```

## Implementation Steps

1. **Create cli-prompt.ts**
   - Set up Commander program
   - Implement prompt processing logic
   - Handle file vs inline prompt detection

2. **Refactor shared logic**
   - Extract template processing to reusable functions
   - Ensure CC class methods can be used without execution

3. **Update build configuration**
   - Add new entry point to tsup.config.ts
   - Update package.json bin field

4. **Add comprehensive tests**
   - Test template interpolation
   - Test file loading
   - Test data parsing options
   - Test output formatting

5. **Update documentation**
   - Add cc-prompt examples to README
   - Create migration guide from cc-prompt to cc
   - Show trust-building progression

## Testing Checklist

- [ ] Template variables are interpolated correctly
- [ ] File-based prompts load and process correctly
- [ ] JSON data parsing from --data flag works
- [ ] JSON data parsing from --data-file works
- [ ] System prompts are prepended properly
- [ ] Metadata comment output is formatted correctly
- [ ] Output can be piped to Claude CLI successfully
- [ ] Error messages are helpful and clear
- [ ] No trailing newlines unless --format is used

## Success Criteria

1. **Zero execution** - Never calls Claude, only outputs text
2. **Full compatibility** - Output works perfectly when piped to Claude
3. **Feature parity** - All template/interpolation features available
4. **Unix philosophy** - Works well in pipes and scripts
5. **Trust building** - Users can inspect output before execution

## Benefits

1. **Gradual adoption path**: Try templates → Verify output → Use full SDK
2. **Security auditing**: See exactly what's sent to Claude
3. **Custom workflows**: Combine with other Unix tools
4. **CI/CD friendly**: Full control over execution environment
5. **Learning tool**: Understand how ChannelCoder processes prompts

## Future Enhancements

- `--output-command` flag to show suggested Claude command
- `--validate` flag to check template syntax without output
- Support for streaming prompt pieces for very large prompts
- Integration with shell completion for template variables

## Notes

- Keep it minimal - resist adding execution features
- Output should be exactly what Claude expects as input
- Consider adding verbose mode showing template processing steps
- This addresses the trust barrier while showcasing our value
