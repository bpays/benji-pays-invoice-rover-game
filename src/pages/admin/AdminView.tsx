import { useCallback, useEffect, useMemo, useState } from 'react';
import { lovable } from '../../integrations/lovable/index';
import { supabase } from '../../integrations/supabase/client';
import type { Database } from '../../integrations/supabase/types';
import {
  getTotpFactors,
  inviteEdgeFn,
  restApi,
  SUPA_KEY,
  SUPA_URL,
} from './adminApi';
import './adminPage.css';

type Score = Database['public']['Tables']['scores']['Row'];
type Screen = 'login' | 'mfaEnroll' | 'mfaVerify' | 'app';

const PAGE_SIZE = 25;
const ALLOWED = 'benjipays.com';
const EVENTS: Record<string, { label: string; tag: string | null }> = {
  all: { label: 'All Events', tag: null },
  'nable-empower-2026': { label: 'N-able Empower 2026', tag: 'nable-empower-2026' },
};

function validateDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() === ALLOWED;
}

type AdminListEntry = {
  user_id: string;
  email: string;
  roles: string[];
  status?: string;
  created_at: string;
};

function toastMsg(msg: string, kind: 'ok' | 'err' = 'ok') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `show ${kind === 'ok' ? 'ok' : 'err'}`;
  setTimeout(() => {
    t.className = '';
  }, 2500);
}

