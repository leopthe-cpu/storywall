import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Provides resolveMediaUrl(value) for the creator: private draft file_uris are
// resolved to short-lived signed URLs (via the resolveDraftMedia backend
// function, which verifies ownership); public http URLs pass through unchanged.
// On the profile (no provider) the default context returns values as-is, so
// published media (public URLs) renders without any resolver.

const DraftMediaContext = createContext({
  resolveMediaUrl: (v) => v,
  retryMedia: () => {},
});

// blob:/data: URIs are local-to-this-tab optimistic previews (e.g. a photo
// shown on the canvas before its upload finishes) — never a stored draft
// file_uri, so they must pass through unresolved just like a public URL.
const isPrivateUri = (v) => typeof v === 'string' && !!v && !/^(https?:|blob:|data:)/i.test(v);
const EXPIRY_MS = 55 * 60 * 1000;        // signed URLs last 1h; treat as fresh for 55min
const REFRESH_BUFFER = 5 * 60 * 1000;   // re-resolve when <5min of validity remains
const REFRESH_INTERVAL = 60 * 1000;     // check for expiring URLs every 60s

export function DraftMediaProvider({ children }) {
  // urlMap: { [file_uri]: { url, expiresAt } }
  const [urlMap, setUrlMap] = useState({});
  const pendingRef = useRef(new Set());
  const inFlightRef = useRef(new Set());

  const resolveMediaUrl = useCallback((value) => {
    if (!isPrivateUri(value)) return value;
    const entry = urlMap[value];
    const now = Date.now();
    if (entry && entry.expiresAt > now + REFRESH_BUFFER) {
      return entry.url;
    }
    // Stale or unknown — schedule resolution, return stale URL if available
    // (keeps the image on screen while the new signed URL is fetched).
    pendingRef.current.add(value);
    return entry?.url || '';
  }, [urlMap]);

  // Flush pending resolution requests after each render. Runs with no dep
  // array so newly-requested uris (added during render) are batched and sent.
  useEffect(() => {
    const now = Date.now();
    const toFetch = [...pendingRef.current].filter(
      (u) => !inFlightRef.current.has(u) && (!urlMap[u] || urlMap[u].expiresAt <= now + REFRESH_BUFFER)
    );
    if (!toFetch.length) return;
    toFetch.forEach((u) => { pendingRef.current.delete(u); inFlightRef.current.add(u); });
    base44.functions.invoke('resolveDraftMedia', { file_uris: toFetch })
      .then((res) => {
        const resolved = res?.data?.resolved || {};
        const ts = Date.now();
        setUrlMap((prev) => {
          const next = { ...prev };
          for (const u of toFetch) {
            if (resolved[u]) next[u] = { url: resolved[u], expiresAt: ts + EXPIRY_MS };
          }
          return next;
        });
      })
      .catch((e) => console.error('[DraftMedia] resolve failed', e))
      .finally(() => toFetch.forEach((u) => inFlightRef.current.delete(u)));
  });

  // Proactive refresh: re-resolve any URL expiring within 2× the buffer so
  // long editing sessions never see blank images.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const expiring = Object.entries(urlMap)
        .filter(([, e]) => e.expiresAt <= now + REFRESH_BUFFER * 2)
        .map(([u]) => u)
        .filter((u) => !inFlightRef.current.has(u));
      if (expiring.length) expiring.forEach((u) => pendingRef.current.add(u));
    }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [urlMap]);

  const retryMedia = useCallback((value) => {
    if (!isPrivateUri(value)) return;
    setUrlMap((prev) => {
      if (!prev[value]) return prev;
      const next = { ...prev };
      delete next[value];
      return next;
    });
    pendingRef.current.add(value);
  }, []);

  return (
    <DraftMediaContext.Provider value={{ resolveMediaUrl, retryMedia }}>
      {children}
    </DraftMediaContext.Provider>
  );
}

export function useDraftMedia() {
  return useContext(DraftMediaContext);
}