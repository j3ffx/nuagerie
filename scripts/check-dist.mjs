#!/usr/bin/env node
// Runs before every deploy: what gets published is dist/, so check it too.
//  - no source maps (they would publish the source with its comments);
//  - no private pattern from the local, ignored `.private-patterns` file.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const errors = [];

if (!existsSync(DIST)) {
  console.error('check-dist: dist/ is missing, run npm run build first');
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(DIST);

for (const file of files) {
  if (file.endsWith('.map')) errors.push(`source map would be published: ${file}`);
}

if (existsSync('.private-patterns')) {
  const patterns = readFileSync('.private-patterns', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => new RegExp(line, 'i'));
  for (const file of files) {
    if (!/\.(html|js|mjs|css|json|webmanifest|svg|txt)$|_headers$/.test(file)) continue;
    const content = readFileSync(file, 'utf8');
    for (const re of patterns)
      if (re.test(content)) errors.push(`private pattern ${re} in ${file}`);
  }
}

if (errors.length) {
  console.error('check-dist: FAILED');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`check-dist: OK (${files.length} files)`);
