---
name: themed-shop-static-publisher
description: 把主题小店玩法项目生成为一个可直接打开游玩的静态页面，并发布为公开链接。当用户想“做一个可玩的主题小店页面”“把某个店铺主题自动出成静态成品页”“调用 Neta creative 生成店铺素材并分享成品”时，必须使用这个 skill。它适用于：从一句店铺想法出发，生成概念、文案、商品图、助手立绘、装饰贴纸、按钮贴纸与音效完整资源，组装为可玩的静态 HTML，并最终发布公开 URL。
---

# Themed Shop Static Publisher

这个 skill 把当前 `witch-curio-shop-mvp-2` 项目作为**主题小店生产引擎**来使用，而不是让终端用户自己走完整建店流程。

主流程和用户体验保持不变：

> 用户给一句店铺想法 → Agent 定概念 → 自动生成内容与素材 → 导出打开即玩的静态页 → QA → 发布公开 URL

内部实现必须同步当前项目的新架构：OAuth / LLM concept、`world-shop-agent/v1` handshake、本地或远程 build agent、Neta creative 图像管线、主题色校验、装饰与按钮贴纸、音效资源、ready session 与静态注入。

## 目标

输出一个：
- 已完成主题定制
- 打开就能玩，不进入 creator 建店页
- 保留原项目核心玩法体验：合成、订单、补给、图鉴、收藏、装饰、助手、入场序章、经营回顾、音效
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

项目根目录：
- `/workspace/03-gameplay-projects 🎮/active/witch-curio-shop-mvp-2`

当前核心文件：
- `server.mjs`：本地 orchestrator、静态服务器、session/build API、SSE、LLM content pack 编排、agent provider 路由
- `creator.js`：前端建店/确认/构建进度/进入店铺流程
- `app.js`：核心合成店铺玩法、runtimeConfig 注入、装饰贴纸、UI 按钮贴纸、图鉴/收藏/订单等
- `styles.css`：游戏主体与 creator/building 页面样式
- `sfx.js`：音效系统
- `assets/sfx/`：本地音效文件，静态导出必须包含
- `builder/agent-handshake.md`：`world-shop-agent/v1` 本地/远程 agent 协议
- `builder/local-codex-worker.mjs`：本地构建 worker，按阶段生成/校验素材并完成 session
- `builder/local-asset-pipeline.mjs`：Neta creative 图片生成、切图与 runtimeConfig 产物组装
- `builder/skills/shop-builder/profile.json`：生成计划，包含 requiredImages、切图行列等
- `builder/skills/shop-builder/prompt_*.md`：concept、assistant、shop sheet、decor、UI button、world patch 的生成约束
- `generated/current-session.json`：当前 ready session 常见位置
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

### 阶段 3：通过 build agent 生成内容与素材

优先复用项目现有生产链：

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
15. publish share link

要求：
- 不允许跳过 `content pack` 直接出最终商品图。
- 不允许在主题色 token 缺失时继续导出。
- 不允许在未确认当前轮结果可用时提前宣布下一轮完成。
- 不允许把项目默认旧素材当成正式完成结果。
- 每轮关键资产完成后，都要向用户返回一条沉浸式进度播报。

### 阶段 4：生成格式要求

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
- `assistant_portraits/manifest.json`
- `assistant_portraits/smile.png`
- `assistant_portraits/serious.png`
- `assistant_portraits/angry.png`
- `assistant_portraits/confused.png`

#### 4.2 shop sheet

当前要求是 `shop_sheet_4x8.png`。

必须满足：
- 4 rows x 8 columns
- 32 个商品/材料图标
- pure white background
- 无文字、无 label、无 logo、无 typography、无 letters、无 numbers
- 无边框、无分隔线、无格子线
- 每个物品居中且略小于格子
- 四周有足够白边
- 相邻物品之间有清晰白色 gutter
- 物体不能碰撞、重叠或跨格
- slot notes 只能作为语义指导，不能被画出来

产物要求：
- `shop_sheet_4x8.png`
- `tiles/manifest.json`
- `tiles/*.png`

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

产物要求：
- `shop_decor_stickers_2x3.png`
- `shop_decorations/manifest.json`
- `shop_decorations/*.png`

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
- `ui_buttons/manifest.json`
- `ui_buttons/*.png`

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
   - `creator.js`，如果静态页仍依赖其函数；否则可不加载
   - `styles.css`
   - `sfx.js`
   - `neta-config.js` / `neta-auth.js` 仅在不会触发登录和不会泄露敏感信息时保留；纯静态成品应尽量绕过 auth
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
   - 页面加载后直接调用或等价执行：`resetShopState(runtimeConfig, { introSeen: false })`，并显示 `#appShell`
6. 路径处理：
   - 所有 `/generated/...`、`/assets/...`、`/Downloads/...` 等必须转换为静态站点内可访问路径，优先相对路径或站内绝对路径
   - 不允许引用本地绝对文件路径

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
- `runtimeConfig.theme` 25 个必需 token 全部存在
- `runtimeConfig.contentPack` 结构完整
- `runtimeConfig.tileAssetBase` 可访问
- `runtimeConfig.tileManifest.bindings` 存在
- 4 张助手表情图可访问
- `decorationManifestUrl` 可访问且至少 6 个装饰
- `uiButtonManifestUrl` 可访问且包含 hall/codex/shelf/reset/trash

#### 页面体验

检查：
- 打开 `index.html` 直接显示游戏，不是 creator 建店页
- 商品图正常显示，不是旧默认素材
- 助手立绘正常显示，不是旧默认素材
- 装饰贴纸可见/可拖动
- 大厅、图鉴、收藏、重开、垃圾桶按钮贴纸正常
- 入场序章、订单、补给、图鉴、收藏、经营回顾基本可用
- 音效文件不 404；浏览器限制下未自动播放不算失败，但用户交互后应可触发音效
- 页面资源没有泄露 token、内部日志、绝对路径或 secrets

### 阶段 9：发布分享

读取 `/configs/platform/.agents/skills/public-share/SKILL.md` 的规则。

做法：
1. 把通过 QA 的静态目录复制到 `/public/<subfolder>/`
2. 返回直达 `index.html` 的 URL

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
- theme token 缺失或明显不可读
- contentPack 缺少 sources/clients/chains/recipes/blessings/introSequence
- session 不是 `ready`
- session 缺少 `runtimeConfig` 或关键 manifest URL
- 生成页仍加载旧默认素材、旧默认文案或旧默认绝对路径
- 静态页仍进入 creator 建店页
- 分享目录缺失 `index.html / app.js / styles.css / sfx.js / session.json / generated... / assets/sfx...` 中的必要项
- 任何素材 manifest 指向不存在文件

## 推荐最终输出格式

对用户汇报时，优先给：
1. 成品名称
2. 本地输出目录
3. 公网 URL
4. 如失败，给出阻塞阶段与缺失项
