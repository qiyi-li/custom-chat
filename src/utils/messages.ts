import type { ChatMessage, MessageImage } from '../types';

export function createMessage(role: ChatMessage['role'], content: string, images?: MessageImage[]): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    ...(images?.length ? { images } : {}),
    createdAt: Date.now(),
  };
}
