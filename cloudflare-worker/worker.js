/**
 * 知乎 API 代理 · Cloudflare Worker
 *
 * 路由规则（通过 __path 参数区分目标）：
 *   /openapi/*    → openapi.zhihu.com
 *   /access_token → openapi.zhihu.com  (OAuth)
 *   /user         → openapi.zhihu.com  (OAuth)
 *   /api/*        → developer.zhihu.com (热榜)
 *
 * 前端调用示例：
 *   https://your-worker.workers.dev?__path=/openapi/ring/detail&ring_id=xxx
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default {
  async fetch(request) {
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const targetPath = url.searchParams.get('__path') || '/';

    // 决定目标域名
    const isRingOrOAuth =
      targetPath.startsWith('/openapi/') ||
      targetPath === '/access_token' ||
      targetPath === '/user';
    const targetHost = isRingOrOAuth ? 'openapi.zhihu.com' : 'developer.zhihu.com';

    // 去掉 __path，剩余参数原样转发
    url.searchParams.delete('__path');
    const qs = url.searchParams.toString();
    const fullPath = qs ? `${targetPath}?${qs}` : targetPath;

    const targetUrl = `https://${targetHost}${fullPath}`;

    // 过滤掉 host / cf-* 等不应转发的头
    const skipHeaders = new Set(['host', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor']);
    const forwardHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      if (!skipHeaders.has(k.toLowerCase())) {
        forwardHeaders.set(k, v);
      }
    }
    forwardHeaders.set('host', targetHost);

    const proxyReq = new Request(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });

    const resp = await fetch(proxyReq);

    // 透传响应，附加 CORS 头
    const respHeaders = new Headers(resp.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      respHeaders.set(k, v);
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    });
  },
};
