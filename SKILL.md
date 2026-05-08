---
name: themed-shop-static-publisher
description: 把主题小店玩法项目生成为一个可直接打开游玩的静态页面，并发布为公开链接。当用户想“做一个可玩的主题小店页面”“把某个店铺主题自动出成静态成品页”“调用 Neta creative 生成店铺素材并分享成品”时，必须使用这个 skill。它适用于：从一句店铺想法出发，生成概念、文案、商品图、助手立绘、装饰贴纸、按钮贴纸与音效完整资源，组装为可玩的静态 HTML，并最终发布公开 URL。
---

# Themed Shop Static Publisher

这个 skill 把当前 `witch-curio-shop-mvp-2` 项目作为**主题小店生产引擎**来使用，而不是让终端用户自己走完整建店流程。

主流程和用户体验保持不变：

> 用户给一句店铺想法 → Agent 定概念 → 自动生成内容与素材 → 导出打开即玩的静态页 → QA → 发布公开 URL

内部实现必须同步当前项目的新架构：OAuth / LLM concept、`world-shop-agent/v1` handshake、本地或远程 build agent、Neta creative 图像管线、主题色校验与自动对比度修正、可持久化/可缩放装饰布局、装饰与按钮贴纸、音效资源、ready session 与静态注入。

## 强制前置步骤：Neta device login

在运行任何创建商店 / 生成素材 / 启动 build agent / 导出成品流程之前，**必须先执行 Neta Skills 设备登录检查**。这是本 skill 的第 0 阶段，优先级高于 concept、content pack、素材生成和静态导出。

要求：
- 每次开始主题小店创建任务时，先检查当前引擎项目的 Neta skill 登录缓存是否存在且可用。
- 如果没有登录、登录失效、找不到 access token，必须先走 device login，不得继续进入 build。
- 登录缓存只能放在引擎运行目录的 `generated/.neta-skill-config` 下，不能写入 `supermarket/stores/`、`outbox/`、`/public`、归档目录或 git 仓库。
- token 只能作为运行期环境变量传给 worker，例如 `NETA_TOKEN`，严禁写入静态导出、QA 报告、发布目录或任何可分享文件。
- 若用户尚未完成授权，应暂停在登录阶段，并明确说明“开店前需要先把 Neta 创作通道接通”。

推荐命令，`<project>` 应替换为实际使用的引擎根目录：

```bash
NETA_CONFIG_DIR="<project>/generated/.neta-skill-config" \
  npx -y @talesofai/neta-skills@latest login --action request-code

NETA_CONFIG_DIR="<project>/generated/.neta-skill-config" \
  npx -y @talesofai/neta-skills@latest login --action verify-code
```

设备登录完成并确认 token 可供运行期读取后，才能进入后续阶段。

## 阶段 0：登录与引擎准备

1. 选择引擎目录：优先活跃项目 `/workspace/03-gameplay-projects 🎮/active/witch-curio-shop-mvp-2`；否则使用本 skill 的 `project-engine/witch-curio-shop-mvp-2/` 或 workspace 本地引擎副本。
2. 设置：
   ```bash
   NETA_CONFIG_DIR="<project>/generated/.neta-skill-config"
   ```
3. 检查 Neta skill 登录缓存；如不可用，执行 device login。
4. 从登录缓存中取得运行期 access token，并仅以环境变量方式注入 worker：
   ```bash
   NETA_TOKEN="<runtime-only-token>"
   ```
5. 完成以上步骤后，才允许进入“阶段 1：准备建店输入”。

## 目标

输出一个：
- 已完成主题定制
- 打开就能玩，不进入 creator 建店页
- 保留原项目核心玩法体验：合成、订单、补给、图鉴、收藏、装饰拖拽与缩放、助手、入场序章、经营回顾、音效
- 资源完整、无默认旧素材冒充新成品
- 可通过公开 URL 访问

的静态页面成品。

## 何时使用

当用户提出以下任务时使用：
- “帮我做一个某某主题的小店可玩页面”
- “把这个玩法项目变成最终成品静态页”
- “直接生成并分享一个能玩的主题店铺页面”
- “调用 Neta creative 自动出素材，然后发布页面”
- “基于 witch-curio-shop-mvp-2 生成一个主题小店游戏”

## 目录与关键文件

独立引擎引用：
- 先阅读 `project-reference/ENGINE_REFERENCE.md`，它记录了本 skill 依赖 `witch-curio-shop-mvp-2` 的哪些部分、运行产物、静态注入契约、Neta skill 登录方式、Linux 图片转换注意事项、以及图名绑定 QA。
- 本 skill 仓库内已内置一份可直接引用的引擎子集：`project-engine/witch-curio-shop-mvp-2/`。这里复制了运行/构建必需脚本和资源，不包含 `node_modules`、生成产物、私密登录缓存、`.git` 或原始音频 zip。
- 当工作区存在活跃项目 `/workspace/03-gameplay-projects 🎮/active/witch-curio-shop-mvp-2` 时，优先使用活跃项目；当活跃项目不存在或需要独立复现时，可使用 `project-engine/witch-curio-shop-mvp-2/` 作为内置引擎副本。

项目根目录：
- 首选活跃项目：`/workspace/03-gameplay-projects 🎮/active/witch-curio-shop-mvp-2`
- 内置引擎子集：`project-engine/witch-curio-shop-mvp-2/`

当前核心文件：
- `server.mjs`：本地 orchestrator、静态服务器、session/build API、SSE、LLM content pack 编排、agent provider 路由
- `creator.js`：前端建店/确认/构建进度/进入店铺流程
- `app.js`：核心合成店铺玩法、runtimeConfig 注入、主题对比度归一化、装饰贴纸拖拽/缩放/持久化、UI 按钮贴纸、图鉴/收藏/订单等
- `styles.css`：游戏主体与 creator/building 页面样式
- `sfx.js`：音效系统
- `assets/sfx/`：本地音效文件，静态导出必须包含
- `builder/agent-handshake.md`：`world-shop-agent/v1` 本地/远程 agent 协议
- `builder/local-codex-worker.mjs`：本地构建 worker，按阶段生成/校验素材并完成 session
- `builder/local-asset-pipeline.mjs`：Neta creative 图片生成、切图与 runtimeConfig 产物组装
- `builder/skills/shop-builder/profile.json`：生成计划，包含 requiredImages、切图行列等
- `builder/skills/shop-builder/prompt_*.md`：concept、assistant、shop sheet、decor、UI button、world patch 的生成约束
- `generated/current-session.json`：当前 ready session 常见位置；这是引擎全局临时态，**不得作为新商店最终导出的 source of truth**，除非它刚由同一 build 生成且通过 cross-shop contamination QA。
- `generated/build-artifacts/<jobId>/...`：当前 job 的生成图片、切图与 manifest
- `generated/archives/.../session.json`：可复用的会话归档示例，如项目中存在

