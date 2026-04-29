# Included Engine Subset

This directory is a runnable/reference subset copied from `witch-curio-shop-mvp-2` for the Themed World Shop Builder skill.

It intentionally includes the scripts and runtime assets the skill directly depends on:

- local server/orchestrator: `server.mjs`
- playable runtime: `index.html`, `app.js`, `styles.css`, `sfx.js`
- creator/build UI and auth helpers: `creator.js`, `neta-auth.js`, `neta-config.js`
- local build worker: `builder/local-codex-worker.mjs`
- Neta creative asset pipeline: `builder/local-asset-pipeline.mjs`
- local/remote agent contract: `builder/agent-handshake.md`
- shop-builder profile and prompts: `builder/skills/shop-builder/*`
- split helper: `builder/scripts/split_image_grid.py`
- packaged sound effects: `assets/sfx/*.ogg`

Not included:

- `node_modules/`
- generated sessions and build artifacts
- private auth caches or `.neta-skill-config`
- raw source audio zip archives under `assets/sfx/_sources`
- `.git/`

Use `npm install` in this directory if you need to run the included engine subset independently.
