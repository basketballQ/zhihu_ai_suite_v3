import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { predictVirality, type PredictionResult, type PredictionDim } from '../lib/ai';
import { hasApiKey } from '../lib/deepseek';
import type { HotTopic } from '../types';

// ─── 工具函数 ───────────────────────────────
function dimColor(value: number): string {
  if (value >= 80) return '#00A86B';
  if (value >= 60) return '#0066ff';
  if (value >= 40) return '#E08A00';
  return '#E84749';
}

const INSIGHT_ICON = { good: '✅', warn: '⚠️', bad: '❌' } as const;

// ─── 子组件 ─────────────────────────────────
function DimCard({ label, value }: PredictionDim) {
  return (
    <div className="dim-card">
      <div className="dim-label">{label}</div>
      <div className="dim-row-inner">
        <div className="dim-bar-wrap">
          <div className="dim-bar">
            <div className="dim-fill" style={{ width: `${value}%`, background: dimColor(value) }} />
          </div>
        </div>
        <div className="dim-val">{value}</div>
      </div>
    </div>
  );
}

// ─── 主组件 ─────────────────────────────────
export default function Virality() {
  const { viralityMode, viralityQuestion, viralityDraft, hotTopics,
    setQuestionForPrediction, publishTarget, setPublishTarget, activeCircle, showToast, zhihuUser } = useApp();

  const [question, setQuestion] = useState(viralityQuestion);
  const [draft, setDraft] = useState(viralityDraft);
  const [showResult, setShowResult] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [mode, setMode] = useState(viralityMode);
  const [predicting, setPredicting] = useState(false);
  const [predictTokens, setPredictTokens] = useState(0);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  // 记录从热榜导入的具体话题（null = 手动输入，不显示热榜元数据）
  const [selectedHotTopic, setSelectedHotTopic] = useState<HotTopic | null>(null);

  useEffect(() => {
    setQuestion(viralityQuestion);
    setDraft(viralityDraft);
    setMode(viralityMode);
    setShowResult(false);
    setPrediction(null);
    // 尝试在热榜中匹配（例如从开场白「预测传播力」跳转过来的场景）
    const matched = hotTopics.find(t => t.title === viralityQuestion) ?? null;
    setSelectedHotTopic(matched);
  }, [viralityQuestion, viralityDraft, viralityMode, hotTopics]);

  const charCount = draft.replace(/\s/g, '').length;

  async function handlePredict() {
    if (!question.trim()) { showToast('请先填写问题标题。'); return; }
    setPredicting(true);
    setPredictTokens(0);
    setShowResult(false);
    setShowBenchmark(false);
    try {
      const result = await predictVirality(question, draft, mode, setPredictTokens);
      setPrediction(result);
      setShowResult(true);
      const score = mode === 'dual'
        ? `新问题 ${result.newQuestionScore ?? '--'} / 回答 ${result.answerScore ?? '--'}`
        : `传播力 ${result.overallScore} / 100`;
      showToast(`预测完成：${score}`);
      setTimeout(() => document.getElementById('pred-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (e) {
      showToast('预测失败：' + (e as Error).message);
    } finally {
      setPredicting(false);
    }
  }

  async function handlePublish() {
    if (!showResult) { showToast('请先完成预测分析，再发布。'); return; }

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
      // ── 评论区截流（圈子来源，双预测）：先发想法，再在该想法下评论（两步走）──
      try {
        const { RING_ID_MAP } = await import('../context/AppContext');
        const ringId = RING_ID_MAP[activeCircle];
        if (!ringId) {
          showToast(`「${activeCircle}」暂未开放 API，无法发布到圈子。`);
          return;
        }
        // 优先用已生成的正文，否则临时生成
        let pinContent = publishTarget.pinContent;
        if (!pinContent) {
          showToast('正在生成想法正文…');
          const { generatePinContent } = await import('../lib/ai');
          pinContent = await generatePinContent(question);
        }
        const { publishPin, createComment } = await import('../lib/zhihuRing');
        showToast('正在发布圈子想法…');
        const pinToken = await publishPin(ringId, question, pinContent);
        showToast('想法发布成功，正在发布评论…');
        await createComment('pin', pinToken, draft);
        showToast('发布成功：想法已发布，回答草稿已作为评论提交。');
        setPublishTarget(null);
      } catch (err) {
        showToast('发布失败：' + (err as Error).message);
      }
    } else if (mode === 'dual') {
      // ── 双预测模式（普通知乎）：创建问题 + 发回答 API 暂未开放 ──
      showToast('⚠️ 知乎创建问题 / 发布回答接口暂未开放，请复制内容后自行到知乎手动发布。');
    } else {
      // ── 热榜 / 普通截流路径（直接回答）：知乎回答 API 暂未开放 ──
      showToast('⚠️ 知乎回答发布接口暂未开放，请复制内容后自行到知乎手动发布。');
    }
  }

  function handleCopyAdvice() {
    const advice = prediction?.advice ?? '优化建议：补充数据支撑，结尾增加互动引导句。';
    navigator.clipboard?.writeText(advice).catch(() => {}).then(() => showToast('优化建议已复制到剪贴板。'));
  }

  // 当前发布路径是否有真实 API 支撑（圈子三条路径均已接入 Ring API）
  const isRealApi =
    publishTarget?.source === 'radar' ||
    publishTarget?.source === 'ring_reply' ||
    publishTarget?.source === 'ring';

  // 统计行数值
  const overallLabel = mode === 'dual'
    ? `双预测 ${prediction ? Math.round(((prediction.newQuestionScore ?? 0) + (prediction.answerScore ?? 0)) / 2) : '--'} / 100`
    : `传播力 ${prediction?.overallScore ?? '--'} / 100`;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">📊 传播力预测器</span>
          <span style={{ fontSize: 12, color: '#999' }}>
            {hasApiKey() ? 'DeepSeek AI 实时分析' : '发布前的最后一道质检'}
          </span>
        </div>
        <div className="card-body">
          {mode === 'dual' && publishTarget?.source === 'ring' && (
            <div className="virality-mode-note">
              圈子双预测模式：正文已生成，在下方编写该想法的评论内容，发布后将以「想法 + 评论」形式呈现。
            </div>
          )}
          {mode === 'dual' && publishTarget?.source !== 'ring' && (
            <div className="virality-mode-note">
              双预测模式：先评估这个评论追问是否适合创建成新问题，再评估回答草稿的传播力。
            </div>
          )}
          {mode === 'answer' && showResult && (
            <div className="virality-mode-note">
              回答预测模式：评估回答草稿和现有问题的契合度、传播力与发布风险。
            </div>
          )}

          <div className="field-label-p">① 你在回答哪个问题？</div>
          <div className="field-hint-p">填写问题有助于 AI 评估「回答与问题的契合度」和「读者预期匹配度」</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              name="virality-question"
              className="input-area"
              style={{ minHeight: 'unset', height: 38, resize: 'none', flex: 1 }}
              placeholder="粘贴知乎问题链接，或直接输入问题标题..."
              value={question}
              onChange={e => { setQuestion(e.target.value); setShowResult(false); setPrediction(null); setSelectedHotTopic(null); }}
            />
            <button
              className="btn-sm ghost"
              style={{ padding: '8px 12px', flexShrink: 0, whiteSpace: 'nowrap' }}
              onClick={() => setShowImporter(v => !v)}
            >从热榜导入</button>
          </div>

          {showImporter && (
            <div className="hot-import-picker">
              <div className="hot-import-picker-head">
                <span>选择一个热榜问题导入预测器</span>
                <button className="hot-import-close" type="button" onClick={() => setShowImporter(false)}>×</button>
              </div>
              <div className="hot-import-picker-list">
                {hotTopics.map(t => (
                  <button
                    key={t.rank}
                    className="hot-import-option"
                    type="button"
                    onClick={() => {
                      setQuestion(t.title);
                      setSelectedHotTopic(t);
                      setMode('answer');
                      setShowResult(false);
                      setPrediction(null);
                      setShowImporter(false);
                      showToast(`已导入热榜问题：${t.title.slice(0, 20)}…`);
                    }}
                  >
                    <div className="hot-import-title">{t.title}</div>
                    <div className="hot-import-meta">
                      <span>{t.heat}</span>
                      <span>{t.answers}</span>
                      <span>匹配度 {t.score}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedHotTopic && (
            <div className="virality-question-meta" style={{ display: 'flex', gap: 14, marginTop: 8, background: '#F9F9F9', borderRadius: 4, padding: '8px 12px', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#999' }}>🔥 {selectedHotTopic.heat}</span>
              <span style={{ fontSize: 12, color: '#999' }}>· {selectedHotTopic.answers}</span>
              <span className="badge badge-hot" style={{ marginLeft: 'auto' }}>热榜 #{selectedHotTopic.rank}</span>
              {selectedHotTopic.window && (
                <span style={{ fontSize: 12, color: '#E84749' }}>流量窗口 {selectedHotTopic.window}</span>
              )}
            </div>
          )}

          {publishTarget?.source === 'ring' && publishTarget.pinContent && (
            <>
              <div className="divider-p" />
              <div className="field-label-p">② 想法正文（已生成）</div>
              <div className="field-hint-p">将作为圈子帖子的正文发布，可返回开场白面板重新选择</div>
              <div style={{ background: '#f9fafb', border: '1px solid #e8e8e8', borderRadius: 6, padding: '10px 14px', fontSize: 14, color: '#333', lineHeight: 1.7, marginBottom: 2 }}>
                {publishTarget.pinContent}
              </div>
            </>
          )}

          <div className="divider-p" />
          <div className="field-label-p">
            {publishTarget?.source === 'ring' ? '③ 评论内容（将发布在该想法下方）' : '② 你的回答内容'}
          </div>
          <div className="field-hint-p">粘贴完整草稿，AI 将结合问题语境综合评估传播潜力</div>
          <textarea
            className="input-area"
            style={{ minHeight: 120 }}
            value={draft}
            onChange={e => { setDraft(e.target.value); setShowResult(false); setPrediction(null); }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#999' }}>
              已输入约 <b style={{ color: '#444' }}>{charCount}</b> 字 · 建议 800–2000 字
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer' }}>
              <input type="checkbox" name="virality-benchmark" defaultChecked /> 对标该问题 Top 10 高赞回答
            </label>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-sm primary"
              style={{ padding: '8px 24px', fontSize: 13 }}
              onClick={handlePredict}
              disabled={predicting}
            >{predicting ? '分析中…' : '开始预测'}</button>
          </div>
        </div>
      </div>

      {/* 预测中状态 */}
      {predicting && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>🤖 DeepSeek 推理模型分析中…</div>
          {predictTokens > 0
            ? <div style={{ fontSize: 12, color: '#0066ff' }}>已生成 {predictTokens} 字符，即将完成</div>
            : <div style={{ fontSize: 12 }}>推理模型思考中，通常需要 15–40 秒，请稍候</div>
          }
        </div>
      )}

      {showResult && prediction && (
        <div className="card" id="pred-result">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="card-title">预测结果</span>
              <span className="badge badge-new" style={{ fontSize: 13, padding: '3px 12px' }}>
                {overallLabel}
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#999' }}>
              {mode === 'dual' ? '基于新问题价值 + 回答承接质量综合评估' : '基于问题语境 + 回答内容综合评估'}
            </span>
          </div>
          <div className="card-body">
            <div className="q-box">
              <div className="q-box-label">{mode === 'dual' ? '正在分析的新问题草稿' : '正在分析的问题'}</div>
              <div className="q-box-text">{question}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                {mode === 'dual' ? (
                  <>
                    <span style={{ fontSize: 12, color: '#999' }}>💬 来源：评论追问</span>
                    <span style={{ fontSize: 12, color: '#999' }}>· 机会类型：新问题承接</span>
                  </>
                ) : (
                  <>
                    {selectedHotTopic && (
                      <span style={{ fontSize: 12, color: '#999' }}>🔥 热榜 #{selectedHotTopic.rank}</span>
                    )}
                    <span style={{ fontSize: 12, color: '#999' }}>{selectedHotTopic ? '· ' : ''}读者期待：深度分析型 / 有真实案例</span>
                  </>
                )}
              </div>
            </div>

            {mode === 'dual' && prediction.newQuestionScore !== undefined && (
              <div className="dual-prediction-box">
                <div className="dual-prediction-title">新问题 + 回答双预测</div>
                <div className="dual-prediction-grid">
                  <div className="dual-prediction-card">
                    <div className="dual-prediction-score">{prediction.newQuestionScore}</div>
                    <div className="dual-prediction-label">新问题潜力</div>
                    <div className="dual-prediction-text">{prediction.newQuestionText}</div>
                  </div>
                  <div className="dual-prediction-card">
                    <div className="dual-prediction-score" style={{ color: '#00A86B' }}>{prediction.answerScore}</div>
                    <div className="dual-prediction-label">回答承接传播力</div>
                    <div className="dual-prediction-text">{prediction.answerText}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="top-stat-row">
              {mode === 'dual' ? (
                <>
                  <div className="stat-cell"><div className="stat-num">{prediction.newQuestionScore ?? '--'}</div><div className="stat-lbl">问题机会</div></div>
                  <div className="stat-cell"><div className="stat-num" style={{ color: '#00A86B' }}>{prediction.answerScore ?? '--'}</div><div className="stat-lbl">回答传播力</div></div>
                  <div className="stat-cell"><div className="stat-num" style={{ color: '#E08A00' }}>中</div><div className="stat-lbl">重复风险</div></div>
                </>
              ) : (
                <>
                  <div className="stat-cell"><div className="stat-num">{prediction.overallScore}</div><div className="stat-lbl">综合传播力</div></div>
                  <div className="stat-cell">
                    <div className="stat-num" style={{ color: prediction.promoLevel === '高' ? '#00A86B' : prediction.promoLevel === '中' ? '#E08A00' : '#E84749' }}>
                      {prediction.promoLevel}
                    </div>
                    <div className="stat-lbl">推荐概率</div>
                  </div>
                  <div className="stat-cell">
                    <div className="stat-num" style={{ color: prediction.hotPotential === '高' ? '#00A86B' : prediction.hotPotential === '中' ? '#E08A00' : '#E84749' }}>
                      {prediction.hotPotential}
                    </div>
                    <div className="stat-lbl">热榜潜力</div>
                  </div>
                </>
              )}
            </div>

            <div className="score-dims">
              {prediction.dims.map(dim => (
                <DimCard key={dim.label} label={dim.label} value={dim.value} />
              ))}
            </div>

            <div style={{ marginTop: 12, background: '#F6FBFF', border: '1px solid #D0E8FF', borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#0066ff', marginBottom: 8 }}>💡 基于「该问题读者」的专项洞察</div>
              {prediction.insights.map((ins, i) => (
                <div key={i} className="insight-row">
                  <div className="insight-icon">{INSIGHT_ICON[ins.type]}</div>
                  <div className="insight-text">{ins.text}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-sm ghost" onClick={() => setShowBenchmark(v => !v)}>
                {showBenchmark ? '收起对标回答' : '查看对标高赞回答'}
              </button>
              <button className="btn-sm primary" onClick={handleCopyAdvice}>复制优化建议</button>
            </div>

            {showBenchmark && (
              <div className="benchmark-box">
                <div style={{ fontSize: 12, color: '#0066ff', marginBottom: 4 }}>对标高赞回答摘录</div>
                <div className="benchmark-item"><b>1.</b><span>高赞回答通常先亮明从业身份，再用一个反常识结论拉住读者。</span></div>
                <div className="benchmark-item"><b>2.</b><span>中段会放 1-2 个可验证案例，避免只停留在趋势判断。</span></div>
                <div className="benchmark-item"><b>3.</b><span>结尾多用开放问题引导评论，让讨论继续扩散。</span></div>
              </div>
            )}

            {prediction.advice && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#FFFBF0', border: '1px solid #FFE58F', borderRadius: 4, fontSize: 12, color: '#7A6000' }}>
                💡 核心建议：{prediction.advice}
              </div>
            )}

            <div className="prediction-final-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div className="prediction-final-copy">预测分析完成后再发布，避免把低分草稿直接推出去</div>
                {publishTarget?.source === 'radar' && (
                  <span style={{ fontSize: 11, color: '#00A86B', background: '#f0faf5', border: '1px solid #b7ebd4', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    圈子评论
                  </span>
                )}
                {(publishTarget?.source === 'ring' || publishTarget?.source === 'ring_reply') && (
                  <span style={{ fontSize: 11, color: '#00A86B', background: '#f0faf5', border: '1px solid #b7ebd4', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    {publishTarget.source === 'ring_reply' ? '回复该圈子评论' : '圈子新想法'}
                  </span>
                )}
                {(publishTarget?.source === 'answer_reply') && (
                  <span style={{ fontSize: 11, color: '#999', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    回复该评论（接口预留）
                  </span>
                )}
                {(!publishTarget || publishTarget.source === 'answer') && (
                  <span style={{ fontSize: 11, color: '#999', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    知乎回答（接口预留）
                  </span>
                )}
              </div>
              <button
                className={isRealApi ? 'btn-sm primary' : 'btn-sm'}
                style={!isRealApi ? { background: '#f0f0f0', color: '#999', border: '1px solid #ddd' } : {}}
                type="button"
                onClick={handlePublish}
                title={!isRealApi ? '该发布路径的知乎 API 暂未开放' : undefined}
              >
                {isRealApi ? '发布' : '接口未开放'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