注意：当前远端项目可能不再自带 `builder/export-static-site.mjs`、`builder/qa-static-site.mjs`、`builder/publish-static-site.mjs`。如果缺失，Agent 必须按本 skill 的“静态导出要求”临时补齐或使用等价脚本完成导出，不得因此把 creator 页面直接当作成品发布。

## 工作方式

### 阶段 1：准备建店输入

原则：
- **只在概念尚未定稳时追问用户。**
- **概念一旦定下，后续一律默认自动推进。**
- 不要在 concept 之后继续把 content pack、素材、导出、分享拆成一堆确认问题抛给用户。
- 对外话术始终保持“筹备开店 / 布置柜台 / 准备开张”的语境。

至少收集：
- `shopIdea`：店铺主题想法

可选：
- `worldName`
- `shareSlug`
- `outputName`

默认可使用：
- `worldName = 你的世界`
- 日期格式：`YYYY-MM-DD`
- `shareSlug` 可由主题名自动生成，必须 URL 安全

### 阶段 2：生成 concept

concept 可以走项目现有链路：
- 前端 OAuth 直连 Neta LLM；或
- 调用 `server.mjs` 中等价的 concept 生成逻辑；或
- 在自动化执行中复用当前 session / archive 的 concept。

concept 必须包含或能推导：
- `worldName`
- `shopIdea`
- `shopName`
- `summary`
- `assistantName`
- `assistantRole`
- `assistantSummary`
- `loopSummary`
- `confirmationLine`
- `readySummary`
- `runtimeConfig.theme`
- `runtimeConfig.shopName`
- `runtimeConfig.brandEyebrow`
- `runtimeConfig.assistantName`

主题色硬性要求：`runtimeConfig.theme` 必须至少包含以下 token，且必须是安全颜色值：

```text
bgTop, bgBottom, paper, paperSoft, gold,
shopBgTop, shopBgMid, shopBgBottom,
shopLight, shopLightSoft,
shopPanel, shopPanel2,
shopPaper, shopPaperSoft,
shopCard, shopCardDark,
shopBorder, shopBorderDark,
shopGold, shopGoldSoft,
shopGreen, shopRed,
shopText, shopInk, shopMuted
```

可读性要求：
- 文本颜色必须和 panel、card、tab、button、dialogue bubble、modal、toast、report 背景明显区分。
- modal / popup backdrop 必须是偏暗的店铺遮罩，不要使用明亮发白的 veil。
- 助手/店员区域是主要视觉组件，不能只当小状态条处理。
- 当前项目会在前端/后端用 `normalizeThemeContrast()` 派生可读色 token，例如 `shopOnPanel`、`shopOnCard`、`shopOnButton`、`shopMutedOnBubble` 等；生成时仍应优先给出高对比基础色，不要依赖自动修正掩盖明显不可读的主题。
- `shopLightSoft` 可以是 `rgba()`，其他基础 token 优先使用 `#RRGGBB`。

### 阶段 3：通过 build agent 生成内容与素材

优先复用项目现有生产链：

0. 如需真实 Neta creative 出图，先用 **Neta skill device login** 登录，而不是依赖项目内前端 OAuth：
   ```bash
   NETA_CONFIG_DIR="<project>/generated/.neta-skill-config" \
     npx -y @talesofai/neta-skills@latest login --action request-code

   NETA_CONFIG_DIR="<project>/generated/.neta-skill-config" \
     npx -y @talesofai/neta-skills@latest login --action verify-code
   ```
   然后从 Neta skill 登录缓存中取 access token，作为 worker 环境变量 `NETA_TOKEN` 注入。本 token 只用于运行期，严禁写入静态导出目录、`/public` 或 git 仓库。
1. 启动主服务：
   ```bash
   npm start
   ```
2. 启动本地 worker：
   ```bash
   npm run start:local-worker
   ```
3. 通过项目 API 触发 build：
   - `POST /api/build/start`
   - 或使用项目已有前端流程触发
4. server 生成 `world-shop-agent/v1` handshake。
5. active provider 执行构建：
   - `local-codex`：本地 `builder/local-codex-worker.mjs`
   - `remote`：`SHOP_AGENT_BASE_URL` 对应远程 agent
6. 等待 session 进入 `ready`。

#### 当前强制顺序

##### 0.5 per-shop source-of-truth 与污染隔离

每个要发布的商店必须有自己的 source-of-truth。推荐路径：

```text
supermarket/stores/<slug>/
├── concept.json
├── content-pack.json
├── generated/session.json
├── generated/build-artifacts/<jobId>/...
├── static-export/
└── qa/qa-report.json
```

