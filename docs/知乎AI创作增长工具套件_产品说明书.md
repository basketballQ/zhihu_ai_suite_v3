# 知乎 AI 创作增长工具套件 · 产品说明书

> 版本：v3（2026-05-10，最后更新 2026-05-10）  
> 技术栈：React 18 + TypeScript + Vite · DeepSeek AI · 知乎开放 API  
> 文档位置：`docs/知乎AI创作增长工具套件_产品说明书.md`

---

## 一、产品概述

**知乎 AI 创作增长工具套件**是一款面向知乎内容创作者的 AI 辅助 SPA（单页应用）。产品以"发现机会 → 起稿 → 评估质量 → 发布互动"为完整创作流将五个独立工具串联，全程借助 DeepSeek 大模型进行实时分析，无 API Key 时自动降级为静态示例数据，保证功能可演示。

### 核心价值主张

| 痛点 | 工具解决方案 |
|------|-------------|
| 不知道该回答哪些热榜问题 | 热榜蹭词器：实时拉取热榜并 AI 评估领域匹配度 |
| 不知道哪个圈子有低竞争问题 | 垂直圈层雷达：分析圈子帖子，提炼蓝海机会题 |
| 回答开头写不好，被划走 | 开场白建议：AI 生成 3 条差异化开头，可在线编辑 |
| 发布前不确定传播力 | 传播力预测器：六维评分 + 专项洞察 + 优化建议 |
| 评论区追问没有承接 | 评论区截流器：提取高价值追问，一键创建新问题或直接回复 |

---

## 二、系统架构

### 2.1 前端架构

```
React 18 (StrictMode)
└── AppProvider (全局状态)
    ├── TopNav（搜索关键词触发热榜/雷达关键词模式）
    ├── Sidebar（圈子管理、领域管理、工具导航）
    └── 页面路由（activeTool 驱动，无路由库）
        ├── Home（套件首页）
        ├── HotTopics（热榜蹭词器）
        ├── Radar（垂直圈层雷达）
        ├── Virality（传播力预测器）
        └── Comments（评论区截流器）
```

### 2.2 状态管理（AppContext）

所有跨页面状态集中在 `AppContext`，主要分组：

**热榜状态**
- `hotTopics` — 当前热榜列表（初始为静态示例数据）
- `hotLoading / hotPhase` — 加载状态；`hotPhase: 'fetch' | 'analyze' | null` 区分两个阶段
- `hotTokens` — DeepSeek 已生成字符数（用于进度展示）
- `hotKeyword` — 关键词模式时的关键词

**雷达状态**
- `radarItems` — 当前圈子问题列表
- `radarLoading / radarPhase` — `'style' | 'content' | null`，区分风格分析与问题分析两阶段
- `radarTokens` — DeepSeek 进度字符数
- `radarKeyword` — 关键词模式
- `circleStyleGuide` — AI 生成的圈子语言风格指南

**圈子 & 领域**
- `circles` — 用户管理的圈子列表（默认 5 个）
- `activeCircle` — 当前激活圈子
- `fields` — 用户领域标签（如"人工智能"、"产品经理"）

**传播力 & 开场白**
- `viralityMode: 'answer' | 'dual'`
- `viralityQuestion / viralityDraft` — 当前预测的问题与草稿
- `openerTitle / openerOpen / openerMode` — 开场白面板状态

**发布目标（PublishTarget）**

```typescript
type PublishTarget =
  | { source: 'radar'; pinToken: string }          // 垂直圈层雷达 → Ring createComment
  | { source: 'ring'; pinContent?: string }         // 评论截流（圈子来源）→ Ring publishPin
  | { source: 'ring_reply'; commentId: string }    // 评论截流（圈子）→ Ring createComment('comment')
  | { source: 'answer' }                            // 热榜/截流（普通问题）→ 知乎回答 API
  | { source: 'answer_reply'; commentId: string }  // 截流（普通问题）→ 知乎回答评论 API
  | null
```

控制"发布"按钮的实际调用路径，全局唯一，确保圈子 API 与知乎回答 API 不会混用。

### 2.3 AI 调用层（`src/lib/ai.ts`）

所有 AI 请求均通过 `chat()` 函数封装，支持流式 token 回调和 JSON 模式：

| 函数 | 用途 | 输出格式 | maxTokens |
|------|------|---------|-----------|
| `analyzeHotTopics` | 批量分析热榜匹配度 | JSON 数组 | 3500 |
| `analyzeCircleStyle` | 分析圈子语言风格 | 4字段 JSON | 4000 |
| `analyzeCircleContent` | 提炼圈子问题机会 | JSON 数组 | 2000 |
| `generateOpeners` | 生成开场白建议 | JSON（3条） | 1000 |
| `generatePinContent` | 生成想法正文 | 纯文本 | 200 |
| `predictVirality` | 传播力六维评分 | JSON 对象 | 2000 |
| `analyzeRingComments` | 提炼圈子真实评论高价值追问 | JSON 数组 | 2500 |
| `generateComments` | AI 模拟生成普通问题追问 | JSON 数组 | 1500 |

