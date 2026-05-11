import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { CommentItem } from '../types';
import { initialComments } from '../data/comments';
import { generateComments, analyzeRingComments } from '../lib/ai';
import { hasApiKey } from '../lib/deepseek';
import { hasRingCredentials, type RingComment } from '../lib/zhihuRing';

type SortMode = 'value' | 'likes';
type ScanSource = 'ring' | 'question';  // 圈子帖子 | 普通知乎问题/文章

function sortComments(items: CommentItem[], mode: SortMode): CommentItem[] {
  return [...items].sort((a, b) =>
    mode === 'likes' ? b.likes - a.likes : b.valueScore - a.valueScore
  );
}

/**
 * 从输入字符串中提取圈子帖子 ID（pin_id）
 *
 * 支持格式：
 *   - 纯数字 ID（15 位以上）：1992912496017834773
 *   - 知乎 pin 链接：https://www.zhihu.com/pin/1992912496017834773
 *
 * 返回 null 表示不是圈子帖子，应走普通回答流程。
 */
function extractPinId(input: string): string | null {
  const trimmed = input.trim();
  // 纯数字且长度 ≥ 15（知乎 pin_id 是 int64，通常 19 位）
  if (/^\d{15,}$/.test(trimmed)) return trimmed;
  // 包含 /pin/ 路径
  const pinMatch = trimmed.match(/\/pin\/(\d+)/);
  if (pinMatch) return pinMatch[1];
  return null;
}

