import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = { src: string; title: string; className?: string };

/**
 * Full-viewport iframe that listens for postMessage `{ type: 'navigate', path: string }`
 * (used by embedded public/*.html UIs to navigate the SPA without full page reloads).
 */
export function EmbedFrame({ src, title, className }: Props) {
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
        src={src}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={title}
        allow="autoplay"
      />
    </div>
  );
}
