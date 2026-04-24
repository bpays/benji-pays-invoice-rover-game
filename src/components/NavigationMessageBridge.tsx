import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Listens for `postMessage({ type: 'navigate', path: string })` (e.g. iframes or legacy embeds)
 * and performs client-side navigation. Safe: only string paths, same as EmbedFrame.
 */
export function NavigationMessageBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.path === 'string') {
        navigate(e.data.path);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  return null;
}
