import type { HotTopic } from '../types';

export const initialHotTopics: HotTopic[] = [
  { rank: 4,  title: 'AGI 真的要来了吗？目前人工智能距离真正的通用智能还有多远？', heat: '热度 892万', answers: '回答 1,243 个', tag: '新上榜',   score: 94, window: '流量窗口 1h 42min' },
  { rank: 7,  title: 'ChatGPT 推出 o3 后，国内 AI 产品经理的工作会发生哪些变化？',   heat: '热度 421万', answers: '回答 678 个',   tag: '快速上升', score: 88, window: '流量窗口 约 3h' },
  { rank: 12, title: '普通人如何用 AI 工具提升工作效率，有哪些真实有效的方法？',      heat: '热度 203万', answers: '回答 2,891 个', tag: '蓝海',     score: 76, window: '回答质量分化' },
  { rank: 18, title: 'AI Agent 会不会成为下一个超级入口？普通产品应该怎么接入？',      heat: '热度 168万', answers: '回答 512 个',   tag: '快速上升', score: 84, window: '流量窗口 约 4h' },
  { rank: 23, title: '年轻人转行 AI 产品还有机会吗？现在入场需要补哪些底层能力？',    heat: '热度 137万', answers: '回答 349 个',   tag: '长尾稳定', score: 81, window: '均赞 31' },
  { rank: 29, title: '公司要求所有岗位都学 AI，是效率升级还是新的形式主义？',          heat: '热度 119万', answers: '回答 904 个',   tag: '争议高',   score: 79, window: '评论增长快' },
  { rank: 34, title: 'AI 写作工具越来越强，内容创作者的核心竞争力还剩什么？',          heat: '热度 96万',  answers: '回答 1,087 个', tag: '蓝海',     score: 73, window: '回答质量分化' },
];

export function keywordHotQuestions(keyword: string): HotTopic[] {
  const term = (keyword || 'AI').trim();
  return [
    { rank: 3,  title: `${term} 相关热榜里，普通人现在最该关注的变化是什么？`,     heat: '热度 623万', answers: '回答 1,032 个', tag: '正在爆发', score: 96, window: '流量窗口 1h 20min' },
    { rank: 8,  title: `${term} 会不会改变产品经理和运营岗位的日常工作？`,         heat: '热度 386万', answers: '回答 714 个',   tag: '快速上升', score: 89, window: '流量窗口 约 3h' },
    { rank: 14, title: `非技术背景的人，如何系统理解 ${term} 的真实价值？`,         heat: '热度 217万', answers: '回答 428 个',   tag: '蓝海',     score: 82, window: '回答质量分化' },
    { rank: 21, title: `${term} 应用落地时，最容易被忽略的成本是什么？`,           heat: '热度 156万', answers: '回答 193 个',   tag: '长尾稳定', score: 78, window: '均赞 29' },
    { rank: 30, title: `公司全面推进 ${term}，是一轮效率升级还是新的形式主义？`,   heat: '热度 121万', answers: '回答 604 个',   tag: '争议高',   score: 74, window: '评论增长快' },
  ];
}
