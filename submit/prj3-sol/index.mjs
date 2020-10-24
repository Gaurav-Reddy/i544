#!/usr/bin/env node

import cli from './src/cli.mjs';

cli().catch(err => console.error(err));
