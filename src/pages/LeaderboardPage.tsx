import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/leaderboard.css';
import { supabase } from '../integrations/supabase/client';

const FALLBACK_EVENT_TAG = 'nable-empower-2026';

type Clock = { timezone?: string; seconds_until_reset?: number };

type LbRow = {
  player_name?: string;
  city_flag?: string;
  city_reached?: string;
  best_combo?: number;
  score?: number;
};

type DailyRes = { scores: LbRow[]; run_count?: number; clock?: Clock };
type EventRes = { scores: LbRow[]; submission_count?: number };

const medals = ['🥇', '🥈', '🥉'];
const rClasses = ['r1', 'r2', 'r3'];
const badgeClasses = ['gold', 'silver', 'bronze'];

function useSupaHeaders() {
  const supa = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  return useMemo(
    () => ({
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json' as const,
    }),
    [key]
  );
}

function fmt(s: number) {
  s = Math.max(0, s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const rpcHeaders = useSupaHeaders();
  const supa = import.meta.env.VITE_SUPABASE_URL as string;

  const [activeEventTag, setActiveEventTag] = useState<string>(FALLBACK_EVENT_TAG);
  const [activeBoard, setActiveBoard] = useState<'daily' | 'event'>('daily');
  const [dailyClockTz, setDailyClockTz] = useState('America/New_York');
  const [dailyResetSeconds, setDailyResetSeconds] = useState(0);
  const [scores, setScores] = useState<LbRow[]>([]);
  const [runnerText, setRunnerText] = useState('Loading...');
  const [boardCountText, setBoardCountText] = useState('Top 10 · Resets Daily');
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayerName, setCurrentPlayerName] = useState('');

  useEffect(() => {
    try {
      setCurrentPlayerName((localStorage.getItem('bp_playerName') || '').trim());
    } catch {
      setCurrentPlayerName('');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('benji-leaderboard-page');
    return () => {
      document.documentElement.classList.remove('benji-leaderboard-page');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'active_event')
        .maybeSingle();
      if (!cancelled && data?.value) setActiveEventTag(String(data.value).trim());
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchDailyDashboard = useCallback(async (): Promise<DailyRes> => {
    const res = await fetch(`${supa}/rest/v1/rpc/get_daily_dashboard`, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ p_event_tag: activeEventTag, p_limit: 10 }),
    });
    if (!res.ok) return { scores: [], run_count: 0, clock: { timezone: 'America/New_York', seconds_until_reset: 0 } };
    return res.json();
  }, [rpcHeaders, supa, activeEventTag]);

  const fetchEventDashboard = useCallback(async (): Promise<EventRes> => {
    const res = await fetch(`${supa}/rest/v1/rpc/get_event_dashboard`, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ p_event_tag: activeEventTag, p_limit: 10 }),
    });
    if (!res.ok) return { scores: [], submission_count: 0 };
    return res.json();
  }, [rpcHeaders, supa, activeEventTag]);

  const refreshBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeBoard === 'daily') {
        const data = await fetchDailyDashboard();
        const sc = data.scores || [];
        setScores(sc);
        const count = data.run_count || 0;
        setRunnerText(`${count} runner${count === 1 ? '' : 's'} today`);
        let tz = dailyClockTz;
        if (data.clock) {
          if (typeof data.clock.timezone === 'string') {
            tz = data.clock.timezone;
            setDailyClockTz(data.clock.timezone);
          }
          if (typeof data.clock.seconds_until_reset === 'number') {
            setDailyResetSeconds(data.clock.seconds_until_reset);
          }
        }
        setBoardCountText(`Top ${Math.min(10, sc.length)} · ${tz}`);
        setLoadError(false);
      } else {
        const data = await fetchEventDashboard();
        const sc = data.scores || [];
        setScores(sc);
        const count = data.submission_count || 0;
        setRunnerText(`${count} run${count === 1 ? '' : 's'} (event total)`);
        setBoardCountText(`Top ${Math.min(10, sc.length)} · All time`);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [activeBoard, dailyClockTz, fetchDailyDashboard, fetchEventDashboard]);

  useEffect(() => {
    void refreshBoard();
  }, [activeBoard, refreshBoard]);

  useEffect(() => {
    const t = setInterval(() => {
      if (activeBoard === 'daily' && dailyResetSeconds > 0) {
        setDailyResetSeconds((s) => s - 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [activeBoard, dailyResetSeconds]);

  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refreshBoard();
    }, 120000);
    const onVis = () => {
      if (!document.hidden) void refreshBoard();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshBoard]);

  const { playerRank, playerRow } = useMemo(() => {
    const cp = currentPlayerName.toLowerCase();
    if (!cp || !scores.length) return { playerRank: -1, playerRow: null as LbRow | null };
    let r = -1;
    let row: LbRow | null = null;
    scores.forEach((s, i) => {
      if (s.player_name && s.player_name.toLowerCase() === cp) {
        r = i + 1;
        row = s;
      }
    });
    return { playerRank: r, playerRow: row };
  }, [scores, currentPlayerName]);

  const updateYourRankBlock = useMemo(() => {
    if (!currentPlayerName) {
      return { label: 'Your Rank', text: 'Play to see your rank', showBadge: false, hasRank: false, badge: '' as string };
    }
    if (playerRank > 0 && playerRow) {
      return {
        label: `${currentPlayerName} · ${activeBoard === 'daily' ? 'Today' : 'All-Time'}`,
        text: `$${(playerRow.score || 0).toLocaleString()} · ${playerRow.city_reached || 'Vancouver'}`,
        showBadge: true,
        hasRank: true,
        badge: String(playerRank),
      };
    }
    return {
      label: currentPlayerName,
      text: activeBoard === 'daily' ? 'No runs today — play now!' : 'Play to get on the board!',
      showBadge: false,
      hasRank: false,
      badge: '',
    };
  }, [activeBoard, currentPlayerName, playerRank, playerRow]);

  const onPlayNav = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/game');
  };

  return (
    <>
      <div className="bg">
        <div className="bg-grad" />
        <div className="orb1" />
        <div className="orb2" />
      </div>
      <div className="page">
        <header>
          <div className="header-top">
            <div className="logo-wrap" aria-label="Benji Pays">
              <a href="https://benjipays.com" target="_blank" rel="noopener noreferrer">
                <img className="logo-svg" src="/favicon.png" width={40} height={40} alt="" style={{ objectFit: 'contain' }} />
              </a>
            </div>
            <div className="timer-wrap" id="timerSection" style={{ display: activeBoard === 'daily' ? '' : 'none' }}>
              <div className="timer-lbl">Resets in (EST)</div>
              <div className="timer">
                <span className="pulse" />
                <span>{activeBoard === 'daily' ? fmt(dailyResetSeconds) : ''}</span>
              </div>
            </div>
          </div>
          <div className="title-block">
            <div className="eyebrow">Invoice Rover · High Velocity Fintech Ledger</div>
            <div className="title" id="leaderTitle">
              <span>{activeBoard === 'daily' ? 'Daily' : 'All-Time'}</span>
              <br />
              <span className="acc">Leader</span>board
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="live-pill">
                <span className="pulse" style={{ margin: 0, width: 5, height: 5 }} />
                <span>{runnerText}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="divider" />
        <div className="your-rank-section">
          <a
            className={`play-cta${updateYourRankBlock.hasRank ? ' has-rank' : ''}`}
            href="/game"
            onClick={onPlayNav}
          >
            <div>
              <div className="play-cta-label">{updateYourRankBlock.label}</div>
              <div className="play-cta-text">{updateYourRankBlock.text}</div>
            </div>
            <div
              className="play-cta-rank"
              style={updateYourRankBlock.showBadge ? undefined : { display: 'none' }}
            >
              {updateYourRankBlock.badge ? `#${updateYourRankBlock.badge}` : ''}
            </div>
          </a>
        </div>
        <div className="divider" />
        <div style={{ padding: '16px 20px 0', position: 'relative', zIndex: 2 }}>
          <button type="button" className="inline-cta" onClick={() => navigate('/game')}>
            P(L)AY NOW
          </button>
          <div
            className="board-toggle"
            style={{ marginTop: 14 }}
            role="tablist"
            aria-label="Leaderboard type"
          >
            <button
              type="button"
              className={`toggle-btn${activeBoard === 'daily' ? ' active' : ''}`}
              role="tab"
              aria-selected={activeBoard === 'daily'}
              onClick={() => setActiveBoard('daily')}
            >
              Daily
            </button>
            <button
              type="button"
              className={`toggle-btn${activeBoard === 'event' ? ' active' : ''}`}
              role="tab"
              aria-selected={activeBoard === 'event'}
              onClick={() => setActiveBoard('event')}
            >
              All-Time
            </button>
          </div>
        </div>
        <div className="divider" />
        <div className="board-section">
          <div className="board-hdr">
            <div className="board-title">Top Runners</div>
            <div className="board-count">{boardCountText}</div>
          </div>
          <div className="rank-list">
            {isLoading ? (
              <div className="loading">Loading leaderboard...</div>
            ) : loadError ? (
              <div className="loading">Could not load leaderboard.</div>
            ) : scores.length === 0 ? (
              <div className="empty-state">
                <div className="empty-dog" aria-hidden>
                  🎮
                </div>
                <div className="empty-title">
                  {activeBoard === 'daily' ? 'No runs yet today.' : 'No scores for this event yet.'}
                </div>
                <div className="empty-sub">
                  {activeBoard === 'daily' ? 'Be the first on the board! 🏁' : 'Play a run to land on the event board.'}
                </div>
              </div>
            ) : (
              scores.map((s, i) => {
                const rank = i + 1;
                const isTop3 = rank <= 3;
                const isMe = !!(
                  currentPlayerName && (s.player_name || '').toLowerCase() === currentPlayerName.toLowerCase()
                );
                return (
                  <div
                    key={`${s.player_name}-${i}`}
                    className={`rank-row${rClasses[i] ? ` ${rClasses[i]}` : ''}${isMe ? ' current-player' : ''}`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className={`rank-badge ${isTop3 ? badgeClasses[i] : 'plain'}`}>
                      {isTop3 ? medals[i] : rank}
                    </div>
                    <div className="rank-player">
                      <div className="rank-name">
                        {s.player_name || '—'}
                        {isMe ? (
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--cooper)',
                              fontFamily: 'Barlow, sans-serif',
                              fontWeight: 600,
                            }}
                          >
                            {' '}
                            (You)
                          </span>
                        ) : null}
                      </div>
                      <div className="rank-meta">
                        <span>{s.city_flag || '🇨🇦'}</span>
                        <span>{s.city_reached || 'Vancouver'}</span>
                        <span>· {s.best_combo || 0}× combo</span>
                      </div>
                    </div>
                    <div className="rank-right">
                      <div className="rank-score">{(s.score || 0).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
