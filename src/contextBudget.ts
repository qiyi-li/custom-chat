import type { ChatMessage } from './types';

const MAX_CONTEXT_CHARACTERS = 6000;
const RECENT_MESSAGE_COUNT = 10;
const SUMMARY_MAX_CHARACTERS = 1800;

function estimateMessageSize(message: ChatMessage): number {
  return message.content.length + message.role.length + 16;
}

function formatSummaryLine(message: ChatMessage): string {
  const speaker = message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : '系统';
  return `${speaker}: ${message.content.trim()}`;
}

function createHistorySummary(messages: ChatMessage[]): ChatMessage | null {
  if (messages.length === 0) {
    return null;
  }

  const lines: string[] = [];
  let usedCharacters = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const line = formatSummaryLine(messages[index]);
    const lineSize = line.length + 1;

    if (usedCharacters + lineSize > SUMMARY_MAX_CHARACTERS) {
      break;
    }

    lines.unshift(line);
    usedCharacters += lineSize;
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    id: 'context-summary',
    role: 'system',
    content: [
      '以下是较早对话的压缩摘要，仅用于保持上下文连续，不要逐字复述：',
      ...lines,
    ].join('\n'),
    createdAt: Date.now(),
  };
}

export function buildBudgetedMessages(messages: ChatMessage[]): ChatMessage[] {
  const recentMessages = messages.slice(-RECENT_MESSAGE_COUNT);
  const olderMessages = messages.slice(0, -RECENT_MESSAGE_COUNT);
  const summaryMessage = createHistorySummary(olderMessages);
  const budgetedMessages = summaryMessage ? [summaryMessage, ...recentMessages] : [...recentMessages];

  let usedCharacters = 0;
  const result: ChatMessage[] = [];

  for (let index = budgetedMessages.length - 1; index >= 0; index -= 1) {
    const message = budgetedMessages[index];
    const messageSize = estimateMessageSize(message);

    if (result.length > 0 && usedCharacters + messageSize > MAX_CONTEXT_CHARACTERS) {
      continue;
    }

    result.unshift(message);
    usedCharacters += messageSize;
  }

  return result;
}
