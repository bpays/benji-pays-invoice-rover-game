import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractSafeNavPath } from '../lib/safeNavigateMessage';

type Props = { src: string; title: string; className?: string };

/**
 * Full-viewport iframe that listens for postMessage `{ type: 'navigate', path: string }`
 * from the embedded child only. Origin, source window, and path are all validated
 * to prevent unrelated frames from steering SPA navigation.
 */
export function EmbedFrame({ src, title, className }: Props) {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // Only accept messages from the iframe we rendered.
      if (e.source !== iframeRef.current?.contentWindow) return;
      const path = extractSafeNavPath(e);
      if (path) navigate(path);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  return (
    <div
      className={className}
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        background: '#002843',
      }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={title}
        allow="autoplay"
      />
    </div>
  );
}