无 API Key 时所有函数均降级，返回与真实数据结构相同的静态数据，不影响 UI 展示。

**JSON 解析防护（`extractJson`）**

所有 AI 返回内容在 `JSON.parse` 前统一经过 `extractJson()` 清洗：
1. 优先剥离 ` ```json ... ``` ` markdown 代码块（部分推理模型会输出此格式）
2. 回退到提取字符串中最外层 `{…}` 块

所有 `JSON.parse` 均包裹 try-catch，失败时按函数各自的降级策略处理，不向上抛错。

**`analyzeRingComments` JSON Schema 精简**

为降低推理模型 token 截断和格式错误概率，对输出 schema 做了专项优化：
- AI 只输出 5 个字段：`index`、`name`、`likes`、`body`、`valueScore`、`badgeText`
- 删去冗余字段 `valueLabel`（由代码计算 `截流价值 ${score}分`）和 `badgeClass`（由 `badgeClassMap` 推导）
- Prompt 模板改用真实数字占位（`3`、`128`、`85`），避免中文文字被模型原样输出导致非法 JSON
- 解析后对所有字段做防御性兜底（`Number()`、`?? '知乎用户'`、`?? 70` 等）

### 2.4 知乎 API 接入

#### 知乎圈子 API（`src/lib/zhihuRing.ts`）
适用于：垂直圈层雷达、评论区截流器（圈子路径）

| 方法 | 端点 | 功能 |
|------|------|------|
| `fetchRingDetail` | `GET /openapi/ring/detail` | 获取圈子帖子列表 |
| `publishPin` | `POST /openapi/publish/pin` | 发布想法（圈子帖子） |
| `createComment` | `POST /openapi/comment/create` | 在帖子或评论下发评论 |
| `fetchAllPinComments` | `GET /openapi/comment/list`（并发分页） | 批量拉取帖子全量评论（最多 500 条） |
| `fetchPinComments` | `GET /openapi/comment/list` | 单页评论拉取 |

鉴权：HMAC-SHA256 签名，签名串格式：
```
app_key:{key}|ts:{timestamp}|logid:{logid}|extra_info:
```
环境变量：`VITE_ZHIHU_APP_KEY` / `VITE_ZHIHU_APP_SECRET`

**Int64 精度保护**：知乎 `pin_id` / `comment_id` 均为 19 位 int64，所有解析响应均通过 `parseSafeJson()` 处理（将 16 位以上裸数字替换为字符串），防止 `JSON.parse` 截断精度。

当前已映射圈子：

| 圈子名 | 圈子 ID | 状态 |
|--------|---------|------|
| OpenClaw 人类观察员 | 2001009660925334090 | ✅ 已接入 |
| 其余 4 个圈子 | — | 显示静态初始数据 |

#### 知乎回答 API（`src/lib/zhihuAnswer.ts`）
适用于：热榜蹭词器、评论区截流器（普通问题路径）

| 方法 | 功能 | 状态 |
|------|------|------|
| `publishQuestion` | 创建知乎新问题 | TODO：待接入 Open API |
| `publishAnswer` | 发布知乎回答 | TODO：待接入 Open API |
| `publishAnswerComment` | 在回答下发评论 | TODO：待接入 Open API |

当前实现模拟 300ms 延迟后返回成功，不发起真实网络请求。

#### 知乎热榜 API（`src/lib/zhihu.ts`）
- 端点：`GET /api/v1/content/hot_list`
- 环境变量：`VITE_ZHIHU_ACCESS_KEY`
- 无 Key 时：抛出 `NO_ZHIHU_KEY`，AppContext 捕获后将内置话题标题列表转为原始格式，仍送 DeepSeek 分析

---

## 三、工具详细说明

---

### 3.1 套件首页（Home）

**入口：** 左侧导航「套件首页」

**功能：**
- 展示 4 个核心工具的说明卡片，每卡支持直接跳转
- 展示"我的领域"标签（来自全局 fields 配置）
- 静态内容，无 AI 调用

---

### 3.2 热榜蹭词器（HotTopics）

**入口：** 左侧导航「热榜蹭词器」

#### 3.2.1 热榜获取与分析（两阶段）

> **懒加载：** 热榜数据**不在 App 启动时拉取**，而是用户**首次点入「热榜蹭词器」页面时**才触发。`hotFetchedRef` 守卫保证只触发一次，`refreshHotTopics()`（手动刷新）不受影响。

