import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_APP_INNER_HTML } from './appInnerHtml';
import { mountInvoiceRoverGame, resetInvoiceRoverGameMount } from './shellRuntime';
import '../../styles/game.css';

export function GameView() {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    document.documentElement.classList.add('benji-game-page');
    el.id = 'app';
    el.innerHTML = GAME_APP_INNER_HTML;
    const onClick = (e: MouseEvent) => {
      const t = (e.target as Element | null)?.closest('a.spa-intra-nav');
      if (!t) return;
      e.preventDefault();
      const to = t.getAttribute('href');
      if (to) navigate(to);
    };
    el.addEventListener('click', onClick);
    mountInvoiceRoverGame();
    return () => {
      el.removeEventListener('click', onClick);
      el.innerHTML = '';
      resetInvoiceRoverGameMount();
      document.documentElement.classList.remove('benji-game-page');
    };
  }, [navigate]);

  return <div ref={ref} />;
}
