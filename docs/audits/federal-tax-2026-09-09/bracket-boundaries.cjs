// Independent bracket-boundary probe. Run from the repository with node <this file>.
// The oracle is the IRS-source transcription in parameters.md, not production tables.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2] || process.cwd();
const ts = require(path.join(repo, 'node_modules/typescript'));
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  }, fileName: filename }).outputText, filename);
const { computeIncomeTax } = require(path.join(repo, 'src/lib/tax/incomeTax.ts'));
const { getTaxYearParameters } = require(path.join(repo, 'src/lib/tax/parameters/index.ts'));
const ratesPercent = [10n,12n,22n,24n,32n,35n,37n];
const centsOf = (s) => {
  const [d,f=''] = s.replaceAll(',','').trim().split('.');
  return BigInt(d)*100n + BigInt(f.padEnd(2,'0'));
};
const decimalOf = (c) => `${c/100n}.${String(c%100n).padStart(2,'0')}`;
const source = fs.readFileSync(path.join(__dirname,'parameters.md'), 'utf8');
const rows = source.split(/\r?\n/).filter(l => /^\| 202[456] \|/.test(l));
assert.equal(rows.length,12,'Expected twelve independently transcribed bracket tables');
let checked=0;
for (const row of rows) {
  const [,yearText,statusText,topsText,basesText] = row.split('|').map(s=>s.trim());
  const statuses = statusText.startsWith('Joint') ? ['married_filing_jointly','qualifying_surviving_spouse']
    : statusText === 'Head of household' ? ['head_of_household']
    : statusText === 'Single' ? ['single'] : ['married_filing_separately'];
  const tops=topsText.split(';').map(centsOf), bases=basesText.split(';').map(centsOf);
  assert.equal(tops.length,6); assert.equal(bases.length,6);
  for (const status of statuses) for (let i=0;i<6;i++) for (const delta of [-1n,0n,1n]) {
    const taxable=tops[i]+delta*100n;
    // At boundary, use printed base. $1 below uses the ending rate, $1 above the next rate.
    const expected=bases[i]+delta*(delta>0n ? ratesPercent[i+1] : ratesPercent[i]);
    const actual=computeIncomeTax(decimalOf(taxable),status,getTaxYearParameters(Number(yearText))).tax.toFixed(2);
    assert.equal(actual,decimalOf(expected),`${yearText}/${status} at taxable income ${decimalOf(taxable)}`);
    checked++;
  }
}
console.log(`PASS: ${checked} IRS-derived checks: every boundary and $1 below/above, all 3 years and all 5 statuses.`);