**Phase 1 — 获取热榜（`fetch`）**
- 调用知乎热榜 API，拉取最新 30 条热榜话题
- UI 显示：「📡 正在获取知乎实时热榜数据…」
- 无 Key 时：Toast 提示"未配置知乎 AccessKey，使用默认话题列表进行分析"，并将内置话题转为原始格式继续下一阶段

**Phase 2 — DeepSeek 分析（`analyze`）**
- 将热榜标题+摘要批量送 DeepSeek，结合用户"我的领域"标签评估每条话题
- UI 显示：「🤖 DeepSeek 正在分析热榜匹配度…」+ 已分析字符数
- AI 为每条话题输出：
  - `score`：与用户领域的匹配度（0–100）
  - `tag`：话题状态（新上榜 / 快速上升 / 蓝海 / 争议高 / 长尾稳定）
  - `heat`：热度描述（"热度 XXX万"格式）
  - `answers`：回答数描述
  - `window`：流量窗口建议（8字以内）
- JSON 解析失败时（token 截断 / 格式污染）逐条降级为 `defaultAnalysis(rank)` 估算值，不整体失败

#### 3.2.2 热榜列表展示

每条话题显示：
- 热榜排名（前10名红色标注）
- 话题标题
- 热度 · 回答数 · 话题状态 Badge
- 流量窗口（前10名红色，其余灰色）
- 领域匹配度进度条（0–100%，蓝色填充）
- 操作按钮：「跳过」「评论截流」「立即回答」

**操作说明：**
- **跳过**：隐藏当前卡片（本地 state，不持久化）
- **评论截流**：在 AppContext 写入 `commentIntercept`，跳转「评论区截流器」并预填 URL
- **立即回答**：进入开场白面板（`openerOpen = true`），问题标题自动填入

#### 3.2.3 从热榜导入到传播力预测器

传播力预测器支持"从热榜导入"弹出选择器，选中后：
- 将该 `HotTopic` 对象存入 `selectedHotTopic`
- 问题输入框自动填充标题
- 显示真实元数据栏：`🔥 {heat} · {answers} · 热榜 #{rank} · 流量窗口 {window}`
- 手动编辑问题后，`selectedHotTopic` 自动清空（不再显示热榜元数据）

#### 3.2.4 顶部通知栏

动态展示当前状态消息：
- 加载中（fetch 阶段）：「📡 正在获取实时热榜数据…」
- 加载中（analyze 阶段）：「🤖 DeepSeek 正在分析匹配度，请稍候…」
- 已选择问题：「已选择！「{问题}」可以先编辑开场白…」
- 加载完成：「新匹配！「{第1名标题}」热榜第X位，匹配度X%，{流量窗口}」

#### 3.2.5 开场白建议（OpenerBox）

触发条件：点击「立即回答」或顶部「查看开场白」按钮

**AI 生成流程：**
1. 调用 `generateOpeners(title)` 生成 3 条差异化开场白（判断型 / 视角型 / 经历型）
2. 加载中显示 3 条灰色骨架屏（shimmer 动画）
3. AI 失败时静默降级到本地模板（`openerSuggestionSets`），不弹 Toast（`NO_API_KEY` 场景除外）

**交互流程：**
- 点击任意一条 → 进入编辑模式（该条 `contentEditable` 激活，另外两条隐藏）
- 「返回重新选」→ 恢复三条展示
- 「换一批」→ 重新调用 AI（编辑中时禁用）

**编辑模式操作：**

| 按钮 | 行为 | 说明 |
|------|------|------|
| 预测传播力 | 草稿送入传播力预测器 | 根据 `openerMode` 区分 answer / dual 模式 |
| 发布 | 调用 `handlePublish` | 根据 `publishTarget` 路由到对应 API |

**圈子模式（`isRingMode = true`）：**
- 触发条件：`publishTarget?.source === 'ring'`（来自评论区截流器圈子路径）
- 标签变为「✍️ AI 生成想法正文」
- 按钮变为「确认正文，去写评论」和「仅发布想法」
- 确认后：`publishTarget.pinContent` 存入正文内容，跳转传播力预测器编写评论草稿

#### 3.2.6 发布路由（handlePublish）

开场白面板的「发布」按钮根据 `publishTarget` 走不同路径：

