/** Fails the build if any page is still the generated placeholder. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PAGES = join(process.cwd(), 'src', 'pages');
const offenders: string[] = [];

for (const name of readdirSync(PAGES)) {
  if (!name.endsWith('.tsx')) continue;
  const path = join(PAGES, name);
  if (!statSync(path).isFile()) continue;
  const text = readFileSync(path, 'utf8');
  if (/\bSTUB\b|正在构建中/.test(text)) offenders.push(name);
}

if (offenders.length) {
  console.error(`✖ placeholder pages still present: ${offenders.join(', ')}`);
  process.exit(1);
}
console.log('✓ no placeholder pages');
