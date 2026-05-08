import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), 'builder/skills/shop-builder');

const forbidden = [
  // Previous shop / demo names and franchise terms.
  'Stardew',
  'Pierre',
  'Hermione',
  'Ollivanders',
  'Harry Potter',
  'Hogwarts',
  '霍格沃茨',
  'Starbucks',
  'Mars',
  'Elon',
  'lotr',
  'red-alert',
  'laoqin',
  '老秦',
  '红色警戒',
  'hp-wood',
  'pinseng',
  'coffee-neta',
  'lego',

  // Theme-specific template residue that should only appear in a generated concept/content pack,
  // never in reusable prompt templates.
  'cozy farming',
  'farm-town',
  'farming general-store',
  'seed-store',
  'valley seed-store',
  'valley grocery',
  'parsnips',
  'fertilizer sacks',
  'wooden seed shop',
  'warm wooden seed shop',
  'middle-aged male general-store owner',
  'green shop apron',
  'small-town grocery owner',
  'seed shop atmosphere',
];

const allowedNeutralPhrases = [
  'previous shops',
  'previous shop',
  'previous examples',
  'previous shops.',
];

function isAllowedContext(text, term, index) {
  const lowerWindow = text.slice(Math.max(0, index - 80), Math.min(text.length, index + term.length + 80)).toLowerCase();
  return allowedNeutralPhrases.some((phrase) => lowerWindow.includes(phrase));
}

const entries = await readdir(root, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && /^prompt_.*\.md$/i.test(entry.name))
  .map((entry) => path.join(root, entry.name));

const failures = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lower = text.toLowerCase();
  for (const term of forbidden) {
    const needle = term.toLowerCase();
    let index = lower.indexOf(needle);
    while (index >= 0) {
      if (!isAllowedContext(text, term, index)) {
        failures.push({ file: path.relative(process.cwd(), file), term, index });
        break;
      }
      index = lower.indexOf(needle, index + needle.length);
    }
  }
}

const report = {
  ok: failures.length === 0,
  root,
  checkedFiles: files.map((file) => path.relative(process.cwd(), file)),
  forbiddenTerms: forbidden,
  failures,
  checkedAt: new Date().toISOString(),
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