硬性规则：
- 不得把 `engine/generated/current-session.json` 当成最终导出源，除非它刚由本轮同一 build 产生，并且 `concept/runtimeConfig/contentPack/profile.generatedAssets` 均指向本轮商店。
- 不得用主题专用旧脚本导出其它主题，例如 `export-laoqin-static.mjs`、`export-starbucks-static.mjs`、`mars-build.mjs`、`red-alert` 相关脚本。必须使用 `builder/export-static-shop.mjs` 或等价通用导出器。
- 禁止把 `/public/<slug>/` 作为唯一修复位置。直接 patch public 只能算临时热修；最终必须回写 `supermarket/stores/<slug>/` 的 locked package，重新导出、QA、发布。
- 每个静态商店必须自带完整 runtime：theme、contentPack、tileManifest、assistantPortraits、decorationManifestUrl、uiButtonManifestUrl、对应 manifests 和生成资产，且 URL 全部为相对路径。
- final static 不允许从默认 demo/旧主题补齐缺失内容。`recipes`、`blessings`、intro/order 等如果为空，必须在本店 content pack 中显式为空或写成本店内容；不得让 `mergeContentPack()` 静默混入生日/HP/咖啡/其它旧店默认值。
- static localStorage/save key 必须按 shop slug/build/shopName/worldName 隔离，或在 static boot 时拒绝不兼容旧存档。全局 key 会让生日店的棋盘、主题、发现、装饰污染皮埃尔店这类新店。
- static 初始化顺序必须是：读取并 sanitize `window.__SHOP_RUNTIME__` → merge 当前 contentPack → rebuild item index/tile bindings → createInitialState/加载兼容存档 → render。禁止先用默认 runtime 创建棋盘，再切换到本店 runtime。
- 首屏主题必须预水合：`index.html` 或首屏 CSS 必须写入本店 theme tokens。不能只依赖 JS 启动后 applyThemeTokens；JS 缓存/延迟/报错时也不得露出生日/HP/default 主题。
- 任何单独重跑的资产板（assistant/shop sheet/decor/UI）都必须写入 session/profile 的 source job，并重新运行 QA。禁止静默混用不同商店的素材。重跑商品板时还必须重新生成/更新 tile contact sheet，并逐格验证图片内容与 manifest 名称一致；重跑 assistant 时必须重新验证四个头像 URL、manifest、静态注入和首屏头像实际解析。
- 在 `make_image` 前必须扫描 handshake/concept/contentPack/prompt payload，确保不含其它商店名称、助手名、世界名或旧主题关键词。
- 发布前必须运行 `builder/qa-static-shop.mjs`，对 `index.html/session.json/static-session.js/manifests/runtime URLs` 做污染扫描与绑定矩阵检查。
- **不要在 skill/Agent 层给静态导出追加、复制或粘贴项目级移动端 CSS 补丁**（例如从其它店铺复制 `Project-level mobile gameplay layout`、`mobile gameplay refinement v2/v3` 之类的大段规则）。移动端布局只能由当前引擎源码/通用导出器自带的稳定 CSS 提供；如果 `qa-mobile-layout.mjs` 因缺少历史补丁而失败，记录为阻塞或需引擎侧修复，不得为了过 QA 在单店 `static-export/styles.css` 或 `/public/<slug>/styles.css` 里追加跨店样式补丁。
- **移动端玩法布局是发布检查项，不是补丁许可**：静态导出应保留项目级 mobile gameplay layout contract。仅在手机/粗指针断点（默认 `@media (max-width: 760px) and (pointer: coarse)`）下，workbench/play panel 与 5x5 board 应优先出现在 secondary sidebar 内容之前；棋盘应尽量适配首个可用手机视口并保持 1:1；assistant/orders/sources/status 等应压缩、抽屉化或内部滚动，不得把棋盘推到首屏之外。若当前引擎未内置这些规则，必须回到引擎/导出器层做可复用修复并重新验证，或将发布标记为阻塞。
- 修改移动端 CSS 或发布前必须运行 `node builder/qa-mobile-layout.mjs <static-export-dir>`（或等价检查）并保存报告；若 `qa-mobile-layout` 失败，不得通过复制旧店铺补丁来强行过关。
- 发布前必须保存视觉语义 QA 证据：至少包含 `tiles/contact-sheet-with-names` 或等价逐格记录，证明每个 `item_*.png` 的实际视觉内容与 `tiles/manifest.json` 中的 `name/description` 对应；不能只证明文件存在或 URL 可访问。

必须按当前 worker 真实顺序推进和校验，不要按旧顺序臆造：

1. concept
2. theme token validation
3. assistant portraits
4. content pack
5. shop sheet
6. tile split + tile manifest
7. decor stickers
8. decor split + decor manifest
9. ui button stickers
10. ui button split + ui button manifest
11. artifact check
12. ready session
13. static export
14. QA check
15. mobile layout QA with `builder/qa-mobile-layout.mjs` when publishing or after any mobile CSS change; if it fails because the current engine lacks mobile rules, stop and report/fix the engine layer, do not paste cross-shop CSS into the export
16. cross-shop contamination QA with `builder/qa-static-shop.mjs`
17. publish share link

要求：
- 静态导出必须使用通用导出器 `builder/export-static-shop.mjs <session.json> <out-dir>` 或等价脚本；不得使用带旧主题硬编码的导出脚本。
- QA 必须使用 `builder/qa-static-shop.mjs <static-export-dir> --expect-shop "<shop>" --expect-world "<world>" --forbid "<old-shop-keywords>"`，并保存报告。
- 移动端 QA 必须使用 `builder/qa-mobile-layout.mjs <static-export-dir>` 或等价脚本，确认 phone/coarse pointer 下 board 优先、5x5 棋盘 1:1、无横向溢出、assistant/task/status/trash 等 secondary UI 不阻塞首屏玩法，并保存报告。若失败，不得通过复制其它店铺的移动端 CSS 补丁修改单店导出；只能修复当前引擎/通用导出器，或将该轮发布阻塞。
- 详见事故复盘：`supermarket/qa/cross-shop-contamination-lessons.md`。
- 详见 source-of-truth/静态状态复盘：`supermarket/qa/static-shop-source-of-truth-lessons.md`。
- 不允许跳过 `content pack` 直接出最终商品图。
- **content pack 必须在任何 `shop_sheet_4x8` 生图之前最终锁定**。禁止在商品图板已经生成后再把商品名称、链条、tier、content pack 改成另一套主题文案；这会造成“图是旧物品、名字是新物品”的错配。
- 当前引擎的 4x8 商品板固定支持 32 个 slot，默认链条顺序和数量必须与运行时一致：`botanical` 6、`alchemy` 6、`curio` 6、`waste` 6、`secret` 8。不要临时新增 `signature` 等未被默认运行时/切图计划识别的链条来承载商品；如确需新链条，必须同时改运行时默认链、sheet slot plan、合成逻辑和 QA。
- 生成 `shop_sheet_4x8` 的 prompt、`tiles/manifest.json`、`session.runtimeConfig.contentPack`、`session.runtimeConfig.tileManifest`、导出后的 `generated/assets/tiles/manifest.json`、`static-session.js` 嵌入 runtime 必须全部来自同一份最终 content pack。
- 商品图板绑定 QA 必须做字段级比对：按 4x8 左到右、上到下检查每个 slot 的 `itemId/chainId/chainLabel/tier/name/description/fileName/url`，确认 `contentPack.chains`、`tileManifest.tiles[]`、`tileManifest.bindings[*]`、导出 manifest、嵌入 `window.__SHOP_RUNTIME__.tileManifest` 完全一致。任何 mismatch 都必须阻止发布并重跑商品图板；不得只改 JSON 冒充修复。
- **商品图视觉语义 QA 是强制闸门**：`item_1_1.png`、`item_1_2.png` 等文件名只是网格坐标，不是商品名。切图后必须生成 contact sheet 或等价逐格审查表，把每张 tile 图放在对应的 `row/col/fileName/itemId/chainId/tier/name/description` 旁边，并使用模型视觉能力/人工视觉检查确认“实际图片内容”与 manifest 名称描述一致。只检查整张 raw sheet 大概像主题、只检查文件存在、只检查 URL 能打开，都不算通过。
- 如果视觉内容和 manifest 名称不一致：若图片内容本身正确但顺序漂移，可以按实际视觉顺序重排 manifest 并重新 QA；若图片内容错误、含混、跨格、含旧主题或含文字，必须从锁定 content pack 重新生成 shop sheet 并重新切图。禁止只改 manifest/session 文案来掩盖图片错配。
- Assistant portrait 也必须做同级绑定 QA：四个 portrait 文件、`assistant_portraits/manifest.json`、`session.runtimeConfig.assistantPortraits`、`static-session.js`、首屏 HTML/运行时 DOM 的头像 `src` 必须指向同一 build 的 `./generated/assets/assistant_portraits/*.png`，不得指向旧 job、其它商店、`/workspace`、`/Downloads` 或根路径 `/generated`。
- 如果发现商品图板是在旧 content pack 下生成的，正确修复是：先锁定最终 content pack → 重新生成 shop sheet → 重新切图 → 重新写 manifest → 重新导出/QA/发布。只重命名 manifest 或 session 只能修文案，不能证明图片视觉与名称对应，不能作为合格成品。
- 不允许在主题色 token 缺失时继续导出。
- 不允许在未确认当前轮结果可用时提前宣布下一轮完成。
- 不允许把项目默认旧素材当成正式完成结果。
- 不允许用程序占位图、本地手画 SVG、未按模板生成的拼贴图，冒充 Neta skill 正式素材。
- 不允许为了赶进度跳过 `remove_background`、跳过固定网格切分、跳过 manifest 绑定 QA。
- Neta 图片生成必须按资产类型**一张一张串行执行**；不要并发触发多张 `make_image/remove_background`，也不要把并发/重试导致的失败误判为额度问题。严禁用 `multi_tool_use.parallel`、后台 shell `&`、多个终端、多个 worker 进程同时发起 Neta 图片任务。必须等当前 `make_image` 完整返回并记录 UUID/URL，再调用同一张图的 `remove_background`；必须等该 `remove_background` 完整返回并记录 cutout UUID/URL 后，才能进入下一张资产。若失败，先串行重试当前单张资产并记录 stdout/stderr。
- 每轮关键资产完成后，都要向用户返回一条沉浸式进度播报。

