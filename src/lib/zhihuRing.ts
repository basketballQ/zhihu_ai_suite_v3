export interface RingInfo {
  ring_id: string;
  ring_name: string;
  ring_desc: string;
  ring_avatar: string;
  membership_num: number;
  discussion_num: number;
}

export interface RingPost {
  pin_id: string;   // int64，超过 JS MAX_SAFE_INTEGER，统一用 string 保留精度
  title?: string;
  content: string;
  author_name: string;
  images: string[];
  publish_time: number;
  like_num: number;
  comment_num: number;
  fav_num: number;
  share_num: number;
  comments: Array<{
    comment_id: string;  // int64，同 pin_id，由 parseSafeJson 保证精度
    content: string;
    author_name: string;
    like_count: number;
    reply_count: number;
  }>;
}

export interface RingDetail {
  ring_info: RingInfo;
  contents: RingPost[];
}

/** 圈子评论列表接口返回的单条评论 */
export interface RingComment {
  comment_id: string;
  content: string;       // HTML 格式，需自行去标签
  author_name: string;
  author_token: string;
  like_count: number;
  reply_count: number;
  publish_time: number;
  reply_to?: string;     // 二级评论才有此字段
}

/**
 * 安全解析含 int64 大整数的 JSON 字符串。
 *
 * JSON.parse 遇到超过 Number.MAX_SAFE_INTEGER（约 9×10¹⁵）的数值时会丢失精度。
 * 知乎 API 返回的 pin_id / comment_id 均为 19 位 int64，必须先转成字符串再解析。
 *
 * 方案：用正则将 JSON 中所有 16 位及以上的裸数字替换为带引号的字符串。
 * 只匹配「: 数字」模式，避免误转小数或版本号。
 */
function parseSafeJson<T>(text: string): T {
  const safe = text.replace(/:\s*(\d{16,})/g, (_, n) => `: "${n}"`);
  return JSON.parse(safe) as T;
}

async function buildSign(appKey: string, appSecret: string, timestamp: string, logId: string): Promise<string> {
  const signStr = `app_key:${appKey}|ts:${timestamp}|logid:${logId}|extra_info:`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signStr));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export function hasRingCredentials(): boolean {
  const k = (import.meta.env.VITE_ZHIHU_APP_KEY as string | undefined) ?? '';
  const s = (import.meta.env.VITE_ZHIHU_APP_SECRET as string | undefined) ?? '';
  return !!k && k !== 'your_zhihu_user_token' && !!s && s !== 'your_app_secret';
}

export async function fetchRingDetail(ringId: string, pageSize = 20): Promise<RingDetail> {
  const appKey = (import.meta.env.VITE_ZHIHU_APP_KEY as string | undefined) ?? '';
  const appSecret = (import.meta.env.VITE_ZHIHU_APP_SECRET as string | undefined) ?? '';

  if (!appKey || !appSecret) throw new Error('NO_RING_CREDS');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const logId = `req_${Date.now()}`;
  const sign = await buildSign(appKey, appSecret, timestamp, logId);

  const res = await fetch(
    `/zhihu-ring-api/openapi/ring/detail?ring_id=${ringId}&page_size=${pageSize}&page_num=1`,
    {
      headers: {
        'X-App-Key': appKey,
        'X-Timestamp': timestamp,
        'X-Log-Id': logId,
        'X-Sign': sign,
        'X-Extra-Info': '',
      },
    },
  );

  if (!res.ok) throw new Error(`Ring API HTTP ${res.status}`);

  // 用 parseSafeJson 防止 pin_id（int64）被 JSON.parse 截断精度
  const json = parseSafeJson<{ status: number; msg: string; data: RingDetail }>(await res.text());
  if (json.status !== 0) throw new Error(`Ring API: ${json.msg}`);

  return json.data;
}

