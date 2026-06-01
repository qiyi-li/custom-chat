export type Role = 'user' | 'assistant' | 'system';

export interface MessageImage {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  images?: MessageImage[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AppConfig {
  selectedModel: string;
}

export interface ModelInfo {
  id: string;
  ownedBy?: string;
}

export interface PersistedState {
  config: AppConfig;
  conversations: Conversation[];
  activeConversationId: string | null;
}
