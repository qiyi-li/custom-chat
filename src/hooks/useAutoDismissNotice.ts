import { useEffect } from 'react';

export function useAutoDismissNotice(notice: string, clearNotice: () => void, delay = 3000) {
  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(clearNotice, delay);
    return () => window.clearTimeout(timer);
  }, [clearNotice, delay, notice]);
}
