+++
id = "BUG-FIXCLI-0522-AA"
title = "Fix CLI shebang for Node.js compatibility"
type = "🐞 Bug"
status = "🟡 To Do"
priority = "🔼 High"
created_date = "2025-05-23"
updated_date = "2025-05-23"
assigned_to = ""
phase = "backlog"
subdirectory = "FEATURE_NodejsCompatibility"
tags = [ "cli", "nodejs", "compatibility" ]
+++

Change `#!/usr/bin/env bun` to `#!/usr/bin/env node` in src/cli.ts to ensure the CLI works with Node.js runtime.
