import {build} from 'esbuild';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({absWorkingDir:root,entryPoints:['scripts/cli.ts'],outfile:resolve(root,'packages/cli/dist/cli.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',tsconfig:'tsconfig.json',banner:{js:'#!/usr/bin/env node'},sourcemap:false,legalComments:'eof'});