| publishTarget | 发布行为 | API 状态 |
|--------------|---------|---------|
| `{ source: 'radar', pinToken }` | Ring `createComment('pin', pinToken, draft)` | ✅ 真实 |
| `{ source: 'ring_reply', commentId }` | Ring `createComment('comment', commentId, draft)` | ✅ 真实 |
| `{ source: 'ring' }` | Ring `publishPin(ringId, title, draft)`（仅发想法，无评论） | ✅ 真实 |
| `{ source: 'answer_reply', commentId }` | ⚠️ Toast「知乎回答评论接口暂未开放」 | ❌ 预留 |
| `openerMode === 'dual'`（无 publishTarget） | ⚠️ Toast「知乎创建问题/发布回答接口暂未开放」 | ❌ 预留 |
| 默认 | ⚠️ Toast「知乎回答发布接口暂未开放」 | ❌ 预留 |

#### 3.2.7 关键词模式

触发：顶部搜索框输入关键词并回车

- 切换为关键词相关热榜问题列表（`keywordHotQuestions(keyword)` 生成静态话题）
- 显示「关键词：{关键词}」标签
- 「返回初始状态」按钮 → 恢复 AI 分析结果（`resetHotTopics()`）

---

### 3.3 垂直圈层雷达（Radar）

**入口：** 左侧导航「垂直圈层雷达」

#### 3.3.1 圈子切换与数据加载

顶部圈子 Tab 列表，默认激活「OpenClaw 人类观察员」。

切换圈子时：
1. 优先读内存缓存（`circleCacheRef`），命中则直接展示，不发网络请求
2. 未命中且有 Ring API 凭证 → 进入两阶段加载
3. 无 Ring ID 映射的圈子 → Toast 提示"暂不支持实时数据"，展示静态初始数据

**防重复请求：** `fetchingRef<Set<string>>` 追踪正在请求的圈子，StrictMode 或快速切换时不重复发起

「OpenClaw」圈子头部显示「实时数据」绿色 Badge（仅加载完成后）

**契合度：** 每个圈子显示固定契合度百分比（`circleFitScore()` 函数，基于圈子名特征计算）

#### 3.3.2 两阶段 AI 加载

**Phase 1 — 圈子风格分析（`style`）**

- 调用 `fetchRingDetail(ringId, 20)` 获取圈子最新 20 条帖子
- 调用 `analyzeCircleStyle(circleName, contents, onTokens)` 分析语言风格
- DeepSeek Prompt 要求输出 4 个独立 JSON 字段（每字段 25–40 字，防止截断）：

```json
{
  "tone": "核心语调描述",
  "topics": "内容偏好描述",
  "tips": "高赞写法特征",
  "avoid": "需要避免的写法"
}
```

- `maxTokens: 4000`（应对 DeepSeek 推理模型消耗 reasoning tokens 的问题）
- 成功后组装 HTML：4 个小节（核心语调 / 内容偏好 / 高赞写法 / 避坑提示）
- 结果带"AI 实时分析"标识方写入 `styleGuideCacheRef`
- Phase 1 失败时静默降级，不影响 Phase 2 执行

UI 显示：
```
📖 正在读取圈子风格词汇和语调…
已分析 {N} 字符
```

**Phase 2 — 问题机会分析（`content`）**

- 在 Phase 1 完成（无论成败）后才启动，顺序执行
- 调用 `analyzeCircleContent(circleName, contents, fields, onTokens)`
- DeepSeek 分析帖子讨论，提炼 8 条适合回答的问题机会
- 每条输出：`status`（正在爆发/长尾稳定/蓝海机会）、`score`（60-99）、`title`、`stat`（关注数）、`answers`、`praise`（均赞）、`color`（对应状态颜色）
- Token 计数在 Phase 1 基础上累加（`styleTokenOffset + n`）
- 失败时降级到 `initialRadarItems` 静态数据

UI 显示：
```
🤖 DeepSeek 正在分析圈子问题机会…
累计已分析 {N} 字符，即将完成
```

骨架屏：两阶段均显示 6 张闪烁占位卡片（shimmer 动画）

**加载完成后：** `radarLoading = false`，`radarPhase = null`，结果写入 `circleCacheRef`

#### 3.3.3 风格指南展示

位于雷达列表下方，始终可见。

**加载中（`styleGuideLoading` 为真）：**
- 条件：`!radarKeyword && radarLoading && RING_SUPPORTED.has(activeCircle) && !circleStyleGuide`
- Phase 1：显示"正在读取圈子近期帖子，分析语言风格…" + 已分析字符数
- Phase 2（风格指南仍未就绪）：显示"语言风格分析未能完成，圈子问题加载中，请稍候…"
- 确保整个加载周期内不闪回静态数据

**加载完成：**
- AI 生成结果：显示"🎨 圈子语言风格指南 · {圈子名}（AI 实时分析）"+ 四段内容
- 非支持圈子/无 Key：显示静态内置指南（`getStyleGuideContent(circle)`）

**关键词模式：** 使用 `getKeywordStyleGuide(keyword)` 静态内容

#### 3.3.4 问题卡片与筛选

