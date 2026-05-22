import type { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  editingConversationId: string | null;
  editingTitle: string;
  isCollapsed: boolean;
  onCancelEdit: () => void;
  onCreateConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onEditTitleChange: (title: string) => void;
  onSaveTitle: () => void;
  onSelectConversation: (conversationId: string) => void;
  onStartEdit: (conversation: Conversation) => void;
  onToggleCollapse: () => void;
}

export function Sidebar({
  conversations,
  activeConversationId,
  editingConversationId,
  editingTitle,
  isCollapsed,
  onCancelEdit,
  onCreateConversation,
  onDeleteConversation,
  onEditTitleChange,
  onSaveTitle,
  onSelectConversation,
  onStartEdit,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand">
          <span className="brand-mark">W</span>
          <div className="brand-text">
            <strong>Web Chat</strong>
            <small>本地历史记录</small>
          </div>
        </div>
      </div>

      <button className="primary-button new-chat-button" onClick={onCreateConversation}>新建对话</button>

      <div className="history-list">
        {conversations.length === 0 && <p className="empty-tip">暂无历史对话</p>}
        {conversations.map((conversation) => {
          const isEditing = editingConversationId === conversation.id;

          return (
            <div
              className={`history-item ${conversation.id === activeConversationId ? 'active' : ''} ${isEditing ? 'editing' : ''}`}
              key={conversation.id}
              onClick={() => {
                if (!isEditing) {
                  onSelectConversation(conversation.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              {isEditing ? (
                <input
                  autoFocus
                  className="history-title-input"
                  value={editingTitle}
                  onBlur={onSaveTitle}
                  onChange={(event) => onEditTitleChange(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onSaveTitle();
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onCancelEdit();
                    }
                  }}
                />
              ) : (
                <>
                  <span onDoubleClick={(event) => {
                    event.stopPropagation();
                    onStartEdit(conversation);
                  }}>
                    {conversation.title}
                  </span>
                  <small>{conversation.model || '未选择模型'}</small>
                  <button
                    aria-label="编辑对话名称"
                    className="history-action edit-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartEdit(conversation);
                    }}
                    type="button"
                  >
                    ✎
                  </button>
                  <button
                    aria-label="删除对话"
                    className="history-action delete-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="icon-button sidebar-toggle"
        aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        onClick={onToggleCollapse}
        type="button"
      >
        {isCollapsed ? '›' : '‹'}
      </button>
    </aside>
  );
}
