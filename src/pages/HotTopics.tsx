import { type ReactNode, useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { HotTopic } from '../types';
import { openerSuggestionSets } from '../data/openers';
import { generateOpeners } from '../lib/ai';
import { hasApiKey } from '../lib/deepseek';

interface OpenerBoxProps {
  title: string;
  onSendToPrediction: (draft: string, question: string) => void;
  onPublish: (draft: string) => void;
  /** 圈子模式：开场白变为"想法正文"生成器 */
  isRingMode?: boolean;
}

function OpenerBox({ title, onSendToPrediction, onPublish, isRingMode }: OpenerBoxProps) {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const { showToast } = useApp();
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const abortRef = useRef<AbortController | null>(null);

  /** 调用 AI（或降级模板）填充三条开场白 */
  function loadOpeners(forTitle: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setEditing(false);
    setSelectedIdx(null);

    generateOpeners(forTitle)
      .then(openers => {
        if (ctrl.signal.aborted) return;
        openers.forEach((text, i) => {
          if (refs[i].current) refs[i].current!.textContent = text;
        });
        setLoading(false);
      })
      .catch(err => {
        if (ctrl.signal.aborted) return;
        // 降级：用模板填充
        const fallback = openerSuggestionSets[0].map(fn => fn(forTitle));
        fallback.forEach((text, i) => {
          if (refs[i].current) refs[i].current!.textContent = text;
        });
        if ((err as Error).message !== 'NO_API_KEY') {
          showToast('AI 生成失败，已使用模板开场白。');
        }
        setLoading(false);
      });
  }

  useEffect(() => {
    loadOpeners(title);
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  function chooseItem(idx: number) {
    setEditing(true);
    setSelectedIdx(idx);
    setTimeout(() => refs[idx].current?.focus(), 30);
    showToast('已选择这条开场白，可以开始编辑。');
  }

  function resetChoices() {
    setEditing(false);
    setSelectedIdx(null);
    showToast('已返回开场白选择。');
  }

  function refresh() {
    if (editing) { showToast('正在编辑时不能换一批，请先返回重新选。'); return; }
    showToast(hasApiKey() ? '正在重新生成开场白建议…' : '已换一批开场白建议。');
    loadOpeners(title);
  }

  function getSelectedDraft(): string {
    const idx = selectedIdx ?? 0;
    return refs[idx].current?.textContent || '';
  }

  return (
    <div className={`opener-box${editing ? ' is-editing' : ''}${focused ? ' is-focused' : ''}`}>
      <div className="opener-head">
        <div className="ob-label">
          {isRingMode
            ? `✍️ ${hasApiKey() ? 'AI 生成想法正文' : '想法正文建议'}（选一个，作为圈子帖子正文）`
            : `⚡ ${hasApiKey() ? 'AI 实时生成开场白建议' : 'AI 开场白建议'}（选一个开始写）`}
        </div>
        <button className="btn-sm ghost" type="button" onClick={refresh} disabled={editing || loading}>
          {loading ? '生成中…' : '换一批'}
        </button>
      </div>

      {loading && (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 52, borderRadius: 6, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
              backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
            }} />
          ))}
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
      )}

      {[0, 1, 2].map(i => (
        <div
          key={i}
          ref={refs[i]}
          className={`opener-item${loading ? ' is-hidden' : ''}${editing && selectedIdx !== i ? ' is-hidden' : ''}`}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onClick={() => { if (!editing && !loading) chooseItem(i); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ))}

      {editing && (
        <div className="opener-actions" style={{ display: 'flex' }}>
          <button className="btn-sm ghost" type="button" onClick={resetChoices}>返回重新选</button>
          <div className="opener-action-right">
            <button className="btn-sm ghost" type="button" onClick={() => {
              const draft = getSelectedDraft();
              if (!draft) { showToast(isRingMode ? '正文还没有内容。' : '开场白还没有内容。'); return; }
              onSendToPrediction(draft, title);
            }}>{isRingMode ? '确认正文，去写评论' : '预测传播力'}</button>
            <button className="btn-sm primary" type="button" onClick={() => {
              const draft = getSelectedDraft();
              if (!draft) { showToast(isRingMode ? '正文还没有内容。' : '开场白还没有内容。'); return; }
              onPublish(draft);
            }}>{isRingMode ? '仅发布想法' : '发布'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface TopicRowProps {
  topic: HotTopic;
  onAnswer: (topic: HotTopic) => void;
  onSkip: () => void;
  onCommentIntercept: (title: string) => void;
  isSelected: boolean;
}

function TopicRow({ topic, onAnswer, onSkip, onCommentIntercept, isSelected }: TopicRowProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const badgeClass = topic.tag === '新上榜' ? 'badge-hot'
    : topic.tag === '快速上升' ? 'badge-up'
    : topic.tag === '蓝海' ? 'badge-new'
    : topic.tag === '争议高' ? 'badge-hot'
    : 'badge-blue';

  const isTop = topic.rank <= 10;

  return (
    <div className={`topic-row${isSelected ? ' is-selected' : ''}`}>
      <div className={`topic-rank${isTop ? ' top3' : ''}`}>{topic.rank}</div>
      <div className="topic-main">
        <div className="topic-title">{topic.title}</div>
        <div className="topic-meta">
          <span>🔥 {topic.heat}</span>
          <span>· {topic.answers}</span>
          <span className={`badge ${badgeClass}`}>{topic.tag}</span>
          <span style={{ fontSize: 12, color: isTop ? '#E84749' : '#999' }}>{topic.window}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'flex-end' }}>
        <div className="match-label" style={{ width: 80 }}>
          <span>匹配度</span>
          <span style={{ color: '#0066ff' }}>{topic.score}%</span>
        </div>
        <div className="match-bar" style={{ width: 80 }}>
          <div className="match-fill" style={{ width: `${topic.score}%` }} />
        </div>
        <div className="hot-actions">
          <button className="btn-sm ghost" type="button" onClick={() => { setHidden(true); }}>跳过</button>
          <button className="btn-sm ghost" type="button" onClick={() => onCommentIntercept(topic.title)}>评论截流</button>
          <button className="btn-sm primary" type="button" onClick={() => onAnswer(topic)}>立即回答</button>
        </div>
      </div>
    </div>
  );
}

export default function HotTopics() {
  const { hotTopics, hotLoading, hotTokens, hotPhase, hotKeyword, fields, openerTitle, openerOpen, openerMode,
    setOpenerTitle, setOpenerOpen, resetHotTopics, refreshHotTopics,
    setQuestionForPrediction, setViralityState, switchTool, activeCircle,
    openCommentInterceptor, publishTarget, setPublishTarget, showToast, zhihuUser } = useApp();

  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  const fieldLabel = fields.length ? fields.join(' · ') : '未设置领域';

  // 动态计算通知栏消息，加载期间不显示模拟数据
  const activeQuestion = openerTitle || hotTopics[0]?.title || '';
  const top = hotTopics[0];
  const notifMsg: ReactNode = (openerOpen || selectedTitle)
    ? <><b>已选择！</b>「{activeQuestion.slice(0, 22)}{activeQuestion.length > 22 ? '…' : ''}」可以先编辑开场白，再进入回答草稿</>
    : hotLoading
      ? hotPhase === 'fetch'
        ? <>📡 正在获取实时热榜数据…</>
        : <>🤖 DeepSeek 正在分析匹配度，请稍候…</>

      : top
        ? <><b>新匹配！</b>「{top.title.slice(0, 18)}{top.title.length > 18 ? '…' : ''}」热榜第 <b>{top.rank}</b> 位，与你的「{fields[0] ?? '内容创作'}」领域匹配度 <b>{top.score}%</b>，{top.window}</>
        : <>暂无热榜数据，请点击右侧刷新</>;

  const handleAnswer = useCallback((topic: HotTopic) => {
    setSelectedTitle(topic.title);
    setOpenerTitle(topic.title);
    setOpenerOpen(true);
    showToast('已选中该热榜问题，可以编辑开场白。');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setOpenerTitle, setOpenerOpen, showToast]);

  const toggleOpener = useCallback(() => {
    const next = !openerOpen;
    setOpenerOpen(next);
    if (next && !selectedTitle && hotTopics.length > 0) {
      const first = hotTopics[0];
      setSelectedTitle(first.title);
      setOpenerTitle(first.title);
    }
  }, [openerOpen, setOpenerOpen, selectedTitle, hotTopics, setOpenerTitle]);

  const handleSendToPrediction = useCallback((draft: string, question: string) => {
    if (openerMode === 'dual' && publishTarget?.source === 'ring') {
      // 圈子+双预测：draft = 想法正文，存入 publishTarget；Virality 草稿留空由用户写评论
      setPublishTarget({ source: 'ring', pinContent: draft });
      setViralityState('dual', question, '');
      switchTool('virality');
      showToast('正文已确认，请在下方编写该想法的评论内容。');
    } else if (openerMode === 'dual') {
      // 普通双预测：开场白作为回答草稿起点
      setViralityState('dual', question, draft + '\n\n');
      switchTool('virality');
      showToast('已送入传播力预测器（双预测模式）。');
    } else {
      setQuestionForPrediction(question, draft + '\n\n');
      showToast('已送入传播力预测器。');
    }
  }, [openerMode, publishTarget, setPublishTarget, setViralityState, setQuestionForPrediction, switchTool, showToast]);

  const handlePublish = useCallback(async (draft: string) => {
    // 需要调用 Ring API 的路径，必须先登录
    const needsLogin = publishTarget?.source === 'radar'
      || publishTarget?.source === 'ring_reply'
      || publishTarget?.source === 'ring';
    if (needsLogin && !zhihuUser) {
      showToast('请先在左侧边栏登录知乎账号，再发布内容。');
      return;
    }

    if (publishTarget?.source === 'radar') {
      // ── 垂直圈层雷达：在已发布 pin 下追加评论（Ring createComment API）──
      try {
        const { createComment } = await import('../lib/zhihuRing');
        await createComment('pin', publishTarget.pinToken, draft);
        showToast('发布成功：已作为评论提交到知乎圈子。');
        setPublishTarget(null);
      } catch (err) {
        showToast('发布圈子评论失败：' + (err as Error).message);
      }
    } else if (publishTarget?.source === 'ring_reply') {
      // ── 评论截流（圈子）：直接回复该评论（Ring createComment 'comment' 类型）──
      try {
        const { createComment } = await import('../lib/zhihuRing');
        await createComment('comment', publishTarget.commentId, draft);
        showToast('发布成功：已在该评论下回复。');
        setPublishTarget(null);
      } catch (err) {
        showToast('回复评论失败：' + (err as Error).message);
      }
    } else if (publishTarget?.source === 'answer_reply') {
      // ── 评论截流（普通问题）：知乎回答评论 API 暂未开放 ──
      showToast('⚠️ 知乎回答评论接口暂未开放，请复制内容后自行到知乎手动回复。');
    } else if (publishTarget?.source === 'ring') {
      // ── 评论区截流（圈子来源）「仅发布想法」：draft = 选中的正文，直接发 pin，无评论 ──
      try {
        const { RING_ID_MAP } = await import('../context/AppContext');
        const ringId = RING_ID_MAP[activeCircle];
        if (!ringId) {
          showToast(`「${activeCircle}」暂未开放 API，无法发布到圈子。`);
          return;
        }
        const { publishPin } = await import('../lib/zhihuRing');
        showToast('正在发布圈子想法…');
        await publishPin(ringId, openerTitle, draft);
        showToast('发布成功：想法已发布到知乎圈子。');
        setPublishTarget(null);
      } catch (err) {
        showToast('发布失败：' + (err as Error).message);
      }
    } else if (openerMode === 'dual') {
      // ── 双预测模式（普通知乎）：创建问题 + 发回答 API 暂未开放 ──
      showToast('⚠️ 知乎创建问题 / 发布回答接口暂未开放，请复制内容后自行到知乎手动发布。');
    } else {
      // ── 热榜 / 普通截流路径（直接回答）：知乎回答 API 暂未开放 ──
      showToast('⚠️ 知乎回答发布接口暂未开放，请复制内容后自行到知乎手动发布。');
    }
  }, [publishTarget, setPublishTarget, activeCircle, openerTitle, showToast]);

  return (
    <div>
      <div className="notif-bar">
        <div className="notif-dot" />
        <span>{notifMsg}</span>
        <button
          className="btn-sm primary"
          style={{ flexShrink: 0, marginLeft: 'auto' }}
          onClick={toggleOpener}
          disabled={hotLoading && !openerOpen}
        >{openerOpen ? '收起开场白' : '查看开场白'}</button>
      </div>

      {openerOpen && (
        <OpenerBox
          title={openerTitle}
          onSendToPrediction={handleSendToPrediction}
          onPublish={handlePublish}
          isRingMode={publishTarget?.source === 'ring'}
        />
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="card-title">🔥 实时热榜监控</span>
            <span className="badge badge-blue">
              {hotKeyword ? `关键词：${hotKeyword}` : `领域：${fieldLabel}`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#999' }}>
              {hotLoading ? '正在获取实时热榜…' : `共 ${hotTopics.length} 条 · 刚刚更新`}
            </span>
            {!hotLoading && !hotKeyword && (
              <button className="btn-sm ghost" type="button" onClick={() => { refreshHotTopics(); showToast('正在刷新热榜…'); }}>
                刷新
              </button>
            )}
            {hotKeyword && (
              <button className="btn-sm ghost keyword-reset-btn" type="button" onClick={resetHotTopics}>
                返回初始状态
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {hotLoading ? (
            <>
              <div className="card" style={{ padding: 24, textAlign: 'center', color: '#999', margin: '0 0 20px', border: '1px solid #f0f0f0', background: '#fafafa' }}>
                {hotPhase === 'fetch' ? (
                  <>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>📡 正在获取知乎实时热榜数据…</div>
                    <div style={{ fontSize: 12 }}>连接知乎热榜接口，请稍候</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>🤖 DeepSeek 正在分析热榜匹配度…</div>
                    {hotTokens > 0
                      ? <div style={{ fontSize: 12, color: '#0066ff' }}>已分析 {hotTokens} 字符，即将完成</div>
                      : <div style={{ fontSize: 12 }}>结合你的领域评估匹配度与流量窗口，通常需要 10–20 秒</div>
                    }
                  </>
                )}
              </div>
              <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
              {[0,1,2,3,4,5].map(i => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                    background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ height: 18, borderRadius: 4, width: `${70 + (i * 7) % 25}%`,
                      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                      backgroundSize: '200% 100%', animation: `shimmer 1.4s ${i * 0.1}s infinite` }} />
                    <div style={{ height: 13, borderRadius: 4, width: '45%',
                      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                      backgroundSize: '200% 100%', animation: `shimmer 1.4s ${i * 0.1 + 0.2}s infinite` }} />
                  </div>
                  <div style={{ width: 80, height: 40, borderRadius: 4, flexShrink: 0,
                    background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                </div>
              ))}
            </>
          ) : (
            hotTopics.map(topic => (
              <TopicRow
                key={topic.rank + topic.title}
                topic={topic}
                isSelected={selectedTitle === topic.title}
                onAnswer={handleAnswer}
                onSkip={() => {}}
                onCommentIntercept={openCommentInterceptor}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
