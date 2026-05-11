import { ringApiUrl } from './apiBase';

export interface ZhihuHotItem {
  Title: string;
  Url: string;
  ThumbnailUrl: string;
  Summary: string;
}

interface ZhihuHotListResponse {
  Code: number;
  Message: string;
  Data: {
    Total: number;
    Items: ZhihuHotItem[];
  };
}

/**
 * 通过 Vite 开发代理 `/zhihu-api` 请求知乎热榜接口。
 * 生产环境需要独立的后端代理，这里仅处理 dev 场景。
 */
export async function fetchZhihuHotList(limit = 30): Promise<ZhihuHotItem[]> {
  const key = (import.meta.env.VITE_ZHIHU_ACCESS_KEY as string | undefined) ?? '';
  if (!key) throw new Error('NO_ZHIHU_KEY');

  const ts = Math.floor(Date.now() / 1000).toString();
  const res = await fetch(ringApiUrl(`/api/v1/content/hot_list?Limit=${limit}`), {
    headers: {
      Authorization: `Bearer ${key}`,
      'X-Request-Timestamp': ts,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Zhihu API HTTP ${res.status}`);

  const json = (await res.json()) as ZhihuHotListResponse;

  if (json.Code === 20001) throw new Error('Zhihu API 鉴权失败（20001）');
  if (json.Code === 30001) throw new Error('Zhihu API 频率限制（30001），请稍后重试');
  if (json.Code !== 0) throw new Error(`Zhihu API 错误（${json.Code}）: ${json.Message}`);

  return json.Data.Items;
}
