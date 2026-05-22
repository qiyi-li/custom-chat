export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const apiKey = env.API_KEY;
    const targetBaseUrl = env.TARGET_BASE_URL;

    if (!apiKey) {
      return jsonResponse({ error: { message: 'Worker 环境变量 ZHISHU_API_KEY 未配置' } }, 500);
    }

    if (!targetBaseUrl) {
      return jsonResponse({ error: { message: 'Worker 环境变量 TARGET_BASE_URL 未配置' } }, 500);
    }

    const incomingUrl = new URL(request.url);
    const normalizedTargetBaseUrl = targetBaseUrl.replace(/\/+$/, '');
    const targetUrl = `${normalizedTargetBaseUrl}${incomingUrl.pathname}${incomingUrl.search}`;
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.delete('host');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    });

    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders.set(key, value));

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
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
