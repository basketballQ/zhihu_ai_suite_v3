import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { ToolId } from '../types';

const CIRCLE_SUGGESTIONS = [
  'AI 产品经理圈', 'AIGC 创作者联盟', 'Prompt 工程实践圈',
  'AI 编程工具圈', '职场成长圈', '产品经理社区', '内容创作者互助圈', '科技创业圈',
];
const FIELD_SUGGESTIONS = ['AI Agent', 'AI 编程', '短剧', '出海', '电商', '低空经济', '机器人', '新能源'];

interface NavItem { id: ToolId; icon: string; label: string; bg: string }
const NAV_ITEMS: NavItem[] = [
  { id: 'radar',    icon: '📡', label: '垂直圈层雷达', bg: '#FFF7E6' },
  { id: 'hot',      icon: '🔥', label: '热榜蹭词器',   bg: '#FFF0F0' },
  { id: 'virality', icon: '📊', label: '传播力预测器', bg: '#EBF5FF' },
  { id: 'comment',  icon: '💬', label: '评论区截流器', bg: '#F0EDFF' },
];

function CircleSection() {
  const { circles, activeCircle, addCircle, removeCircle, setActiveCircle } = useApp();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pickerOpen) inputRef.current?.focus();
  }, [pickerOpen]);

  function doAdd(name: string) {
    name = name.trim();
    if (!name) return;
    addCircle(name);
    setPickerOpen(false);
    setCustomInput('');
  }

  return (
    <div className="side-section">
      <div className="side-title">我的圈子</div>
      <div style={{ padding: '10px 16px' }}>
        <div className="circle-list">
          {circles.map(c => (
            <div
              key={c}
              className={`circle-item${activeCircle === c ? ' is-active' : ''}`}
              onClick={() => setActiveCircle(c)}
            >
              {c}
              <button
                className="circle-item-remove"
                type="button"
                aria-label={`删除 ${c}`}
                onClick={e => { e.stopPropagation(); removeCircle(c); }}
              >×</button>
            </div>
          ))}

          {pickerOpen ? (
            <div className="circle-picker">
              <div className="field-picker-label">推荐加入的知乎圈子</div>
              <div className="field-picker">
                {CIRCLE_SUGGESTIONS.map(name => (
                  <button
                    key={name}
                    className={`field-suggest${circles.includes(name) ? ' is-disabled' : ''}`}
                    type="button"
                    disabled={circles.includes(name)}
                    onClick={() => { doAdd(name); }}
                  >{name}</button>
                ))}
              </div>
              <input
                ref={inputRef}
                className="field-add-input"
                type="text"
                placeholder="搜索或输入圈子"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') doAdd(customInput);
                  if (e.key === 'Escape') setPickerOpen(false);
                }}
              />
              <div className="circle-picker-row">
                <button className="btn-sm primary" type="button" onClick={() => doAdd(customInput)}>加入</button>
                <button className="btn-sm ghost" type="button" onClick={() => setPickerOpen(false)}>取消</button>
              </div>
            </div>
          ) : (
            <div
              className="circle-add"
              role="button"
              tabIndex={0}
              onClick={() => setPickerOpen(true)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPickerOpen(true); } }}
            >+ 加入圈子</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldSection() {
  const { fields, addField, removeField } = useApp();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pickerOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [pickerOpen]);

  function doAdd(name: string) {
    name = name.trim();
    if (!name) return;
    addField(name);
    setPickerOpen(false);
    setCustomInput('');
  }

  const tagColors: Record<number, string> = { 0: 'sel', 1: 'sel', 2: 'sel-add' };

  return (
    <div className="side-section">
      <div className="side-title">我的领域</div>
      <div style={{ padding: '10px 16px' }}>
        <div className="tag-list">
          {fields.map((f, i) => (
            <div key={f} className={`tag ${tagColors[i] ?? 'sel'} field-tag`} data-field={f}>
              {f}
              <button
                className="tag-remove"
                type="button"
                aria-label={`删除 ${f}`}
                onClick={() => removeField(f)}
              >×</button>
            </div>
          ))}

          {pickerOpen ? (
            <div className="field-picker">
              <div className="field-picker-label">当前热度高</div>
              {FIELD_SUGGESTIONS.map((name, idx) => (
                <button
                  key={name}
                  className={`field-suggest${fields.includes(name) ? ' is-disabled' : ''}`}
                  type="button"
                  disabled={fields.includes(name)}
                  onClick={() => doAdd(name)}
                >
                  {name}{idx < 4 && <span className="hot-mark">↑</span>}
                </button>
              ))}
              <input
                ref={inputRef}
                className="field-add-input"
                placeholder="自定义"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') doAdd(customInput);
                  if (e.key === 'Escape') setPickerOpen(false);
                }}
              />
              <div className="field-picker-actions">
                <button className="btn-sm primary" type="button" onClick={() => doAdd(customInput)}>添加</button>
                <button className="btn-sm ghost" type="button" onClick={() => setPickerOpen(false)}>取消</button>
              </div>
            </div>
          ) : (
            <div
              className="tag add-field"
              role="button"
              tabIndex={0}
              onClick={() => setPickerOpen(true)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPickerOpen(true); } }}
            >+ 添加</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSection() {
  const { zhihuUser, zhihuLoginLoading, loginWithZhihu, logoutZhihu } = useApp();

  return (
    <div className="side-section">
      <div className="side-title">知乎账号</div>
      <div style={{ padding: '10px 16px' }}>
        {zhihuLoginLoading ? (
          <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '6px 0' }}>
            登录中…
          </div>
        ) : zhihuUser ? (
          /* 已登录：显示头像 + 昵称 + 退出按钮 */
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={zhihuUser.avatar_path}
              alt={zhihuUser.fullname}
              style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', border: '1px solid #e8e8e8' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {zhihuUser.fullname}
              </div>
              {zhihuUser.headline && (
                <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {zhihuUser.headline}
                </div>
              )}
            </div>
            <button
              className="btn-sm ghost"
              type="button"
              style={{ flexShrink: 0, fontSize: 11, padding: '3px 8px' }}
              onClick={logoutZhihu}
              title="退出登录"
            >退出</button>
          </div>
        ) : (
          /* 未登录：显示登录按钮 */
          <button
            className="btn-sm primary"
            type="button"
            style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
            onClick={loginWithZhihu}
          >
            🔑 登录知乎账号
          </button>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { activeTool, switchTool } = useApp();

  return (
    <div className="sidebar">
      <div className="side-section">
        <div className="side-title">导航</div>
        <div
          className={`side-item${activeTool === 'home' ? ' active' : ''}`}
          onClick={() => switchTool('home')}
        >
          <div className="s-icon" style={{ background: '#F0F0F0' }}>🏠</div>
          <div className="s-label">套件首页</div>
        </div>
      </div>

      <div className="side-section">
        <div className="side-title">AI 工具</div>
        {NAV_ITEMS.map(item => (
          <div
            key={item.id}
            className={`side-item${activeTool === item.id ? ' active' : ''}`}
            onClick={() => switchTool(item.id)}
          >
            <div className="s-icon" style={{ background: item.bg }}>{item.icon}</div>
            <div className="s-label">{item.label}</div>
          </div>
        ))}
      </div>

      <CircleSection />
      <FieldSection />
      <AccountSection />
    </div>
  );
}
