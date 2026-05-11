/* @refresh reset */
import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { ToolId, HotTopic, ToastItem, ViralityMode, RadarItem } from '../types';

/**
 * 发布目标上下文
 *
 * - source: 'radar'  → 垂直圈层雷达：在已发布的圈子 pin 下追加评论（Ring createComment API）
 * - source: 'ring'   → 评论区截流（圈子来源）：将回答草稿发布为圈子新想法（Ring publishPin API）
 * - source: 'answer' → 热榜蹭词器 / 评论区截流（普通来源）：发布知乎回答（Answer API，预留）
 * - null             → 无待发布目标
 */
export type PublishTarget =
  | { source: 'radar'; pinToken: string }          // 垂直圈层雷达：在已发布 pin 下追加评论
  | { source: 'ring'; pinContent?: string }          // 评论截流（圈子）：发布新圈子想法（pinContent = AI生成的正文）
  | { source: 'ring_reply'; commentId: string }    // 评论截流（圈子）：直接回复该评论
  | { source: 'answer' }                            // 热榜 / 截流（普通问题）：发布新回答
  | { source: 'answer_reply'; commentId: string }  // 热榜 / 截流（普通问题）：直接回复该评论
  | null;
import { initialHotTopics, keywordHotQuestions } from '../data/hotTopics';
import { initialRadarItems, keywordRadarQuestions } from '../data/radar';
import { fetchZhihuHotList } from '../lib/zhihu';
import { analyzeHotTopics, analyzeCircleContent, analyzeCircleStyle } from '../lib/ai';
import { fetchRingDetail, hasRingCredentials } from '../lib/zhihuRing';
import {
  type ZhihuOAuthUser,
  extractCodeFromUrl, clearCodeFromUrl,
  exchangeToken, fetchZhihuOAuthUser,
  saveOAuthSession, loadOAuthToken, loadOAuthUser, clearOAuthSession,
  getLoginUrl, hasOAuthCredentials,
} from '../lib/zhihuOAuth';

// 知乎圈名 → 圈子 ID（仅已开放的圈子有值）
export const RING_ID_MAP: Record<string, string> = {
  'OpenClaw 人类观察员': '2001009660925334090',
};

interface AppContextValue {
  activeTool: ToolId;
  switchTool: (id: ToolId) => void;

  circles: string[];
  activeCircle: string;
  addCircle: (name: string) => void;
  removeCircle: (name: string) => void;
  setActiveCircle: (name: string) => void;
  fields: string[];
  addField: (name: string) => void;
  removeField: (name: string) => void;

  hotTopics: HotTopic[];
  hotLoading: boolean;
  hotTokens: number;
  hotPhase: 'fetch' | 'analyze' | null;
  hotKeyword: string | null;
  setHotKeyword: (kw: string | null) => void;
  updateHotByKeyword: (keyword: string) => void;
  resetHotTopics: () => void;
  refreshHotTopics: () => void;

  radarItems: RadarItem[];
  radarLoading: boolean;
  radarTokens: number;
  radarPhase: 'style' | 'content' | null;
  radarKeyword: string | null;
  circleStyleGuide: { label: string; body: string } | null;
  setRadarKeyword: (kw: string | null) => void;
  updateRadarByKeyword: (keyword: string) => void;
  refreshCircleData: () => void;
  resetRadarItems: () => void;

  viralityMode: ViralityMode;
  viralityQuestion: string;
  viralityDraft: string;
  setViralityState: (mode: ViralityMode, question: string, draft: string) => void;
  setQuestionForPrediction: (question: string, draft?: string) => void;
  setNewQuestionForPrediction: (question: string) => void;

  openerTitle: string;
  openerOpen: boolean;
  openerMode: 'answer' | 'dual';
  setOpenerTitle: (title: string) => void;
  setOpenerOpen: (open: boolean) => void;

  commentIntercept: string | null;
  openCommentInterceptor: (title: string) => void;
  clearCommentIntercept: () => void;

  toasts: ToastItem[];
  showToast: (msg: string) => void;

  publishTarget: PublishTarget;
  setPublishTarget: (target: PublishTarget) => void;