**筛选条件：** 全部 / 正在爆发 / 长尾稳定 / 蓝海 >70

每张卡片显示：
- 状态 Badge（红=正在爆发，蓝=长尾稳定，绿=蓝海机会）
- 蓝海评分（`score` 值，≥70 显示"蓝海"，否则"观察"）
- 问题标题
- 关注数 · 回答数 · 均赞
- 操作按钮（见下节）

#### 3.3.5 发布想法与评论（圈子 Ring API）

仅 `OpenClaw 人类观察员` 等已映射 Ring ID 的圈子支持。

**「发布想法」流程：**
1. 防重复检查：若该题目已在 `publishedPins` Map 中，Toast 提示并返回
2. 调用 `generatePinContent(title)` → AI 生成想法正文（50-100 字）；无 Key 时降级为模板
3. 调用 `publishPin(ringId, title, content)` → 知乎 Ring API 发布
4. 成功后：记录 `publishedPins.set(title, pinToken)`，按钮切换为「已发布」（禁用）

**「发布并评论」/ 已发布后的「评论」：**
- 发布成功后：`setPublishTarget({ source: 'radar', pinToken })`
- 调用 `startOpenerForQuestion(title)` → 跳转到热榜蹭词器开场白面板
- 用户编辑评论内容，点击「发布」→ 调用 `createComment('pin', pinToken, draft)` 提交

**防重复逻辑（双重保险）：**
- 按钮层：发布成功后 `disabled={loading || published}`
- 函数层：`publishedPins.has(title)` 检查，有则 Toast 提示并 return

---

### 3.4 传播力预测器（Virality）

**入口：** 左侧导航「传播力预测器」；或从开场白「预测传播力」按钮跳转；或从评论区截流器跳转

#### 3.4.1 预测模式

| 模式 | 触发场景 | 说明 |
|------|---------|------|
| `answer`（回答预测） | 默认 / 从热榜导入 / 从截流器直接回答 | 评估草稿对当前问题的传播力 |
| `dual`（双预测） | 从截流器「创建新问题并回答」 | 同时评估"该追问是否值得创建为新问题"和"回答的传播力" |

#### 3.4.2 问题来源区分

**从热榜导入时：**
- `selectedHotTopic` 记录完整热榜话题对象
- 显示真实元数据栏：`🔥 {heat} · {answers} · 热榜 #{rank} · 流量窗口 {window}`
- 手动编辑问题后自动清空 `selectedHotTopic`

**从外部跳转时（`viralityQuestion` 变化）：**
- `useEffect` 尝试在 `hotTopics` 中精确匹配标题，匹配成功则自动设置 `selectedHotTopic`

**圈子双预测模式（`ring` + `dual`）：**
- `publishTarget.source === 'ring'` 且 `publishTarget.pinContent` 已有内容时，显示已生成的想法正文（只读）
- 草稿输入区标签变为「③ 评论内容（将发布在该想法下方）」
- 发布时：先 `publishPin`（用已有正文），再 `createComment`（用草稿作为评论）

#### 3.4.3 AI 六维评分（`answer` 模式）

DeepSeek 分析草稿，输出：

| 指标 | 权重 | 说明 |
|------|------|------|
| 开头吸引力 | 25% | 前三句是否抓住读者 |
| 问题契合度 | — | 回答是否正面回应问题 |
| 情感共鸣度 | 20% | 是否触动目标读者情绪 |
| 信息密度 | 20% | 单位文字的信息量 |
| 结构清晰度 | 15% | 是否有逻辑分层 |
| 行动引导 | 10% | 是否有引导评论/关注的收尾 |

综合输出：
- `overallScore`（0–100）
- `promoLevel`：推荐概率（高/中/低）
- `hotPotential`：热榜潜力（高/中/低）
- `dims`：6 维评分数组
- `insights`：3 条专项洞察（good/warn/bad 类型）
- `advice`：核心优化建议（20字以内）

> AI 返回格式异常（JSON 解析失败）时自动降级到 `mockPrediction(mode)` 示例数据，流程不中断。

#### 3.4.4 双预测模式（`dual`）

额外输出：
- `newQuestionScore`：新问题潜力分（0–100）
- `newQuestionText`：新问题价值描述
- `answerScore`：回答传播力分
- `answerText`：回答质量描述

UI 额外展示「新问题 + 回答双预测」卡片，并行展示两个评分

#### 3.4.5 发布路由（handlePublish）与按钮状态

`isRealApi` 计算当前发布路径是否有真实 API 支撑：
- **真实路径**（`radar` / `ring` / `ring_reply`）：按钮显示蓝色「发布」
- **预留路径**（`answer_reply` / `dual` 非 Ring / 默认）：按钮显示灰色「接口未开放」，hover 显示 tooltip，点击仍弹 Toast 说明原因；路径 badge 同步显示「（接口预留）」灰色样式

