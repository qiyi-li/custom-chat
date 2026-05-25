import { buildBudgetedMessages } from './contextBudget';
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

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface SendChatCompletionOptions {
  baseUrl?: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
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

function createChatPayload(options: SendChatCompletionOptions, stream: boolean) {
  return {
    model: options.model,
    messages: buildBudgetedMessages(options.messages).map(({ role, content }) => ({ role, content })),
    temperature: 0.7,
    stream,
  };
}

function parseStreamLine(line: string): string {
  const trimmedLine = line.trim();
  if (!trimmedLine || !trimmedLine.startsWith('data:')) {
    return '';
  }

  const payload = trimmedLine.replace(/^data:\s*/, '');
  if (payload === '[DONE]') {
    return '';
  }

  try {
    const chunk = JSON.parse(payload) as ChatCompletionChunk;
    if (chunk.error?.message) {
      throw new Error(chunk.error.message);
    }

    return chunk.choices?.map((choice) => choice.delta?.content ?? choice.message?.content ?? '').join('') ?? '';
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    return '';
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

export async function sendChatCompletion(options: SendChatCompletionOptions): Promise<string> {
  const response = await fetch(`${normalizeBaseUrl(options.baseUrl ?? API_BASE_URL)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createChatPayload(options, false)),
    signal: options.signal,
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

export async function streamChatCompletion(
  options: SendChatCompletionOptions,
  onDelta: (delta: string) => void,
): Promise<string> {
  const response = await fetch(`${normalizeBaseUrl(options.baseUrl ?? API_BASE_URL)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createChatPayload(options, true)),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`对话请求失败：${await parseError(response)}`);
  }

  if (!response.body) {
    const fallback = await response.json() as ChatCompletionResponse;
    const content = fallback.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(fallback.error?.message || '供应商没有返回有效回复');
    }
    onDelta(content);
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const delta = parseStreamLine(line);
      if (delta) {
        fullContent += delta;
        onDelta(delta);
      }
    }
  }

  const remainingDelta = parseStreamLine(buffer);
  if (remainingDelta) {
    fullContent += remainingDelta;
    onDelta(remainingDelta);
  }

  if (!fullContent) {
    throw new Error('供应商没有返回有效回复');
  }

  return fullContent;
}
