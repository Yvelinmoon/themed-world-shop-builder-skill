import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertContentPackReady } from './content-pack-contract.mjs';

const root = process.cwd();
const [,, sessionArg, outArg] = process.argv;
if (!sessionArg || !outArg) {
  throw new Error('Usage: node builder/export-static-shop.mjs <session.json> <out-dir>');
}
const sessionPath = path.resolve(root, sessionArg);
const out = path.resolve(root, outArg);
const session = JSON.parse(await readFile(sessionPath, 'utf8'));
const sessionPack = session.runtimeConfig?.contentPack || session.contentPack || session.concept?.runtimeConfig?.contentPack;
assertContentPackReady(sessionPack, {
  requireThemed: true,
  expectedKeywords: [session.concept?.shopName, session.shopIdea, session.concept?.summary]
    .flatMap((value) => String(value || '').match(/[\u4e00-\u9fa5]{2,}/g) || [])
    .slice(0, 12),
});
const runtime = session.runtimeConfig || {};
const profile = session.profile || {};
const generatedAssets = profile.generatedAssets || {};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstItem(pack, chainId, index = 0) {
  const item = pack?.chains?.find((chain) => chain.id === chainId)?.items?.[index];
  if (Array.isArray(item)) return item[0] || '';
  return item?.name || '';
}

function getIntroEntry(session, index = 0) {
  return session.runtimeConfig?.contentPack?.introSequence?.[index] || {};
}

function relUrl(value) {
  if (typeof value !== 'string') return value;
  let u = value.trim();
  if (!u) return u;
  if (/^(?:https?:|data:|blob:)/i.test(u)) return u;
  u = u.replace(/\\/g, '/');
  const buildMatch = u.match(/\/generated\/build-artifacts\/([^/]+)\/(.*)$/);
  if (buildMatch) return `./generated/assets/${buildMatch[2]}`;
  const absBuildMatch = u.match(/.*?\/generated\/build-artifacts\/([^/]+)\/(.*)$/);
  if (absBuildMatch) return `./generated/assets/${absBuildMatch[2]}`;
  if (u.startsWith('/generated/assets/')) return `.${u}`;
  if (u.startsWith('/assets/')) return `.${u}`;
  if (u.startsWith('/generated/')) return `.${u}`;
  if (u.startsWith('/Downloads/') || u.startsWith('/workspace/')) return '';
  return u;
}

function fixDeep(value) {
  if (typeof value === 'string') return relUrl(value);
  if (Array.isArray(value)) return value.map(fixDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixDeep(v)]));
  }
  return value;
}

function resolveSourcePath(urlOrPath, fallback = '') {
  const input = urlOrPath || fallback;
  if (!input || typeof input !== 'string') return null;
  if (input.startsWith('./generated/assets/')) {
    return path.resolve(path.dirname(sessionPath), input.replace(/^\.\//, ''));
  }
  const buildMatch = input.match(/\/generated\/build-artifacts\/([^/]+)\/(.*)$/);
  if (buildMatch) return path.join(root, 'generated', 'build-artifacts', buildMatch[1], buildMatch[2]);
  if (path.isAbsolute(input)) return input;
  return path.resolve(root, input);
}

async function copyIfExists(src, dest) {
  if (!src) return false;
  try {
    await cp(src, dest, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

async function copyRuntimeAssetsDir(src, dest, options = {}) {
  if (!src) return false;
  const { keep = null } = options;
  try {
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        if (!keep || keep(entry.name, true)) await cp(from, to, { recursive: true });
        continue;
      }
      if (!keep || keep(entry.name, false)) await cp(from, to);
    }
    return true;
  } catch {
    return false;
  }
}

async function copyRuntimeAssetDirFromRuntime(runtimeUrl, destRel, options = {}) {
  const src = resolveSourcePath(runtimeUrl);
  if (!src) return false;
  return copyRuntimeAssetsDir(src, path.join(out, destRel), options);
}

async function copyAssetDirFromRuntime(runtimeUrl, destRel) {
  return copyRuntimeAssetDirFromRuntime(runtimeUrl, destRel);
}

async function readJsonMaybe(filePath) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); } catch { return null; }
}