| publishTarget | 发布行为 | API 状态 |
|--------------|---------|---------|
| `{ source: 'radar', pinToken }` | Ring `createComment('pin', pinToken, draft)` | ✅ 真实 |
| `{ source: 'ring_reply', commentId }` | Ring `createComment('comment', commentId, draft)` | ✅ 真实 |
| `{ source: 'ring' }`（含 pinContent） | Ring `publishPin` → `createComment`（两步走） | ✅ 真实 |
| `{ source: 'answer_reply', commentId }` | ⚠️ Toast「知乎回答评论接口暂未开放」 | ❌ 预留 |
| `mode === 'dual'`（无 publishTarget） | ⚠️ Toast「知乎创建问题/发布回答接口暂未开放」 | ❌ 预留 |
| 默认 | ⚠️ Toast「知乎回答发布接口暂未开放」 | ❌ 预留 |

---

### 3.5 评论区截流器（Comments）

**入口：** 左侧导航「评论区截流器」；或从热榜「评论截流」按钮跳转（自动填充 URL/标题）

#### 3.5.1 输入识别与路径分流

输入框实时检测内容类型，右侧显示绿色「圈子帖子」或蓝色「普通问题」标签：

```
extractPinId(input):
  ├── 纯数字且 ≥15 位 → 识别为圈子帖子 ID，走 scanRingPin()
  ├── URL 含 /pin/ → 提取 ID，走 scanRingPin()
  └── 其他（知乎链接/问题文字）→ 走 scanQuestion()（AI 模拟）
```

#### 3.5.2 圈子帖子评论扫描（`scanRingPin`）真实数据

无圈子 API 凭证时降级到示例数据并提示。

Phase 1 与 Phase 2 使用**独立 try-catch**，错误信息和降级行为互不干扰：

**Phase 1 — 批量拉取评论（独立 try-catch）：**
- 调用 `fetchAllPinComments(pinId, 500, onProgress)`
- 并发分页：每批 5 页，页大小 50 条，批次间 150ms 延迟防限频
- 实时回调显示已获取条数：「📡 正在拉取评论… 已获取 N 条」
- **失败时**：Toast「圈子评论获取失败：{原因}」，降级 `initialComments`，`return` 不进入 Phase 2

**Phase 2 — DeepSeek 分析（独立 try-catch）：**
- 取点赞最高的 100 条送 `analyzeRingComments('', comments)`
- AI 提炼最多 5 条高价值追问（非原文复制，改写为追问形式）
- 显示：「🤖 已获取 M 条评论，DeepSeek 正在分析点赞最高的 N 条…」
- **失败时**：Toast「AI 分析失败：{原因}」，降级展示**原始高赞前 5 条**（直接从 `ringComments` 取，无需再请求 API），状态栏显示「AI 分析失败，显示原始高赞前 5 条」

**扫描完成状态文案：**

| 结果 | 状态栏文案 |
|------|----------|
| 完全成功 | `已拉取 N 条真实评论（已达 500 条上限）· 分析点赞最高 M 条 · 筛选出 K 条高价值追问` |
| Phase 2 失败 | `已拉取 N 条真实评论 · AI 分析失败，显示原始高赞前 5 条` |
| Phase 1 失败 | `评论拉取失败，已显示示例数据` |

列表头部显示绿色「真实评论」Badge。

#### 3.5.3 普通问题评论（`scanQuestion`）AI 模拟

> **接口预留**：当前由 `generateComments(url)` 根据 URL/问题内容模拟生成追问，不发起知乎评论 API 请求

列表头部显示蓝色「AI 模拟（接口预留）」Badge。

#### 3.5.4 高价值追问清单

- 排序：按截流价值（valueScore 65–95）或按点赞数
- 每条追问显示：头像（首字母）、昵称、点赞数、追问内容、截流价值分、类型 Badge

**Badge 类型：**
- 「知乎无对应问题」→ badge-blue
- 「相关问题回答少」→ badge-up
- 「已有相关问题」→ 无样式

#### 3.5.5 追问操作与发布路由

| 按钮 | 扫描来源 | publishTarget | 跳转 |
|------|---------|--------------|------|
| 创建新问题并回答 | 圈子 | `{ source: 'ring' }` | `startOpenerForQuestion(body, 'dual')` |
| 创建新问题并回答 | 普通问题 | `{ source: 'answer' }` | `startOpenerForQuestion(body, 'dual')` |
| 直接回答 | 圈子（有 commentId） | `{ source: 'ring_reply', commentId }` | `startOpenerForQuestion(body, 'answer')` |
| 直接回答 | 圈子（无 commentId） | `{ source: 'ring' }` | `startOpenerForQuestion(body, 'answer')` |
| 直接回答 | 普通问题（有 commentId） | `{ source: 'answer_reply', commentId }` | `startOpenerForQuestion(body, 'answer')` |
| 直接回答 | 普通问题（无 commentId） | `{ source: 'answer' }` | `startOpenerForQuestion(body, 'answer')` |

