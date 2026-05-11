import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { RadarItem } from '../types';
import { circleFitScore, getStyleGuideContent, getKeywordStyleGuide } from '../data/radar';

type FilterMode = '全部' | '正在爆发' | '长尾稳定' | '蓝海 >70';

interface RadarCardProps {
  item: RadarItem;
  loading?: boolean;
  /** 已发布时传入 pinToken，按钮切换为「已发布」+「评论」，防重复发布 */
  pinToken?: string;
  onAction: (title: string, action: 'pin' | 'pin_and_comment') => void;
  onComment: (title: string, pinToken: string) => void;
}

function RadarCard({ item, loading, pinToken, onAction, onComment }: RadarCardProps) {
  const badgeClass = item.status === '蓝海机会' ? 'badge-green'
    : item.status === '长尾稳定' ? 'badge-blue'
    : 'badge-hot';

  const published = !!pinToken;

  return (
    <div className="topic-card-r" style={{ borderTop: `3px solid ${item.color}` }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <span className={`badge ${badgeClass}`}>{item.status}</span>
        <div className="ocean-score">
          <span className="os-val">{item.score}</span>
          <span style={{ fontSize: 10, color: '#00A86B' }}>{item.score >= 70 ? '蓝海' : '观察'}</span>
        </div>
      </div>
      <div className="tc-title-r">{item.title}</div>
      <div className="tc-meta-r">
        <span className="tc-stat">{item.stat}</span>
        <span className="tc-dot" />
        <span className="tc-stat">{item.answers}</span>
        <span className="tc-dot" />
        <span className="tc-stat">{item.praise}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          className="btn-sm ghost"
          style={{ flex: 1 }}
          type="button"
          disabled={loading || published}
          onClick={() => onAction(item.title, 'pin')}
        >{loading ? '生成中…' : published ? '已发布' : '发布想法'}</button>
        <button
          className="btn-sm primary"
          style={{ flex: 1 }}
          type="button"
          disabled={loading}
          onClick={() => published
            ? onComment(item.title, pinToken)
            : onAction(item.title, 'pin_and_comment')
          }
        >{loading ? '生成中…' : published ? '评论' : '发布并评论'}</button>
      </div>
    </div>
  );
}

const RING_SUPPORTED = new Set(['OpenClaw 人类观察员']);

export default function Radar() {
  const { radarItems, radarLoading, radarTokens, radarPhase, radarKeyword, resetRadarItems, circleStyleGuide, circles, activeCircle,
    setActiveCircle, startOpenerForQuestion, setPublishTarget, refreshCircleData, showToast, zhihuUser } = useApp();

  const [filter, setFilter] = useState<FilterMode>('全部');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // title → pinToken，记录已发布的想法，防止重复发布
  const [publishedPins, setPublishedPins] = useState<Map<string, string>>(new Map());

  function matchesFilter(item: RadarItem): boolean {
    if (filter === '全部') return true;
    if (filter === '蓝海 >70') return item.score > 70;
    return item.title.includes(filter) || item.status === filter || item.status.includes(filter.replace(' >70', ''));
  }

  const filtered = radarItems.filter(matchesFilter);

  function handleFilter(mode: FilterMode) {
    setFilter(mode);
    const count = radarItems.filter(item => {
      if (mode === '全部') return true;
      if (mode === '蓝海 >70') return item.score > 70;
      return item.status === mode;
    }).length;
    showToast(`已筛选出 ${count} 个圈层机会。`);
  }

  const handleRadarAction = async (title: string, action: 'pin' | 'pin_and_comment') => {
    // 未登录则拦截
    if (!zhihuUser) {
      showToast('请先在左侧边栏登录知乎账号，再发布想法。');
      return;
    }
    // 防止已发布的卡片再次触发发布（双重保险，按钮层已 disabled）
    if (publishedPins.has(title)) {
      showToast('该想法已发布，请勿重复发布。');
      return;
    }

    const { RING_ID_MAP } = await import('../context/AppContext');
    const ringId = RING_ID_MAP[activeCircle];
    if (!ringId) {
      showToast('该圈子暂未开放 API 发布功能。');
      return;
    }

    setActionLoading(title);
    try {
      const { generatePinContent } = await import('../lib/ai');
      const { publishPin } = await import('../lib/zhihuRing');

      // AI 生成想法正文
      const content = await generatePinContent(title);

      // 发布想法
      const pinToken = await publishPin(ringId, title, content);

      // 记录已发布，按钮切换为「已发布」+「评论」
      setPublishedPins(prev => new Map(prev).set(title, pinToken));

      if (action === 'pin_and_comment') {
        // 垂直圈层：跳转到开场白，发布时作为圈子帖子的评论
        setPublishTarget({ source: 'radar', pinToken });
        showToast('想法发布成功，即将前往编写评论…');
        startOpenerForQuestion(title);
      } else {
        showToast('想法发布成功！');
      }
    } catch (err) {
      showToast('发布失败：' + (err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  // 已发布后点「评论」直接跳转，不重新发布（垂直圈层：圈子帖子评论）
  const handleComment = (title: string, pinToken: string) => {
    if (!zhihuUser) {
      showToast('请先在左侧边栏登录知乎账号，再发布评论。');
      return;
    }
    setPublishTarget({ source: 'radar', pinToken });
    startOpenerForQuestion(title);
    showToast('前往编写评论…');
  };

  function handleCircleSwitch(circle: string) {
    setActiveCircle(circle);
    showToast(`已切换圈子：${circle}`);
  }

  // Bug Fix #4: 兜底时明确用 activeCircle（当前激活圈子）生成静态风格指南
  // 避免 circleStyleGuide 为 null 时误用 circles[0] 导致指南与圈子不匹配
  const currentCircle = activeCircle || circles[0] || 'OpenClaw 人类观察员';
  // 在整个加载周期（Phase 1 风格 + Phase 2 问题）内，只要 circleStyleGuide 尚未生成就保持"分析中"。
  // 不再局限于 radarPhase==='style'：即使进入 Phase 2，若风格指南仍未出结果也不应回退到静态数据。
  const styleGuideLoading = !radarKeyword && radarLoading && RING_SUPPORTED.has(activeCircle) && !circleStyleGuide;
  const styleGuide = radarKeyword
    ? getKeywordStyleGuide(radarKeyword)
    : (circleStyleGuide ?? getStyleGuideContent(currentCircle));

  const fitScore = circleFitScore(activeCircle || circles[0] || '');

  const FILTERS: FilterMode[] = ['全部', '正在爆发', '长尾稳定', '蓝海 >70'];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">📡 垂直圈层雷达</span>
          <div className="circle-switcher">
            <span className="circle-switch-label">我的圈子：</span>
            {circles.map(c => (
              <button
                key={c}
                className={`circle-chip${activeCircle === c ? ' is-active' : ''}`}
                type="button"
                data-circle={c}
                onClick={() => handleCircleSwitch(c)}
              >{c}</button>
            ))}
            {RING_SUPPORTED.has(activeCircle) && !radarLoading && (
              <span style={{ fontSize: 11, color: '#00A86B', background: '#f0faf5', border: '1px solid #b7ebd4', borderRadius: 4, padding: '2px 7px', marginLeft: 4 }}>
                实时数据
              </span>
            )}
            <span className="circle-fit">契合度 {fitScore}%</span>
            {RING_SUPPORTED.has(activeCircle) && !radarKeyword && (
              <button
                className="btn-sm ghost"
                type="button"
                disabled={radarLoading}
                onClick={() => refreshCircleData()}
                style={{ marginLeft: 4, padding: '2px 10px', fontSize: 12 }}
              >{radarLoading ? '加载中…' : '刷新'}</button>
            )}
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: '#999', flexShrink: 0, lineHeight: '26px' }}>筛选：</span>
            {FILTERS.map(f => (
              <button
                key={f}
                className={`btn-sm${filter === f ? ' primary' : ' ghost'}`}
                type="button"
                onClick={() => handleFilter(f)}
              >{f}</button>
            ))}
          </div>

          {radarLoading ? (
            <>
              <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
              <div className="card" style={{ padding: 24, textAlign: 'center', color: '#999', margin: '20px 0' }}>
                {radarPhase === 'style' ? (
                  <>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>📖 正在读取圈子风格词汇和语调…</div>
                    {radarTokens > 0
                      ? <div style={{ fontSize: 12, color: '#0066ff' }}>已分析 {radarTokens} 字符</div>
                      : <div style={{ fontSize: 12 }}>读取圈子最新内容中，请稍候…</div>
                    }
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>🤖 DeepSeek 正在分析圈子问题机会…</div>
                    {radarTokens > 0
                      ? <div style={{ fontSize: 12, color: '#0066ff' }}>累计已分析 {radarTokens} 字符，即将完成</div>
                      : <div style={{ fontSize: 12 }}>首次加载圈子内容和风格可能需要 15–30 秒，请稍候</div>
                    }
                  </>
                )}
              </div>
              <div className="radar-grid">
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} style={{ borderRadius: 8, border: '1px solid #f0f0f0', padding: 16 }}>
                    {[0.6,0.9,0.75,0.5].map((w, j) => (
                      <div key={j} style={{
                        height: j === 0 ? 20 : 14, borderRadius: 4, marginBottom: 10,
                        width: `${w * 100}%`,
                        background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                        backgroundSize: '200% 100%',
                        animation: `shimmer 1.4s ${i * 0.1}s infinite`,
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="radar-grid">
                {filtered.map((item, idx) => (
                  <RadarCard
                    key={idx}
                    item={item}
                    loading={actionLoading === item.title}
                    pinToken={publishedPins.get(item.title)}
                    onAction={handleRadarAction}
                    onComment={handleComment}
                  />
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="empty-state">当前筛选条件下暂无问题</div>
              )}
            </>
          )}

          <div className="style-guide" style={{ marginTop: 10 }}>
            {styleGuideLoading ? (
              <>
                <div className="sg-label">🎨 圈子语言风格指南 · {activeCircle}（DeepSeek 分析中…）</div>
                <div className="sg-body" style={{ color: '#aaa', fontStyle: 'italic' }}>
                  {radarPhase === 'style' ? (
                    <>
                      正在读取圈子近期帖子，分析语言风格、内容偏好与写作套路，请稍候…
                      {radarTokens > 0 && (
                        <span style={{ marginLeft: 8, color: '#0066ff', fontStyle: 'normal', fontSize: 12 }}>
                          已分析 {radarTokens} 字符
                        </span>
                      )}
                    </>
                  ) : (
                    '语言风格分析未能完成，圈子问题加载中，请稍候…'
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="sg-label">{styleGuide.label}</div>
                <div className="sg-body" dangerouslySetInnerHTML={{ __html: styleGuide.body }} />
              </>
            )}
          </div>
        </div>
      </div>

      {radarKeyword && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4, marginBottom: 8 }}>
          <button className="btn-sm ghost keyword-reset-btn" type="button" onClick={resetRadarItems}>
            返回初始状态
          </button>
        </div>
      )}
    </div>
  );
}
