import { chat, hasApiKey } from './deepseek';
import { openerSuggestionSets } from '../data/openers';
import type { CommentItem, HotTopic, RadarItem } from '../types';
import type { ZhihuHotItem } from './zhihu';
import type { RingPost } from './zhihuRing';

/**
 * 从 DeepSeek 原始输出中提取合法 JSON 字符串。
 * 处理两种常见污染：
 *  1. 模型用 ```json ... ``` 包裹了输出
 *  2. JSON 前后存在多余说明文字
 */
function extractJson(raw: string): string {
  // 优先匹配 markdown 代码块
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  // 找最外层 { ... }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw;
}

// ─────────────────────────────────────────────
// 开场白生成
// ─────────────────────────────────────────────

export async function generateOpeners(question: string): Promise<string[]> {
  if (!hasApiKey()) {
    // 无 API Key 时使用模板降级
    return openerSuggestionSets[0].map(fn => fn(question));
  }

  const content = await chat(
    [
      {
        role: 'system',
        content:
          '你是知乎爆款回答写作专家，擅长写出能立刻抓住读者注意力的开头句。风格直接、有观点、有温度。',
      },
      {
        role: 'user',
        content: `请为以下知乎问题生成 3 个不同风格的开头句：

问题：${question}

要求：
1. 判断/结论型：先给出一个有点反常识的核心结论
2. 视角/拆解型：提出看这个问题的独特维度或框架
3. 经历/身份型：以具体从业者或亲历者身份切入

每个开头用「」括起来，控制在 80 字以内，语言自然、口语化。

严格按 JSON 返回：{"openers": ["第一个", "第二个", "第三个"]}`,
      },
    ],
    { json: true, temperature: 0.85, maxTokens: 1000 },
  );

  try {
    const parsed = JSON.parse(extractJson(content)) as { openers: string[] };
    if (Array.isArray(parsed.openers) && parsed.openers.length > 0) {
      return parsed.openers.slice(0, 3);
    }
  } catch { /* 降级到模板 */ }
  return openerSuggestionSets[0].map(fn => fn(question));
}

/**
 * 流式生成开场白，每次 chunk 回调可实现打字机效果。
 * 完成后同样返回完整的三条开场白数组。
 */
export async function generateOpenersStream(
  question: string,
  onChunk: (partial: string) => void,
): Promise<string[]> {
  if (!hasApiKey()) {
    const fallback = openerSuggestionSets[0].map(fn => fn(question));
    fallback.forEach(t => onChunk(t));
    return fallback;
  }

  const content = await chat(
    [
      {
        role: 'system',
        content: '你是知乎爆款回答写作专家，擅长写出能立刻抓住读者注意力的开头句。风格直接、有观点、有温度。',
      },
      {
        role: 'user',
        content: `请为以下知乎问题生成 3 个不同风格的开头句：

问题：${question}

要求：
1. 判断/结论型：先给出一个有点反常识的核心结论
2. 视角/拆解型：提出看这个问题的独特维度或框架
3. 经历/身份型：以具体从业者或亲历者身份切入

每个开头用「」括起来，控制在 80 字以内，语言自然、口语化。

严格按 JSON 返回：{"openers": ["第一个", "第二个", "第三个"]}`,
      },
    ],
    { json: true, temperature: 0.85, maxTokens: 1000, onChunk: (_, acc) => onChunk(acc) },
  );

  try {
    const parsed = JSON.parse(extractJson(content)) as { openers: string[] };
    if (Array.isArray(parsed.openers) && parsed.openers.length > 0) {
      return parsed.openers.slice(0, 3);
    }
  } catch { /* 降级到模板 */ }
  return openerSuggestionSets[0].map(fn => fn(question));
}

// ─────────────────────────────────────────────
// 传播力预测
// ─────────────────────────────────────────────

export interface PredictionDim {
  label: string;
  value: number;
}

export interface PredictionInsight {
  type: 'good' | 'warn' | 'bad';
  text: string;
}

