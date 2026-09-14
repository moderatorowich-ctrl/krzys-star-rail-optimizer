import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'work' || entry.name === 'dist') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (['.md', '.html'].includes(extname(path))) result.push(path);
  }
  return result;
}

const files = await walk(process.cwd());
let checked = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\((?!https?:|#|mailto:)([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target) continue;
    await import('node:fs/promises').then(({ access }) => access(join(file, '..', target)));
    checked += 1;
  }
}
console.log(`Verified ${checked} local documentation links.`);
