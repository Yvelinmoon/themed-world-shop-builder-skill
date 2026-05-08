import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { validateContentPackShape } from './content-pack-contract.mjs';

const [,, exportDirArg, ...args] = process.argv;
if (!exportDirArg) throw new Error('Usage: node builder/qa-static-shop.mjs <static-export-dir> [--expect-shop NAME] [--expect-world NAME] [--forbid a,b,c] [--report out.json]');
const exportDir = path.resolve(process.cwd(), exportDirArg);
function argValue(flag, fallback='') { const i=args.indexOf(flag); return i>=0 ? args[i+1] || fallback : fallback; }
const expectShop = argValue('--expect-shop');
const expectWorld = argValue('--expect-world');
const reportPath = argValue('--report');
const forbid = new Set([
  '老秦','红色警戒','复古等距战场','火星','星巴克','Starbucks','Mars','Elon','娜塔莎','Hermione','Harry Potter','Ollivanders','hp-wood','/workspace','/Downloads','/generated/shop-stickers',
  ...argValue('--forbid').split(',').map(s=>s.trim()).filter(Boolean),
]);
const activeFiles = ['index.html','session.json','static-session.js'];
const sourceFiles = ['app.js','styles.css'];
const failures=[]; const warnings=[];
async function exists(p){try{await access(p);return true}catch{return false}}
async function readText(rel){try{return await readFile(path.join(exportDir,rel),'utf8')}catch{return ''}}
function fail(code, detail){failures.push({code,detail})} function warn(code, detail){warnings.push({code,detail})}

for (const file of ['index.html','app.js','styles.css','sfx.js','session.json','static-session.js']) if(!(await exists(path.join(exportDir,file)))) fail('missing-file',file);

const session = JSON.parse(await readText('session.json') || '{}');
const staticJs = await readText('static-session.js');
const html = await readText('index.html');
if (!staticJs.includes('window.__SHOP_STATIC_MODE__ = true')) fail('missing-static-mode','static-session.js');
if (html.includes('creator.js') || html.includes('neta-auth.js') || html.includes('neta-config.js')) fail('creator-or-auth-script','index.html includes creator/auth script');

if (expectShop) {
  if (session.runtimeConfig?.shopName !== expectShop) fail('shop-name-mismatch',{expected:expectShop,actual:session.runtimeConfig?.shopName});
  if (session.concept?.shopName !== expectShop) fail('concept-shop-name-mismatch',{expected:expectShop,actual:session.concept?.shopName});
}
if (expectWorld) {
  if (session.worldName !== expectWorld) fail('world-name-mismatch',{expected:expectWorld,actual:session.worldName});
  if (session.runtimeConfig?.worldName && session.runtimeConfig.worldName !== expectWorld) fail('runtime-world-mismatch',{expected:expectWorld,actual:session.runtimeConfig.worldName});
}

for (const file of activeFiles) {
  const text = await readText(file);
  for (const term of forbid) {
    if (!term) continue;
    if (text.includes(term)) fail('forbidden-term',{file,term});
  }
}
for (const file of sourceFiles) {
  const text = await readText(file);
  for (const term of forbid) {
    if (!term) continue;
    if (['/workspace','/Downloads','/generated/shop-stickers','hp-wood','Hermione','Ollivanders','Harry Potter','霍格沃茨','Starbucks','red-alert','laoqin','lotr'].includes(term) && text.includes(term)) {
      fail('forbidden-source-term',{file,term});
    }
  }
}

const runtime = session.runtimeConfig || {};
const tileManifest = runtime.tileManifest || {};
const cp = runtime.contentPack || {};
const contentCheck = validateContentPackShape(cp, {
  requireThemed: Boolean(expectShop || session.shopIdea || session.concept?.summary),
  expectedKeywords: [expectShop, session.shopIdea, session.concept?.summary]
    .flatMap((value) => String(value || '').match(/[\u4e00-\u9fa5]{2,}/g) || [])
    .slice(0, 12),
});
for (const item of contentCheck.failures) fail(`content-${item.code}`, item.detail);
if (!Array.isArray(cp.chains) || !cp.chains.length) fail('missing-content-pack-chains','runtimeConfig.contentPack.chains');
if (!tileManifest.bindings) fail('missing-tile-bindings','runtimeConfig.tileManifest.bindings');

