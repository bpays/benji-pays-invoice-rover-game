import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide the inline loading overlay (defined in index.html) once the app is ready.
function hideBenjiLoader() {
  const el = document.getElementById('benji-loading');
  if (!el) return;
  el.classList.add('benji-loading--hidden');
  setTimeout(() => { el.parentNode?.removeChild(el); }, 350);
}

function preload(urls: string[]): Promise<void> {
  return new Promise((resolve) => {
    let remaining = urls.length;
    if (!remaining) return resolve();
    const done = () => { if (--remaining <= 0) resolve(); };
    urls.forEach((src) => {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = src;
    });
  });
}

const path = window.location.pathname;
const isGame = path === '/' || path === '/game' || path === '/game/';

if (isGame) {
  const critical = [
    '/game/assets/ui/logo-white.svg',
    '/game/assets/ui/how-to-play.png',
    '/game/assets/powerups/shield.png',
    '/game/assets/powerups/instant-pay.png',
    '/game/assets/powerups/power-up-label.png',
  ];
  const timeout = new Promise<void>((r) => setTimeout(r, 2500));
  Promise.race([preload(critical), timeout]).then(hideBenjiLoader);
} else {
  requestAnimationFrame(() => requestAnimationFrame(hideBenjiLoader));
}
