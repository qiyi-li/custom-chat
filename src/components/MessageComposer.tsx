import type { FormEvent } from 'react';

interface MessageComposerProps {
  draft: string;
  isSending: boolean;
  onDraftChange: (draft: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function MessageComposer({ draft, isSending, onDraftChange, onSubmit }: MessageComposerProps) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="输入消息，Ctrl/Cmd + Enter 发送"
        rows={3}
      />
      <button className="primary-button send-button" disabled={isSending || !draft.trim()} type="submit">
        {isSending ? '发送中' : '发送'}
      </button>
    </form>
  );
}
