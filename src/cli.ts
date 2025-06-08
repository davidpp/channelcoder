#!/usr/bin/env node

import { run } from '@stricli/core';
import { buildContext } from './cli/context.js';
import { app } from './cli/index.js';

// Run the Stricli app
void run(app, process.argv.slice(2), buildContext(process));
