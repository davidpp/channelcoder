# Task Completion Checklist

## Always Run Before Committing Code

1. **Code Quality Checks** (MANDATORY)
   ```bash
   bun run check          # Smart check for changed files
   # OR
   bun run check:full     # Full project check
   ```

2. **Fix Any Issues**
   ```bash
   bun run lint:fix       # Auto-fix linting issues
   bun run format         # Format code with Biome
   ```

3. **Verify Types**
   ```bash
   bun run typecheck      # Ensure no TypeScript errors
   ```

4. **Run Tests**
   ```bash
   bun run test           # Run all tests
   bun run test:compat    # Ensure Node.js compatibility
   ```

## Important Notes
- **NEVER** commit without running `bun run check` first
- The project MUST maintain compatibility with both Node.js and Bun
- Use only Node.js APIs (no Bun-specific APIs)
- All code must pass Biome linting and formatting
- TypeScript strict mode must be satisfied

## When Unsure
If you can't find the correct command, ask the user for the command to run. If they provide it, suggest writing it to CLAUDE.md so you'll know to run it next time.