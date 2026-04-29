# Project Engine Reference — witch-curio-shop-mvp-2

This skill uses `witch-curio-shop-mvp-2` as the production engine for themed world-shop builds.

Canonical project path in this workspace:

```text
/workspace/03-gameplay-projects 🎮/active/witch-curio-shop-mvp-2
```

Upstream repository:

```text
https://github.com/Yvelinmoon/witch-curio-shop-mvp-2
```

## Required engine pieces

The skill depends on these parts of the project:

- `server.mjs`
  - local orchestrator
  - `/api/build/start`
  - `/api/session`
  - `world-shop-agent/v1` handshake generation
  - LLM concept/content-pack routes
- `builder/local-codex-worker.mjs`
  - local job polling
  - build-stage progression
  - ready session completion
- `builder/local-asset-pipeline.mjs`
  - Neta creative image calls
  - image download/conversion
  - assistant/shop/decor/UI splitting
  - runtimeConfig asset URL generation
- `builder/agent-handshake.md`
  - local/remote agent protocol contract
- `builder/skills/shop-builder/profile.json`
  - required image plan
  - split rows/cols
- `builder/skills/shop-builder/prompt_*.md`
  - image and world patch prompt constraints
- `app.js`
  - playable merge-shop runtime
  - runtimeConfig injection
  - item/catalog rebuild
  - decoration drag/resize/persistence
  - UI button sticker loading
  - theme contrast normalization
- `styles.css`
  - shop layout and visual system
- `sfx.js` and `assets/sfx/`
  - interaction and merge audio
- `index.html`
  - base shell for static export

## Runtime artifacts the skill expects

A completed build should produce:

```text
generated/build-artifacts/<jobId>/
├── assistant_sheet_2x2.png
├── assistant_portraits/
│   ├── manifest.json
│   ├── smile.png
│   ├── serious.png
│   ├── angry.png
│   └── confused.png
├── shop_sheet_4x8.png
├── tiles/
│   ├── manifest.json
│   └── item_*.png
├── shop_decor_stickers_2x3.png
├── shop_decorations/
│   ├── manifest.json
│   └── decor_*.png
├── ui_button_stickers_1x5.png
└── ui_buttons/
    ├── manifest.json
    └── button_*.png
```

The static export should include:

```text
index.html
app.js
styles.css
sfx.js
session.json
assets/sfx/
generated/build-artifacts/<jobId>/...
```

`creator.js`, `neta-auth.js`, and `neta-config.js` are not required for final direct-play static exports unless the export deliberately uses creator-side helpers. Prefer not to publish them if the page is direct-play only.

## Static-mode contract

The exported page must inject:

```js
window.__SHOP_STATIC_MODE__ = true;
window.__SHOP_STATIC_SESSION__ = session;
window.__SHOP_RUNTIME__ = session.runtimeConfig;
```

Then it must show `#appShell` directly and avoid `/api/session` / OAuth dependencies.

## Neta skill auth contract

For real image generation, use the Neta skill device login rather than the project frontend OAuth:

```bash
NETA_CONFIG_DIR="<project>/generated/.neta-skill-config" \
  npx -y @talesofai/neta-skills@latest login --action request-code

NETA_CONFIG_DIR="<project>/generated/.neta-skill-config" \
  npx -y @talesofai/neta-skills@latest login --action verify-code
```

For the project image pipeline, ensure the worker process has:

```bash
NETA_CONFIG_DIR=<project>/generated/.neta-skill-config
NETA_TOKEN=<access token from the Neta skill login cache>
```

The token must never be published to `/public` or committed to the skill repository.

## Linux image conversion note

Some versions of the engine call macOS `sips` for image conversion/resizing. In Linux runtimes this fails with:

```text
spawn /usr/bin/sips ENOENT
```

Use an environment-available converter such as ImageMagick `convert` for local builds, or update the engine to use a cross-platform conversion path. This is an engine-runtime compatibility issue, not a Neta generation failure.

## Asset/name binding QA

Neta image generation can produce a valid sheet whose visual slots do not perfectly match the planned item names. The skill must verify the final mapping:

- rendered tile image
- `tileManifest.bindings[itemId].url`
- `contentPack.chains[].items[].name`
- in-game item detail name

If a visible mismatch appears, such as a stone image named “oak log”, fix by either:

1. regenerating the sheet with stricter per-slot prompt order, or
2. remapping `tileManifest.bindings` and content-pack chain names so visible art and item names agree.

Do not ship a page where the visual item and item name obviously contradict each other.
