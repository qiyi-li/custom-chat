import type { ChatMessage } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function MessageList({ messages, isSending, messagesEndRef }: MessageListProps) {
  return (
    <div className="messages">
      {messages.length === 0 && (
        <div className="welcome-card">
          <h2>开始聊天</h2>
          <p>服务配置由 Cloudflare Worker 托管，模型选择和全部对话历史会保存在当前浏览器本地。</p>
        </div>
      )}

      {messages.map((message) => (
        <article className={`message ${message.role}`} key={message.id}>
          <div className="avatar">{message.role === 'user' ? '你' : 'AI'}</div>
          <div className="bubble">{message.content}</div>
        </article>
      ))}

      {isSending && (
        <article className="message assistant">
          <div className="avatar">AI</div>
          <div className="bubble typing">正在思考...</div>
        </article>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
