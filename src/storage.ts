import type { AppConfig, Conversation, PersistedState } from './types';

const STORAGE_KEY = 'web-chat-state-v1';

export const defaultConfig: AppConfig = {
  selectedModel: '',
};

const defaultState: PersistedState = {
  config: defaultConfig,
  conversations: [],
  activeConversationId: null,
};

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>;

    return {
      config: {
        ...defaultConfig,
        ...parsed.config,
      },
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      activeConversationId: parsed.activeConversationId ?? null,
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createConversation(model: string): Conversation {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title: '新对话',
    model,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function getConversationTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return '新对话';
  }

  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}...` : trimmed;
}