export default function Comments() {
  const { commentIntercept, clearCommentIntercept, startOpenerForQuestion,
    setPublishTarget, showToast } = useApp();

  const [url, setUrl] = useState('https://www.zhihu.com/pin/2010562877086523530');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('value');
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [scanStatus, setScanStatus] = useState('');
  const [scanSource, setScanSource] = useState<ScanSource | null>(null);
  useEffect(() => {
    if (commentIntercept) {
      setUrl(commentIntercept);
      clearCommentIntercept();
    }
  }, [commentIntercept, clearCommentIntercept]);

  async function handleScan() {
    setScanning(true);
    setScanned(false);
    setScanSource(null);

    const pinId = extractPinId(url);

    if (pinId) {
      // ── 圈子帖子路径：获取真实评论 → DeepSeek 分析 ──
      await scanRingPin(pinId);
    } else {
      // ── 普通知乎问题/文章路径：AI 模拟（接口预留）──
      await scanQuestion(url);
    }

    setScanning(false);
  }

  /** 圈子帖子评论：批量拉取全量评论（最多 500 条），再送 DeepSeek 分析 */
  async function scanRingPin(pinId: string) {
    setScanSource('ring');

    if (!hasRingCredentials()) {
      showToast('未配置圈子 API 凭证，使用示例数据。');
      setComments(sortComments(initialComments, sortMode));
      setScanned(true);
      setScanStatus('未配置凭证 · 显示示例追问数据');
      return;
    }

    // ── Phase 1：批量拉取真实评论（并发分页，最多 500 条）──
    let ringComments: RingComment[] = [];
    let total = 0;
    try {
      setScanStatus('📡 正在拉取评论…');
      const { fetchAllPinComments } = await import('../lib/zhihuRing');
      ({ comments: ringComments, total } = await fetchAllPinComments(
        pinId,
        500,
        (fetched) => setScanStatus(`📡 正在拉取评论… 已获取 **${fetched}** 条`),
      ));
    } catch (fetchErr) {
      showToast('圈子评论获取失败：' + (fetchErr as Error).message);
      setComments(sortComments(initialComments, sortMode));
      setScanned(true);
      setScanStatus('评论拉取失败，已显示示例数据');
      return;
    }

    if (ringComments.length === 0) {
      showToast('该帖子暂无评论。');
      setScanned(true);
      setScanStatus('该帖子暂无评论');
      return;
    }

    // ── Phase 2：DeepSeek 分析高价值追问（取点赞最高的 100 条）──
    const analyzeCount = Math.min(ringComments.length, 100);
    const cappedHint = total >= 500 ? '（已达 500 条上限）' : '';
    setScanStatus(`🤖 已获取 **${total}** 条评论，DeepSeek 正在分析点赞最高的 **${analyzeCount}** 条…`);
    try {
      const results = await analyzeRingComments('', ringComments);
      setComments(sortComments(results, sortMode));
      setScanned(true);
      setScanStatus(`已拉取 **${total} 条真实评论**${cappedHint} · 分析点赞最高 **${analyzeCount}** 条 · 筛选出 **${results.length} 条高价值追问**`);
      showToast(`圈子评论分析完成：共拉取 ${total} 条，发现 ${results.length} 条高价值追问。`);
    } catch (analyzeErr) {
      // AI 分析失败：降级展示原始高赞评论（前 5 条），提示实际原因
      showToast('AI 分析失败：' + (analyzeErr as Error).message);
      const rawFallback = [...ringComments]
        .sort((a, b) => b.like_count - a.like_count)
        .slice(0, 5)
        .map((c, i) => ({
          id: i + 1,
          avatar: c.author_name.charAt(0).toUpperCase(),
          name: c.author_name,
          likes: c.like_count,
          body: c.content.replace(/<[^>]*>/g, '').trim().slice(0, 120),
          valueScore: Math.min(95, 65 + (c.like_count % 30)),
          valueLabel: `截流价值 ${Math.min(95, 65 + (c.like_count % 30))}分`,
          badgeText: '相关问题回答少' as const,
          badgeClass: 'badge-up',
          hasExistingQuestion: false,
          commentId: c.comment_id,
        }));
      setComments(sortComments(rawFallback, sortMode));
      setScanned(true);
      setScanStatus(`已拉取 **${total} 条真实评论**${cappedHint} · AI 分析失败，显示原始高赞前 5 条`);
    }
  }

  /**
   * 普通知乎问题/文章评论：接口预留
   * 待接入知乎问题 Open API 后，替换为真实评论获取逻辑
   * 当前由 DeepSeek 根据 URL/问题内容模拟生成追问
   */
  async function scanQuestion(urlOrQuestion: string) {
    setScanSource('question');
    setScanStatus(hasApiKey() ? 'AI 分析中，正在提取高价值追问…' : '扫描中...');
    try {
      const results = await generateComments(urlOrQuestion);
      const sorted = sortComments(results, sortMode);
      setComments(sorted);
      setScanned(true);
      setScanStatus(`已扫描 · 筛选出 **${results.length} 条高价值追问**`);
      showToast(`扫描完成：发现 ${results.length} 条高价值追问。`);
    } catch (e) {
      const fallback = sortComments(initialComments, sortMode);
      setComments(fallback);
      setScanned(true);
      setScanStatus('分析失败，已显示示例追问数据');
      showToast('AI 分析失败，已显示示例追问数据。');
    }
  }

  function handleSort(mode: SortMode) {
    setSortMode(mode);
    setComments(sortComments(comments, mode));
    showToast(mode === 'likes' ? '已按点赞数重新排序。' : '已按截流价值重新排序。');
  }

  function handleCreateNewQuestion(body: string) {
    // 先设置发布路径，再进开场白（双预测模式）
    setPublishTarget(scanSource === 'ring' ? { source: 'ring' } : { source: 'answer' });
    startOpenerForQuestion(body, 'dual');
  }

  function handleDirectAnswer(item: CommentItem) {
    // 直接回复该评论（在该评论下回复，不创建新问题）
    if (scanSource === 'ring') {
      setPublishTarget(item.commentId
        ? { source: 'ring_reply', commentId: item.commentId }
        : { source: 'ring' });
    } else {
      setPublishTarget(item.commentId
        ? { source: 'answer_reply', commentId: item.commentId }
        : { source: 'answer' });
    }
    startOpenerForQuestion(item.body, 'answer');
  }

  function renderScanStatus(raw: string) {
    const parts = raw.split('**');
    return parts.map((p, i) => i % 2 === 1 ? <b key={i} style={{ color: '#0066ff' }}>{p}</b> : <span key={i}>{p}</span>);
  }

  // 根据输入内容实时判断模式，用于 placeholder 和 badge 提示
  const pinId = extractPinId(url);
  const inputMode: ScanSource = pinId ? 'ring' : 'question';

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">💬 评论区截流器</span>
          <span style={{ fontSize: 12, color: '#999' }}>
            {hasApiKey() ? 'DeepSeek AI 智能提取高价值追问' : '挖掘热帖评论中的流量机会'}
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="input-area"
                style={{ minHeight: 'unset', height: 38, resize: 'none', width: '100%' }}
                placeholder="知乎问题/文章链接 或 圈子帖子 ID / pin 链接"
                value={url}
                onChange={e => { setUrl(e.target.value); setScanned(false); }}
              />
              {/* 实时模式 badge */}
              <span style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, padding: '2px 6px', borderRadius: 3, pointerEvents: 'none',
                background: inputMode === 'ring' ? '#f0faf5' : '#f0f4ff',
                color: inputMode === 'ring' ? '#00A86B' : '#0066ff',
                border: `1px solid ${inputMode === 'ring' ? '#b7ebd4' : '#c7d8ff'}`,
              }}>
                {inputMode === 'ring' ? '圈子帖子' : '普通问题'}
              </span>
            </div>
            <button
              className={`btn-sm primary${scanning ? ' is-loading' : ''}`}
              style={{ padding: '7px 16px', flexShrink: 0 }}
              onClick={handleScan}
              disabled={scanning}
            >{scanning ? '扫描中...' : scanned ? '重新扫描' : '扫描评论'}</button>
          </div>
          {scanStatus && (
            <div className="comment-scan-status" style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              {renderScanStatus(scanStatus)}
            </div>
          )}
        </div>
      </div>

      {scanned && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="card-title">高价值追问清单</span>
              {scanSource === 'ring' && (
                <span style={{ fontSize: 11, color: '#00A86B', background: '#f0faf5', border: '1px solid #b7ebd4', borderRadius: 4, padding: '2px 7px' }}>
                  真实评论
                </span>
              )}
              {scanSource === 'question' && (
                <span style={{ fontSize: 11, color: '#0066ff', background: '#f0f4ff', border: '1px solid #c7d8ff', borderRadius: 4, padding: '2px 7px' }}>
                  AI 模拟（接口预留）
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`btn-sm${sortMode === 'value' ? ' primary' : ' ghost'}`}
                onClick={() => handleSort('value')}
              >按价值排序</button>
              <button
                className={`btn-sm${sortMode === 'likes' ? ' primary' : ' ghost'}`}
                onClick={() => handleSort('likes')}
              >按点赞排序</button>
            </div>
          </div>
          <div className="card-body">
            {comments.map(item => (
              <div key={item.id} className="comment-item">
                <div className="ci-head">
                  <div className="ci-avatar">{item.avatar}</div>
                  <div className="ci-name">{item.name}</div>
                  <div className="ci-likes">❤️ {item.likes.toLocaleString()}</div>
                </div>
                <div className="ci-body">{item.body}</div>
                <div className="ci-score-row">
                  <span className={`value-score ${item.valueScore >= 80 ? 'vs-high' : 'vs-mid'}`}>
                    {item.valueLabel}
                  </span>
                  <span className={`badge ${item.badgeClass}`} style={{ fontSize: 11 }}>
                    {item.badgeText}
                  </span>
                  <div className="ci-actions">
                    <button
                      className="btn-sm ghost"
                      type="button"
                      onClick={() => handleCreateNewQuestion(item.body)}
                    >创建新问题并回答</button>
                    <button
                      className="btn-sm primary"
                      type="button"
                      onClick={() => handleDirectAnswer(item)}
                    >直接回答</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
