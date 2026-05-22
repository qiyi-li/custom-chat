import type { ChatMessage } from '../types';

export function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
  };
}