export interface PredictionResult {
  overallScore: number;
  dims: PredictionDim[];
  insights: PredictionInsight[];
  promoLevel: '高' | '中' | '低';
  hotPotential: '高' | '中' | '低';
  advice: string;
  // 仅 dual 模式
  newQuestionScore?: number;
  answerScore?: number;
  newQuestionText?: string;
  answerText?: string;
}

/** 无 API Key 时的 mock 结果 */
function mockPrediction(mode: 'answer' | 'dual'): PredictionResult {
  const base: PredictionResult = {
    overallScore: 82,
    dims: [
      { label: '开头吸引力 (25%)', value: 88 },
      { label: '问题契合度', value: 91 },
      { label: '情感共鸣度 (20%)', value: 90 },
      { label: '信息密度 (20%)', value: 74 },
      { label: '结构清晰度 (15%)', value: 62 },
      { label: '行动引导 (10%)', value: 48 },
    ],
    insights: [
      { type: 'good', text: '开头定位精准，符合该问题读者期待。' },
      { type: 'warn', text: '缺少量化数据支撑，建议补充 1–2 个可引用数据。' },
      { type: 'bad', text: '行动引导缺失：建议在结尾增加互动引导句以提升评论权重。' },
    ],
    promoLevel: '高',
    hotPotential: '中',
    advice: '补充 1–2 个可引用数据；结尾加开放式互动引导句。',
  };
  if (mode === 'dual') {
    return {
      ...base,
      newQuestionScore: 91,
      answerScore: 83,
      newQuestionText: '评论点赞高、原问题未充分覆盖，适合整理成独立知乎问题。',
      answerText: '先给学习路径，再补真实案例，避免只列工具清单。',
    };
  }
  return base;
}

export async function predictVirality(
  question: string,
  draft: string,
  mode: 'answer' | 'dual',
  onProgress?: (tokens: number) => void,
): Promise<PredictionResult> {
  if (!hasApiKey()) return mockPrediction(mode);

  const isDual = mode === 'dual';

  const dualExtra = isDual
    ? `,
  "newQuestionScore": 新问题潜力得分（0-100整数）,
  "answerScore": 回答承接传播力得分（0-100整数）,
  "newQuestionText": "一句话说明新问题的价值",
  "answerText": "一句话给出回答建议"`
    : '';

  const content = await chat(
    [
      {
        role: 'system',
        content: `你是知乎内容传播力评估专家，评分标准极其严苛。你的参照系是知乎平台真正高赞（500赞以上）的头部回答。

评分原则：
- 满分（90+）代表该回答几乎必然爆火，极少草稿能达到
- 80–89 代表有明显爆款潜力，发布后有望进前三
- 60–79 代表中等水平，能获得一定赞同但不会出圈
- 40–59 代表低于平均线，大概率被淹没
- 40以下 代表几乎没有传播价值，需要大幅重写
- 草稿字数不足 500 字，信息密度和结构清晰度上限为 55 分
- 没有数据/案例支撑，信息密度上限为 60 分
- 没有行动引导（提问/互动句），行动引导上限为 30 分
- overallScore 是六维加权均值，禁止虚高`,
      },
      {
        role: 'user',
        content: `请严格评估以下知乎${isDual ? '追问和回答草稿' : '问题与回答草稿'}的传播力，按 JSON 返回。

${isDual ? '追问' : '问题'}：${question}
回答草稿：${draft || '（用户尚未填写草稿）'}
草稿字数：约 ${draft.replace(/\s/g, '').length} 字

返回 JSON（数字字段均为 0–100 整数）：
{
  "overallScore": 六维加权综合得分（严格计算，不要虚高）,
  "dims": [
    {"label": "开头吸引力 (25%)", "value": 分数},
    {"label": "问题契合度", "value": 分数},
    {"label": "情感共鸣度 (20%)", "value": 分数},
    {"label": "信息密度 (20%)", "value": 分数},
    {"label": "结构清晰度 (15%)", "value": 分数},
    {"label": "行动引导 (10%)", "value": 分数}
  ],
  "insights": [
    {"type": "good", "text": "一句话说明最大优势（具体，不要泛泛而谈）"},
    {"type": "warn", "text": "一句话指出最需改进的点（要有具体建议）"},
    {"type": "bad", "text": "一句话指出拖累传播力的主要缺陷（直接说问题）"}
  ],
  "promoLevel": "高/中/低",
  "hotPotential": "高/中/低",
  "advice": "一句最关键优化建议（20字以内，直接告诉用户该做什么）"${dualExtra}
}`,
      },
    ],
    {
      json: true,
      temperature: 0.3,
      maxTokens: 2000,
      onChunk: onProgress ? (_, acc) => onProgress(acc.length) : undefined,
    },
  );

  try {
    return JSON.parse(extractJson(content)) as PredictionResult;
  } catch {
    return mockPrediction(mode);
  }
}

