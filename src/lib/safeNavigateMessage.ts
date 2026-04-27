/**
 * Validators for `postMessage({ type: 'navigate', path })` consumed by
 * NavigationMessageBridge and EmbedFrame. Locks down origin + path so a
 * malicious embedder/iframe can't trigger open-redirect or `javascript:`-style
 * navigation through our SPA router.
 */

const MAX_PATH_LEN = 512;

function parseAllowedOrigins(): string[] {
  const raw = (import.meta.env.VITE_ALLOWED_MESSAGE_ORIGINS as string | undefined) ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string): boolean {
  if (origin === window.location.origin) return true;
  return parseAllowedOrigins().includes(origin);
}

export function isSafeNavPath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > MAX_PATH_LEN) return false;
  // Must start with exactly one `/` — reject `//evil.com` and protocol-relative.
  if (path[0] !== '/' || path[1] === '/') return false;
  // Block `javascript:`, `http:`, `data:`, etc.
  if (path.includes(':')) return false;
  // Reject control characters / newlines.
  if (/[\u0000-\u001F\u007F]/.test(path)) return false;
  return true;
}

export function extractSafeNavPath(e: MessageEvent): string | null {
  if (!isAllowedOrigin(e.origin)) return null;
  const data = e.data;
  if (!data || typeof data !== 'object') return null;
  if ((data as { type?: unknown }).type !== 'navigate') return null;
  const path = (data as { path?: unknown }).path;
  return isSafeNavPath(path) ? path : null;
}
