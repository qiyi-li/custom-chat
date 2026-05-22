import type { ChatMessage, ModelInfo } from './types';

interface ModelListResponse {
  data?: Array<{ id?: string; owned_by?: string }>;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export const API_BASE_URL = 'https://chatapiproxy.errgou.workers.dev';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message || body?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function fetchModels(baseUrl = API_BASE_URL): Promise<ModelInfo[]> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`);

  if (!response.ok) {
    throw new Error(`模型列表获取失败：${await parseError(response)}`);
  }

  const body = (await response.json()) as ModelListResponse;
  return (body.data ?? [])
    .filter((model) => Boolean(model.id))
    .map((model) => ({ id: model.id!, ownedBy: model.owned_by }));
}

export async function sendChatCompletion(options: {
  baseUrl?: string;
  model: string;
  messages: ChatMessage[];
}): Promise<string> {
  const response = await fetch(`${normalizeBaseUrl(options.baseUrl ?? API_BASE_URL)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages.map(({ role, content }) => ({ role, content })),
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`对话请求失败：${await parseError(response)}`);
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(body.error?.message || '供应商没有返回有效回复');
  }

  return content;
}
