import { access, readFile } from 'node:fs/promises';

const root = new URL('../dist/', import.meta.url);
const indexPath = new URL('index.html', root);
await access(indexPath);
const index = await readFile(indexPath, 'utf8');
if (!index.includes('/krzys-star-rail-optimizer/')) {
  throw new Error('Production HTML is not using the GitHub Pages project base path.');
}
const refs = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
for (const ref of refs.filter((item) => item.startsWith('/krzys-star-rail-optimizer/'))) {
  const relative = ref.replace('/krzys-star-rail-optimizer/', '').split('?')[0];
  if (!relative) continue;
  await access(new URL(relative, root));
}
console.log(`Verified ${refs.length} GitHub Pages asset references.`);
