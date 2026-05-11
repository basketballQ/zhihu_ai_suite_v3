import type { RadarItem } from '../types';

export const initialRadarItems: RadarItem[] = [
  { status: '正在爆发', score: 88, title: 'AI 编程工具真的能替代初级程序员吗？大厂现在的实际态度是？',   stat: '👥 4.2万关注', answers: '回答 89个',  praise: '均赞 12', color: '#E84749' },
  { status: '正在爆发', score: 76, title: '产品经理如何在简历里写 AI 能力，才不会被 HR 当成吹牛？',      stat: '👥 2.8万关注', answers: '回答 156个', praise: '均赞 8',  color: '#E84749' },
  { status: '长尾稳定', score: 82, title: '非科班背景的人，有没有可能做到 AI 产品总监？需要补哪些课？', stat: '👥 1.6万关注', answers: '回答 34个',  praise: '均赞 23', color: '#0066ff' },
  { status: '长尾稳定', score: 79, title: 'AI 产品的 PRD 怎么写？和传统产品的核心区别是什么？',          stat: '👥 3.1万关注', answers: '回答 212个', praise: '均赞 6',  color: '#0066ff' },
  { status: '正在爆发', score: 91, title: 'AI Agent 会不会重做企业内部工具？产品经理现在该补哪些能力？', stat: '👥 3.6万关注', answers: '回答 47个',  praise: '均赞 19', color: '#E84749' },
  { status: '正在爆发', score: 84, title: '公司全面接入 AI 后，普通运营和产品岗位会先被替代哪一部分？',  stat: '👥 2.1万关注', answers: '回答 63个',  praise: '均赞 15', color: '#E84749' },
  { status: '长尾稳定', score: 87, title: '没有技术背景的产品经理，怎么系统学习大模型应用设计？',        stat: '👥 1.9万关注', answers: '回答 58个',  praise: '均赞 21', color: '#0066ff' },
  { status: '长尾稳定', score: 74, title: 'AI 产品从 Demo 到可商业化，中间最容易踩的坑是什么？',         stat: '👥 2.4万关注', answers: '回答 121个', praise: '均赞 10', color: '#0066ff' },
  { status: '蓝海机会', score: 93, title: '中小团队要不要现在做垂直 AI 应用？哪些细分场景仍有机会？',    stat: '👥 1.2万关注', answers: '回答 26个',  praise: '均赞 31', color: '#00A86B' },
  { status: '蓝海机会', score: 81, title: 'AI 工作流工具越来越多，个人知识管理还有必要单独做吗？',       stat: '👥 9800关注',  answers: '回答 18个',  praise: '均赞 28', color: '#00A86B' },
  { status: '长尾稳定', score: 69, title: '产品经理使用 AI 写需求文档，会不会降低团队沟通质量？',         stat: '👥 1.5万关注', answers: '回答 143个', praise: '均赞 7',  color: '#0066ff' },
  { status: '正在爆发', score: 78, title: '从 ChatGPT 到多模态 Agent，未来一年 AI 产品会怎么变化？',     stat: '👥 4.8万关注', answers: '回答 198个', praise: '均赞 9',  color: '#E84749' },
];

export function keywordRadarQuestions(keyword: string): RadarItem[] {
  const term = (keyword || 'AI').trim();
  return [
    { status: '正在爆发', score: 91, title: `${term} 在垂直圈子里有哪些低竞争、高关注问题？`,    stat: '👥 3.8万关注', answers: '回答 47个', praise: '均赞 21', color: '#E84749' },
    { status: '蓝海机会', score: 88, title: `围绕 ${term}，小团队还有哪些可深耕的细分场景？`,    stat: '👥 2.4万关注', answers: '回答 32个', praise: '均赞 34', color: '#00A86B' },
    { status: '长尾稳定', score: 82, title: `普通从业者学习 ${term}，最该先补哪三类能力？`,      stat: '👥 1.9万关注', answers: '回答 61个', praise: '均赞 18', color: '#0066ff' },
    { status: '正在爆发', score: 79, title: `${term} 的真实落地案例，哪些行业已经开始受益？`,    stat: '👥 4.1万关注', answers: '回答 118个', praise: '均赞 9', color: '#E84749' },
    { status: '蓝海机会', score: 86, title: `${term} 工具越来越多，个人知识管理还值得单独做吗？`, stat: '👥 9800关注',  answers: '回答 18个', praise: '均赞 28', color: '#00A86B' },
    { status: '长尾稳定', score: 75, title: `没有技术背景，如何判断一个 ${term} 产品是否靠谱？`, stat: '👥 1.5万关注', answers: '回答 73个', praise: '均赞 16', color: '#0066ff' },
  ];
}

export function circleFitScore(circle: string): number {
  let base = 86 + (circle.length % 8);
  if (circle.includes('人工智能') || circle.includes('AI')) base += 3;
  if (circle.includes('产品')) base += 2;
  return Math.min(base, 96);
}

export function getStyleGuideContent(circle: string): { label: string; body: string } {
  if (circle.includes('职场')) {
    return {
      label: `🎨 圈子语言风格指南 · ${circle}`,
      body: '该圈子读者偏好<b>「可执行路径 + 真实转型经验」</b>，需要看到具体步骤、避坑经验和结果对比。开头宜直接点出痛点，正文用清单式结构，结尾引导读者补充自身场景。',
    };
  }
  if (circle.includes('机器人') || circle.includes('AI 编程')) {
    return {
      label: `🎨 圈子语言风格指南 · ${circle}`,
      body: '该圈子读者偏好<b>「技术判断 + 产业落地」</b>，排斥空泛趋势。开头先给判断，再用案例解释边界，数据和一线反馈越具体越容易获得收藏。',
    };
  }
  return {
    label: `🎨 圈子语言风格指南 · ${circle}`,
    body: '该圈子读者偏好<b>「从业者视角 + 真实案例」</b>，排斥纯理论堆砌。开头用「我在 XX 工作了 N 年」建立信任，结构宜用小标题分层，数据引用需注明来源，结尾引导讨论效果最好。',
  };
}

export function getKeywordStyleGuide(keyword: string): { label: string; body: string } {
  return {
    label: `🎨 圈层语言风格指南 · ${keyword} 相关圈子`,
    body: `该关键词下的读者更关心<b>真实场景、落地路径和可验证案例</b>。建议避免泛泛讲趋势，优先用行业问题切入，再补充具体工具、成本和边界。`,
  };
}
