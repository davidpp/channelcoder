#!/usr/bin/env node

import { run } from '@stricli/core';
import { app } from './cli/index.js';
import { buildContext } from './cli/context.js';

// Run the Stricli app
void run(app, process.argv.slice(2), buildContext(process));