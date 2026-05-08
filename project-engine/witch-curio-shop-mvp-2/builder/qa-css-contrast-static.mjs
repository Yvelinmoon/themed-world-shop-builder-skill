import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [,, exportDirArg, ...args] = process.argv;
if (!exportDirArg) throw new Error('Usage: node builder/qa-css-contrast-static.mjs <static-export-dir> [--report out.json]');
const exportDir = path.resolve(process.cwd(), exportDirArg);
function argValue(flag, fallback='') { const i=args.indexOf(flag); return i>=0 ? args[i+1] || fallback : fallback; }
const reportPath = argValue('--report');
const css = await readFile(path.join(exportDir, 'styles.css'), 'utf8');
const failures=[];
function fail(code, detail){ failures.push({code, detail}); }

const badUnlockedBlock = /\.source-card\.unlocked\s+h3\s*,\s*\.source-card\.unlocked\s+\.source-state\s*,\s*\.source-card\.unlocked\s+\.source-meta-pill\s*,\s*\.source-card\.unlocked\s+\.source-meta-pill\s+strong\s*\{[\s\S]*?color:\s*var\(--shop-on-source\)/m;
if (badUnlockedBlock.test(css)) {
  fail('source-chip-inherits-dark-text', 'Unlocked source state/meta chips must not use --shop-on-source on their light chip background. Use --shop-on-chip.');
}
if (!/\.source-card\.unlocked\s+\.source-state\s*,\s*\.source-card\.unlocked\s+\.source-meta-pill\s*,\s*\.source-card\.unlocked\s+\.source-meta-pill\s+strong\s*\{[\s\S]*?color:\s*var\(--shop-on-chip\)/m.test(css)) {
  fail('source-chip-contrast-rule-missing', 'Missing explicit --shop-on-chip rule for unlocked source state/meta chips.');
}
const report={ok:failures.length===0, exportDir, failures, checkedAt:new Date().toISOString()};
if (reportPath) await writeFile(path.resolve(process.cwd(), reportPath), JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.ok) process.exit(1);
