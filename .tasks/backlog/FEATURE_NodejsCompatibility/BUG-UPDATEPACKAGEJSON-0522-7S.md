+++
id = "BUG-UPDATEPACKAGEJSON-0522-7S"
title = "Update package.json bin entries to compiled JS"
type = "🐞 Bug"
status = "🟢 Done"
priority = "🔼 High"
created_date = "2025-05-23"
updated_date = "2025-05-23"
assigned_to = ""
phase = "backlog"
subdirectory = "FEATURE_NodejsCompatibility"
tags = [ "package.json", "nodejs", "build" ]
+++

Update package.json bin entries to point to compiled JS files (`./dist/cli.js` instead of `./src/cli.ts`) so Node.js can execute the CLI properly.