function sanitizeManifest(manifest) {
  return fixDeep(manifest || {});
}

function prehydrateHtml(html, fixedSession, uiManifest = {}) {
  const runtime = fixedSession.runtimeConfig || {};
  const concept = fixedSession.concept || {};
  const pack = runtime.contentPack || {};
  const shopName = runtime.shopName || concept.shopName || '世界商店';
  const brandEyebrow = runtime.brandEyebrow || fixedSession.worldName || 'World Shop';
  const assistantName = runtime.assistantName || concept.assistantName || '店员助手';
  const readyLine = concept.readySummary || concept.confirmationLine || '货源正在接入，店铺马上开张。';
  const firstIntro = getIntroEntry(fixedSession, 0);
  const firstItemName = firstItem(pack, 'botanical', 0) || '第一件货品';
  const assistantPortrait = relUrl(runtime.assistantPortraits?.serious || './generated/assets/assistant_portraits/serious.png');
  const uiBindings = uiManifest?.bindings || {};
  const uiUrl = (role, index) => relUrl(uiBindings[role]?.url || `./generated/assets/ui_buttons/button_1_${index}.png`);

  let next = html;
  next = next.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(shopName)}</title>`);
  next = next.replace(/<body(\s[^>]*)?>/, '<body$1 class="shop-booting">');
  next = next.replace(/<p id="brandEyebrow" class="eyebrow"[^>]*>[^<]*<\/p>/, `<p id="brandEyebrow" class="eyebrow">${escapeHtml(brandEyebrow)}</p>`);
  next = next.replace(/<strong id="brandTitle" class="brand-title">[^<]*<\/strong>/, `<strong id="brandTitle" class="brand-title">${escapeHtml(shopName)}</strong>`);
  next = next.replace(/aria-label="Harry Potter merge board"/g, `aria-label="${escapeHtml(shopName)}合成台"`);
  next = next.replace(/id="assistantPortrait"([\s\S]*?)src="[^"]*"([\s\S]*?)alt="[^"]*"/, `id="assistantPortrait"$1src="${escapeHtml(assistantPortrait)}"$2alt="${escapeHtml(assistantName)}立绘"`);
  next = next.replace(/<div id="assistantMood" class="assistant-mood">[^<]*<\/div>/, '<div id="assistantMood" class="assistant-mood">准备就绪</div>');
  next = next.replace(/<strong id="assistantName">[^<]*<\/strong>/, `<strong id="assistantName">${escapeHtml(assistantName)}</strong>`);
  next = next.replace(/<p id="assistantLine" class="assistant-line">[\s\S]*?<\/p>/, `<p id="assistantLine" class="assistant-line">${escapeHtml(readyLine)}</p>`);
  next = next.replace(/<span id="assistantFocus" hidden>[^<]*<\/span>/, `<span id="assistantFocus" hidden>${escapeHtml('今日重点：先完成第一张订单')}</span>`);
  next = next.replace(/<span id="assistantStatus" hidden>[^<]*<\/span>/, `<span id="assistantStatus" hidden>${escapeHtml('店铺状态：静态资源已接入')}</span>`);
  next = next.replace(/<div id="introScene" class="intro-scene">[^<]*<\/div>/, `<div id="introScene" class="intro-scene">${escapeHtml(shopName)} · 开张引导</div>`);
  next = next.replace(/<h2 id="introSpeaker">[^<]*<\/h2>/, `<h2 id="introSpeaker">${escapeHtml(firstIntro.speaker || assistantName)}</h2>`);
  next = next.replace(/<p id="introText" class="intro-text">[\s\S]*?<\/p>/, `<p id="introText" class="intro-text">${escapeHtml(firstIntro.text || readyLine)}</p>`);
  next = next.replace(/<p id="reportAssistantLine" class="report-assistant">[\s\S]*?<\/p>/, `<p id="reportAssistantLine" class="report-assistant">${escapeHtml(`${assistantName}：${readyLine}`)}</p>`);
  next = next.replace(/<p id="itemDetailChain" class="section-kicker">[^<]*<\/p>/, '<p id="itemDetailChain" class="section-kicker">货品档案</p>');
  next = next.replace(/<h2 id="itemDetailTitle">[^<]*<\/h2>/, `<h2 id="itemDetailTitle">${escapeHtml(firstItemName)}</h2>`);
  next = next.replace(/<p id="itemDetailSubtitle" class="item-detail-subtitle">[^<]*<\/p>/, '<p id="itemDetailSubtitle" class="item-detail-subtitle">开张后可在图鉴中查看完整说明。</p>');
  next = next.replace(/<p class="section-kicker">馆藏页面<\/p>/, '<p class="section-kicker">图鉴页面</p>');
  next = next.replace(/<h2 id="libraryTitle">[^<]*<\/h2>/, '<h2 id="libraryTitle">图鉴与收藏架</h2>');
  next = next.replace(/<span id="schoolStatusText">[^<]*<\/span>/, `<span id="schoolStatusText">${escapeHtml(shopName)}待命</span>`);
  next = next.replace(/<span id="schoolStatusDetail">[^<]*<\/span>/, `<span id="schoolStatusDetail">${escapeHtml(readyLine)}</span>`);
  next = next.replace(/<img data-ui-sticker="hall" src="[^"]*"/g, `<img data-ui-sticker="hall" src="${escapeHtml(uiUrl('hall', 1))}"`);
  next = next.replace(/<img data-ui-sticker="codex" src="[^"]*"/g, `<img data-ui-sticker="codex" src="${escapeHtml(uiUrl('codex', 2))}"`);
  next = next.replace(/<img data-ui-sticker="shelf" src="[^"]*"/g, `<img data-ui-sticker="shelf" src="${escapeHtml(uiUrl('shelf', 3))}"`);
  next = next.replace(/<img data-ui-sticker="reset" src="[^"]*"/g, `<img data-ui-sticker="reset" src="${escapeHtml(uiUrl('reset', 4))}"`);
  next = next.replace(/<img data-ui-sticker="trash" src="[^"]*"/g, `<img data-ui-sticker="trash" src="${escapeHtml(uiUrl('trash', 5))}"`);

  const bootMarkup = `
    <div id="shopBootScreen" class="shop-boot-screen" role="status" aria-live="polite">
      <div class="shop-boot-card">
        <strong data-boot-shop-name>${escapeHtml(shopName)}</strong>
        <span data-boot-line>${escapeHtml(readyLine)}</span>
      </div>
    </div>`;
  if (!next.includes('id="shopBootScreen"')) {
    next = next.replace(/<body([^>]*)>/, `<body$1>${bootMarkup}`);
  }
  return next;
}

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'generated', 'assets'), { recursive: true });

const runtimeImageFile = (name, isDirectory = false) => {
  if (isDirectory) return false;
  return /^(?:manifest\.json|.+\.(?:png|webp|avif|jpg|jpeg|svg))$/i.test(name)
    && !/_(?:raw|cutout|trimmed)\.(?:png|webp|avif|jpg|jpeg)$/i.test(name)
    && !/(?:^|[._-])raw(?:[._-]|$)/i.test(name);
};

for (const file of ['index.html', 'app.js', 'styles.css', 'sfx.js']) {
  await cp(path.join(root, file), path.join(out, file));
}
await mkdir(path.join(out, 'assets'), { recursive: true });
await cp(path.join(root, 'assets', 'sfx'), path.join(out, 'assets', 'sfx'), { recursive: true });

await copyRuntimeAssetDirFromRuntime(runtime.tileAssetBase, 'generated/assets/tiles', { keep: runtimeImageFile });
await copyRuntimeAssetDirFromRuntime(Object.values(runtime.assistantPortraits || {})[0]?.replace(/\/[^/]+$/, ''), 'generated/assets/assistant_portraits', { keep: runtimeImageFile });
await copyRuntimeAssetDirFromRuntime(runtime.decorationManifestUrl?.replace(/\/manifest\.json$/, ''), 'generated/assets/shop_decorations', { keep: runtimeImageFile });
await copyRuntimeAssetDirFromRuntime(runtime.uiButtonManifestUrl?.replace(/\/manifest\.json$/, ''), 'generated/assets/ui_buttons', { keep: runtimeImageFile });

const evidenceMap = [
  ['shopSheet', 'shop_sheet_4x8.png'],
  ['assistantSheet', 'assistant_sheet_2x2.png'],
  ['shopDecorStickers', 'shop_decor_stickers_2x3.png'],
  ['uiButtonStickers', 'ui_button_stickers_1x5.png'],
];
// Always include the assistant portrait sheet in the export so QA can
// verify grid alignment (alpha offset must be ≤2px from origin).
// A sheet-level remove_background before splitting produces offsets like +4px,
// causing grid misalignment that trim then masks.
const assistantSheetSrc = resolveSourcePath(generatedAssets.assistantSheet);
if (assistantSheetSrc) {
  await copyIfExists(assistantSheetSrc, path.join(out, 'generated', 'assets', 'assistant_sheet_2x2.png'));
}

if (process.env.SHOP_EXPORT_INCLUDE_EVIDENCE === '1') {
  for (const [key, destName] of evidenceMap) {
    const src = resolveSourcePath(generatedAssets[key]);
    await copyIfExists(src, path.join(out, 'generated', 'assets', destName));
    if (src) {
      await copyIfExists(src.replace(/\.png$/i, '_raw.png'), path.join(out, 'generated', 'assets', destName.replace(/\.png$/i, '_raw.png')));
      await copyIfExists(src.replace(/\.png$/i, '_cutout.png'), path.join(out, 'generated', 'assets', destName.replace(/\.png$/i, '_cutout.png')));
      await copyIfExists(src.replace(/\.png$/i, '_trimmed.png'), path.join(out, 'generated', 'assets', destName.replace(/\.png$/i, '_trimmed.png')));
    }
  }
}

const fixedSession = fixDeep({ ...session, enteredShop: true });
fixedSession.runtimeConfig = fixedSession.runtimeConfig || {};
fixedSession.runtimeConfig.tileAssetBase = './generated/assets/tiles';
fixedSession.runtimeConfig.decorationManifestUrl = './generated/assets/shop_decorations/manifest.json';
fixedSession.runtimeConfig.uiButtonManifestUrl = './generated/assets/ui_buttons/manifest.json';
fixedSession.runtimeConfig.assistantManifestUrl = './generated/assets/assistant_portraits/manifest.json';
fixedSession.runtimeConfig.assistantPortraits = {
  smile: './generated/assets/assistant_portraits/smile.png',
  serious: './generated/assets/assistant_portraits/serious.png',
  angry: './generated/assets/assistant_portraits/angry.png',
  confused: './generated/assets/assistant_portraits/confused.png',
  ...(fixedSession.runtimeConfig.assistantPortraits || {}),
};
fixedSession.runtimeConfig.assistantPortraits = fixDeep(fixedSession.runtimeConfig.assistantPortraits);
if (fixedSession.runtimeConfig.tileManifest) fixedSession.runtimeConfig.tileManifest = sanitizeManifest(fixedSession.runtimeConfig.tileManifest);

const decorManifest = sanitizeManifest(await readJsonMaybe(path.join(out, 'generated/assets/shop_decorations/manifest.json')) || {});
const uiManifest = sanitizeManifest(await readJsonMaybe(path.join(out, 'generated/assets/ui_buttons/manifest.json')) || {});
const tileManifest = sanitizeManifest(await readJsonMaybe(path.join(out, 'generated/assets/tiles/manifest.json')) || fixedSession.runtimeConfig.tileManifest || {});
const assistantManifest = sanitizeManifest(await readJsonMaybe(path.join(out, 'generated/assets/assistant_portraits/manifest.json')) || {});

if (tileManifest && Object.keys(tileManifest).length) {
  await mkdir(path.join(out, 'generated/assets/tiles'), { recursive: true });
  tileManifest.tileBaseUrl = './generated/assets/tiles';
  if (Array.isArray(tileManifest.tiles)) tileManifest.tiles = tileManifest.tiles.map(t => ({ ...t, url: `./generated/assets/tiles/${t.fileName}` }));
  if (tileManifest.bindings) {
    tileManifest.bindings = Object.fromEntries(Object.entries(tileManifest.bindings).map(([id, b]) => [id, { ...b, url: `./generated/assets/tiles/${b.fileName}` }]));
  }
  fixedSession.runtimeConfig.tileManifest = tileManifest;
  await writeFile(path.join(out, 'generated/assets/tiles/manifest.json'), JSON.stringify(tileManifest, null, 2));
}
if (decorManifest && Object.keys(decorManifest).length) {
  await mkdir(path.join(out, 'generated/assets/shop_decorations'), { recursive: true });
  await writeFile(path.join(out, 'generated/assets/shop_decorations/manifest.json'), JSON.stringify(decorManifest, null, 2));
}
if (uiManifest && Object.keys(uiManifest).length) {
  await mkdir(path.join(out, 'generated/assets/ui_buttons'), { recursive: true });
  await writeFile(path.join(out, 'generated/assets/ui_buttons/manifest.json'), JSON.stringify(uiManifest, null, 2));
}
if (assistantManifest && Object.keys(assistantManifest).length) {
  await mkdir(path.join(out, 'generated/assets/assistant_portraits'), { recursive: true });
  await writeFile(path.join(out, 'generated/assets/assistant_portraits/manifest.json'), JSON.stringify(assistantManifest, null, 2));
}

await writeFile(path.join(out, 'session.json'), JSON.stringify(fixedSession, null, 2));
await writeFile(path.join(out, 'static-session.js'), [
  'window.__SHOP_STATIC_MODE__ = true;',
  `window.__SHOP_STATIC_SESSION__ = ${JSON.stringify(fixedSession)};`,
  `window.__SHOP_RUNTIME__ = ${JSON.stringify(fixedSession.runtimeConfig)};`,
  `window.__SHOP_DECORATION_MANIFEST__ = ${JSON.stringify(decorManifest || {})};`,
  `window.__SHOP_UI_BUTTON_MANIFEST__ = ${JSON.stringify(uiManifest || {})};`,
  `window.__SHOP_TILE_MANIFEST__ = ${JSON.stringify(tileManifest || {})};`,
  '',
].join('\n'));

let html = await readFile(path.join(out, 'index.html'), 'utf8');
html = html.replace('id="appShell" class="app-shell" data-shop-rank="1" hidden', 'id="appShell" class="app-shell" data-shop-rank="1"');
html = html.replace(/<section id="creatorOverlay" class="creator-page">[\s\S]*?<\/section>\s*(?=<div id="dragLayer")/, '<section id="creatorOverlay" class="creator-page" hidden></section>\n      ');
html = html.replace(/\n\s*<script src="\.\/neta-config\.js"><\/script>/g, '');
html = html.replace(/\n\s*<script src="\.\/neta-auth\.js"><\/script>/g, '');
html = html.replace(/\n\s*<script src="\.\/creator\.js"><\/script>/g, '');
html = html.replace(/<script src="\.\/sfx\.js"><\/script>/, '<script src="./static-session.js"></script>\n    <script src="./sfx.js"></script>');
html = prehydrateHtml(html, fixedSession, uiManifest);
await writeFile(path.join(out, 'index.html'), html);

console.log(out);