---

## 四、跨工具联动路径

```
热榜蹭词器
├── [立即回答] ──→ 开场白面板
│                  ├── [预测传播力] ──→ 传播力预测器（answer 模式）
│                  │                    └── [发布] ──→ publishAnswer（知乎回答 API）
│                  └── [发布] ──→ publishAnswer（知乎回答 API）
│
├── [评论截流] ──→ 评论区截流器（预填 URL）
│                  ├── [创建新问题并回答] ──→ 开场白面板（dual 模式）
│                  │                          └── 传播力预测器 → 发布（两步走）
│                  └── [直接回答] ──→ 开场白面板（answer 模式）
│                                     └── 传播力预测器 → 发布（回复评论）
│
└── [从热榜导入] ←── 传播力预测器（反向导入话题）

垂直圈层雷达
├── [发布想法] ──→ Ring publishPin（直接发布，不带评论）
└── [发布并评论] ──→ Ring publishPin 成功后
    └── setPublishTarget({ source:'radar', pinToken })
        └── 热榜开场白面板（isRingMode = false）
            └── [发布] ──→ Ring createComment('pin', pinToken, draft)

评论区截流器（圈子路径）
└── [创建新问题并回答] ──→ publishTarget = { source: 'ring' }
    └── 开场白面板（isRingMode = true）
        └── [确认正文，去写评论] ──→ publishTarget.pinContent 存入正文
            └── 传播力预测器（dual 模式，显示已生成正文）
                └── [发布] ──→ Ring publishPin + createComment（两步走）
```

---

## 五、左侧侧边栏功能

### 5.1 我的圈子

- 默认 5 个：OpenClaw 人类观察员 / AI 工具测评中心 / 探索Vibe Coding / AI 时代的我们 / 运动打卡行动派
- 支持添加（从推荐列表选择或自定义输入）和删除（×按钮）
- 删除当前激活圈子时自动切换到列表第一个（同一 `setCircles` 批次内更新，无竞态）
- 圈子 Tab 同步更新垂直圈层雷达的数据加载

### 5.2 我的领域

- 默认：人工智能 / 产品经理 / 职场
- 支持添加和删除
- 领域标签直接影响 DeepSeek 评估热榜匹配度时的 Prompt（`fieldsRef` 实时注入，无闭包陈旧问题）

---

## 六、顶部搜索框（全局关键词模式）

输入关键词后按回车：
1. 热榜蹭词器切换为关键词相关话题列表（`keywordHotQuestions(keyword)`）
2. 垂直圈层雷达切换为关键词相关问题列表（`keywordRadarQuestions(keyword)`）
3. 两者均显示「关键词：{keyword}」标签 + 「返回初始状态」按钮
4. 同时跳转到执行搜索时的当前工具页面（上下文感知：热榜页面更新热榜，雷达页面更新雷达）
5. 支持合成输入法（IME），中文输入不会误触 Enter

---

## 七、Toast 通知系统

- 全局浮层，右下角展示
- 每条 Toast 独立 ID，2500ms 后自动消失
- 支持多条并行堆叠展示
- 不同操作有专属文案（发布成功/失败、切换圈子、切换领域、筛选结果等）

---

## 八、关键工程实现

