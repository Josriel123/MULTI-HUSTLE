// Builds public/third-party-notices.txt (served at /third-party-notices.txt and
// linked from /legal/licenses) and the THIRD_PARTY_NOTICES.md pointer from the
// installed production dependency tree. Run after dependencies change:
//   npm run notices          (or: node scripts/third-party-notices.mjs --list)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString());

/** name@version -> package dir, walking the resolved tree. */
const found = new Map();
function walk(deps) {
  for (const [name, info] of Object.entries(deps || {})) {
    if (!info || info.missing || !info.version) continue;
    const key = `${name}@${info.version}`;
    if (!found.has(key)) found.set(key, { name, version: info.version, path: info.path || null });
    walk(info.dependencies);
  }
}
walk(tree.dependencies);

function dirOf(entry) {
  if (entry.path && fs.existsSync(entry.path)) return entry.path;
  const guess = path.join(root, 'node_modules', entry.name);
  return fs.existsSync(guess) ? guess : null;
}

const rows = [];
for (const entry of [...found.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = dirOf(entry);
  if (!dir) continue;
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {}
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type || l).join(' OR ') : 'UNKNOWN');
  const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(f));
  const text = file ? fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim() : null;
  rows.push({ name: entry.name, version: entry.version, license, text, repo: typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || '' });
}

if (process.argv.includes('--list')) {
  const byLicense = {};
  for (const r of rows) byLicense[r.license] = (byLicense[r.license] || 0) + 1;
  console.log(rows.length, 'packages');
  console.log(byLicense);
  console.log(rows.filter((r) => !r.text).map((r) => `${r.name}@${r.version} (${r.license})`).join('\n'));
  process.exit(0);
}

const out = [];
out.push('THIRD-PARTY NOTICES FOR MULTI-HUSTLE');
out.push('');
out.push('Multi-Hustle is built on the open-source packages below. This file carries');
out.push("each one's licence text, as their licences ask when the software is");
out.push('distributed (the browser downloads parts of several of them). It is');
out.push('generated from the installed production dependency tree (npm ls --omit=dev');
out.push('--all); development and test tools are not distributed and are not listed.');
out.push('');
out.push('Also used, not from npm:');
out.push('');
out.push('* Outfit typeface, Copyright 2021 The Outfit Project Authors');
out.push('  (https://github.com/Outfitio/Outfit-Fonts), licensed under the SIL Open Font');
out.push('  License, Version 1.1 (https://openfontlicense.org). Served from this site by');
out.push('  next/font; the font files carry the copyright and the licence link in their');
out.push('  metadata.');
out.push('* App icon: the Lucide "sprout" icon (ISC licence, below under lucide-react) on');
out.push('  the brand colour.');
out.push('');
out.push(`${rows.length} packages. Licences: ${Object.entries(rows.reduce((m, r) => ((m[r.license] = (m[r.license] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} (${n})`).join(', ')}.`);
out.push('');
const RULE = '-'.repeat(78);
for (const r of rows) {
  out.push(RULE);
  out.push(`${r.name} ${r.version}`);
  out.push(`Licence: ${r.license}${r.repo ? `. Source: ${r.repo.replace(/^git\+/, '').replace(/\.git$/, '')}` : ''}`);
  out.push('');
  out.push(r.text || 'The package ships no separate licence file; its licence is the one named above, as declared in its package.json.');
  out.push('');
}
const served = path.join(root, 'public', 'third-party-notices.txt');
fs.writeFileSync(served, out.join('\n'));
fs.writeFileSync(
  path.join(root, 'THIRD_PARTY_NOTICES.md'),
  [
    '# Third-party notices',
    '',
    'The licence texts of every package Multi-Hustle is built on, the Outfit typeface',
    'and the icon are in [`public/third-party-notices.txt`](public/third-party-notices.txt),',
    'which the site serves at `/third-party-notices.txt` and links from its Licenses',
    'page (`/legal/licenses`).',
    '',
    'It is generated from the installed production dependency tree',
    '(`npm ls --omit=dev --all`) by `npm run notices`; run it when dependencies',
    'change (`docs/security-program.md`, "Change management").',
    '',
  ].join('\n'),
);
console.log('wrote', rows.length, 'packages', Math.round(fs.statSync(served).size / 1024), 'KB');
