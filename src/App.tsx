import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL, fetchModels, sendChatCompletion } from './api';
import { createConversation, getConversationTitle, loadState, saveState } from './storage';
import type { ChatMessage, Conversation, ModelInfo, PersistedState } from './types';

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
  };
}

function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [draft, setDraft] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? null,
    [state.activeConversationId, state.conversations],
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, isSending]);

  useEffect(() => {
    void loadModels(false);
  }, []);

  async function loadModels(showSuccess = true) {
    setIsLoadingModels(true);
    setNotice('');

    try {
      const nextModels = await fetchModels();
      setModels(nextModels);
      const hasSelectedModel = nextModels.some((model) => model.id === state.config.selectedModel);
      const selectedModel = hasSelectedModel ? state.config.selectedModel : nextModels[0]?.id ?? '';

      setState((current) => ({
        ...current,
        config: {
          ...current.config,
          selectedModel,
        },
      }));

      if (showSuccess) {
        setNotice(nextModels.length ? '模型列表已刷新。' : '模型列表为空，请检查供应商配置。');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '模型列表获取失败。');
    } finally {
      setIsLoadingModels(false);
    }
  }

  function updateStateWithConversations(conversations: Conversation[], activeConversationId = state.activeConversationId) {
    setState((current) => ({
      ...current,
      conversations,
      activeConversationId,
    }));
  }

  function handleNewConversation() {
    const conversation = createConversation(state.config.selectedModel);
    updateStateWithConversations([conversation, ...state.conversations], conversation.id);
  }

  function handleDeleteConversation(conversationId: string) {
    const nextConversations = state.conversations.filter((conversation) => conversation.id !== conversationId);
    const nextActiveId = state.activeConversationId === conversationId ? nextConversations[0]?.id ?? null : state.activeConversationId;
    updateStateWithConversations(nextConversations, nextActiveId);
  }

  function handleModelChange(model: string) {
    setState((current) => ({
      ...current,
      config: {
        ...current.config,
        selectedModel: model,
      },
    }));
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();

    if (!content || isSending) {
      return;
    }

    if (!state.config.selectedModel) {
      setNotice('请先选择模型。');
      return;
    }

    const currentConversation = activeConversation ?? createConversation(state.config.selectedModel);
    const userMessage = createMessage('user', content);
    const updatedConversation: Conversation = {
      ...currentConversation,
      model: state.config.selectedModel,
      title: currentConversation.messages.length ? currentConversation.title : getConversationTitle(content),
      messages: [...currentConversation.messages, userMessage],
      updatedAt: Date.now(),
    };
    const withoutCurrent = state.conversations.filter((conversation) => conversation.id !== updatedConversation.id);

    setDraft('');
    setNotice('');
    setIsSending(true);
    setState((current) => ({
      ...current,
      conversations: [updatedConversation, ...withoutCurrent],
      activeConversationId: updatedConversation.id,
    }));

    try {
      const reply = await sendChatCompletion({
        model: state.config.selectedModel,
        messages: updatedConversation.messages,
      });
      const assistantMessage = createMessage('assistant', reply);
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === updatedConversation.id
            ? {
                ...conversation,
                messages: [...conversation.messages, assistantMessage],
                updatedAt: Date.now(),
              }
            : conversation,
        ),
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '发送失败，请稍后重试。');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <div>
            <strong>Web Chat</strong>
            <small>本地历史记录</small>
          </div>
        </div>

        <button className="primary-button" onClick={handleNewConversation}>新建对话</button>

        <div className="history-list">
          {state.conversations.length === 0 && <p className="empty-tip">暂无历史对话</p>}
          {state.conversations.map((conversation) => (
            <button
              className={`history-item ${conversation.id === state.activeConversationId ? 'active' : ''}`}
              key={conversation.id}
              onClick={() => setState((current) => ({ ...current, activeConversationId: conversation.id }))}
            >
              <span>{conversation.title}</span>
              <small>{conversation.model || '未选择模型'}</small>
              <b
                aria-label="删除对话"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteConversation(conversation.id);
                }}
              >
                ×
              </b>
            </button>
          ))}
        </div>

        <button className="ghost-button" onClick={() => setIsConfigOpen(true)}>
          查看服务配置
        </button>
      </aside>

      <section className="chat-panel">
        <header className="topbar">
          <div>
            <h1>{activeConversation?.title ?? '开始新的对话'}</h1>
            <p>服务商和 API Key 已由 Cloudflare Worker 托管，选择模型即可对话</p>
          </div>
          <div className="model-controls">
            <select value={state.config.selectedModel} onChange={(event) => handleModelChange(event.target.value)}>
              <option value="">选择模型</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>{model.id}</option>
              ))}
            </select>
            <button className="ghost-button compact" disabled={isLoadingModels} onClick={() => void loadModels()}>
              {isLoadingModels ? '加载中' : '刷新模型'}
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        <div className="messages">
          {!activeConversation?.messages.length && (
            <div className="welcome-card">
              <h2>开始聊天</h2>
              <p>服务配置由 Cloudflare Worker 托管，模型选择和全部对话历史会保存在当前浏览器本地。</p>
            </div>
          )}

          {activeConversation?.messages.map((message) => (
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

        <form className="composer" onSubmit={handleSend}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="输入消息，Enter 换行，点击发送提交"
            rows={3}
          />
          <button className="primary-button" disabled={isSending || !draft.trim()} type="submit">
            {isSending ? '发送中' : '发送'}
          </button>
        </form>
      </section>

      {isConfigOpen && (
        <div className="modal-backdrop">
          <div className="config-modal">
            <h2>服务配置</h2>
            <p>前端只请求你的 Cloudflare Worker，真实供应商地址和 API Key 请配置在 Worker 环境变量中。</p>
            <label>
              当前代理地址
              <input value={API_BASE_URL} readOnly />
            </label>
            <div className="modal-actions">
              <button className="primary-button" type="button" onClick={() => setIsConfigOpen(false)}>知道了</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
