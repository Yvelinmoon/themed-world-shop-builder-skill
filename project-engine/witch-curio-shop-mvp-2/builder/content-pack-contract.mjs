export const CONTENT_PACK_CHAIN_ORDER = ["botanical", "alchemy", "curio", "waste", "secret"];
export const CONTENT_PACK_CHAIN_COUNTS = {
  botanical: 6,
  alchemy: 6,
  curio: 6,
  waste: 6,
  secret: 8,
};

export const DEFAULT_CONTENT_TERMS = [
  "基础小件",
  "成形小件",
  "进阶小件",
  "成套货件",
  "精选货件",
  "招牌成货",
  "半成品件",
  "初配件",
  "定型件",
  "高配件",
  "精炼件",
  "完成成品",
  "风味小物",
  "特色件",
  "亮眼件",
  "镇店特色",
  "隐藏样件",
  "隐藏小件",
];

export const LEGACY_THEME_TERMS = [
  "cozy farming",
  "farm-town",
  "farming general-store",
  "seed packet",
  "fertilizer",
  "soil bag",
  "Pierre",
  "Stardew",
  "Hermione",
  "Ollivanders",
  "Harry Potter",
  "霍格沃茨",
  "Mars",
  "Elon",
  "Starbucks",
  "laoqin",
  "lotr",
  "red-alert",
  "hp-wood",
  "/Downloads",
  "/generated/shop-stickers",
];

function textOfItem(item) {
  if (Array.isArray(item)) return { name: String(item[0] || "").trim(), description: String(item[1] || "").trim() };
  if (item && typeof item === "object") return { name: String(item.name || "").trim(), description: String(item.description || "").trim() };
  return { name: "", description: "" };
}

function pushFailure(failures, code, detail) {
  failures.push({ code, detail });
}

export function validateContentPackShape(contentPack, options = {}) {
  const failures = [];
  const pack = contentPack && typeof contentPack === "object" ? contentPack : {};
  const { requireThemed = false, expectedKeywords = [], forbidDefaultTerms = true, forbidLegacyTerms = true } = options;

  if (!Array.isArray(pack.sources) || pack.sources.length !== 3) pushFailure(failures, "sources-count", { expected: 3, actual: pack.sources?.length || 0 });
  if (!Array.isArray(pack.clients) || pack.clients.length !== 5) pushFailure(failures, "clients-count", { expected: 5, actual: pack.clients?.length || 0 });
  if (!Array.isArray(pack.chains) || pack.chains.length !== 5) pushFailure(failures, "chains-count", { expected: 5, actual: pack.chains?.length || 0 });
  if (!Array.isArray(pack.recipes) || pack.recipes.length !== 3) pushFailure(failures, "recipes-count", { expected: 3, actual: pack.recipes?.length || 0 });
  if (!Array.isArray(pack.blessings) || pack.blessings.length !== 3) pushFailure(failures, "blessings-count", { expected: 3, actual: pack.blessings?.length || 0 });
  if (!Array.isArray(pack.introSequence) || pack.introSequence.length !== 4) pushFailure(failures, "intro-count", { expected: 4, actual: pack.introSequence?.length || 0 });

  const chainById = new Map(Array.isArray(pack.chains) ? pack.chains.map((chain) => [chain.id, chain]) : []);
  for (const chainId of CONTENT_PACK_CHAIN_ORDER) {
    const chain = chainById.get(chainId);
    if (!chain) {
      pushFailure(failures, "missing-chain", chainId);
      continue;
    }
    const expectedCount = CONTENT_PACK_CHAIN_COUNTS[chainId];
    if (!Array.isArray(chain.items) || chain.items.length !== expectedCount) {
      pushFailure(failures, "chain-item-count", { chainId, expected: expectedCount, actual: chain.items?.length || 0 });
    }
    (chain.items || []).forEach((item, index) => {
      const normalized = textOfItem(item);
      if (!normalized.name) pushFailure(failures, "item-name-empty", { chainId, tier: index + 1 });
      if (!normalized.description) pushFailure(failures, "item-description-empty", { chainId, tier: index + 1, name: normalized.name });
    });
  }

  const allText = [
    ...(pack.sources || []).flatMap((item) => [item.name, item.shortLabel, item.blurb]),
    ...(pack.clients || []).flatMap((item) => [item.name, item.role, item.requestFlavor]),
    ...(pack.chains || []).flatMap((chain) => [chain.label, ...(chain.items || []).flatMap((item) => { const t = textOfItem(item); return [t.name, t.description]; })]),
    ...(pack.recipes || []).flatMap((item) => [item.title, item.body]),
    ...(pack.blessings || []).flatMap((item) => [item.title, item.description, ...(item.tags || [])]),
    ...(pack.introSequence || []).flatMap((item) => [item.speaker, item.text]),
  ].filter(Boolean).join("\n");

  if (forbidDefaultTerms) {
    for (const term of DEFAULT_CONTENT_TERMS) if (allText.includes(term)) pushFailure(failures, "default-content-term", term);
  }
  if (forbidLegacyTerms) {
    for (const term of LEGACY_THEME_TERMS) if (allText.includes(term)) pushFailure(failures, "legacy-content-term", term);
  }
  const keywords = expectedKeywords.map((item) => String(item || "").trim()).filter(Boolean);
  if (requireThemed && keywords.length && !keywords.some((term) => allText.includes(term))) {
    pushFailure(failures, "missing-expected-theme-keyword", keywords);
  }
  return { ok: failures.length === 0, failures, text: allText };
}

export function assertContentPackReady(contentPack, options = {}) {
  const result = validateContentPackShape(contentPack, options);
  if (!result.ok) {
    const error = new Error(`Content pack is not publishable: ${result.failures.map((f) => f.code).join(", ")}`);
    error.failures = result.failures;
    throw error;
  }
  return result;
}
