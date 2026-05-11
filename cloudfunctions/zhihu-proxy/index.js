/**
 * 知乎 API 统一代理云函数
 *
 * 路由规则（通过 path 参数区分目标）：
 *   path 含 /openapi/ 或 /access_token 或 /user  → openapi.zhihu.com
 *   其余                                           → developer.zhihu.com
 *
 * 前端调用示例：
 *   原来: /zhihu-ring-api/openapi/ring/detail?...
 *   现在: 云函数 HTTP 触发器地址?path=/openapi/ring/detail&...
 */

const https = require('https');

exports.main = async (event) => {
  // 云函数 HTTP 触发器将请求信息放在 event 里
  const httpMethod = (event.httpMethod || 'GET').toUpperCase();
  const queryString = event.queryString || {};
  const headers    = event.headers || {};
  const body       = event.body || '';

  // 从查询参数里取出 __path（前端编码的目标路径），其余参数透传
  const targetPath = queryString.__path || '/';
  const forwardQuery = Object.entries(queryString)
    .filter(([k]) => k !== '__path')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // 根据路径决定目标域名
  const isRingApi =
    targetPath.startsWith('/openapi/') ||
    targetPath === '/access_token'    ||
    targetPath === '/user';
  const targetHost = isRingApi
    ? 'openapi.zhihu.com'
    : 'developer.zhihu.com';

  const fullPath = forwardQuery
    ? `${targetPath}?${forwardQuery}`
    : targetPath;

  // 过滤掉本地 host，避免干扰目标服务器
  const forwardHeaders = Object.fromEntries(
    Object.entries(headers).filter(([k]) =>
      !['host', 'content-length'].includes(k.toLowerCase()),
    ),
  );

  return new Promise((resolve, reject) => {
    const options = {
      hostname: targetHost,
      port: 443,
      path: fullPath,
      method: httpMethod,
      headers: {
        ...forwardHeaders,
        host: targetHost,
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        resolve({
          statusCode: res.statusCode,
          headers: {
            'Content-Type': res.headers['content-type'] || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          },
          body: rawBody,
          isBase64Encoded: false,
        });
      });
    });

    req.on('error', (e) => reject(e));

    if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};