export async function publishPin(ringId: string, title: string, content: string): Promise<string> {
  const appKey = (import.meta.env.VITE_ZHIHU_APP_KEY as string | undefined) ?? '';
  const appSecret = (import.meta.env.VITE_ZHIHU_APP_SECRET as string | undefined) ?? '';

  if (!appKey || !appSecret) throw new Error('NO_RING_CREDS');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const logId = `req_${Date.now()}`;
  const sign = await buildSign(appKey, appSecret, timestamp, logId);

  const body = {
    title,
    content,
    image_urls: [],
    ring_id: ringId,
  };

  const res = await fetch(`/zhihu-ring-api/openapi/publish/pin`, {
    method: 'POST',
    headers: {
      'X-App-Key': appKey,
      'X-Timestamp': timestamp,
      'X-Log-Id': logId,
      'X-Sign': sign,
      'X-Extra-Info': '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Ring Publish API HTTP ${res.status}`);

  // parseSafeJson 防止 content_token 若为 int64 数字时精度丢失
  const json = parseSafeJson<{ status: number; msg: string; data: { content_token: string } | null }>(await res.text());
  if (json.status !== 0) throw new Error(`Ring Publish API: ${json.msg}`);

  return json.data?.content_token || '';
}

export async function createComment(contentType: 'pin' | 'comment', contentToken: string, content: string): Promise<string> {
  const appKey = (import.meta.env.VITE_ZHIHU_APP_KEY as string | undefined) ?? '';
  const appSecret = (import.meta.env.VITE_ZHIHU_APP_SECRET as string | undefined) ?? '';

  if (!appKey || !appSecret) throw new Error('NO_RING_CREDS');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const logId = `req_${Date.now()}`;
  const sign = await buildSign(appKey, appSecret, timestamp, logId);

  const body = {
    content_token: contentToken,
    content_type: contentType,
    content,
  };

  const res = await fetch(`/zhihu-ring-api/openapi/comment/create`, {
    method: 'POST',
    headers: {
      'X-App-Key': appKey,
      'X-Timestamp': timestamp,
      'X-Log-Id': logId,
      'X-Sign': sign,
      'X-Extra-Info': '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Ring Comment API HTTP ${res.status}`);

  // parseSafeJson 防止 comment_id（int64）精度丢失；status/code 兼容两种响应格式
  const json = parseSafeJson<{ status?: number; code?: number; msg: string; data: { comment_id: string } | null }>(await res.text());
  const successFlag = json.status ?? json.code;
  if (successFlag !== 0) throw new Error(`Ring Comment API: ${json.msg}`);

  return json.data?.comment_id || '';
}

/**
 * 获取圈子帖子（或评论）下的评论列表
 * 文档：GET /openapi/comment/list
 *
 * @param contentToken  想法 ID 或评论 ID
 * @param contentType   'pin'（想法的一级评论）| 'comment'（评论的二级回复）
 * @param pageSize      每页条数，最多 50，默认 50
 * @param pageNum       页码，默认 1
 */
/**
 * 批量拉取帖子全量评论（并发分页，自动翻页直到无更多或达到上限）
 *
 * @param contentToken  帖子 ID
 * @param maxComments   最多拉取的评论总数，默认 500
 * @param onProgress    每批次完成后的进度回调，传入当前已拉取总数
 * @returns             按点赞数降序排好的全量评论 + 实际拉取总数
 */
export async function fetchAllPinComments(
  contentToken: string,
  maxComments = 500,
  onProgress?: (fetched: number) => void,
): Promise<{ comments: RingComment[]; total: number }> {
  const PAGE_SIZE = 50;
  const BATCH = 5; // 每批并发页数
  const maxPages = Math.ceil(maxComments / PAGE_SIZE);

  // 先拉第 1 页
  const first = await fetchPinComments(contentToken, 'pin', PAGE_SIZE, 1);
  const all: RingComment[] = [...first.comments];
  onProgress?.(all.length);

  if (!first.hasMore || all.length >= maxComments) {
    all.sort((a, b) => b.like_count - a.like_count);
    return { comments: all.slice(0, maxComments), total: all.length };
  }

  // 分批并发拉剩余页
  let nextPage = 2;
  let done = false;

  while (!done && nextPage <= maxPages) {
    const pages: number[] = [];
    for (let i = 0; i < BATCH && nextPage <= maxPages; i++, nextPage++) {
      pages.push(nextPage);
    }

    const results = await Promise.all(
      pages.map(p => fetchPinComments(contentToken, 'pin', PAGE_SIZE, p).catch(() => ({ comments: [] as RingComment[], hasMore: false }))),
    );

    for (const r of results) {
      all.push(...r.comments);
      if (!r.hasMore) { done = true; break; }
    }

    onProgress?.(Math.min(all.length, maxComments));

    // 批次间稍作等待，避免触发限频
    if (!done && nextPage <= maxPages) {
      await new Promise(res => setTimeout(res, 150));
    }
  }

  all.sort((a, b) => b.like_count - a.like_count);
  return { comments: all.slice(0, maxComments), total: all.length };
}

export async function fetchPinComments(
  contentToken: string,
  contentType: 'pin' | 'comment' = 'pin',
  pageSize = 50,
  pageNum = 1,
): Promise<{ comments: RingComment[]; hasMore: boolean }> {
  const appKey = (import.meta.env.VITE_ZHIHU_APP_KEY as string | undefined) ?? '';
  const appSecret = (import.meta.env.VITE_ZHIHU_APP_SECRET as string | undefined) ?? '';

  if (!appKey || !appSecret) throw new Error('NO_RING_CREDS');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const logId = `req_${Date.now()}`;
  const sign = await buildSign(appKey, appSecret, timestamp, logId);

  const params = new URLSearchParams({
    content_token: contentToken,
    content_type: contentType,
    page_size: String(pageSize),
    page_num: String(pageNum),
  });

  const res = await fetch(`/zhihu-ring-api/openapi/comment/list?${params}`, {
    headers: {
      'X-App-Key': appKey,
      'X-Timestamp': timestamp,
      'X-Log-Id': logId,
      'X-Sign': sign,
      'X-Extra-Info': '',
    },
  });

  if (!res.ok) throw new Error(`Ring Comment List API HTTP ${res.status}`);

  // 用 parseSafeJson 防止 comment_id（int64）精度丢失
  const json = parseSafeJson<{
    status: number;
    msg: string;
    data: { comments: RingComment[]; has_more: boolean } | null;
  }>(await res.text());
  if (json.status !== 0) throw new Error(`Ring Comment List API: ${json.msg}`);

  return {
    comments: json.data?.comments ?? [],
    hasMore: json.data?.has_more ?? false,
  };
}