#### 引擎兼容性注意

- 如果图片管线报错 `spawn /usr/bin/sips ENOENT`，说明当前 Linux 环境缺少 macOS 专用 `sips`，这是本地转换兼容问题，不是 Neta 出图失败。
- 可用 ImageMagick `convert` 或等价跨平台转换路径替代 `sips`，再重启 worker 重新跑构建。
- 处理这类兼容问题时，不要降低“必须真实出图”的标准，也不要退回程序占位图作为最终成品。

### 阶段 4：生成格式要求

#### 4.0 Neta 出图与切图硬性流程

所有图片资产都必须使用对应 `builder/skills/shop-builder/prompt_*.md` 模板生成，不得只写泛泛主题词。每一种资产必须按以下顺序**串行**处理；禁止并发、禁止后台执行、禁止多个 Neta 图像任务重叠：

1. 使用该板块专属 prompt 模板调用 Neta `make_image`，等待命令结束。
2. 记录返回的 artifact UUID 和 URL。
3. 对同一张图调用 Neta `remove_background`，等待命令结束。
4. 记录 cutout UUID 和 URL。
5. 下载 raw 与 cutout，保留证据。
6. 将去背景结果放入透明画布，保持目标 sheet 比例，不得非等比压缩。
7. 按固定网格 crop/split。
8. 对每个切片单独 trim 透明边缘。
9. 写入 manifest，并用 manifest 绑定到 runtimeConfig。
10. QA 检查页面实际加载的是这些切片，而不是默认旧素材或 raw sheet。
11. 完成当前板块后，才允许开始下一板块的 `make_image`。

严禁：
- 同时启动多个 `make_image` 或 `remove_background`，包括通过 `multi_tool_use.parallel`、后台 `&`、多个 shell、多个本地 worker、未停止的旧 worker 造成的重叠请求。
- 先 crop 再去背景。
- 对整张 sheet 使用 `resize WIDTHxHEIGHT!` 这类非等比强制压缩，尤其是 `ui_button_stickers_1x5`，会把按钮图标压扁。
- 把 decor 场景贴纸当作合成材料 tile。
- 把完整场景、海报、拼贴、室内图切成合成材料。
- 跳过各板块 prompt 模板，手写一个笼统 prompt 代替。
- 因一次串行之外的失败就宣布“额度不足”；需要确认不是并发、重试堆叠、环境变量或 token 传递问题。

推荐 ImageMagick 顺序示例：

```bash
# UI 1x5 示例：优先使用 remove_background/cutout 的完整横条，而不是 opaque raw。
# 如果 cutout 仍保留完整 5:1 左右布局：透明背景等比缩放到 1600x320，再按 5 个 320x320 cell 切。
convert ui_cutout.png \
  -resize 1600x320 \
  -background none -gravity center -extent 1600x320 \
  PNG32:ui_button_stickers_1x5.png

for c in 0 1 2 3 4; do
  convert ui_button_stickers_1x5.png \
    -crop 320x320+$((c*320))+0 +repage \
    PNG32:ui_buttons/button_1_$((c+1)).png
done
```

UI 按钮特别经验（已发生过事故）：
- 不要直接 split opaque raw UI sheet；raw 的白/灰背景会让每个 button 的 alpha bounds 变成完整 `320x320`，浏览器会显示成方块背景，看起来像“按钮解析错了”。
- UI button runtime cell 建议保留 `320x320` 透明画布，不要像普通贴纸一样 `-trim` 成不等尺寸；稳定布局靠透明 canvas，QA 靠 alpha bounds。
- 每个 button 的 alpha bounds 必须“有意义但不是整格”：拒绝 `1x1`、近空图、以及 `320x320`/近 full-cell opaque background。
- 如果 cutout 被裁成中间内容带且破坏 5:1 横条布局，必须改用 `remove_background_nocrop` 或重跑 UI board；不能把 center-cropped cutout 当 1x5 split。
- 静态导出的 `index.html` 还必须把五个可见按钮 `<img data-ui-sticker>` 的 `src` 预绑定到本次 build 的相对路径：`./generated/assets/ui_buttons/button_1_1.png` 到 `button_1_5.png`。不要只依赖 JS 启动后根据 manifest 再去填空 `src=""`；UI 按钮是预存在 DOM 里的节点，首屏/缓存/重置时序问题会让 manifest-only 方案表现为按钮没解析对。
- 静态模式下 `resetGeneratedStickerAssets()` 必须优先使用 `window.__SHOP_UI_BUTTON_MANIFEST__`，不得把 UI 按钮重置回默认/旧图。`loadRuntimeStickerAssets()` 也应先用 embedded UI manifest，再尝试 fetch。
- 详见 workspace 记录：`supermarket/qa/ui-button-runtime-binding-lessons.md`。

