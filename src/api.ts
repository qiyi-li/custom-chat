import { buildBudgetedMessages } from './contextBudget';
import type { ChatMessage, MessageImage, ModelInfo } from './types';

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

interface ImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
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

type ChatPayloadContent = string | Array<{
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}>;

interface GenerateImageOptions {
  model: string;
  prompt: string;
  images: MessageImage[];
  signal?: AbortSignal;
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || '/api';

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

function createMessageContent(message: ChatMessage): ChatPayloadContent {
  if (!message.images?.length) {
    return message.content;
  }

  return [
    ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
    ...message.images.map((image) => ({
      type: 'image_url' as const,
      image_url: {
        url: image.dataUrl,
      },
    })),
  ];
}

function createChatPayload(options: SendChatCompletionOptions, stream: boolean) {
  return {
    model: options.model,
    messages: buildBudgetedMessages(options.messages).map((message) => ({
      role: message.role,
      content: createMessageContent(message),
    })),
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

function imageResultToMessageImage(image: NonNullable<ImageGenerationResponse['data']>[number]): MessageImage {
  const dataUrl = image.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : image.url;

  if (!dataUrl) {
    throw new Error('图片服务没有返回图片数据');
  }

  return {
    id: crypto.randomUUID(),
    name: '生成图片.png',
    type: 'image/png',
    dataUrl,
  };
}

async function imageToBlob(image: MessageImage): Promise<Blob> {
  const response = await fetch(image.dataUrl);
  if (!response.ok) {
    throw new Error(`无法读取参考图片：${image.name}`);
  }

  return response.blob();
}

export async function generateImage(options: GenerateImageOptions): Promise<MessageImage[]> {
  const baseUrl = normalizeBaseUrl(API_BASE_URL);
  const isEdit = options.images.length > 0;
  let response: Response;

  if (isEdit) {
    const formData = new FormData();
    formData.set('model', options.model);
    formData.set('prompt', options.prompt);
    formData.set('response_format', 'b64_json');
    await Promise.all(options.images.map(async (image) => {
      formData.append('image', await imageToBlob(image), image.name);
    }));

    response = await fetch(`${baseUrl}/images/edits`, {
      method: 'POST',
      body: formData,
      signal: options.signal,
    });
  } else {
    response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        prompt: options.prompt,
        response_format: 'b64_json',
      }),
      signal: options.signal,
    });
  }

  if (!response.ok) {
    throw new Error(`图片${isEdit ? '编辑' : '生成'}失败：${await parseError(response)}`);
  }

  const body = (await response.json()) as ImageGenerationResponse;
  if (body.error?.message) {
    throw new Error(body.error.message);
  }

  const images = body.data?.map(imageResultToMessageImage) ?? [];
  if (!images.length) {
    throw new Error('图片服务没有返回图片数据');
  }

  return images;
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
