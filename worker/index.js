export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const apiKey = env.API_KEY;
    const targetBaseUrl = env.TARGET_BASE_URL;

    if (!targetBaseUrl) {
      return jsonResponse({ error: { message: 'Worker 环境变量 TARGET_BASE_URL 未配置' } }, 500);
    }
    if (!apiKey) {
      return jsonResponse({ error: { message: 'Worker 环境变量 API_KEY 未配置' } }, 500);
    }

    try {
      const incomingUrl = new URL(request.url);
      const targetUrl = new URL(targetBaseUrl);
      const targetPath = targetUrl.pathname.replace(/\/+$/, '');
      let incomingPath = incomingUrl.pathname;

      // The frontend may call either /models or /v1/models. Avoid /v1/v1/models.
      if (targetPath.endsWith('/v1') && (incomingPath === '/v1' || incomingPath.startsWith('/v1/'))) {
        incomingPath = incomingPath.slice(3) || '/';
      }

      targetUrl.pathname = `${targetPath}/${incomingPath.replace(/^\/+/, '')}`.replace(/\/+/g, '/');
      targetUrl.search = incomingUrl.search;

      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${apiKey}`);
      headers.delete('host');

      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        signal: AbortSignal.timeout(15000),
      });

      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders.set(key, value));
      return new Response(response.body, { status: response.status, headers: responseHeaders });
    } catch (error) {
      return jsonResponse({ error: { message: `上游请求失败：${String(error)}` } }, 502);
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    },
  });
}