| 问题 | 解决方案 | 涉及文件 |
|------|---------|---------|
| StrictMode 双重执行 | `initFetchedRef` 守卫启动 useEffect，确保圈子初始化请求只发一次 | AppContext.tsx |
| 热榜启动即拉取影响首屏 | `hotFetchedRef` 守卫懒加载 effect：首次切换到热榜页（`activeTool === 'hot'`）时才触发 `refreshHotTopics()` | AppContext.tsx |
| useCallback 闭包陈旧 | `fieldsRef` / `activeCircleRef` 通过 useEffect 同步最新值，callback 读 ref 而非 state | AppContext.tsx |
| 圈子切换重复请求 | `fetchingRef<Set<string>>` 追踪进行中的请求；`circleCacheRef` 命中则跳过网络 | AppContext.tsx |
| Int64 精度丢失 | `parseSafeJson()` 将响应文本中 16 位以上裸数字替换为字符串再 parse；覆盖 fetchRingDetail / fetchPinComments / publishPin / createComment 全部响应解析 | zhihuRing.ts |
| AI 输出 JSON 格式污染 | `extractJson()` 在 JSON.parse 前剥离 markdown 代码块、提取最外层 `{…}`；全部 AI 函数统一使用 | ai.ts |
| AI JSON 解析异常 | 所有 `JSON.parse` 包裹 try-catch；`analyzeHotTopics` 失败时逐条降级 `defaultAnalysis`，`predictVirality` 降级 `mockPrediction`，其余降级静态数据 | ai.ts |
| AI 分析各阶段失败 | 各函数独立降级：开场白→模板，热榜→默认分析，圈子内容→initialRadarItems，圈子风格→静态指南 | ai.ts |
| 评论 Phase 1/2 错误混淆 | `scanRingPin` 将拉取（Phase 1）与 AI 分析（Phase 2）拆为独立 try-catch；Phase 2 失败不再报"评论获取失败"，而是 Toast 实际原因并用已拉到的原始高赞评论降级展示 | Comments.tsx |
| analyzeRingComments token 截断 | maxTokens 1500→2500；JSON schema 精简至 5 字段（删去 `valueLabel`/`badgeClass`）；Prompt 模板改用真实数字占位；代码端 `badgeClassMap` 推导 badgeClass；字段全量防御性兜底 | ai.ts |
| 预留接口假装成功 | HotTopics/Virality 所有 stub 路径（`answer`/`answer_reply`/`dual` 非 Ring）改为 ⚠️ Toast 明确提示接口未开放；Virality 发布按钮按 `isRealApi` 区分蓝色「发布」和灰色「接口未开放」 | HotTopics.tsx / Virality.tsx |

---

## 九、环境变量配置

| 变量 | 说明 | 必填 |
|------|------|------|
| `VITE_DEEPSEEK_API_KEY` | DeepSeek API Key | 否（无则全部降级静态数据） |
| `VITE_ZHIHU_ACCESS_KEY` | 知乎热榜 API AccessKey | 否（无则用默认话题列表送 DeepSeek 分析） |
| `VITE_ZHIHU_APP_KEY` | 知乎圈子 Open API App Key | 否（无则圈子功能只展示静态数据） |
| `VITE_ZHIHU_APP_SECRET` | 知乎圈子 Open API App Secret | 与 APP_KEY 配套 |

---

## 十、降级策略

| 场景 | 降级行为 |
|------|---------|
| 无 DeepSeek Key | 所有 AI 分析跳过，直接展示静态示例数据，UI 隐藏"AI 实时分析"标识 |
| 无知乎热榜 Key | 将内置话题送 DeepSeek 分析（如有 Key），否则直接展示初始列表 |
| 无圈子 API Key | 圈子展示静态 `initialRadarItems`，发布按钮 Toast 提示"未配置凭证" |
| DeepSeek 分析超时/失败 | 各页面捕获错误，Toast 提示，静默降级到静态数据 |
| Ring API 请求失败 | Toast 提示具体错误，保留已生成的风格指南（Phase 1 成功时不回退） |
| 传播力预测 JSON 解析失败 | `extractJson` 预处理 + try-catch，降级到 `mockPrediction(mode)` 示例结果，流程不中断 |
| 热榜分析 JSON 解析失败 | `extractJson` 预处理 + try-catch，逐条降级 `defaultAnalysis(rank)`，不整体报错 |
| 开场白 JSON 解析失败 | try-catch 捕获，降级到 `openerSuggestionSets` 本地模板 |
| 圈子评论 Phase 1 拉取失败 | Toast「圈子评论获取失败：{原因}」，降级展示 `initialComments` 示例数据 |
| 圈子评论 Phase 2 AI 分析失败 | Toast「AI 分析失败：{原因}」，降级展示已拉取的原始高赞前 5 条评论，不丢失 Phase 1 成果 |

---

## 十一、已知限制与待开发项

| 项目 | 状态 | 说明 |
|------|------|------|
| 知乎回答发布 API | 预留接口 | `publishAnswer` / `publishAnswerComment` / `publishQuestion` 接口未开放；UI 已更新为 ⚠️ 提示和灰色「接口未开放」按钮，不再假装成功 |
| 多圈子 Ring API 映射 | 仅 OpenClaw | 其余圈子需注册并配置 Ring ID（`RING_ID_MAP`） |
| 普通问题评论区真实数据 | 未实现 | `scanQuestion` 当前由 AI 模拟生成追问，待知乎回答评论 API 开放后替换 |
| 对标高赞回答 | 静态内容 | 3 条模式总结为固定文案，未接入真实回答数据 |
| 数据持久化 | 无 | 所有状态在页面刷新后重置；圈子/领域配置未写入 localStorage |
| 生产环境热榜代理 | 未配置 | Vite 代理仅适用于开发环境，生产需独立后端代理 |