#### 4.1 assistant portraits

当前要求是先生成一个 `assistant_sheet_2x2.png`，再切成四张表情图。

必须满足：
- 横向 16:9 游戏资产 sheet
- 严格 2x2 布局
- 四角顺序：
  - top-left：smile
  - top-right：serious
  - bottom-left：angry
  - bottom-right：confused
- 半身像
- 中心区域尽量留白，四个象限互不接触
- 纯白背景
- 无文字、无标签、无边框
- 不添加用户/世界观没有提到的物种、身体特征、科技、能力、阵营等
- 现实店铺使用可信的现实店员服装和角色设计

产物要求：
- `assistant_sheet_2x2.png`
- `assistant_sheet_2x2_raw.png` 或等价 raw 记录
- `assistant_sheet_2x2_cutout.png` 或等价 remove_background 记录
- `assistant_portraits/manifest.json`
- `assistant_portraits/smile.png`
- `assistant_portraits/serious.png`
- `assistant_portraits/angry.png`
- `assistant_portraits/confused.png`

QA 必查：
- 四个表情必须来自严格 2x2 角落布局，不得把一张立绘硬切成四块。
- 去背景后每个 portrait 不应带大块白底或被裁断头发/肩膀/手。
- manifest 顺序必须是 `smile, serious, angry, confused`，并与页面实际显示 URL 一致。

#### 4.2 shop sheet

当前要求是 `shop_sheet_4x8.png`。

必须满足：
- 4 rows x 8 columns
- 32 个商品/材料图标
- pure white background
- 无文字、无 label、无 logo、无 typography、无 letters、无 numbers
- **严禁把商品名、链条名、tier、slot note 或任何可读/近似可读文字画进图标里**。即使文字内容正好等于 content pack 的 `name`，也必须视为失败；合成物素材只能用形状、颜色、材质和图案表达语义。
- 无边框、无分隔线、无格子线
- 每个物品居中且略小于格子
- 四周有足够白边
- 相邻物品之间有清晰白色 gutter
- 物体不能碰撞、重叠或跨格
- slot notes 只能作为语义指导，不能被画出来

产物要求：
- `shop_sheet_4x8.png`
- `shop_sheet_4x8_raw.png` 或等价 raw 记录
- `shop_sheet_4x8_cutout.png` 或等价 remove_background 记录
- `tiles/manifest.json`
- `tiles/*.png`

QA 必查：
- 合成台 tile 必须是商品/材料 icon，不得是店铺场景、海报、装饰贴纸、UI 图标或完整柜台。
- 32 个 itemId 必须与 `runtimeConfig.contentPack.chains` 的物品名和顺序绑定。
- `runtimeConfig.tileManifest.bindings` 必须覆盖所有可发现 item，页面实际 `imageUrl` 必须来自这些 bindings。
- 切图前必须完成去背景；切片应有透明背景，不得整格白底或跨格残影。
- 必须生成并保存 `tiles/contact-sheet-with-names` 或等价 QA 证据，逐格显示 tile 图片与 `fileName/itemId/name/description`。使用视觉能力确认每张 tile 的实际内容与对应 name/description 匹配；例如不能让篮子图对应“防风草种子包”，也不能让种子包图对应“背包升级券”。
- **视觉语义 QA 必须同时做“无文字/OCR”检查**：逐格查看 raw sheet、cutout、contact sheet 和每个 `tiles/item_*.png`，确认没有商品名、汉字、英文、数字、伪文字、logo、标签、包装字样、UI 字或手写标记。仅靠 URL/manifest/文件存在、或只检查图像大致主题正确，不能通过 QA。
- 若任一 tile 上出现可读或疑似可读文字，尤其是把该 slot 的 `name` 直接写在物品、标签、牌子、瓶身或包装上，必须判定 shop sheet 不合格并重新生成；不得裁掉文字、PS 涂抹、缩小到看不清或在 QA 报告中豁免。
- 若模型没有严格遵守 slot plan，必须在发布前发现并处理：可重排 manifest（仅当视觉内容都正确且只是顺序错）、局部替换（若管线支持）、或重跑整张 shop sheet。不得把错配的图片和名字一起发布。

#### 4.3 decor stickers

当前要求是 `shop_decor_stickers_2x3.png`。

必须满足：
- 2 rows x 3 columns
- 正好 6 个店铺装饰物
- 每格一个独立居中物体
- pure white background
- 无网格线、边框、分隔线
- 不要可读文字、招牌字、logo、label、letters、numbers
- 不要海报、拼贴、货架整体场景、店面整体图或完整室内大场景
- 必须是可拖拽摆放的 isolated props
- 风格为 warm handcrafted casual game sticker style

运行体验要求：
- 静态成品必须保留装饰贴纸拖拽摆放能力。
- 当前项目支持通过角标缩放装饰贴纸，静态成品不得因导出遗漏样式或事件而破坏缩放。
- 装饰位置会进入游戏存档，并兼容旧版 `localStorage` 装饰位置；导出/归档时不要丢弃 `decorPositions`、`decorSlotPositions` 或 `decorEntries`。
- 装饰布局作用域与 `shopName`、`worldName`、`decorationManifestUrl` 相关；更换主题/manifest 时不要复用旧主题的错位布局。

产物要求：
- `shop_decor_stickers_2x3.png`
- `shop_decor_stickers_2x3_raw.png` 或等价 raw 记录
- `shop_decor_stickers_2x3_cutout.png` 或等价 remove_background 记录
- `shop_decorations/manifest.json`
- `shop_decorations/*.png`

QA 必查：
- `shop_decorations/manifest.json` 中 `stickers` 必须是数组，且至少 6 项；当前 app 的 `mapDecorationManifest()` 读取数组，不读取对象形态。
- 每个 sticker URL 必须能从静态导出相对路径加载。
- 页面中的装饰托盘必须加载本轮主题装饰，不得回退到默认 Ollivanders/Harry Potter 装饰。

#### 4.4 UI button stickers

当前要求是 `ui_button_stickers_1x5.png`。

必须满足：
- 1 row x 5 columns
- 从左到右顺序固定：
  1. lobby / hall
  2. collection book / codex
  3. favorites shelf / shelf
  4. restart / reset
  5. trash
- pure white background
- 无文字、无 label、无按钮框、无 UI 面板、无边框
- 每个图标独立居中，留足白边和 gutter
- 小尺寸下仍然可读

