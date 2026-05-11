import { Fragment } from 'react';
import { useApp } from '../context/AppContext';
import type { ToolId } from '../types';

interface ToolCardProps {
  id: ToolId;
  num: string;
  icon: string;
  iconBg: string;
  name: string;
  nameColor: string;
  desc: string;
  tagBg: string;
  tagColor: string;
  tagBorder: string;
  tags: string[];
  ctaColor: string;
  hint: string;
}

function ToolCard({ id, num, icon, iconBg, name, nameColor, desc, tagBg, tagColor, tagBorder, tags, ctaColor, hint }: ToolCardProps) {
  const { switchTool } = useApp();
  return (
    <div className="tool-card" onClick={() => switchTool(id)}>
      <div className="tc-header">
        <div className="tc-icon" style={{ background: iconBg }}>{icon}</div>
        <div className="tc-num">{num}</div>
      </div>
      <div className="tc-name" style={{ color: nameColor }}>{name}</div>
      <div className="tc-desc">{desc}</div>
      <div className="tc-tags">
        {tags.map(t => (
          <span key={t} className="tc-tag" style={{ background: tagBg, color: tagColor, border: `1px solid ${tagBorder}` }}>{t}</span>
        ))}
      </div>
      <div className="tc-launch">
        <div className="tc-cta" style={{ color: ctaColor }}>打开工具 <span className="cta-arrow">→</span></div>
        <span style={{ fontSize: 11, color: '#aaa' }}>{hint}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { switchTool } = useApp();

  const tools: ToolCardProps[] = [
    { id: 'hot',      num: '01', icon: '🔥', iconBg: 'rgba(0,102,255,0.1)',  name: '热榜蹭词器',   nameColor: '#0066ff', desc: '监控知乎热榜与高关注问题，当热点与你的专业领域匹配时，立刻提示切入角度并生成回答开头', tagBg: 'rgba(0,102,255,0.12)',  tagColor: '#0066ff', tagBorder: 'rgba(0,102,255,0.2)',  tags: ['热榜问题', '领域匹配', 'deepseek-v4-pro'], ctaColor: '#0066ff', hint: '实时监控' },
    { id: 'virality', num: '02', icon: '📊', iconBg: 'rgba(0,196,140,0.1)',  name: '传播力预测器', nameColor: '#00a876', desc: '发布前对知乎回答进行六维质量评估，结合问题语境预测赞同、收藏与关注转化潜力，给出优化建议', tagBg: 'rgba(0,196,140,0.12)',  tagColor: '#00a876', tagBorder: 'rgba(0,196,140,0.2)',  tags: ['六维评分', '优化建议', 'deepseek-v4-pro'], ctaColor: '#00a876', hint: '发布前质检' },
    { id: 'comment',  num: '03', icon: '💬', iconBg: 'rgba(124,106,247,0.1)', name: '评论区截流器', nameColor: '#7c6af7', desc: '扫描问题评论区与高赞回答下的追问，挖掘尚未被充分回答的需求，把讨论热度转化为你的专业曝光', tagBg: 'rgba(124,106,247,0.12)', tagColor: '#7c6af7', tagBorder: 'rgba(124,106,247,0.2)', tags: ['追问挖掘', '价值评分', 'deepseek-v4-pro'], ctaColor: '#7c6af7', hint: '流量截取' },
    { id: 'radar',    num: '04', icon: '📡', iconBg: 'rgba(240,165,0,0.1)',   name: '垂直圈层雷达', nameColor: '#c98a00', desc: '深入分析知乎话题圈层、热议问题、回答风格和低竞争机会，系统性建立可信的专业身份',         tagBg: 'rgba(240,165,0,0.12)',   tagColor: '#c98a00', tagBorder: 'rgba(240,165,0,0.2)',   tags: ['话题分析', '低竞争问题', 'deepseek-v4-pro'], ctaColor: '#c98a00', hint: '长期深耕' },
  ];

  const chain = [
    { id: 'radar' as ToolId,    icon: '📡', name: '垂直圈层雷达', color: '#c98a00', action: '定位话题' },
    { id: 'hot' as ToolId,      icon: '🔥', name: '热榜蹭词器',   color: '#0066ff', action: '抓住热榜' },
    { id: 'comment' as ToolId,  icon: '💬', name: '评论区截流器', color: '#7c6af7', action: '延展问题' },
    { id: 'virality' as ToolId, icon: '📊', name: '传播力预测器', color: '#00a876', action: '优化回答' },
  ];

  return (
    <div>
      <div className="home-hero">
        <div className="hero-eyebrow">知乎 × AI · 专业内容增长工具套件</div>
        <div className="hero-title">让好问题找到你</div>
        <div className="hero-desc">四款 AI 工具覆盖从「发现问题」到「高赞回答」的完整创作链路，围绕知乎热榜、话题、评论与专业表达构建</div>
        <div className="hero-flow">
          <div className="flow-step">发现问题</div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">组织回答</div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">承接讨论</div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">沉淀关注</div>
        </div>
      </div>

      <div className="tools-grid">
        {tools.map(t => <ToolCard key={t.id} {...t} />)}
      </div>

      <div className="chain-section">
        <div className="chain-title">四工具协同 · 知乎创作增长链路</div>
        <div className="chain-row">
          {chain.map((node, idx) => (
            <Fragment key={node.id}>
              <div className="chain-node" onClick={() => switchTool(node.id)}>
                <div className="cn-icon">{node.icon}</div>
                <div className="cn-name" style={{ color: node.color }}>{node.name}</div>
                <div className="cn-action">{node.action}</div>
              </div>
              {idx < chain.length - 1 && <div className="chain-arrow">→</div>}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
