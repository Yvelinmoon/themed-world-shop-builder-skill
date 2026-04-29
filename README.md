# Themed World Shop Builder Skill

A Cohub/agent skill for turning a single themed shop idea into a playable static world-shop page, based on the current `witch-curio-shop-mvp-2` production engine.

The project has evolved beyond the original witch-curio framing: this skill treats the engine as a general **themed world shop builder**.

## What it does

Main user-facing flow:

1. User gives a shop idea.
2. Agent generates / confirms the shop concept.
3. Agent automatically builds content and assets.
4. Agent exports an immediately playable static page.
5. Agent runs QA.
6. Agent publishes a public URL.

## Core expectations

- Keep the end-user experience simple: idea → progress updates → playable link.
- Use the current `world-shop-agent/v1` handshake and build-agent flow where available.
- Generate and validate:
  - concept
  - theme tokens
  - assistant portraits
  - content pack
  - shop item sheet
  - tile manifest
  - decor stickers
  - UI button stickers
  - ready session
  - static export
  - QA result
- Static pages must open directly into the playable shop, not the creator flow.

## Files

- `SKILL.md` — full skill definition and execution requirements.
- `project-reference/ENGINE_REFERENCE.md` — explains how the skill references and uses the world-shop engine.
- `project-engine/witch-curio-shop-mvp-2/` — included engine subset with the scripts and runtime assets directly used by this skill:
  - `server.mjs`
  - `app.js`
  - `creator.js`
  - `styles.css`
  - `sfx.js`
  - `index.html`
  - `builder/local-codex-worker.mjs`
  - `builder/local-asset-pipeline.mjs`
  - `builder/agent-handshake.md`
  - `builder/skills/shop-builder/*`
  - `assets/sfx/*.ogg`

The included engine subset intentionally excludes generated artifacts, auth caches, `node_modules`, `.git`, and raw source zip archives.

## Suggested skill name

The internal skill file currently keeps the legacy frontmatter name `themed-shop-static-publisher` for compatibility, while this repository is named `themed-world-shop-builder-skill` to reflect the broader world-shop direction.
