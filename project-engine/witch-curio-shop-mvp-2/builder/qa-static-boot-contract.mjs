import { readFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Usage: node builder/qa-static-boot-contract.mjs <static-export-dir>');
const html = await readFile(path.join(out, 'index.html'), 'utf8');
const app = await readFile(path.join(out, 'app.js'), 'utf8');
const css = await readFile(path.join(out, 'styles.css'), 'utf8');
const staticSession = await readFile(path.join(out, 'static-session.js'), 'utf8');

const uiRoles = ['hall','codex','shelf','reset','trash'];
const uiSrcs = Object.fromEntries([...html.matchAll(/data-ui-sticker="([^"]+)" src="([^"]*)"/g)].map(m => [m[1], m[2]]));
const forbiddenDefaults = ['有求必应屋','赫敏','麦格教授','霍格沃茨','Harry Potter','Room of Requirement','/generated/shop-stickers','/Downloads/'];
const activeText = html + '\n' + staticSession;
const report = {
  status: 'passed',
  checks: {
    bodyBooting: /<body[^>]*class="[^"]*shop-booting/.test(html),
    bootScreen: html.includes('id="shopBootScreen"'),
    bootCss: css.includes('body.shop-booting #appShell') && css.includes('.shop-boot-screen'),
    finishBootJs: app.includes('function finishStaticBoot') && app.includes('finishStaticBoot();'),
    bootErrorJs: app.includes('function showStaticBootError'),
    noTextPollution: !/^undefined\s*$/m.test(html + '\n' + css + '\n' + app + '\n' + staticSession) && !(html + css + app + staticSession).includes('[object Object]'),
    staticSessionBeforeApp: html.indexOf('./static-session.js') >= 0 && html.indexOf('./static-session.js') < html.indexOf('./app.js'),
    uiPrebound: uiRoles.every(role => uiSrcs[role] && uiSrcs[role].startsWith('./generated/assets/ui_buttons/button_1_')),
    noDefaultShellText: forbiddenDefaults.filter(token => activeText.includes(token)),
  },
};
if (Object.entries(report.checks).some(([key, value]) => Array.isArray(value) ? value.length : !value)) {
  report.status = 'failed';
}
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exit(1);