产物要求：
- `ui_button_stickers_1x5.png`
- `ui_button_stickers_1x5_raw.png` 或等价 raw 记录
- `ui_button_stickers_1x5_cutout.png` 或等价 remove_background 记录
- `ui_buttons/manifest.json`
- `ui_buttons/*.png`

QA 必查：
- `ui_buttons/manifest.json` 必须包含 `bindings.hall`、`bindings.codex`、`bindings.shelf`、`bindings.reset`、`bindings.trash`；当前 app 的 `mapUiButtonManifest()` 读取 `bindings`，不是 `stickers`。
- 左到右顺序必须严格是 hall/codex/shelf/reset/trash。
- 必须先去背景，再补透明 5:1 画布，再等比 resize，再 crop 1x5；不得用非等比 `resize 1600x320!` 压扁图标。
- 页面 DOM 中 `[data-ui-sticker]` 的实际 `src` 必须被替换为本轮 `ui_buttons` 切片，不得保留默认 HP wood 图标。

#### UI 按钮运行时绑定强制闸门

UI 按钮是高风险资产板块；以下任一项失败都不得发布：

- `ui_button_stickers_1x5` 在归一化过程中必须保持完整 5:1 横条布局。常见事故是 `remove_background` 把整条横图裁成中间内容带，再把这个被裁过的带子补成 5:1，结果切出 4 个透明 `1x1` 按钮。如果 cutout 尺寸明显不是 5:1，必须对同一 artifact 使用 `remove_background_nocrop`，或从 raw sheet 重建透明 5:1 画布后再切。不得把居中裁切后的 cutout 直接当原始 1x5 sheet 来切。
- UI 1x5 的正确处理顺序：raw/Neta artifact → `remove_background` 或 `remove_background_nocrop` → 保留完整左右顺序的透明 5:1 画布 → 等比 resize 到 1600x320（禁止 `!`）→ crop 五个 320x320 cell → 每格 alpha trim。
- 切图后必须检查每个按钮 PNG 的 alpha bounds：`hall/codex/shelf/reset/trash` 都不能是 `1x1`、近似空透明图或只有极细横条；只要出现 1x1/空图，即使文件存在也算 QA 失败。
- `ui_buttons/manifest.json` 必须包含 `bindings.hall/codex/shelf/reset/trash`，并且五个 URL 必须指向同一 build 的五个切片，顺序严格 hall/codex/shelf/reset/trash。
- 静态导出必须注入 `window.__SHOP_UI_BUTTON_MANIFEST__`，或确保 `uiButtonManifestUrl` 能稳定 fetch；静态模式下 `app.js` 应优先使用 embedded UI manifest，或至少在 fetch 失败时 fallback 到 embedded manifest，不能因为 `ui_manifest.json` 路径/缓存/异步失败而静默回到默认按钮。
- `resetGeneratedStickerAssets()` 在 QA 通过的静态成品中不得把 UI 按钮重置为 HP/default 资产；静态模式下应重置到本轮 embedded/generated UI manifest，并调用 `applyUiButtonStickerUrls()`。
- 必须验证真实运行 DOM，而不是只验证文件：`[data-ui-sticker="hall|codex|shelf|reset|trash"]` 的实际 `src` 必须能从静态导出根目录解析到本 build 的 `ui_buttons/button_1_*.png`，不得是 `hp-wood`、`/generated/shop-stickers`、`/Downloads`、`/workspace` 或空 `src`。
- 如果曾经发布过坏按钮版本，重新发布时必须加 cache-busting query 或等价措施，避免浏览器继续加载旧的坏 `app.js`、`static-session.js` 或 1x1 PNG。


### 阶段 5：content pack 要求

`contentPack` 必须写入 `runtimeConfig.contentPack`，用于驱动首轮体验、订单、补给和合成链。

至少应包含：
- `sources`：补给来源
- `clients`：顾客 / 委托方
- `chains`：合成链和物品名/描述
- `recipes`：特殊合成/混合配方
- `blessings`：经营加成或每日事件
- `introSequence`：入场序章

当前项目可能按 section 生成：
- `meta`
- `core-chains`
- `special-chains`

如果 LLM 生成 JSON 失败，应修复或回退为结构完整的 fallback，不得导出半缺失 content pack。

### 阶段 6：ready session 要求

最终 ready session 应保持当前 MVP 兼容，至少包含：

```json
{
  "sessionId": "...",
  "status": "ready",
  "enteredShop": true,
  "createdAt": "...",
  "worldName": "...",
  "shopIdea": "...",
  "concept": {},
  "runtimeConfig": {},
  "sources": {},
  "profile": {}
}
```

`runtimeConfig` 至少包含：
- `shopName`
- `brandEyebrow`
- `assistantName`
- `theme`
- `contentPack`
- `tileAssetBase`
- `tileManifest`
- `assistantPortraits.smile`
- `assistantPortraits.serious`
- `assistantPortraits.angry`
- `assistantPortraits.confused`
- `decorationManifestUrl`
- `uiButtonManifestUrl`

静态 final 额外要求：
- `contentPack` 必须是本店完整包，不得缺字段后依赖默认旧主题补齐。至少显式包含 `sources`、`clients`、`chains`、`recipes`、`blessings`、`introSequence`；如果没有特殊配方/祝福，也必须写 `recipes: []`、`blessings: []`，并确保 static runtime 不自动合入默认 demo 值。
- `theme` 必须同时进入 `session/static-session` 和首屏 HTML/CSS 预水合变量，避免 JS 未启动时露出旧主题。
- static save/localStorage namespace 必须与 `shopName/worldName/slug/buildId` 绑定或拒绝旧存档。

`savedState` / 存档如被导出，应保留或兼容：
- `decorPositions`
- `decorSlotPositions`
- 旧版 `shop_decor_positions` localStorage entries（归档结构中通常叫 `decorEntries`）

`sources` 至少应能说明：
- LLM 来源
- builder / orchestrator 来源
- image 来源
- agent 来源

### 阶段 7：导出成品静态页

主体验要求保持不变：最终必须是**打开即玩**的静态页面，而不是 creator 建店页。

如果项目中存在官方导出脚本，优先使用，例如：

```bash
node builder/export-static-site.mjs --session <session.json> --output <dir>
```

如果当前项目没有导出脚本，Agent 必须用等价方式导出。导出逻辑必须满足：

1. 复制必要前端文件：
   - `index.html`
   - `app.js`
   - `styles.css`
   - `sfx.js`
   - `creator.js`、`neta-config.js`、`neta-auth.js` 一般不应加载到最终静态成品；除非静态页确实依赖其函数且已证明不会展示建店页/触发登录/泄露敏感信息
   - 不要复制或加载与当前店铺无关的实验脚本/主题补丁（例如其他 demo 的 `*-barracks.js/css`）；这些脚本可能注册全局 pointer/drag/click 监听并破坏合成台交互
