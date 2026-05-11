# 知乎 AI 创作增长工具套件 v3

> 面向知乎内容创作者的 AI 辅助工具集，覆盖「发现机会 → 生成内容 → 预测效果 → 发布互动」完整创作链路。

**技术栈**：React 18 + TypeScript + Vite + DeepSeek API + 知乎 Open API

---

## 功能模块

### 🔥 热榜蹭词器
- 实时接入知乎热榜（Top 30）
- DeepSeek 分析每条话题与你专业领域的匹配度（0–100 分）
- 识别流量窗口标签：新上榜 / 快速上升 / 蓝海 / 争议高 / 长尾稳定
- AI 生成 3 条不同风格开场白（判断型 / 视角型 / 经历型）
- 支持关键词监控模式

### 📊 传播力预测器
- 六维质量评分：开头吸引力 / 问题契合度 / 情感共鸣 / 信息密度 / 结构清晰度 / 行动引导
- 参照系：知乎 500+ 赞头部回答
- 支持双预测模式（新问题潜力 + 回答传播力同步评估）
- 可从热榜一键导入问题

### 💬 评论区截流器
- 支持知乎圈子帖子（pin 链接 / ID）和普通问题链接
- 批量并发拉取真实评论（最多 500 条）
- DeepSeek 识别高价值追问，输出截流价值评分
- 支持「创建新问题并回答」和「直接回复评论」两种行动路径

### 📡 垂直圈层雷达
- 接入知乎圈子实时数据，分析话题热度与蓝海机会
- DeepSeek 生成圈子语言风格指南（语调 / 内容偏好 / 高赞写法 / 避坑提示）
- 一键发布圈子想法，支持「发布并评论」双步流程
- 支持按状态筛选：正在爆发 / 长尾稳定 / 蓝海 >70

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制并填写 API 密钥：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# DeepSeek API Key（必填，否则降级为模板数据）
VITE_DEEPSEEK_API_KEY=sk-xxx

# 知乎热榜 API（选填）
VITE_ZHIHU_ACCESS_KEY=xxx

# 知乎圈子 Ring API（选填）
VITE_ZHIHU_APP_KEY=xxx
VITE_ZHIHU_APP_SECRET=xxx

# 知乎 OAuth 登录（选填，供社区用户登录后发布）
VITE_ZHIHU_OAUTH_APP_ID=xxx
VITE_ZHIHU_OAUTH_APP_KEY=xxx
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:5173 即可使用。

---

## API 凭证申请

| 凭证 | 用途 | 申请渠道 |
|------|------|---------|
| DeepSeek API Key | AI 分析核心能力 | [platform.deepseek.com](https://platform.deepseek.com) |
| 知乎 AccessKey | 热榜实时数据 | 知乎开放平台 |
| 知乎 App Key / Secret | 圈子数据 & 发布 | 知乎 moltbook openapi |
| 知乎 OAuth App ID / Key | 社区用户登录 | 知乎商务渠道 / 黑客松 |

> 未配置 API Key 时，各模块自动降级使用本地示例数据，不影响界面正常运行。

---

## 项目结构

```
src/
├── context/AppContext.tsx     # 全局状态（工具切换、圈子、领域、发布路由、OAuth）
├── lib/
│   ├── ai.ts                  # AI 分析入口（开场白 / 预测 / 热榜 / 圈子 / 评论）
│   ├── deepseek.ts            # DeepSeek API 封装（流式 + JSON 解析）
│   ├── zhihu.ts               # 知乎热榜 API
│   ├── zhihuRing.ts           # 知乎圈子 API（帖子 / 评论 / 发布）
│   └── zhihuOAuth.ts          # 知乎 OAuth 2.0 登录
├── pages/
│   ├── HotTopics.tsx          # 热榜蹭词器
│   ├── Virality.tsx           # 传播力预测器
│   ├── Comments.tsx           # 评论区截流器
│   └── Radar.tsx              # 垂直圈层雷达
├── components/
│   ├── Sidebar.tsx            # 侧边栏（导航 / 圈子 / 领域 / 账号登录）
│   ├── TopNav.tsx             # 顶部搜索导航
│   └── Toast.tsx              # 全局提示
└── data/                      # 本地示例数据 & 降级模板
```

---

## 发布路径说明

| 场景 | 接口状态 |
|------|---------|
| 发布圈子想法 | ✅ 已接入 Ring API |
| 发布圈子评论 / 回复 | ✅ 已接入 Ring API |
| 发布知乎回答 | ⚠️ 接口预留（知乎官方未开放） |
| 创建知乎问题 | ⚠️ 接口预留（知乎官方未开放） |

发布圈子内容需先在左侧边栏完成**知乎账号登录**（OAuth 2.0）。

---

## 文档

详细产品说明见 [`docs/知乎AI创作增长工具套件_产品说明书.md`](docs/知乎AI创作增长工具套件_产品说明书.md)