// ─────────────────────────────────────────────
// 评论区分析（生成上下文相关追问）
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 知乎热榜 DeepSeek 分析
// ─────────────────────────────────────────────

export interface AnalyzedHotItem {
  score: number;   // 领域匹配度 0-100
  tag: string;     // 新上榜 | 快速上升 | 蓝海 | 争议高 | 长尾稳定
  window: string;  // 流量窗口描述
  heat: string;    // 热度描述（如"热度 892万"）
  answers: string; // 回答数描述（如"回答 1,243 个"）
}

/** 无 API Key 时按排名生成保底数据 */
function defaultAnalysis(rank: number): AnalyzedHotItem {
  const tags = ['新上榜', '快速上升', '蓝海', '争议高', '长尾稳定'];
  const tag = tags[rank % tags.length];
  const score = Math.max(55, 95 - rank * 2);
  const heatVal = Math.max(50, 900 - rank * 28);
  const answerVal = Math.max(100, 2000 - rank * 60);
  const windows = ['流量窗口约 2h', '流量窗口约 3h', '均赞 28', '评论增长快', '回答质量分化'];
  return {
    score,
    tag,
    window: windows[rank % windows.length],
    heat: `热度 ${heatVal}万`,
    answers: `回答 ${answerVal.toLocaleString()} 个`,
  };
}

/**
 * 用 DeepSeek 批量分析知乎热榜条目，结合用户领域计算匹配度、标签、流量窗口等。
 * 无 API Key 时降级为按排名估算。
 */
