import type { FormEvent } from 'react';

interface MessageComposerProps {
  draft: string;
  isSending: boolean;
  onDraftChange: (draft: string) => void;
  onStop: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function MessageComposer({ draft, isSending, onDraftChange, onStop, onSubmit }: MessageComposerProps) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key.toLowerCase() === 'c' && isSending) {
            event.preventDefault();
            onStop();
            return;
          }

          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="输入消息，Ctrl/Cmd + Enter 发送"
        rows={3}
      />
      {isSending ? (
        <button className="ghost-button send-button stop-button" onClick={onStop} type="button">
          停止
        </button>
      ) : (
        <button className="primary-button send-button" disabled={!draft.trim()} type="submit">
          发送
        </button>
      )}
    </form>
  );
}