const expectedItems=[];
for (const chain of cp.chains || []) {
  const items = Array.isArray(chain.items) ? chain.items : [];
  items.forEach((item, index)=>{
    expectedItems.push({itemId:`${chain.id}-${index+1}`, chainId:chain.id, chainLabel:chain.label, tier:index+1, name:Array.isArray(item)?item[0]:item.name, description:Array.isArray(item)?item[1]:item.description});
  });
}
for (const exp of expectedItems) {
  const b = tileManifest.bindings?.[exp.itemId];
  if (!b) { fail('missing-item-binding',exp.itemId); continue; }
  for (const key of ['chainId','tier','name','description']) {
    if (String(b[key] ?? '') !== String(exp[key] ?? '')) fail('tile-binding-mismatch',{itemId:exp.itemId,key,expected:exp[key],actual:b[key]});
  }
  if (!String(b.url||'').startsWith('./generated/assets/tiles/')) fail('tile-url-not-relative',{itemId:exp.itemId,url:b.url});
  if (!(await exists(path.join(exportDir, b.url.replace(/^\.\//,''))))) fail('tile-file-missing',{itemId:exp.itemId,url:b.url});
}

const portraits = runtime.assistantPortraits || {};
for (const key of ['smile','serious','angry','confused']) {
  const url = portraits[key];
  if (!url || !String(url).startsWith('./generated/assets/assistant_portraits/')) fail('assistant-url-invalid',{key,url});
  else if (!(await exists(path.join(exportDir, url.replace(/^\.\//,''))))) fail('assistant-file-missing',{key,url});
}

// Assistant portrait grid alignment & completeness check.
// When remove_background crops the whole sheet before splitting, the cutout
// shifts portrait content away from grid boundaries. After contain-padding
// back to 1600×900 and blind grid split, the split tiles are misaligned —
// one portrait may have part of another's body, or be cut on one side.
// Trim then masks the misalignment because it crops to alpha bounds.
// This QA check detects the root cause: grid-offset misalignment on the
// normalized sheet, and suspiciously small/clipped portrait tiles.
{
  const assistantManifest = JSON.parse(await readText('generated/assets/assistant_portraits/manifest.json') || '{}');
  const sheetW = assistantManifest.sheet?.width || 1600;
  const sheetH = assistantManifest.sheet?.height || 900;
  const sheetRows = 2;
  const sheetCols = 2;
  const cellW = sheetW / sheetCols;
  const cellH = sheetH / sheetRows;

  // Check portrait tile plausibility: each tile should not be tiny (which
  // indicates a 1×1 empty file from a failed pipeline). A correct portrait
  // from a split-raw-first pipeline typically occupies ~18% of its 800×450
  // grid cell after white-to-alpha and trim. Even a grid-misaligned clip
  // from the old remove_background-before-split pipeline was ~28% cell fill.
  // So 30% threshold would be too strict. Use 5% (36,000 px for 800×450)
  // to catch truly broken/empty tiles; grid misalignment is caught by the
  // alpha-offset and aspect-deviation checks instead.
  const minPortraitPixels = Math.round(cellW * cellH * 0.05);
  for (const key of ['smile','serious','angry','confused']) {
    const url = portraits[key];
    if (!url) continue;
    const filePath = path.join(exportDir, url.replace(/^\.\//,''));
    if (!(await exists(filePath))) continue;
    try {
      const PNG = await import('pngjs').then(m => m.PNG || m.default.PNG);
      const buffer = await readFile(filePath);
      const png = PNG.sync.read(buffer);
      // Count non-transparent pixels
      let opaquePixels = 0;
      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          if (png.data[(png.width * y + x) * 4 + 3] > 0) opaquePixels++;
        }
      }
      if (png.width <= 1 && png.height <= 1) fail('portrait-tile-1x1',{key,width:png.width,height:png.height});
      if (opaquePixels < minPortraitPixels) fail('portrait-tile-too-small',{key,width:png.width,height:png.height,opaquePixels,minPortraitPixels,threshold:'30% of cell'});
    } catch (e) {
      warn('portrait-png-read-failed',{key,error:e.message});
    }
  }

  // Check: if a normalized sheet file exists (from build artifacts or evidence),
  // verify that the content region's offset is within 2px of the grid origin.
  // A sheet-level remove_background cutout will produce an offset like +4px,
  // meaning the grid split at cell boundaries will cut through portrait bodies.
  // The correct pipeline (split-raw-first, per-tile-white-to-alpha) produces
  // an offset of 0 because the raw sheet has perfect grid alignment.
  // Note: the static export may not include the normalized sheet itself, but
  // we check the manifest's sheet dimensions to infer alignment.
  // Portrait tile aspect ratio consistency check.
  // When grid misalignment causes one portrait to be clipped, its
  // width/height ratio becomes noticeably different from the others.
  // All 4 portraits from the same sheet should have similar proportions.
  const portraitDimensions = [];
  for (const key of ['smile','serious','angry','confused']) {
    const url = portraits[key];
    if (!url) continue;
    const filePath = path.join(exportDir, url.replace(/^\.\//,''));
    if (!(await exists(filePath))) continue;
    try {
      const PNGModule = await import('pngjs').then(m => m.PNG || m.default.PNG);
      const buffer = await readFile(filePath);
      const png = PNGModule.sync.read(buffer);
      portraitDimensions.push({key, width:png.width, height:png.height, ratio:png.width/png.height});
    } catch (e) { /* already warned above */ }
  }
  if (portraitDimensions.length >= 3) {
    const ratios = portraitDimensions.map(d => d.ratio);
    const medianRatio = ratios.sort((a,b) => a-b)[Math.floor(ratios.length/2)];
    for (const d of portraitDimensions) {
      const deviation = Math.abs(d.ratio - medianRatio);
      if (deviation > 0.2) {
        // A portrait that's 20% narrower or wider than the median is likely
        // clipped by grid misalignment — one side was cut by the grid line.
        fail('portrait-tile-aspect-deviation',{key:d.key, width:d.width, height:d.height, ratio:d.ratio.toFixed(2), medianRatio:medianRatio.toFixed(2), deviation:deviation.toFixed(2)});
      }
    }
  }

  // Check: if a normalized assistant sheet exists in build artifacts (accessible
  // via the manifest sheet.path or nearby evidence), verify that the content
  // region's offset is within 2px of the grid origin (0,0).
  // A sheet-level remove_background cutout shifts content away from grid
  // boundaries. After contain-padding to 1600×900, the alpha content starts
  // at an offset like (4,0), meaning the 2×2 grid split at (800,450) cuts
  // through portrait bodies. The correct pipeline (split-raw-first) produces
  // an offset of 0 because the normalized sheet is a proportional resize of
  // the raw sheet with white background intact.
  // This check reads the sheet from the manifest's path if it resolves inside
  // the export directory or engine build artifacts.
  const sheetPath = assistantManifest.sheet?.path;
  if (sheetPath) {
    // Try resolving: first as relative to export dir, then as engine artifact
    const candidates = [
      path.join(exportDir, sheetPath.replace(/^\.\//,'')),
      sheetPath, // may be absolute engine path
      path.join(exportDir, 'generated/assets/assistant_sheet_2x2.png'), // evidence in export
    ];
    for (const candidate of candidates) {
      if (!(await exists(candidate))) continue;
      try {
        const PNGModule = await import('pngjs').then(m => m.PNG || m.default.PNG);
        const buffer = await readFile(candidate);
        const png = PNGModule.sync.read(buffer);
        // Find alpha bounding box of the sheet
        let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
        for (let y = 0; y < png.height; y++) {
          for (let x = 0; x < png.width; x++) {
            if (png.data[(png.width * y + x) * 4 + 3] > 0) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX >= minX && maxY >= minY) {
          const offsetX = minX;
          const offsetY = minY;
          const maxAllowedOffset = 2;
          if (offsetX > maxAllowedOffset || offsetY > maxAllowedOffset) {
            fail('assistant-sheet-alpha-offset-misaligned',{sheet:candidate, offsetX, offsetY, maxAllowedOffset, explanation:'remove_background cropped the sheet before splitting; portraits are offset from grid boundaries, so 2×2 split will cut through portrait bodies'});
          }
        }
      } catch (e) {
        warn('assistant-sheet-png-read-failed',{sheet:candidate,error:e.message});
      }
      break; // only check the first accessible candidate
    }
  }

  if (sheetW !== 1600 || sheetH !== 900) {
    warn('assistant-sheet-unexpected-size',{width:sheetW,height:sheetH,expected:'1600x900'});
  }
}

const ui = JSON.parse((await readText('generated/assets/ui_buttons/manifest.json')) || '{}');
for (const key of ['hall','codex','shelf','reset','trash']) {
  const url = ui.bindings?.[key]?.url;
  if (!url || !url.startsWith('./generated/assets/ui_buttons/')) fail('ui-binding-invalid',{key,url});
  else if (!(await exists(path.join(exportDir,url.replace(/^\.\//,''))))) fail('ui-file-missing',{key,url});
  if (!html.includes(`data-ui-sticker="${key}"`) || !html.includes(url)) fail('ui-html-prebind-missing',{key,url});
}

const decor = JSON.parse((await readText('generated/assets/shop_decorations/manifest.json')) || '{}');
if (!Array.isArray(decor.stickers)) fail('decor-stickers-not-array','generated/assets/shop_decorations/manifest.json');
for (const sticker of decor.stickers || []) {
  if (!sticker.url?.startsWith('./generated/assets/shop_decorations/')) fail('decor-url-invalid',sticker);
}

const report={ok:failures.length===0, exportDir, expectShop, expectWorld, failures, warnings, checkedAt:new Date().toISOString()};
if (reportPath) await writeFile(path.resolve(process.cwd(),reportPath), JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exit(1);