export async function analyzeHotTopics(
  items: ZhihuHotItem[],
  fields: string[],
  onTokens?: (count: number) => void,
): Promise<HotTopic[]> {
  if (!hasApiKey() || items.length === 0) {
    return items.map((item, i) => {
      const a = defaultAnalysis(i);
      return {
        rank: i + 1,
        title: item.Title,
        ...a,
        url: item.Url,
        thumbnailUrl: item.ThumbnailUrl,
        summary: item.Summary,
      };
    });
  }

  const itemsText = items
    .map((item, i) => `${i + 1}. 标题：${item.Title}\n   摘要：${item.Summary || '（无摘要）'}`)
    .join('\n');

  const content = await chat(
    [
      {
        role: 'system',
        content: `你是知乎平台内容运营专家，负责分析热榜话题与创作者领域的匹配程度，并判断每个话题的当前趋势状态。
你对知乎平台的流量机制非常了解，能准确预判每个话题的流量窗口和创作机会。`,
      },
      {
        role: 'user',
        content: `请分析以下知乎热榜话题，结合创作者的领域背景，给出每个话题的评估结果。

创作者领域：${fields.length > 0 ? fields.join('、') : '未指定'}

热榜话题列表：
${itemsText}

对每个话题请返回：
- score：与创作者领域的匹配度（0-100整数，100=完全吻合，0=毫不相关，严格评估）
- tag：话题状态，必须从以下五个中选一个："新上榜"、"快速上升"、"蓝海"、"争议高"、"长尾稳定"
  - 新上榜：刚进热榜，回答竞争少
  - 快速上升：热度快速增长，窗口期有限
  - 蓝海：热度稳定但高赞回答少，适合深度回答
  - 争议高：评论区活跃，正反意见分裂
  - 长尾稳定：长期存在的经典问题
- window：流量窗口建议（8字以内，如"流量窗口约2h"、"均赞31"、"评论增长快"、"回答质量分化"）
- heat：热度描述（格式固定为"热度 XXX万"，根据话题在热榜的位置估算，第1名约900万，逐渐递减）
- answers：回答数描述（格式固定为"回答 X,XXX 个"，根据话题类型估算）

严格按JSON返回，不要其他文字：
{"results": [{"score":数字,"tag":"标签","window":"描述","heat":"热度 XXX万","answers":"回答 X,XXX 个"}, ...]}`,
      },
    ],
    { json: true, temperature: 0.4, maxTokens: 3500, onChunk: (_, acc) => onTokens?.(acc.length) },
  );

  type AiResult = { score: number; tag: string; window: string; heat: string; answers: string };

  // 解析失败时降级为按排名估算，不向上抛错
  let results: AiResult[] = [];
  try {
    const parsed = JSON.parse(extractJson(content)) as { results: AiResult[] };
    results = Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    // JSON 解析失败（截断 / 格式污染），results 保持空数组，下方 map 会逐条使用 defaultAnalysis
  }

  return items.map((item, i) => {
    const r: AiResult = results[i] ?? defaultAnalysis(i);
    return {
      rank: i + 1,
      title: item.Title,
      score: typeof r.score === 'number' ? Math.min(100, Math.max(0, r.score)) : defaultAnalysis(i).score,
      tag: r.tag || defaultAnalysis(i).tag,
      window: r.window || defaultAnalysis(i).window,
      heat: r.heat || defaultAnalysis(i).heat,
      answers: r.answers || defaultAnalysis(i).answers,
      url: item.Url,
      thumbnailUrl: item.ThumbnailUrl,
      summary: item.Summary,
    };
  });
}

// ─────────────────────────────────────────────
// 圈子语言风格分析
// ─────────────────────────────────────────────

