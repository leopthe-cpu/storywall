import { useEffect } from 'react';

// Sets the browser tab title for the page it's called from, restoring the
// previous title on unmount so navigating between pages (client-side, no
// reload) never leaves a stale one behind. Pass `null`/`undefined`/'' to
// skip (e.g. while a name is still loading) — the previous title stays.
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