export function AdminView() {
  const [screen, setScreen] = useState<Screen>('login');
  const [loginError, setLoginError] = useState('');
  const [mfaEnrollErr, setMfaEnrollErr] = useState('');
  const [mfaVerifyErr, setMfaVerifyErr] = useState('');
  const [timezoneErr, setTimezoneErr] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaQr, setMfaQr] = useState('');
  const [mfaSecret, setMfaSecret] = useState('—');
  const [mfaEnrollCode, setMfaEnrollCode] = useState('');
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');

  const [currentEventKey, setCurrentEventKey] = useState('nable-empower-2026');
  const [boardMode, setBoardMode] = useState<'event' | 'daily'>('event');
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [filteredScores, setFilteredScores] = useState<Score[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [search, setSearch] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
  const [hideZero, setHideZero] = useState(true);

  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    active: 0,
    leads: 0,
    avg: 0,
    topScore: 0,
    topName: '—',
    topCity: '—',
  });

  const [editing, setEditing] = useState<{ id: string; name: string; score: number } | null>(null);
  const [editName, setEditName] = useState('');
  const [editScore, setEditScore] = useState(0);

  const [timezoneVal, setTimezoneVal] = useState('America/New_York');
  const [inviteEmail, setInviteEmail] = useState('');

  const [admins, setAdmins] = useState<AdminListEntry[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const redirectUri = useMemo(() => `${window.location.origin}/admin/`, []);

  const runFilter = useCallback(
    (data: Score[]) => {
      const q = search.toLowerCase();
      const next = data.filter((s) => {
        if (!showFlagged && s.flagged) return false;
        if (hideZero && s.score === 0) return false;
        if (
          q &&
          !s.player_name?.toLowerCase().includes(q) &&
          !s.email?.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });
      setFilteredScores(next);
      setCurrentPage(0);
    },
    [search, showFlagged, hideZero]
  );

  const eventParams = useCallback(() => {
    const ev = EVENTS[currentEventKey];
    return ev.tag ? `event_tag=eq.${ev.tag}` : '';
  }, [currentEventKey]);

  const loadStats = useCallback(
    async (dataOverride?: Score[]) => {
      const ep = eventParams();
      let data = dataOverride;
      if (!data) {
        const d = (await restApi('GET', 'scores', null, `select=id,score,email,city_reached,player_name,created_at,flagged${ep ? `&${ep}` : ''}&order=score.desc`)) as Score[] | null;
        if (!d) return;
        data = d;
      }
      if (!data.length) {
        setStats((s) => ({
          ...s,
          total: 0,
          today: 0,
          active: 0,
          leads: 0,
          avg: 0,
          topScore: 0,
          topName: '—',
          topCity: '—',
        }));
        return;
      }
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const fifteenAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const todayRuns = data.filter((x) => new Date(x.created_at || 0) >= today).length;
      const active = data.filter((x) => new Date(x.created_at || 0) >= fifteenAgo).length;
      const leads = new Set(data.map((s) => s.email).filter(Boolean)).size;
      const nonZero = data.filter((s) => s.score > 0);
      const avg = nonZero.length
        ? Math.round(nonZero.reduce((a, b) => a + b.score, 0) / nonZero.length)
        : 0;
      const top = data[0];
      const cities: Record<string, number> = {};
      data.forEach((s) => {
        if (s.city_reached && s.score > 0) {
          cities[s.city_reached] = (cities[s.city_reached] || 0) + 1;
        }
      });
      const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0];
      setStats({
        total: data.length,
        today: todayRuns,
        active,
        leads,
        avg,
        topScore: top?.score || 0,
        topName: top?.player_name || '—',
        topCity: topCity ? topCity[0] : '—',
      });
    },
    [eventParams]
  );

  const loadScores = useCallback(async () => {
    if (boardMode === 'daily') {
      const now = new Date();
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const y = et.getFullYear();
      const m = String(et.getMonth() + 1).padStart(2, '0');
      const d = String(et.getDate()).padStart(2, '0');
      const dayStart = `${y}-${m}-${d}T00:00:00-04:00`;
      const ev = EVENTS[currentEventKey];
      let p = `created_at=gte.${encodeURIComponent(dayStart)}`;
      if (ev.tag) p += `&event_tag=eq.${encodeURIComponent(ev.tag)}`;
      const data = (await restApi(
        'GET',
        'scores',
        null,
        `select=id,player_name,email,score,city_reached,city_flag,best_combo,flagged,event_tag,created_at&${p}&order=score.desc&limit=500`
      )) as Score[] | null;
      setAllScores(data || []);
      runFilter(data || []);
      return;
    }
    const ep = eventParams();
    const data = (await restApi(
      'GET',
      'scores',
      null,
      `select=id,player_name,email,score,city_reached,city_flag,best_combo,flagged,event_tag,created_at${ep ? `&${ep}` : ''}&order=score.desc`
    )) as Score[] | null;
    if (!data) {
      setAllScores([]);
      runFilter([]);
      return;
    }
    setAllScores(data);
    runFilter(data);
  }, [boardMode, currentEventKey, eventParams, runFilter]);

  const loadAll = useCallback(async () => {
    const ep = eventParams();
    const st = (await restApi(
      'GET',
      'scores',
      null,
      `select=id,score,email,city_reached,player_name,created_at,flagged${ep ? `&${ep}` : ''}&order=score.desc`
    )) as Score[] | null;
    if (st) await loadStats(st);
    await loadScores();
  }, [eventParams, loadStats, loadScores]);

  const loadTimezone = useCallback(async () => {
    const res = (await restApi('GET', 'settings', null, 'key=eq.leaderboard_timezone&select=value')) as
      | { value: string }[]
      | null;
    if (!res?.[0]) {
      setTimezoneVal('America/New_York');
      return;
    }
    setTimezoneVal(String(res[0].value).trim() || 'America/New_York');
  }, []);

  const loadAdminList = useCallback(async () => {
    const res = await inviteEdgeFn({ action: 'list' });
    if (res.error || !Array.isArray(res.admins)) {
      return;
    }
    setAdmins(res.admins as AdminListEntry[]);
    const { data: u } = await supabase.auth.getUser();
    setMyUserId(u.user?.id ?? null);
  }, []);

  const enterApp = useCallback(async () => {
    setScreen('app');
    try {
      await loadTimezone();
      await loadAdminList();
    } catch (e) {
      console.error(e);
      toastMsg('Dashboard data failed to load', 'err');
    }
  }, [loadAdminList, loadTimezone]);

  useEffect(() => {
    if (screen !== 'app') return;
    void loadAll();
  }, [screen, currentEventKey, boardMode, loadAll]);

  const startMfaEnrollment = useCallback(async () => {
    const fname = `TOTP-${Date.now()}`;
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: fname });
    if (error) {
      setMfaEnrollErr(error.message);
      return;
    }
    setMfaFactorId(data.id);
    setMfaQr((data as { totp: { qr_code: string; secret: string } }).totp.qr_code);
    setMfaSecret((data as { totp: { secret: string } }).totp.secret);
    setMfaEnrollErr('');
    setScreen('mfaEnroll');
  }, []);

  const handleMfaFlow = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      await enterApp();
      return;
    }
    const totpFactors = getTotpFactors(
      data as { totp?: { id: string; status: string; factor_type: string }[]; all?: { id: string; status: string; factor_type: string }[] }
    );
    const verified = totpFactors.filter((f) => f.status === 'verified');
    const unverified = totpFactors.filter((f) => f.status === 'unverified');
    if (verified.length > 0) {
      setMfaFactorId(verified[0].id);
      setMfaVerifyCode('');
      setMfaVerifyErr('');
      setScreen('mfaVerify');
      return;
    }
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    await startMfaEnrollment();
  }, [enterApp, startMfaEnrollment]);

  const handleOAuthSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const email = session.user.email || '';
    if (!validateDomain(email)) {
      setLoginError('Access restricted to @benjipays.com accounts only');
      await supabase.auth.signOut();
      return;
    }
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin');
    if (roles && roles.length > 0) {
      await handleMfaFlow();
      return;
    }
    try {
      const claimRes = await fetch(`${SUPA_URL}/functions/v1/admin-invite`, {
        method: 'POST',
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'claim' }),
      });
      const claimData = (await claimRes.json()) as { success?: boolean };
      if (claimData.success) {
        await handleMfaFlow();
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setLoginError('Access denied — no admin invite found for this account');
    await supabase.auth.signOut();
  }, [handleMfaFlow]);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user.app_metadata?.provider === 'google') {
          await handleOAuthSession();
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [handleOAuthSession]);

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          if (session.user.app_metadata?.provider === 'google') return;
          if (!validateDomain(session.user.email || '')) {
            await supabase.auth.signOut();
            return;
          }
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'admin');
          if (roles && roles.length > 0) {
            const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
              const { data: fac } = await supabase.auth.mfa.listFactors();
              const v = getTotpFactors(
                fac as { totp?: { id: string; status: string; factor_type: string }[]; all?: { id: string; status: string; factor_type: string }[] }
              ).filter((f) => f.status === 'verified');
              if (v.length > 0) {
                setMfaFactorId(v[0].id);
                setScreen('mfaVerify');
                return;
              }
            } else if (aal && aal.currentLevel === 'aal2') {
              await enterApp();
              return;
            }
            await supabase.auth.signOut();
          } else {
            await supabase.auth.signOut();
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [enterApp]);

  const googleSignIn = async () => {
    setLoginError('');
    const errEl = setLoginError;
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: redirectUri,
        extraParams: { hd: 'benjipays.com' },
      });
      if (result.error) {
        errEl(result.error instanceof Error ? result.error.message : 'Google sign-in failed');
        return;
      }
      if (result.redirected) return;
      if ('tokens' in result && result.tokens) {
        await supabase.auth.setSession(result.tokens);
      }
      await handleOAuthSession();
    } catch (e) {
      errEl('Sign-in could not be completed. Try again.');
    }
  };

  const verifyEnrollment = async () => {
    setMfaEnrollErr('');
    const code = mfaEnrollCode.trim();
    if (!code || code.length !== 6 || !/^[0-9]{6}$/.test(code)) {
      setMfaEnrollErr('Enter a valid 6-digit code');
      return;
    }
    if (!mfaFactorId) {
      setMfaEnrollErr('MFA setup expired — sign in again');
      return;
    }
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (cErr) {
      setMfaEnrollErr('Challenge failed');
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: ch.id,
      code,
    });
    if (vErr) {
      setMfaEnrollErr('Verification failed');
      return;
    }
    toastMsg('MFA enabled');
    await enterApp();
  };

  const verifyMfa = async () => {
    setMfaVerifyErr('');
    const code = mfaVerifyCode.trim();
    if (!code || !/^[0-9]{6}$/.test(code)) {
      setMfaVerifyErr('Enter a valid 6-digit code');
      return;
    }
    if (!mfaFactorId) {
      setMfaVerifyErr('MFA session expired');
      return;
    }
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (cErr) {
      setMfaVerifyErr('Challenge failed');
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: ch.id,
      code,
    });
    if (vErr) {
      setMfaVerifyErr('Invalid code');
      return;
    }
    await enterApp();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setScreen('login');
    window.location.reload();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const n = editName.trim();
    const s = Math.floor(Number(editScore));
    if (!n) {
      toastMsg('Name required', 'err');
      return;
    }
    const res = await restApi('PATCH', 'scores', { player_name: n, score: s }, `id=eq.${editing.id}`);
    if (res) {
      setEditing(null);
      toastMsg('Score updated');
      await loadAll();
    } else toastMsg('Update failed', 'err');
  };

  const openEdit = (r: Score) => {
    setEditName(r.player_name || '');
    setEditScore(r.score);
    setEditing({ id: r.id, name: r.player_name || '', score: r.score });
  };

  const evLabel = EVENTS[currentEventKey]?.label || '—';

  useEffect(() => {
    if (screen !== 'app') return;
    runFilter(allScores);
  }, [allScores, screen, runFilter, search, showFlagged, hideZero]);

  useEffect(() => {
    if (screen !== 'app') return;
    const t = setInterval(() => {
      const ep = eventParams();
      void (async () => {
        const data = (await restApi(
          'GET',
          'scores',
          null,
          `select=id,score,email,city_reached,player_name,created_at,flagged${ep ? `&${ep}` : ''}&order=score.desc`
        )) as Score[] | null;
        if (data) await loadStats(data);
      })();
    }, 60000);
    return () => clearInterval(t);
  }, [eventParams, loadStats, screen]);

  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const page = filteredScores.slice(start, end);
  const totalF = filteredScores.length;

  const onResetEvent = async () => {
    if (currentEventKey === 'all') {
      toastMsg('Select a specific event in the header', 'err');
      return;
    }
    const ev = EVENTS[currentEventKey];
    if (!ev?.tag) return;
    if (!window.confirm('This permanently deletes all scores for this event. Continue?')) return;
    const typed = window.prompt(`Type the event tag to confirm:\n${ev.tag}`);
    if (typed !== ev.tag) {
      toastMsg('Reset cancelled', 'err');
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      toastMsg('You must be signed in', 'err');
      return;
    }
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/reset_event_scores`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_event_tag: ev.tag }),
    });
    if (!res.ok) {
      toastMsg('Reset failed', 'err');
      return;
    }
    const txt = await res.text();
    toastMsg(`Deleted ${parseInt(txt, 10) || 0} row(s)`);
    await loadAll();
  };

  const onSaveTz = async () => {
    setTimezoneErr('');
    if (!timezoneVal) {
      setTimezoneErr('Select a timezone');
      return;
    }
    const res = await restApi(
      'PATCH',
      'settings',
      { value: timezoneVal, updated_at: new Date().toISOString() },
      'key=eq.leaderboard_timezone'
    );
    if (res) toastMsg('Timezone saved');
    else {
      setTimezoneErr('Could not save. Check migration if row is missing.');
      toastMsg('Failed to save', 'err');
    }
  };

  const onInvite = async () => {
    setInviteErr('');
    setInviteSuccess('');
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteErr('Email is required');
      return;
    }
    if (!email.endsWith('@benjipays.com')) {
      setInviteErr('Only @benjipays.com');
      return;
    }
    const r = await inviteEdgeFn({ action: 'invite', email, role: 'admin' });
    if (r.error) {
      setInviteErr(String(r.error));
      return;
    }
    setInviteSuccess(`Invited ${email}`);
    setInviteEmail('');
    toastMsg('Invite sent');
    void loadAdminList();
  };

  const exportCSV = () => {
    const rows: (string | number)[][] = [['Rank', 'Name', 'Email', 'Score', 'City', 'Combo', 'Event', 'Date']];
    filteredScores.forEach((s, i) => {
      rows.push([
        i + 1,
        s.player_name,
        s.email,
        s.score,
        `${s.city_flag || ''} ${s.city_reached || ''}`,
        s.best_combo,
        s.event_tag,
        new Date(s.created_at || '').toLocaleString(),
      ]);
    });
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `invoice-rover-${currentEventKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toastMsg('CSV exported');
  };

  return (
    <>
      {screen === 'login' && (
        <div id="loginScreen">
          <div className="login-box">
            <div className="login-logo">INVOICE ROVER</div>
            <div className="login-sub">Admin Panel · Benji Pays</div>
            <div className="login-domain-note">@benjipays.com accounts only</div>
            <button
              type="button"
              className="admin-google-btn"
              onClick={() => {
                void googleSignIn();
              }}
            >
              <span>Sign in with Google</span>
            </button>
            {loginError && (
              <div className="login-err" style={{ display: 'block' }}>
                {loginError}
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'mfaEnroll' && (
        <div id="mfaEnrollScreen" className="mfa-screen" style={{ display: 'flex' }}>
          <div className="login-box" style={{ maxWidth: 420 }}>
            <div className="login-logo">Set Up MFA</div>
            <div className="login-sub">Scan the QR code with your authenticator app</div>
            {mfaQr ? <img src={mfaQr} alt="MFA QR" className="mfa-qr-img" style={{ maxWidth: 200 }} /> : null}
            <div className="mfa-secret-wrap">
              <div className="mfa-secret-label">Or enter this code:</div>
              <div className="mfa-secret" id="mfaSecret">
                {mfaSecret}
              </div>
            </div>
            <input
              value={mfaEnrollCode}
              onChange={(e) => setMfaEnrollCode(e.target.value)}
              type="text"
              placeholder="6-digit code"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <button type="button" onClick={() => void verifyEnrollment()}>
              Verify &amp; enable MFA
            </button>
            {mfaEnrollErr && (
              <div className="login-err" style={{ display: 'block' }}>
                {mfaEnrollErr}
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'mfaVerify' && (
        <div id="mfaVerifyScreen" className="mfa-screen" style={{ display: 'flex' }}>
          <div className="login-box">
            <div className="login-logo">Two-Factor Auth</div>
            <div className="login-sub">Enter the code from your app</div>
            <input
              value={mfaVerifyCode}
              onChange={(e) => setMfaVerifyCode(e.target.value)}
              type="text"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <button type="button" onClick={() => void verifyMfa()}>
              Verify
            </button>
            {mfaVerifyErr && (
              <div className="login-err" style={{ display: 'block' }}>
                {mfaVerifyErr}
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'app' && (
        <div id="adminApp" style={{ display: 'block' }}>
          <div className="topbar">
            <div className="topbar-logo">
              BENJI PAYS: <span>INVOICE ROVER</span> — ADMIN
            </div>
            <div className="topbar-right">
              <select
                className="event-selector"
                value={currentEventKey}
                onChange={(e) => {
                  setCurrentEventKey(e.target.value);
                }}
                aria-label="Event"
              >
                <option value="all">All Events</option>
                <option value="nable-empower-2026">N-able Empower 2026</option>
              </select>
              <div className="badge badge-cooper" id="eventNameBadge">
                {evLabel.toUpperCase()}
              </div>
              <div className="badge badge-green">● LIVE</div>
              <button type="button" className="logout-btn" onClick={() => void logout()}>
                Log out
              </button>
            </div>
          </div>
          <div className="main">
            <div className="section-label">
              Event Stats — <span>{evLabel}</span>
            </div>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-val">{stats.total.toLocaleString()}</div>
                <div className="stat-lbl">Total Runs</div>
                <div className="stat-sub">all time</div>
              </div>
              <div className="stat-card">
                <div className="stat-val green">{stats.today.toLocaleString()}</div>
                <div className="stat-lbl">Runs Today</div>
              </div>
              <div className="stat-card">
                <div className="stat-val yellow">{stats.active.toLocaleString()}</div>
                <div className="stat-lbl">Active Now</div>
              </div>
              <div className="stat-card">
                <div className="stat-val cooper">{stats.leads.toLocaleString()}</div>
                <div className="stat-lbl">Leads</div>
              </div>
              <div className="stat-card">
                <div className="stat-val blue">{stats.avg.toLocaleString()}</div>
                <div className="stat-lbl">Avg Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.topScore.toLocaleString()}</div>
                <div className="stat-lbl">Top Score</div>
                <div className="stat-sub">{stats.topName}</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.topCity}</div>
                <div className="stat-lbl">Top City</div>
              </div>
            </div>

            <div className="section">
              <div className="section-label" style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                Daily leaderboard timezone
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
                Midnight in this zone defines the daily board.
              </p>
              <div className="field">
                <label htmlFor="tzSel">IANA timezone</label>
                <select
                  id="tzSel"
                  value={timezoneVal}
                  onChange={(e) => setTimezoneVal(e.target.value)}
                  style={{ width: '100%', maxWidth: 400, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,.25)', color: 'var(--white)' }}
                >
                  <option value="America/New_York">Eastern</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                  <option value="America/Phoenix">Phoenix</option>
                  <option value="America/Toronto">Toronto</option>
                  <option value="America/Vancouver">Vancouver</option>
                  <option value="Pacific/Honolulu">Honolulu</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">London</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={() => void onSaveTz()}>
                  Save timezone
                </button>
              </div>
              {timezoneErr && (
                <div className="login-err" style={{ display: 'block' }}>
                  {timezoneErr}
                </div>
              )}
            </div>

            <div className="section">
              <div className="section-title">Reset event leaderboard</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 640 }}>
                Deletes all score rows for the event selected. Cannot be undone.
              </p>
              <button
                type="button"
                className="btn btn-danger"
                disabled={currentEventKey === 'all'}
                onClick={() => void onResetEvent()}
              >
                Reset event scores
              </button>
            </div>

            <div className="section">
              <div className="section-title">Scores — {evLabel}</div>
              <div
                className="board-toggle"
                style={{ display: 'flex', marginBottom: 14, width: 'fit-content', border: '1px solid rgba(255,255,255,.12)' }}
              >
                <button
                  type="button"
                  className={`btn btn-sm board-toggle-btn${boardMode === 'event' ? ' active' : ''}`}
                  onClick={() => {
                    setBoardMode('event');
                  }}
                >
                  Event
                </button>
                <button
                  type="button"
                  className={`btn btn-sm board-toggle-btn${boardMode === 'daily' ? ' active' : ''}`}
                  onClick={() => {
                    setBoardMode('daily');
                  }}
                >
                  Daily
                </button>
              </div>
              <div className="table-controls">
                <input
                  className="search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email..."
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadAll()}>
                  Refresh
                </button>
                <button type="button" className="btn btn-green btn-sm" onClick={exportCSV}>
                  CSV
                </button>
                <label className="table-check">
                  <input type="checkbox" checked={showFlagged} onChange={(e) => setShowFlagged(e.target.checked)} />
                  Show flagged
                </label>
                <label className="table-check">
                  <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
                  Hide 0
                </label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Email</th>
                      <th>Score</th>
                      <th>City</th>
                      <th>Combo</th>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="empty-cell" style={{ textAlign: 'center' }}>
                          No rows
                        </td>
                      </tr>
                    ) : (
                      page.map((s, i) => (
                        <tr key={s.id} className={s.flagged ? 'flagged-row' : ''}>
                          <td className="muted-cell">{start + i + 1}</td>
                          <td>
                            <strong>{s.player_name || '—'}</strong>
                            {s.flagged && <span className="flagged-badge"> FLAGGED</span>}
                          </td>
                          <td className="muted-cell">{s.email || '—'}</td>
                          <td>
                            <span className="score-val">{(s.score || 0).toLocaleString()}</span>
                          </td>
                          <td className="city-cell">
                            {s.city_flag} {s.city_reached}
                          </td>
                          <td className="muted-cell">{s.best_combo || 0}×</td>
                          <td>
                            <span className="event-tag-badge">{s.event_tag || '—'}</span>
                          </td>
                          <td className="date-cell">{new Date(s.created_at || '').toLocaleString()}</td>
                          <td>
                            <div className="action-btns">
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm flag-btn ${s.flagged ? 'unflag' : 'flag'}`}
                                onClick={async () => {
                                  const r = await restApi('PATCH', 'scores', { flagged: !s.flagged }, `id=eq.${s.id}`);
                                  if (r) {
                                    void loadAll();
                                    toastMsg(s.flagged ? 'Unflagged' : 'Flagged');
                                  }
                                }}
                              >
                                {s.flagged ? 'Unflag' : 'Flag'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={async () => {
                                  if (!window.confirm('Delete permanently?')) return;
                                  const ok = (await restApi('DELETE', 'scores', null, `id=eq.${s.id}`)) as boolean;
                                  if (ok) {
                                    void loadAll();
                                    toastMsg('Deleted');
                                  }
                                }}
                              >
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  {start + 1}–{Math.min(end, totalF)} of {totalF}
                </span>
                <div className="pagination-btns">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}>
                    Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={end >= totalF}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-title">Admin Management</div>
              <div className="admin-mgmt-grid">
                <div className="admin-invite-form">
                  <div className="section-label">Invite</div>
                  <div className="field">
                    <label htmlFor="inviteEmail">Email</label>
                    <input
                      id="inviteEmail"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="name@benjipays.com"
                    />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => void onInvite()}>
                    Invite
                  </button>
                  {inviteErr && <div className="login-err" style={{ display: 'block' }}>{inviteErr}</div>}
                  {inviteSuccess && <div className="invite-success show">{inviteSuccess}</div>}
                </div>
                <div>
                  <div className="section-label">Admins</div>
                  <div className="admin-list">
                    {admins.length === 0
                      ? '—'
                      : admins.map((a) => (
                          <div key={a.user_id} className="admin-card" style={{ marginBottom: 8 }}>
                            <div>
                              {a.email}
                              {a.user_id === myUserId ? ' (You)' : ''}
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="modal-overlay show"
          id="editModal"
          role="presentation"
          onClick={() => setEditing(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-title">Edit</div>
            <div className="modal-field">
              <label>Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} type="text" />
            </div>
            <div className="modal-field">
              <label>Score</label>
              <input value={editScore} onChange={(e) => setEditScore(parseInt(e.target.value, 10) || 0)} type="number" />
            </div>
            <div className="modal-btns">
              <button type="button" className="btn btn-primary" onClick={() => void saveEdit()}>
                Save
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div id="toast" />
    </>
  );
}