  startOpenerForQuestion: (title: string, mode?: 'answer' | 'dual') => void;
  toastIdRef: React.MutableRefObject<number>;

  // 知乎 OAuth 登录
  zhihuUser: ZhihuOAuthUser | null;
  zhihuToken: string | null;
  zhihuLoginLoading: boolean;
  loginWithZhihu: () => void;
  logoutZhihu: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<ToolId>('home');

  const [circles, setCircles] = useState<string[]>([
    'OpenClaw 人类观察员',
    'AI 工具测评中心',
    '探索Vibe Coding',
    'AI 时代的我们',
    '运动打卡行动派',
  ]);
  const [activeCircle, setActiveCircleState] = useState('OpenClaw 人类观察员');
  const [fields, setFields] = useState<string[]>(['人工智能', '产品经理', '职场']);

  const [hotTopics, setHotTopics] = useState<HotTopic[]>(initialHotTopics);
  const [hotLoading, setHotLoading] = useState(false);
  const [hotTokens, setHotTokens] = useState(0);
  const [hotPhase, setHotPhase] = useState<'fetch' | 'analyze' | null>(null);
  const [hotKeyword, setHotKeyword] = useState<string | null>(null);

  const [radarItems, setRadarItems] = useState<RadarItem[]>(initialRadarItems);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarTokens, setRadarTokens] = useState(0);
  const [radarPhase, setRadarPhase] = useState<'style' | 'content' | null>(null);
  const [radarKeyword, setRadarKeyword] = useState<string | null>(null);
  const [circleStyleGuide, setCircleStyleGuide] = useState<{ label: string; body: string } | null>(null);

  const circleCacheRef = useRef<Record<string, RadarItem[]>>({});
  const styleGuideCacheRef = useRef<Record<string, { label: string; body: string }>>({});

  // ── refs 持有最新状态，避免 useCallback 闭包陈旧 ──
  const fieldsRef = useRef(fields);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);
  const activeCircleRef = useRef('OpenClaw 人类观察员');
  useEffect(() => { activeCircleRef.current = activeCircle; }, [activeCircle]);
  const fetchingRef = useRef<Set<string>>(new Set());
  // StrictMode 在开发环境会将 useEffect 执行两次，用 ref 确保启动请求只发一次
  const initFetchedRef = useRef(false);
  // 热榜懒加载：首次切换到热榜页时才拉取，避免打开网页即触发
  const hotFetchedRef = useRef(false);

  const [viralityMode, setViralityMode] = useState<ViralityMode>('answer');
  const [viralityQuestion, setViralityQuestion] = useState('AGI 真的要来了吗？目前人工智能距离真正的通用智能还有多远？');
  const [viralityDraft, setViralityDraft] = useState('');

  const [openerTitle, setOpenerTitle] = useState('AGI 真的要来了吗？目前人工智能距离真正的通用智能还有多远？');
  const [openerOpen, setOpenerOpen] = useState(false);
  const [openerMode, setOpenerMode] = useState<'answer' | 'dual'>('answer');

  const [commentIntercept, setCommentIntercept] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const [publishTarget, setPublishTarget] = useState<PublishTarget>(null);

  // 知乎 OAuth 登录状态（从 sessionStorage 恢复，页面关闭自动失效）
  const [zhihuUser, setZhihuUser] = useState<ZhihuOAuthUser | null>(loadOAuthUser);
  const [zhihuToken, setZhihuToken] = useState<string | null>(loadOAuthToken);
  const [zhihuLoginLoading, setZhihuLoginLoading] = useState(false);

  const showToast = useCallback((msg: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message: msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  const switchTool = useCallback((id: ToolId) => {
    setActiveTool(id);
  }, []);

  // ── 知乎 OAuth：跳转授权页 ──────────────────────────────────────────────────
  const loginWithZhihu = useCallback(() => {
    if (!hasOAuthCredentials()) {
      showToast('未配置知乎 OAuth 凭证（VITE_ZHIHU_OAUTH_APP_ID / APP_KEY），请先在 .env.local 中添加。');
      return;
    }
    // 跳转到知乎授权页（用户授权后会被重定向回本页 + ?code=xxx）
    window.location.href = getLoginUrl();
  }, [showToast]);

  // ── 知乎 OAuth：退出登录 ────────────────────────────────────────────────────
  const logoutZhihu = useCallback(() => {
    clearOAuthSession();
    setZhihuUser(null);
    setZhihuToken(null);
    showToast('已退出知乎账号。');
  }, [showToast]);

  // 拉取指定圈子的雷达数据（优先读缓存）
  // Bug Fix #2: 不再接收 currentFields 参数，改为从 fieldsRef 读取，避免闭包陈旧
  const fetchCircleData = useCallback((circleName: string) => {
    if (circleCacheRef.current[circleName]) {
      setRadarItems(circleCacheRef.current[circleName]);
      setCircleStyleGuide(styleGuideCacheRef.current[circleName] ?? null);
      return;
    }
    if (fetchingRef.current.has(circleName)) {
      return; // 防止 StrictMode 或快速切换导致的重复请求
    }

    const ringId = RING_ID_MAP[circleName];
    if (!ringId || !hasRingCredentials()) {
      setRadarItems(initialRadarItems);
      setCircleStyleGuide(null);
      // Bug Fix #3: 不支持实时数据时给用户明确提示
      if (ringId === undefined) {
        showToast(`「${circleName}」暂不支持实时数据，显示默认示例。`);
      }
      return;
    }

    fetchingRef.current.add(circleName);
    setRadarLoading(true);
    setRadarTokens(0);
    setRadarPhase('style');
    fetchRingDetail(ringId, 20)
      .then(async detail => {
        // Phase 1：分析圈子语言风格（只在这里 try-catch，失败静默降级）
        let styleTokenOffset = 0;
        let styleSucceeded = false; // 标记 Phase 1 是否成功设置了风格指南
        const cachedStyle = styleGuideCacheRef.current[circleName];
        if (cachedStyle) {
          setCircleStyleGuide(cachedStyle);
          styleSucceeded = true;
        } else {
          try {
            const style = await analyzeCircleStyle(
              circleName,
              detail.contents,
              (n) => { styleTokenOffset = n; setRadarTokens(n); },
            );
            // 只有真正的 AI 分析结果（label 含「AI 实时分析」）才写入缓存
            // 若 analyzeCircleStyle 内部降级返回了静态数据，不缓存，下次仍会重新调用 AI
            if (style.label.includes('AI 实时分析')) {
              styleGuideCacheRef.current[circleName] = style;
            }
            setCircleStyleGuide(style);
            styleSucceeded = true;
          } catch (styleErr) {
            // 风格指南分析失败，静默降级，不影响后续问题分析
            console.error('[Phase 1 Style Error]', styleErr);
          }
        }

        // Phase 2：始终执行且只执行一次，token 计数在 style 基础上累积
        setRadarPhase('content');
        const currentFields = fieldsRef.current;
        const items = await analyzeCircleContent(
          circleName,
          detail.contents,
          currentFields,
          (n) => setRadarTokens(styleTokenOffset + n),
        );
        circleCacheRef.current[circleName] = items;
        setRadarItems(items);
        setRadarLoading(false);
        setRadarPhase(null);
        // 闭包引用 styleSucceeded，仅为防止 lint 警告
        void styleSucceeded;
      })
      .catch((err: Error) => {
        showToast(`圈子数据加载失败：${err.message}`);
        setRadarItems(initialRadarItems);
        // 不再无条件清空：若 Phase 1 已成功设置 AI 风格指南，保留它
        // Phase 1 失败时 circleStyleGuide 本身就是 null，无需重置
        setRadarLoading(false);
        setRadarPhase(null);
      })
      .finally(() => {
        fetchingRef.current.delete(circleName);
      });
  }, [showToast]);

  // 强制刷新当前激活圈子（清除缓存后重新拉取）
  const refreshCircleData = useCallback(() => {
    const circleName = activeCircleRef.current;
    delete circleCacheRef.current[circleName];
    delete styleGuideCacheRef.current[circleName];
    setCircleStyleGuide(null);
    fetchingRef.current.delete(circleName); // 允许重新发起请求
    fetchCircleData(circleName);
    showToast(`正在刷新「${circleName}」数据…`);
  }, [fetchCircleData, showToast]);

  const refreshHotTopics = useCallback(() => {
    setHotLoading(true);
    setHotTokens(0);
    setHotPhase('fetch');

    // Phase 1：从知乎拉取热榜（无 key 时用初始标题列表替代，仍走 Phase 2）
    fetchZhihuHotList(30)
      .catch((err: Error) => {
        const msg = err.message.includes('NO_ZHIHU_KEY')
          ? '未配置知乎 AccessKey，使用默认话题列表进行分析。'
          : `热榜获取失败：${err.message}，使用默认话题列表。`;
        showToast(msg);
        // 将初始热榜标题转为 ZhihuHotItem 格式，交给 DeepSeek 分析
        return initialHotTopics.map(t => ({
          Title: t.title,
          Url: t.url ?? '',
          ThumbnailUrl: t.thumbnailUrl ?? '',
          Summary: '',
        }));
      })
      // Phase 2：DeepSeek 分析匹配度、标签、流量窗口
      .then(items => {
        setHotPhase('analyze');
        return analyzeHotTopics(items, fieldsRef.current, setHotTokens);
      })
      .then(topics => {
        setHotTopics(topics);
        setHotKeyword(null);
      })
      .catch((err: Error) => {
        showToast(`分析失败：${err.message}`);
        setHotTopics(initialHotTopics);
      })
      .finally(() => {
        setHotLoading(false);
        setHotPhase(null);
      });
  }, [showToast]);

  // 启动时仅拉取 OpenClaw 圈子数据；热榜改为懒加载（首次进入热榜页再拉取）
  // initFetchedRef 防止 React StrictMode 在开发环境的双重 effect 触发两次请求
  useEffect(() => {
    if (initFetchedRef.current) return;
    initFetchedRef.current = true;

    // ── 检测知乎 OAuth 回调（URL 中携带 ?code=xxx）──────────────────────────
    const code = extractCodeFromUrl();
    if (code) {
      clearCodeFromUrl(); // 立即清除 URL 中的 code，防止刷新后重复换取
      setZhihuLoginLoading(true);
      exchangeToken(code)
        .then(token => {
          setZhihuToken(token);
          return fetchZhihuOAuthUser(token).then(user => {
            setZhihuUser(user);
            saveOAuthSession(token, user);
            showToast(`🎉 已登录知乎账号：${user.fullname}`);
          });
        })
        .catch((err: Error) => {
          showToast(`知乎登录失败：${err.message}`);
        })
        .finally(() => {
          setZhihuLoginLoading(false);
        });
    }

    fetchCircleData('OpenClaw 人类观察员');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 懒加载热榜：首次切换到热榜页时才发起拉取
  useEffect(() => {
    if (activeTool !== 'hot') return;
    if (hotFetchedRef.current) return;
    hotFetchedRef.current = true;
    refreshHotTopics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  const addCircle = useCallback((name: string) => {
    name = name.trim();
    if (!name) { showToast('请选择圈子。'); return; }
    setCircles(prev => {
      if (prev.includes(name)) { showToast('这个圈子已经存在。'); return prev; }
      showToast(`已加入圈子：${name}`);
      return [...prev, name];
    });
  }, [showToast]);

  // Bug Fix #1: 将两个 setter 合并到同一 setCircles 回调内，消除闭包竞态
  const removeCircle = useCallback((name: string) => {
    setCircles(prev => {
      const next = prev.filter(c => c !== name);
      // 在同一批次更新 activeCircle，避免引用旧的 circles 闭包
      setActiveCircleState(cur => (cur === name ? next[0] ?? '' : cur));
      showToast(`已删除圈子：${name}`);
      return next;
    });
  }, [showToast]);

  const setActiveCircle = useCallback((name: string) => {
    setActiveCircleState(name);
    // Bug Fix #2: fetchCircleData 内部现在自己从 fieldsRef 读取最新领域
    fetchCircleData(name);
  }, [fetchCircleData]);

  const addField = useCallback((name: string) => {
    name = name.trim();
    if (!name) return;
    setFields(prev => {
      if (prev.includes(name)) { showToast('这个领域已经存在。'); return prev; }
      showToast(`已添加领域：${name}`);
      return [...prev, name];
    });
  }, [showToast]);

  const removeField = useCallback((name: string) => {
    setFields(prev => prev.filter(f => f !== name));
    showToast(`已删除领域：${name}`);
  }, [showToast]);

  const updateHotByKeyword = useCallback((keyword: string) => {
    setHotTopics(keywordHotQuestions(keyword));
    setHotKeyword(keyword);
    setActiveTool('hot');
    setOpenerOpen(false);
    showToast(`已更新关键词热榜监控：${keyword}`);
  }, [showToast]);

  const resetHotTopics = useCallback(() => {
    setHotTopics(initialHotTopics);
    setHotKeyword(null);
    setOpenerOpen(false);
    showToast('已恢复热榜蹭词器初始状态。');
  }, [showToast]);

  const updateRadarByKeyword = useCallback((keyword: string) => {
    setRadarItems(keywordRadarQuestions(keyword));
    setRadarKeyword(keyword);
    setActiveTool('radar');
    showToast(`已更新关键词圈层问题：${keyword}`);
  }, [showToast]);

  // Bug Fix #5: 使用 activeCircleRef 读取最新圈子，避免 useCallback 闭包捕获旧值
  const resetRadarItems = useCallback(() => {
    const cached = circleCacheRef.current[activeCircleRef.current];
    setRadarItems(cached ?? initialRadarItems);
    setRadarKeyword(null);
    showToast('已恢复垂直圈层雷达初始状态。');
  }, [showToast]);

  const setViralityState = useCallback((mode: ViralityMode, question: string, draft: string) => {
    setViralityMode(mode);
    setViralityQuestion(question);
    setViralityDraft(draft);
  }, []);

  const setQuestionForPrediction = useCallback((question: string, draft = '') => {
    setViralityMode('answer');
    setViralityQuestion(question);
    setViralityDraft(draft);
    setActiveTool('virality');
  }, []);

  const setNewQuestionForPrediction = useCallback((question: string) => {
    setViralityMode('dual');
    setViralityQuestion(question);
    setViralityDraft(`新问题草稿：${question}\n\n回答草稿：\n我会先把这个追问拆成三个层次：现状、路径和可验证的案例。\n\n`);
    setActiveTool('virality');
  }, []);

  const openCommentInterceptor = useCallback((title: string) => {
    setCommentIntercept(title);
    setActiveTool('comment');
    showToast('已跳到评论区截流器，可扫描该问题下的追问。');
  }, [showToast]);

  const clearCommentIntercept = useCallback(() => {
    setCommentIntercept(null);
  }, []);

  const startOpenerForQuestion = useCallback((title: string, mode: 'answer' | 'dual' = 'answer') => {
    setOpenerTitle(title);
    setOpenerOpen(true);
    setOpenerMode(mode);
    setActiveTool('hot');
    showToast(mode === 'dual' ? '已进入开场白建议，编辑后可进入双预测。' : '已进入开场白建议，可先编辑回答开头。');
  }, [showToast]);

  const value: AppContextValue = {
    activeTool, switchTool,
    circles, activeCircle, addCircle, removeCircle, setActiveCircle,
    fields, addField, removeField,
    hotTopics, hotLoading, hotTokens, hotPhase, hotKeyword, setHotKeyword, updateHotByKeyword, resetHotTopics, refreshHotTopics,
    radarItems, radarLoading, radarTokens, radarPhase, radarKeyword, setRadarKeyword, updateRadarByKeyword, resetRadarItems, circleStyleGuide, refreshCircleData,
    viralityMode, viralityQuestion, viralityDraft,
    setViralityState, setQuestionForPrediction, setNewQuestionForPrediction,
    openerTitle, openerOpen, openerMode, setOpenerTitle, setOpenerOpen,
    commentIntercept, openCommentInterceptor, clearCommentIntercept,
    toasts, showToast, toastIdRef,
    publishTarget, setPublishTarget,
    startOpenerForQuestion,
    zhihuUser, zhihuToken, zhihuLoginLoading, loginWithZhihu, logoutZhihu,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
