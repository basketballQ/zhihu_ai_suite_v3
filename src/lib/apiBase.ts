/**
 * API 请求基础路径
 *
 * 开发环境：使用 Vite 代理（/zhihu-ring-api → openapi.zhihu.com）
 * 生产环境：使用 CloudBase 云函数代理（VITE_CLOUDBASE_PROXY_URL）
 *
 * 云函数代理 URL 格式：
 *   https://{envId}.service.tcloudbase.com/zhihu-proxy
 *
 * 用法：
 *   ringApi('/openapi/ring/detail?ring_id=xxx')
 *   → 开发: /zhihu-ring-api/openapi/ring/detail?ring_id=xxx
 *   → 生产: https://xxx.service.tcloudbase.com/zhihu-proxy?__path=/openapi/ring/detail&ring_id=xxx
 */

const PROXY_URL = (import.meta.env.VITE_CLOUDBASE_PROXY_URL as string | undefined) ?? '';
const IS_PROD = !!PROXY_URL;

/**
 * 构造知乎 Ring / OAuth API 请求 URL
 * @param path  以 / 开头的 API 路径，可带查询参数（如 /openapi/ring/detail?ring_id=xxx）
 */
export function ringApiUrl(path: string): string {
  if (!IS_PROD) {
    // 开发环境：Vite 代理直接拼接
    return `/zhihu-ring-api${path}`;
  }
  // 生产环境：路径和查询参数都通过 __path 传给云函数
  const [pathname, qs] = path.split('?');
  const params = new URLSearchParams(qs ?? '');
  params.set('__path', pathname);
  return `${PROXY_URL}?${params.toString()}`;
}
