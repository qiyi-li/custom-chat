import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchModels, streamChatCompletion } from './api';
import { ChatHeader } from './components/ChatHeader';
import { MessageComposer } from './components/MessageComposer';
import { MessageList } from './components/MessageList';
import { Sidebar } from './components/Sidebar';
import { useAutoDismissNotice } from './hooks/useAutoDismissNotice';
import { createConversation, getConversationTitle, loadState, saveState } from './storage';
import type { Conversation, ModelInfo, PersistedState } from './types';
import { createMessage } from './utils/messages';

function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [draft, setDraft] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? null,
    [state.activeConversationId, state.conversations],
  );

  const clearNotice = useCallback(() => setNotice(''), []);
  useAutoDismissNotice(notice, clearNotice);

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

  function handleSelectConversation(conversationId: string) {
    setState((current) => ({ ...current, activeConversationId: conversationId }));
  }

  function startEditingConversation(conversation: Conversation) {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  }

  function saveConversationTitle() {
    const title = editingTitle.trim();
    if (!editingConversationId) {
      return;
    }

    setState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === editingConversationId
          ? { ...conversation, title: title || '新对话', updatedAt: Date.now() }
          : conversation,
      ),
    }));
    setEditingConversationId(null);
    setEditingTitle('');
  }

  function cancelConversationTitleEdit() {
    setEditingConversationId(null);
    setEditingTitle('');
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

  function handleStopGeneration() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSending(false);
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

    const assistantMessage = createMessage('assistant', '');
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

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await streamChatCompletion(
        {
          model: state.config.selectedModel,
          messages: updatedConversation.messages,
          signal: abortController.signal,
        },
        (delta) => {
          setState((current) => ({
            ...current,
            conversations: current.conversations.map((conversation) =>
              conversation.id === updatedConversation.id
                ? {
                    ...conversation,
                    messages: conversation.messages.map((message) =>
                      message.id === assistantMessage.id
                        ? { ...message, content: `${message.content}${delta}` }
                        : message,
                    ),
                    updatedAt: Date.now(),
                  }
                : conversation,
            ),
          }));
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setState((current) => ({
        ...current,
        conversations: current.conversations.map((conversation) =>
          conversation.id === updatedConversation.id
            ? {
                ...conversation,
                messages: conversation.messages.filter((message) => message.id !== assistantMessage.id || message.content),
                updatedAt: Date.now(),
              }
            : conversation,
        ),
      }));
      setNotice(error instanceof Error ? error.message : '发送失败，请稍后重试。');
    } finally {
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }

  return (
    <main className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        conversations={state.conversations}
        activeConversationId={state.activeConversationId}
        editingConversationId={editingConversationId}
        editingTitle={editingTitle}
        isCollapsed={isSidebarCollapsed}
        onCancelEdit={cancelConversationTitleEdit}
        onCreateConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onEditTitleChange={setEditingTitle}
        onSaveTitle={saveConversationTitle}
        onSelectConversation={handleSelectConversation}
        onStartEdit={startEditingConversation}
        onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
      />

      <section className="chat-panel">
        <ChatHeader
          title={activeConversation?.title ?? '开始新的对话'}
          models={models}
          selectedModel={state.config.selectedModel}
          isLoadingModels={isLoadingModels}
          onModelChange={handleModelChange}
          onRefreshModels={() => void loadModels()}
        />

        {notice && <div className="notice">{notice}</div>}

        <MessageList
          messages={activeConversation?.messages ?? []}
          isSending={isSending}
          messagesEndRef={messagesEndRef}
        />

        <MessageComposer
          draft={draft}
          isSending={isSending}
          onDraftChange={setDraft}
          onStop={handleStopGeneration}
          onSubmit={handleSend}
        />
      </section>
    </main>
  );
}

export default App;
