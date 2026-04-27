import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractSafeNavPath } from '@/lib/safeNavigateMessage';

/**
 * Listens for `postMessage({ type: 'navigate', path: string })` and performs
 * client-side navigation. Origin + path are validated in extractSafeNavPath
 * to prevent open-redirect / `javascript:`-style abuse from third-party frames.
 */
export function NavigationMessageBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const path = extractSafeNavPath(e);
      if (path) navigate(path);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  return null;
}