export async function analyzeCircleStyle(
  circleName: string,
  posts: RingPost[],
  onTokens?: (count: number) => void,
): Promise<{ label: string; body: string }> {
  if (!hasApiKey() || posts.length === 0) {
    const { getStyleGuideContent } = await import('../data/radar');
    return getStyleGuideContent(circleName);
  }

  const sanitize = (s: string) =>
    s.replace(/<[^>]+>/g, '')
      .replace(/["\\\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

  const samples = posts
    .slice(0, 10)
    .map(p => sanitize(p.content ?? p.title ?? ''))
    .filter(Boolean)
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n');

  // 不在内部 fallback：JSON 解析失败时直接抛出，让 AppContext 决定是否回退静态数据。
  // 内部 fallback 会把静态数据写入 circleStyleGuide，导致 UI 在 Phase 2 期间也显示静态数据。
  // 用四个独立字段代替单个超长 body：即使 token 被推理消耗，各字段被截断概率更低。
  const content = await chat(
    [
      {
        role: 'system',
        content: '你是知乎圈子内容策略专家，专门给创作者提供实用写作建议。只返回JSON，不要有其他文字。',
      },
      {
        role: 'user',
        content: `分析「${circleName}」圈子，用JSON返回写作指南，每个字段25-40字，严禁双引号和反斜线。

近期帖子样本：
${samples}

返回格式（每个字段一句话，严禁双引号）：
{"tone":"核心语调和情感基调","topics":"最受欢迎的话题类型","tips":"高赞写法的关键套路","avoid":"最容易踩的雷区"}`,
      },
    ],
    { json: true, temperature: 0.4, maxTokens: 4000, onChunk: (_, acc) => onTokens?.(acc.length) },
  );

  const parsed = JSON.parse(extractJson(content)) as { tone: string; topics: string; tips: string; avoid: string };
  // 将四个独立字段组合成带 HTML 格式的风格指南
  const body = [
    `<b>🎯 核心语调</b><br>${parsed.tone ?? ''}`,
    `<b>📌 内容偏好</b><br>${parsed.topics ?? ''}`,
    `<b>✅ 高赞写法</b><br>${parsed.tips ?? ''}`,
    `<b>❌ 避坑提示</b><br>${parsed.avoid ?? ''}`,
  ].filter(s => !s.endsWith('<br>')).join('<br><br>');

  return {
    label: `🎨 圈子语言风格指南 · ${circleName}（AI 实时分析）`,
    body,
  };
}

// ─────────────────────────────────────────────
// 圈子内容分析 → 雷达问题
// ─────────────────────────────────────────────

export async function analyzeCircleContent(
  circleName: string,
  posts: RingPost[],
  fields: string[],
  onTokens?: (count: number) => void,
): Promise<RadarItem[]> {
  if (!hasApiKey() || posts.length === 0) {
    const { initialRadarItems } = await import('../data/radar');
    return initialRadarItems;
  }

  const clean = (s: string) =>
    s.replace(/<[^>]+>/g, '')
      .replace(/["\\\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

  const postsText = posts
    .slice(0, 12)
    .map((p, i) => {
      const text = clean(p.content ?? p.title ?? '');
      return `${i + 1}. [赞${p.like_num} 评${p.comment_num}] ${text}`;
    })
    .join('\n');

  let content = '';
  try {
    content = await chat(
      [
        {
          role: 'system',
          content: `你是知乎圈子内容分析专家，擅长从圈子讨论中提炼出高价值的知乎问答机会。`,
        },
        {
          role: 'user',
          content: `圈子名称：${circleName}
创作者领域：${fields.length > 0 ? fields.join('、') : '未指定'}

以下是该圈子最新的 ${posts.length} 条帖子（含互动数据）：
${postsText}

请分析这些讨论，提炼出 8 个适合在知乎上回答的高价值问题方向（不是原文复制，而是总结成知乎问题形式）。

严格返回 JSON：
{
  "items": [
    {
      "status": "正在爆发|长尾稳定|蓝海机会",
      "score": 蓝海机会评分(60-99整数),
      "title": "知乎问题形式的标题（15-40字）",
      "stat": "👥 X万关注",
      "answers": "回答 XX个",
      "praise": "均赞 XX",
      "color": "#E84749|#0066ff|#00A86B"
    }
  ]
}
color 规则：正在爆发=#E84749，长尾稳定=#0066ff，蓝海机会=#00A86B`,
        },
      ],
      { json: true, temperature: 0.5, maxTokens: 2000, onChunk: (_, acc) => onTokens?.(acc.length) },
    );

    type AiItem = { status: string; score: number; title: string; stat: string; answers: string; praise: string; color: string };
    const parsed = JSON.parse(extractJson(content)) as { items: AiItem[] };
    return parsed.items.map(it => ({
      status: it.status,
      score: Math.min(99, Math.max(60, it.score)),
      title: it.title,
      stat: it.stat,
      answers: it.answers,
      praise: it.praise,
      color: it.color,
    }));
  } catch {
    const { initialRadarItems } = await import('../data/radar');
    return initialRadarItems;
  }
}

// ─────────────────────────────────────────────
// 评论区分析 — 圈子帖子真实评论（Ring API 获取后送 DeepSeek 分析）
// ─────────────────────────────────────────────

/** 去除 HTML 标签，保留纯文本 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

/**
 * 分析圈子帖子的真实评论，提炼高价值追问
 * 输入：由 fetchPinComments() 获取的真实评论列表
 * 输出：CommentItem[]（可直接用于截流器 UI）
 */
export async function analyzeRingComments(
  pinContent: string,
  comments: Array<{ comment_id: string; content: string; author_name: string; like_count: number; reply_count: number }>,
  onTokens?: (count: number) => void,
): Promise<CommentItem[]> {
  if (comments.length === 0) {
    const { initialComments } = await import('../data/comments');
    return initialComments;
  }

  if (!hasApiKey()) {
    // 无 Key：按点赞数降序取前 5 条原始评论直接展示
    return comments
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 5)
      .map((c, i) => ({
        id: i + 1,
        avatar: c.author_name.charAt(0).toUpperCase(),
        name: c.author_name,
        likes: c.like_count,
        body: stripHtml(c.content).slice(0, 120),
        valueScore: Math.min(95, 65 + c.like_count % 30),
        valueLabel: `截流价值 ${Math.min(95, 65 + c.like_count % 30)}分`,
        badgeText: '相关问题回答少',
        badgeClass: 'badge-up',
        hasExistingQuestion: false,
        commentId: c.comment_id,
      }));
  }

  // 按点赞数降序，最多传 100 条给 DeepSeek（外层已排好序，直接截取）
  const sorted = [...comments]
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, 100);

  const commentsText = sorted
    .map((c, i) => `[${i + 1}] [${c.like_count}赞 ${c.reply_count}回复] ${c.author_name}：${stripHtml(c.content).slice(0, 200)}`)
    .join('\n');

  const pinSnippet = pinContent ? `帖子内容（节选）：${stripHtml(pinContent).slice(0, 300)}\n\n` : '';

  const content = await chat(
    [
      {
        role: 'system',
        content: '你是知乎内容创作专家，擅长从圈子真实评论中识别高价值追问，判断哪些评论值得在知乎上展开成独立回答，帮助创作者捕获流量机会。',
      },
      {
        role: 'user',
        content: `以下是某个知乎圈子帖子下的真实评论，请从中筛选最多 5 条最有截流价值的追问评论。

${pinSnippet}真实评论列表（按点赞数排序）：
${commentsText}

筛选标准：
- 该评论提出了一个有深度、可展开的问题方向
- 有相当数量的读者可能有类似疑惑
- 适合在知乎上独立成篇作答

注意：body 不是原文复制，而是将评论核心意图提炼成追问形式（30–80字）
badgeText 只能是以下三者之一：知乎无对应问题 / 相关问题回答少 / 已有相关问题

严格返回 JSON，示例格式如下（数字字段必须是数字，不要用文字占位）：
{"comments":[{"index":3,"name":"张三","likes":128,"body":"提炼后的追问内容","valueScore":85,"badgeText":"相关问题回答少"}]}`,
      },
    ],
    { json: true, temperature: 0.5, maxTokens: 2500, onChunk: (_, acc) => onTokens?.(acc.length) },
  );

  type AiComment = {
    index?: number; name: string; likes: number; body: string;
    valueScore: number; badgeText: string;
  };

  // badgeText → badgeClass 映射（避免让模型输出，减少格式出错概率）
  const badgeClassMap: Record<string, string> = {
    '知乎无对应问题': 'badge-blue',
    '相关问题回答少': 'badge-up',
    '已有相关问题': '',
  };

  try {
    const parsed = JSON.parse(extractJson(content)) as { comments: AiComment[] };
    if (!Array.isArray(parsed.comments)) throw new Error('comments 字段不是数组');

    return parsed.comments.map((c, i) => {
      const score = Math.min(95, Math.max(65, Number(c.valueScore) || 70));
      const badge = c.badgeText ?? '相关问题回答少';
      // 用 DeepSeek 返回的 index 反查原始评论的 comment_id
      const original = c.index != null ? sorted[c.index - 1] : undefined;
      return {
        id: i + 1,
        avatar: (c.name ?? '?').charAt(0).toUpperCase(),
        name: c.name ?? '知乎用户',
        likes: Number(c.likes) || 0,
        body: c.body ?? '',
        valueScore: score,
        valueLabel: `截流价值 ${score}分`,
        badgeText: badge,
        badgeClass: badgeClassMap[badge] ?? 'badge-up',
        hasExistingQuestion: badge === '已有相关问题',
        commentId: original?.comment_id,
      };
    });
  } catch (parseErr) {
    // JSON 解析失败：抛出语义明确的错误，让调用层决定如何降级
    throw new Error(`AI 返回内容解析失败（${(parseErr as Error).message}），请重试。`);
  }
}

// ─────────────────────────────────────────────
// 评论区分析 — 普通知乎回答评论（接口预留，当前由 AI 模拟）
// 待接入：GET /openapi/comment/list（answer 维度，知乎回答 Open API 开放后替换）
// ─────────────────────────────────────────────

export async function generateComments(urlOrQuestion: string): Promise<CommentItem[]> {
  if (!hasApiKey()) {
    const { initialComments } = await import('../data/comments');
    return initialComments;
  }

  const content = await chat(
    [
      {
        role: 'system',
        content:
          '你是知乎平台深度用户，能模拟真实读者对一篇热门回答的追问场景，语气真实、贴近中文互联网用户习惯。',
      },
      {
        role: 'user',
        content: `根据以下知乎问题或链接，生成 5 条高价值的读者追问评论。

问题/链接：${urlOrQuestion}

要求：
- 追问要具体、有深度，不能只是"能详细说说吗"
- 点赞数在 500–5000 之间，反映真实热度差异
- badgeText 三选一："知乎无对应问题" / "相关问题回答少" / "已有相关问题"
- badgeClass 对应："badge-blue" / "badge-up" / ""
- hasExistingQuestion：当 badgeText 为"已有相关问题"时为 true，否则 false
- 用户名用英文名或带特点的中文网名

严格返回 JSON：
{
  "comments": [
    {
      "name": "用户名",
      "likes": 点赞数,
      "body": "追问内容（40–90字）",
      "valueScore": 截流价值分（65–95），
      "valueLabel": "截流价值 XX分",
      "badgeText": "...",
      "badgeClass": "...",
      "hasExistingQuestion": true或false
    }
  ]
}`,
      },
    ],
    { json: true, temperature: 0.8, maxTokens: 1500 },
  );

  const parsed = JSON.parse(extractJson(content)) as {
    comments: Array<{
      name: string;
      likes: number;
      body: string;
      valueScore: number;
      valueLabel: string;
      badgeText: string;
      badgeClass: string;
      hasExistingQuestion: boolean;
    }>;
  };

  return parsed.comments.map((c, i) => ({
    id: i + 1,
    avatar: c.name.charAt(0).toUpperCase(),
    name: c.name,
    likes: c.likes,
    body: c.body,
    valueScore: c.valueScore,
    valueLabel: c.valueLabel,
    badgeText: c.badgeText,
    badgeClass: c.badgeClass,
    hasExistingQuestion: c.hasExistingQuestion,
  }));
}

// ─────────────────────────────────────────────
// 生成想法正文 (Pin)
// ─────────────────────────────────────────────

export async function generatePinContent(title: string): Promise<string> {
  if (!hasApiKey()) {
    return `关于「${title}」，大家有什么看法？欢迎在评论区讨论。`;
  }

  const content = await chat(
    [
      {
        role: 'system',
        content: '你是知乎垂直圈层的活跃创作者，擅长发布简短、有互动性的想法（类似微博或动态）。',
      },
      {
        role: 'user',
        content: `请为以下主题生成一段知乎想法的配套正文。
主题：${title}
要求：
1. 语言简练，控制在 50-100 字左右。
2. 带有分享欲，可以适当提出一个开放性的问题，引导圈友在评论区讨论。
3. 不需要 markdown 格式，只返回纯文本正文内容。`,
      },
    ],
    { json: false, temperature: 0.7, maxTokens: 200 },
  );

  return content.trim();
}