2. 复制必要资源：
   - `assets/sfx/`
   - 当前 session 用到的 `generated/build-artifacts/<jobId>/...`
   - 其他 session 引用的本地图片资源
3. 写入：
   - `session.json`
   - 静态 runtime 注入脚本，例如 `static-session.js` 或内联脚本
4. 注入静态模式：
   - `window.__SHOP_STATIC_MODE__ = true`
   - `window.__SHOP_STATIC_SESSION__ = <ready session>`
   - `window.__SHOP_RUNTIME__ = session.runtimeConfig`
5. 绕过 creator/API：
   - 不依赖 `GET /api/session`
   - 不要求 OAuth 登录
   - 不展示建店输入页
   - 删除/隐藏 creator 页面时必须保留运行时节点：`#appShell`、`#dragLayer`、`#toastStack`、各 overlay 容器（intro/report/item/library）以及 board/trash/source/order/sidebar 等核心 DOM。不要用过宽正则把 `creatorOverlay` 后面的 `dragLayer`、`toastStack` 或启动脚本一起删掉。
   - 页面加载后直接调用或等价执行：`resetShopState(runtimeConfig, { introSeen: false })`，并显示 `#appShell`
   - 如果导出包含玩家已布置好的装饰布局，应在 reset/import 后恢复 `decorPositions`、`decorSlotPositions` 或等价 `decorEntries`
6. 路径处理：
   - 所有 `/generated/...`、`/assets/...`、`/Downloads/...` 等必须转换为静态站点内可访问路径。
   - 对 Cohub public share 这种 `/s/<space-id>/<slug>/index.html` 子路径发布，**不要保留根路径 `/generated/...` 或 `/assets/...`**；优先转换为 `./generated/...` 和 `./assets/...`。
   - 不允许引用本地绝对文件路径，例如 `/workspace/...`。
   - 必须递归处理 `session.json` / `static-session.js` / runtimeConfig / manifest 中的所有资源 URL：`assistantPortraits.*`、`tileAssetBase`、`tileManifest.tileBaseUrl`、`tileManifest.tiles[].url`、`tileManifest.bindings[*].url`、`decorationManifestUrl`、`uiButtonManifestUrl`、decor `stickers[].url`、UI `bindings.*.url`。
   - 只改 `session.json` 不够；如果 `app.js` 会在启动、重置、导入存档时接收 runtimeConfig，必须在这些入口调用 URL sanitizer，避免运行时重新使用 `/generated/...`。

#### 静态 URL 解析防错要求

本项目曾出现“图文件正确存在，但页面没加载正确图”的问题。原因是静态页发布在 `/s/<space-id>/<slug>/` 子路径下，runtime/manifest 仍保留 `/generated/...` 根路径，浏览器实际请求到了 `https://public.cohub.run/generated/...` 而不是当前 slug 下的资源。以后必须按以下要求处理：

- 静态导出必须包含或注入等价的 `resolveStaticAssetUrl(url)`：在 `window.__SHOP_STATIC_MODE__` 下把 `/generated/...` 转为 `./generated/...`，把 `/assets/...` 转为 `./assets/...`。
- 必须包含或注入等价的 `sanitizeRuntimeAssetUrls(config)`，递归清洗 `assistantPortraits`、`tileAssetBase`、`tileManifest`、`decorationManifestUrl`、`uiButtonManifestUrl`。
- `rebuildCatalogFromContentPack()` 或任何建立商品索引的逻辑，不能直接使用 `tileBindingIndex[id].url`；必须先走 `resolveStaticAssetUrl(...)`。
- `renderAssistant()` 或任何助手头像渲染逻辑，不能直接使用 `runtimeConfig.assistantPortraits[...]`；必须先走 `resolveStaticAssetUrl(...)`。
- item detail、board item、decor sticker、UI button、manifest fetch 也要在使用 URL 前清洗。
- fallback 默认素材也必须替换到当前 build，或保证不会在成品中生效；不得让 `/Downloads/hermione...`、`/Downloads/magic_assets...`、`hp-wood`、`ollivanders-decor` 作为活跃 fallback。

参考复盘与 QA 清单：`supermarket/qa/static-url-binding-lessons.md`。

#### 图片与名称绑定 QA

除文件存在外，必须检查**图片内容、manifest 绑定、物品名称、合成链语义**是否一致：

- `contentPack.chains[].items[]` 中的名称应和对应 tile 视觉一致。
- `runtimeConfig.tileManifest.bindings[itemId].url` 应指向正确的切图。
- 不允许出现明显错配，例如“石头图片叫橡木原木”“木头合成成无关石头”。
- 如果 Neta sheet 生成顺序和计划不一致，优先重新生成；如果图片可用但顺序错位，可以重排 `tileManifest.bindings` 并同步修正 content pack 链名/物品名。
- 合成线应有语义连续性，同线升级应像同一类货的递进；跨线只通过指定 recipe 产出隐藏物，否则应进入废料/失败结果。

### 阶段 8：QA check

发布前必须检查：

#### 文件完整性

静态输出目录至少应包含：
- `index.html`
- `app.js`
- `styles.css`
- `sfx.js`
- `session.json`
- `assets/sfx/`
- `generated/...` 或等价生成资源目录

如果静态页依赖以下文件，也必须包含：
- `creator.js`
- `neta-config.js`
- `neta-auth.js`

#### session/runtime 完整性

检查：
- `session.status === "ready"`
- `session.enteredShop === true` 或静态页会直接进店
- `runtimeConfig.theme` 25 个必需基础 token 全部存在，并且页面运行时派生出的可读色 token 生效
- `runtimeConfig.contentPack` 结构完整
- `runtimeConfig.tileAssetBase` 可访问，且在 public share 子路径下解析后能命中静态目录文件，不是根路径 `/generated/...`
- `runtimeConfig.tileManifest.bindings` 存在，且每个 binding URL 经过静态路径解析后可访问
- 4 张助手表情图可访问
- `decorationManifestUrl` 可访问且至少 6 个装饰；decor manifest 内 `stickers[].url` 也必须是静态子路径可加载 URL
- `uiButtonManifestUrl` 可访问且包含 hall/codex/shelf/reset/trash；UI manifest 内 `bindings.*.url` 也必须是静态子路径可加载 URL

#### 页面体验

