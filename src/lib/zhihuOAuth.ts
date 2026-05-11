/**
 * 知乎 OAuth 2.0 授权码模式
 *
 * 文档: https://openapi.zhihu.com/
 * Vite 代理: /zhihu-ring-api → https://openapi.zhihu.com
 *
 * 环境变量（在 .env.local 中配置）：
 *   VITE_ZHIHU_OAUTH_APP_ID   - 知乎 OAuth App ID
 *   VITE_ZHIHU_OAUTH_APP_KEY  - 知乎 OAuth App Key
 */

import { ringApiUrl } from './apiBase';

const APP_ID = (import.meta.env.VITE_ZHIHU_OAUTH_APP_ID as string | undefined) ?? '';
const APP_KEY = (import.meta.env.VITE_ZHIHU_OAUTH_APP_KEY as string | undefined) ?? '';

/** OAuth 回调地址（SPA 当前 origin，知乎将 code 附加在此地址后返回） */
const REDIRECT_URI = window.location.origin;

const SESSION_TOKEN_KEY = 'zhihu_oauth_token';
const SESSION_USER_KEY = 'zhihu_oauth_user';

// ─── 类型 ───────────────────────────────────────────────────────────────────

export interface ZhihuOAuthUser {
  uid: number;
  fullname: string;
  gender: string;       // 'male' | 'female' | 'Unknown'
  headline: string;     // 个人简介
  description: string;  // 个人描述
  avatar_path: string;  // 头像完整 URL
  phone_no: string;     // 可能为空字符串（权限不足时）
  email: string;        // 可能为空字符串（权限不足时）
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/** 是否已配置 OAuth 应用凭证 */
export function hasOAuthCredentials(): boolean {
  return !!APP_ID && !!APP_KEY;
}

/** 生成知乎 OAuth 授权页面 URL */
export function getLoginUrl(): string {
  const params = new URLSearchParams({
    redirect_uri: REDIRECT_URI,
    app_id: APP_ID,
    response_type: 'code',
  });
  // 直接指向知乎授权页，不走 Vite 代理（需要浏览器真实跳转）
  return `https://openapi.zhihu.com/authorize?${params.toString()}`;
}

/** 从当前 URL 中提取 OAuth 回调 code（兼容 code 和 authorization_code 两种参数名） */
export function extractCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('code') ?? params.get('authorization_code');
}

/** 清除 URL 中的 code/authorization_code 参数，防止刷新后重复换取 */
export function clearCodeFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('authorization_code');
  window.history.replaceState({}, '', url.toString());
}

// ─── OAuth API 调用 ──────────────────────────────────────────────────────────

/**
 * 用 authorization_code 换取 access_token
 * POST /zhihu-ring-api/access_token (代理至 openapi.zhihu.com)
 */
export async function exchangeToken(code: string): Promise<string> {
  if (!APP_ID || !APP_KEY) throw new Error('未配置 VITE_ZHIHU_OAUTH_APP_ID / VITE_ZHIHU_OAUTH_APP_KEY');

  const body = new URLSearchParams({
    app_id: APP_ID,
    app_key: APP_KEY,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  });

  const res = await fetch(ringApiUrl('/access_token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  // 先读原始文本，便于调试
  const rawText = await res.text();
  console.log('[OAuth] /access_token 原始响应:', rawText);

  if (!res.ok) throw new Error(`Token 换取失败 (HTTP ${res.status})：${rawText.slice(0, 200)}`);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(`响应不是合法 JSON：${rawText.slice(0, 200)}`);
  }

  // 知乎 OAuth 成功：直接返回 access_token
  if (typeof data.access_token === 'string' && data.access_token) {
    return data.access_token;
  }

  // 知乎 OAuth 错误格式：{ code: 400, data: "..." } 或 { error: "...", error_description: "..." }
  const errMsg =
    (data.data as string | undefined) ??
    (data.error_description as string | undefined) ??
    (data.error as string | undefined) ??
    `未知错误：${rawText.slice(0, 200)}`;
  throw new Error(errMsg);
}

/**
 * 用 access_token 获取当前登录用户信息
 * GET /zhihu-ring-api/user
 */
export async function fetchZhihuOAuthUser(token: string): Promise<ZhihuOAuthUser> {
  const res = await fetch(ringApiUrl('/user'), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const rawText = await res.text();
  console.log('[OAuth] /user 原始响应:', rawText);

  if (!res.ok) throw new Error(`用户信息获取失败 (HTTP ${res.status})：${rawText.slice(0, 200)}`);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(`用户接口响应不是合法 JSON：${rawText.slice(0, 200)}`);
  }

  // 错误响应格式：{ code: 401, data: "..." }
  if (typeof data.code === 'number' && data.code !== 0) {
    throw new Error((data.data as string | undefined) ?? `用户接口错误 code=${data.code}`);
  }

  return data as unknown as ZhihuOAuthUser;
}

// ─── Session 持久化 ──────────────────────────────────────────────────────────

/** 将 token 和用户信息保存到 sessionStorage（页面关闭后自动清除） */
export function saveOAuthSession(token: string, user: ZhihuOAuthUser): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

/** 从 sessionStorage 恢复 access_token */
export function loadOAuthToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

/** 从 sessionStorage 恢复用户信息 */
export function loadOAuthUser(): ZhihuOAuthUser | null {
  const raw = sessionStorage.getItem(SESSION_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as ZhihuOAuthUser; } catch { return null; }
}

/** 清除 OAuth session（退出登录） */
export function clearOAuthSession(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
}
