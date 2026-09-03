// Vercel Hobby serverless proxy. Configure API_KEY and TARGET_BASE_URL
// in the Vercel project settings; never commit the provider key.
export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    setCors(response);
    return response.status(204).end();
  }

  const apiKey = process.env.API_KEY;
  const targetBaseUrl = process.env.TARGET_BASE_URL;
  if (!apiKey || !targetBaseUrl) {
    setCors(response);
    return response.status(500).json({
      error: { message: 'Vercel 环境变量 API_KEY 或 TARGET_BASE_URL 未配置' },
    });
  }

  try {
    const base = new URL(targetBaseUrl);
    const targetPath = base.pathname.replace(/\/+$/, '');
    const incomingUrl = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
    // Read the actual request URL instead of req.query: Vercel's catch-all
    // route parameters are not consistently exposed there across runtimes.
    const requestedPath = incomingUrl.pathname.replace(/^\/api(?:\/|$)/, '/') || '/';
    const path = targetPath.endsWith('/v1') && (requestedPath === '/v1' || requestedPath.startsWith('/v1/'))
      ? requestedPath.slice(3) || '/'
      : requestedPath;

    base.pathname = `${targetPath}/${path.replace(/^\/+/, '')}`.replace(/\/+/g, '/');
    // `path=models` may be injected by the catch-all route. It is only an
    // internal Vercel routing parameter and Air Router rejects unknown params.
    const upstreamQuery = new URLSearchParams(incomingUrl.searchParams);
    upstreamQuery.delete('path');
    base.search = upstreamQuery.toString() ? `?${upstreamQuery.toString()}` : '';

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length' && value) {
        headers.set(key, Array.isArray(value) ? value.join(',') : value);
      }
    }
    // Accept either a raw key (`sk-...`) or a pasted `Bearer sk-...` value.
    // Air Router accepts both Authorization and x-api-key authentication.
    const normalizedApiKey = apiKey.replace(/^Bearer\s+/i, '').trim();
    headers.set('Authorization', `Bearer ${normalizedApiKey}`);
    headers.set('x-api-key', normalizedApiKey);

    const upstream = await fetch(base.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : JSON.stringify(request.body),
    });

    setCors(response);
    response.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) response.setHeader('content-type', contentType);
    return response.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    setCors(response);
    return response.status(502).json({ error: { message: `上游请求失败：${String(error)}` } });
  }
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