检查：
- 打开 `index.html` 直接显示游戏，不是 creator 建店页
- 商品图正常显示，不是旧默认素材；商品图和名称/详情/合成链语义一致
- 助手立绘正常显示，不是旧默认素材
- 装饰贴纸可见/可拖动/可缩放，刷新后布局能按当前店铺作用域恢复
- 大厅、图鉴、收藏、重开、垃圾桶按钮贴纸正常
- 入场序章、订单、补给、图鉴、收藏、经营回顾基本可用
- 音效文件不 404；浏览器限制下未自动播放不算失败，但用户交互后应可触发音效
- 页面资源没有泄露 token、内部日志、绝对路径或 secrets
- 检查 `#dragLayer` 和 `#toastStack` 存在；拖拽合成依赖 `#dragLayer` 创建 ghost，缺失会导致鼠标拖拽素材时 JS 抛错并中断。
- 检查没有加载与当前店铺无关的全局实验脚本/样式（如 `lotr-barracks.js/css`、其他 demo patch），这些脚本会覆盖 board、注册 pointer/click 监听或重绘工作台，可能阻塞拖拽。
- grep 静态导出目录，确认没有活跃旧素材或错误路径：`/Downloads`、`hp-wood`、`ollivanders`、`Ollivanders`、`Hermione`、`赫敏`、`/workspace`、`.neta-skill-config`、`NETA_TOKEN`、`accessToken`
- 用脚本从静态输出目录模拟 URL 解析：`assistantPortraits.serious`、`tileAssetBase/item_1_1.png`、`tileManifest.bindings[*].url`、decor `stickers[].url`、UI `bindings.*.url` 都必须能由 `<static-export>/...` 直接找到文件；仅检查文件存在但不检查 runtime URL 视为 QA 不通过

### 阶段 9：发布分享

必须读取并遵守 `/configs/platform/.agents/skills/public-share/SKILL.md` 的规则。

做法：
1. 把通过 QA 的静态目录复制到 `/public/<subfolder>/`
2. 返回直达 `index.html` 的 URL

#### Cohub public-share URL 强制规则

本 workspace 的最终分享链接必须使用 Cohub public-share 前缀，不得凭空改成其他域名，也不得返回本地路径或裸 slug。

正确格式：

```text
${PUBLIC_URL_PREFIX}/<subfolder>/index.html
```

通常等价于：

```text
https://public.cohub.run/s/<COHUB_SPACE_ID>/<subfolder>/index.html
```

严禁把以下形式作为最终给用户的分享链接：

```text
https://cohub.ai/public/<subfolder>/index.html
/public/<subfolder>/index.html
/<subfolder>/index.html
```

发布前必须验证：

```bash
test -f /public/<subfolder>/index.html
printf '%s/%s/index.html\n' "$PUBLIC_URL_PREFIX" "<subfolder>"
```

如果 `/configs/platform/.agents/skills/public-share/SKILL.md` 因 stale NFS handle 暂时不可读，仍必须按照上面的 `PUBLIC_URL_PREFIX` 规则输出 URL；不要因此猜测或使用 `cohub.ai/public/...`。

同时在 `supermarket/published/<subfolder>.json` 写入发布记录，至少包含：

```json
{
  "slug": "<subfolder>",
  "path": "/public/<subfolder>",
  "url": "${PUBLIC_URL_PREFIX}/<subfolder>/index.html",
  "shopName": "...",
  "jobId": "...",
  "status": "published"
}
```

注意：
- `/public` 只作为发布目标，不要在那里开发。
- 不要发布 secrets、token、OAuth 缓存、内部日志或完整 `.git` 内容。

## 对用户汇报规则

- 每一轮关键资产完成后，都要主动汇报一次进度。
- 主句使用沉浸式口吻，例如：
  - “开店信已经接下，正在把店铺主题和开张清单定稳。”
  - “店员已经到柜台前了，四种表情都备好了。”
  - “第一批货物已经上托盘，正在裁进工作台格子。”
  - “装饰和入口小牌都裁好了，正在最后清点开张用品。”
- 如需补技术信息，把技术信息放在第二句，不要盖过开店语境。
- 出错时也先说明“店里卡在哪一步”，再补真实错误原因。
- 不要频繁用“要不要继续”“我现在继续吗”打断用户，除非遇到真正阻塞。
- 当 concept 已定、信息已足够时，应默认自动推进到下一个强制阶段。
- 用户侧看到的应尽量是：定概念 → 等待若干轮进度 → 直接收到可玩的成品链接。

## 执行建议

### A. 有现成 ready session 时

如果用户给的是现成构建结果，或项目里已有可用 ready session：
- 先验证 session/runtime/artifacts 是否完整
- 如缺少 `enteredShop`，静态导出时强制设置或绕过 creator
- 直接导出静态站点
- QA
- 发布分享

### B. 需要全新生成时

按完整链路执行：
- 生成 concept
- 校验 theme token
- 生成 assistant portraits
- 生成 content pack
- 生成商品、装饰、按钮贴纸与 manifest
- 等待 ready session
- 导出静态站点
- QA
- 发布分享

### C. 项目缺少静态导出脚本时

不要放弃“打开即玩 + 公网 URL”的主目标。应：
- 在临时工作目录或项目 builder 中创建等价导出脚本
- 不修改 archived 目录
- 不把 `/public` 当开发目录
- 导出前后都验证文件与页面行为

## 成功标准

完成时应满足：
- 最终页面打开就显示游戏，而不是 creator 建店页
- 商品图、助手图、装饰贴纸、按钮贴纸都能正常加载
- content pack 驱动的订单、补给、合成链、入场序章可用
- 音效资源存在且交互后可触发
- 页面内资源全部使用相对路径或站内路径
- 无 secrets/token/内部日志泄露
- 返回一个可公开访问的 `index.html` 链接

## 阻塞与返工规则

必须返工或报告阻塞的情况：
- concept 缺少核心字段
- theme token 缺失或明显不可读，且自动对比度修正后仍有主要 UI 文本不可读
- 装饰布局导出后不可拖拽、不可缩放，或刷新后明显丢失当前店铺的布局状态
- contentPack 缺少 sources/clients/chains/recipes/blessings/introSequence
- session 不是 `ready`
- session 缺少 `runtimeConfig` 或关键 manifest URL
- 图片和 manifest/content pack 明显错配，例如石头图绑定成木头名，或合成链出现无关跳变
- 静态页仍进入 creator 建店页
- 分享目录缺失 `index.html / app.js / styles.css / sfx.js / session.json / generated... / assets/sfx...` 中的必要项
- 任何素材 manifest 指向不存在文件

## 推荐最终输出格式

对用户汇报时，优先给：
1. 成品名称
2. 本地输出目录
3. 公网 URL
4. 如失败，给出阻塞阶段与缺失项
