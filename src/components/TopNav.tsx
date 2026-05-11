import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

interface SearchResult {
  title: string;
  meta: string;
  action: string;
  type: 'hot' | 'radar';
}

function buildSearchResults(keyword: string): SearchResult[] {
  const term = keyword.trim() || 'AI';
  return [
    { title: `${term} 相关热榜监控`, meta: '更新热榜蹭词器 · 高匹配问题 · 流量窗口', action: '热榜监控', type: 'hot' },
    { title: `${term} 相关圈层分析`, meta: '更新垂直圈层雷达 · 圈子问题 · 蓝海机会',  action: '圈层分析', type: 'radar' },
  ];
}

export default function TopNav() {
  const { activeTool, updateHotByKeyword, updateRadarByKeyword, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const composingRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const closePopover = useCallback(() => setPopoverOpen(false), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        closePopover();
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [closePopover]);

  function applyContextual(kw: string, silent?: boolean): boolean {
    const term = kw.trim();
    if (!term) return false;
    if (activeTool === 'hot') {
      updateHotByKeyword(term);
      if (!silent) showToast(`已更新热榜：${term}`);
      closePopover();
      return true;
    }
    if (activeTool === 'radar') {
      updateRadarByKeyword(term);
      closePopover();
      return true;
    }
    return false;
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (composingRef.current) return;
    if (applyContextual(val, true)) return;
    if (val.trim()) setPopoverOpen(true);
    else setPopoverOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (composingRef.current) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const kw = query.trim();
      if (!kw) return;
      if (applyContextual(kw)) return;
      setPopoverOpen(true);
      showToast('已生成搜索结果，可选择后续工具。');
    }
    if (e.key === 'Escape') closePopover();
  }

  function handleAction(type: 'hot' | 'radar') {
    const kw = query.trim() || 'AI';
    closePopover();
    if (type === 'hot') updateHotByKeyword(kw);
    else updateRadarByKeyword(kw);
  }

  const results = buildSearchResults(query || 'AI');

  return (
    <div className="zh-top">
      <div className="zh-logo">
        <div className="zh-logo-icon">知</div>
        AI 创作增长套件
      </div>

      <div className="zh-search-wrap" ref={wrapRef}>
        <input
          className="zh-search"
          placeholder="搜索关键词..."
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            const val = (e.target as HTMLInputElement).value;
            if (applyContextual(val, true)) return;
            if (val.trim()) setPopoverOpen(true);
          }}
        />
        <div className={`search-popover${popoverOpen ? ' is-open' : ''}`}>
          <div className="search-popover-head">
            <span>关键词：{query || 'AI'}</span>
            <span>选择一个后续动作</span>
          </div>
          {results.map(r => (
            <div className="search-result" key={r.type}>
              <div className="search-result-title">{r.title}</div>
              <div className="search-result-meta"><span>{r.meta}</span></div>
              <div className="search-result-actions">
                <button className="btn-sm primary" onClick={() => handleAction(r.type)}>{r.action}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
        <div className="zh-user">我</div>
      </div>
    </div>
  );
}
