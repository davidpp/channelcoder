# ChannelCoder Examples

This directory contains practical examples demonstrating ChannelCoder's features.

## Prerequisites

All examples require Claude CLI to be installed and configured:
- Install: https://docs.anthropic.com/en/docs/claude-code/cli-usage
- The examples will check for Claude CLI and warn if it's not available

## Release Analysis Example

A real-world example showing how to automate release version analysis using git history.

### Files

- `release-analysis.md` - Prompt template with:
  - Input schema validation
  - Output schema for structured responses
  - Multiple variable interpolation
  - Conditional content based on input
  - System prompt for consistency

- `release.ts` - Script that:
  - Gathers git information (commits, tags, changes)
  - Passes multiple variables to the prompt
  - Validates responses with Zod schemas
  - Shows both file-based and inline prompt usage

### Running the Example

```bash
# Make sure you're in a git repository
cd your-project

# Run the analysis
bun run examples/release.ts

# Or validate a specific target version
bun run examples/release.ts v2.0.0
```

### What It Demonstrates

1. **Multi-variable Interpolation**:
   ```yaml
   currentVersion: "1.2.3"
   lastTag: "v1.2.0"
   commits: "git log output..."
   fileChanges: "git diff stats..."
   ```

2. **Conditional Content**:
   ```markdown
   ${targetVersion ? "Validate target: ${targetVersion}" : ""}
   ```

3. **Schema Validation**:
   - Input validation ensures all required data is provided
   - Output validation guarantees structured responses

4. **Real-world Use Case**:
   - Analyzes git history
   - Recommends semantic version bumps
   - Provides reasoning and confidence levels

### Example Output

```
🚀 Release Analysis Example

📊 Current version: 1.2.3
🏷️  Last tag: v1.2.0
📝 Analyzing 15 commits...

🔍 Running release analysis...

✅ Analysis Complete!

📌 Recommended Version: 1.3.0
📊 Change Type: MINOR
🎯 Confidence: HIGH
💥 Breaking Changes: No

💡 Reasoning: Added new features without breaking existing functionality

🌟 Highlights:
   - Added streaming support for real-time responses
   - Implemented schema validation with Zod
   - New fluent builder API for prompts
```

## Root Cause Analysis Example

A debugging tool that demonstrates systematic error analysis using code tracing.

### Files

- `root-cause-analysis.md` - Advanced prompt template featuring:
  - Read-only tool restrictions for safety
  - Multiple search and analysis tools (rg, grep, git blame)
  - Structured output for call traces
  - Hypothesis generation

- `root-cause-analysis.ts` - Interactive debugging script that:
  - Analyzes different types of errors
  - Traces function calls through codebases
  - Generates fix recommendations
  - Supports custom error analysis

### Running the Example

```bash
# Run demo scenarios
bun run examples/root-cause-analysis.ts

# Analyze a custom error
bun run examples/root-cause-analysis.ts --custom "TypeError: x is not a function" "function.*x"

# Quick pattern search
bun run examples/root-cause-analysis.ts --search "TODO|FIXME"
```

### What It Demonstrates

1. **Safe Tool Usage**:
   ```yaml
   allowedTools:
     - "Bash(rg:*)"      # ripgrep for searching
     - "Bash(git log:*)" # git history
     - Read              # file reading
     # Note: No Write or Edit tools
   ```

2. **Complex Analysis Flow**:
   - Search for error patterns
   - Trace call stacks
   - Examine git history
   - Form hypotheses
   - Suggest fixes

3. **Structured Debugging Output**:
   ```json
   {
     "rootCause": {
       "file": "src/service.ts",
       "line": 42,
       "description": "Null check missing"
     },
     "callTrace": [...],
     "hypothesis": "...",
     "suggestedFix": "..."
   }
   ```

## Creating Your Own Examples

1. **Define a Prompt File** with frontmatter:
   ```yaml
   ---
   input:
     param1: string
     param2?: boolean
   output:
     result: string
   ---
   Process ${param1}...
   ```

2. **Use in Your Script**:
   ```typescript
   const result = await cc.fromFile('your-prompt.md', {
     param1: 'value',
     param2: true
   });
   ```

3. **Validate Results**:
   ```typescript
   const validated = cc.validate(result, YourSchema);
   ```