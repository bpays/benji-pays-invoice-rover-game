import { useCallback, useEffect, useMemo, useState } from 'react';
import { lovable } from '../../integrations/lovable/index';
import { supabase } from '../../integrations/supabase/client';
import type { Database } from '../../integrations/supabase/types';
import {
  callEdgeFnWithMfaRetry,
  ensureAal2Token,
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
const ALL_EVENTS_KEY = '__all__';

type EventRow = { tag: string; label: string };

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

  const [events, setEvents] = useState<EventRow[]>([]);
  const [activeEventTag, setActiveEventTag] = useState<string>('');
  const [currentEventKey, setCurrentEventKey] = useState<string>('');
  const [boardMode, setBoardMode] = useState<'event' | 'daily'>('event');
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [filteredScores, setFilteredScores] = useState<Score[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [search, setSearch] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
  const [hideZero, setHideZero] = useState(true);

  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventTag, setNewEventTag] = useState('');
  const [eventErr, setEventErr] = useState('');
  const [importBusy, setImportBusy] = useState(false);

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
  const [adminListErr, setAdminListErr] = useState<string>('');
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Backups
  const [backupsEnabled, setBackupsEnabled] = useState<boolean>(false);
  const [backupsLastRun, setBackupsLastRun] = useState<{ at: string; filename: string; row_count: number } | null>(null);
  const [backupBusy, setBackupBusy] = useState<boolean>(false);
  const [backupTogglingBusy, setBackupTogglingBusy] = useState<boolean>(false);
  const [backupsList, setBackupsList] = useState<{ name: string; created_at: string | null; size: number | null }[]>([]);
  const [backupsListTotal, setBackupsListTotal] = useState<number>(0);
  const [backupsListBusy, setBackupsListBusy] = useState<boolean>(false);
  const [backupsListLimit, setBackupsListLimit] = useState<number>(10);
  const [downloadingName, setDownloadingName] = useState<string | null>(null);

  const redirectUri = useMemo(() => `${window.location.origin}/admin`, []);

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

  const currentEventTag = useCallback((): string | null => {
    if (currentEventKey === ALL_EVENTS_KEY) return null;
    return currentEventKey || null;
  }, [currentEventKey]);

  const eventParams = useCallback(() => {
    const tag = currentEventTag();
    return tag ? `event_tag=eq.${encodeURIComponent(tag)}` : '';
  }, [currentEventTag]);

  const loadStats = useCallback(async () => {
    const tag = currentEventTag();
    // Make sure our cached JWT actually has aal2 before calling an aal2-gated RPC.
    await ensureAal2Token();
    let { data, error } = await supabase.rpc('get_admin_stats', {
      p_event_tag: tag ?? undefined,
    });
    // If the DB still rejects with MFA required, the token was stale — refresh and retry once.
    if (error && /MFA \(aal2\) required/i.test(error.message || '')) {
      try { await supabase.auth.refreshSession(); } catch (e) { console.warn('refreshSession before stats retry failed', e); }
      const retry = await supabase.rpc('get_admin_stats', { p_event_tag: tag ?? undefined });
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      console.error('get_admin_stats error:', error);
      toastMsg(`Stats failed: ${error.message}`, 'err');
      return;
    }
    if (!data) return;
    const s = data as {
      total: number;
      today: number;
      active: number;
      leads: number;
      avg: number;
      topScore: number;
      topName: string;
      topCity: string;
    };
    setStats({
      total: s.total ?? 0,
      today: s.today ?? 0,
      active: s.active ?? 0,
      leads: s.leads ?? 0,
      avg: s.avg ?? 0,
      topScore: s.topScore ?? 0,
      topName: s.topName ?? '—',
      topCity: s.topCity ?? '—',
    });
  }, [currentEventKey]);

  const loadScores = useCallback(async () => {
    if (boardMode === 'daily') {
      const now = new Date();
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const y = et.getFullYear();
      const m = String(et.getMonth() + 1).padStart(2, '0');
      const d = String(et.getDate()).padStart(2, '0');
      const dayStart = `${y}-${m}-${d}T00:00:00-04:00`;
      const tag = currentEventTag();
      let p = `created_at=gte.${encodeURIComponent(dayStart)}`;
      if (tag) p += `&event_tag=eq.${encodeURIComponent(tag)}`;
      const data = (await restApi(
        'GET',
        'scores',
        null,
        `select=id,player_name,email,score,city_reached,city_flag,best_combo,flagged,event_tag,created_at,duration_s&${p}&order=score.desc&limit=500`
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
      `select=id,player_name,email,score,city_reached,city_flag,best_combo,flagged,event_tag,created_at,duration_s${ep ? `&${ep}` : ''}&order=score.desc`
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
    await Promise.all([loadStats(), loadScores()]);
  }, [loadStats, loadScores]);

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
    setAdminListErr('');
    try {
      const res = await inviteEdgeFn({ action: 'list' });
      if (res.error) {
        const msg = String(res.error);
        console.warn('admin list error:', msg);
        setAdminListErr(msg);
        return;
      }
      if (!Array.isArray(res.admins)) {
        setAdminListErr('Unexpected response from admin list');
        return;
      }
      setAdmins(res.admins as AdminListEntry[]);
      const { data: u } = await supabase.auth.getUser();
      setMyUserId(u.user?.id ?? null);
    } catch (e) {
      console.error('loadAdminList:', e);
      setAdminListErr(e instanceof Error ? e.message : 'Failed to load admins');
    }
  }, []);

  const loadEvents = useCallback(async () => {
    const rows = (await restApi('GET', 'events', null, 'select=tag,label&order=created_at.asc')) as
      | EventRow[]
      | null;
    setEvents(rows || []);
  }, []);

  const loadActiveEvent = useCallback(async () => {
    const res = (await restApi('GET', 'settings', null, 'key=eq.active_event&select=value')) as
      | { value: string }[]
      | null;
    const tag = res?.[0]?.value ? String(res[0].value).trim() : '';
    if (tag) {
      setActiveEventTag(tag);
      setCurrentEventKey(tag);
    } else {
      // No active event configured — fall back to All Events so the dashboard still loads.
      setCurrentEventKey(ALL_EVENTS_KEY);
    }
  }, []);

  const loadBackupSettings = useCallback(async () => {
    const res = (await restApi(
      'GET',
      'settings',
      null,
      'key=in.(backups_enabled,backups_last_run)&select=key,value'
    )) as { key: string; value: string }[] | null;
    if (!res) return;
    for (const row of res) {
      if (row.key === 'backups_enabled') {
        setBackupsEnabled(row.value === 'true');
      } else if (row.key === 'backups_last_run') {
        if (!row.value) { setBackupsLastRun(null); continue; }
        try {
          const parsed = JSON.parse(row.value);
          if (parsed && typeof parsed.at === 'string') setBackupsLastRun(parsed);
        } catch { setBackupsLastRun(null); }
      }
    }
  }, []);

  const loadBackupsList = useCallback(async (limit?: number) => {
    setBackupsListBusy(true);
    try {
      const sinceMs = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const { data, error } = await supabase.functions.invoke('backup-scores', {
        body: { action: 'list', since_ms: sinceMs, limit: limit ?? backupsListLimit, offset: 0 },
      });
      if (error) throw error;
      const d = data as { items?: { name: string; created_at: string | null; size: number | null }[]; total?: number; error?: string };
      if (d?.error) throw new Error(d.error);
      setBackupsList(d.items || []);
      setBackupsListTotal(d.total || 0);
    } catch (e) {
      console.error('list backups:', e);
      toastMsg(e instanceof Error ? e.message : 'Could not load backups list', 'err');
    } finally {
      setBackupsListBusy(false);
    }
  }, [backupsListLimit]);

  const enterApp = useCallback(async () => {
    setScreen('app');
    try {
      await Promise.all([loadTimezone(), loadAdminList(), loadEvents(), loadActiveEvent(), loadBackupSettings(), loadBackupsList()]);
    } catch (e) {
      console.error(e);
      toastMsg('Dashboard data failed to load', 'err');
    }
  }, [loadAdminList, loadTimezone, loadEvents, loadActiveEvent, loadBackupSettings, loadBackupsList]);

  useEffect(() => {
    if (screen !== 'app') return;
    // Don't fetch scores until we know which event to scope to.
    // currentEventKey is empty on first mount and gets set by loadActiveEvent().
    if (!currentEventKey) return;
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
      // Fail closed: do not enter the app if we can't verify MFA factors.
      setMfaEnrollErr('Unable to verify MFA status. Please sign in again.');
      await supabase.auth.signOut();
      setScreen('login');
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
    console.info('[admin-login] handleOAuthSession: checking session');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) { console.warn('[admin-login] no session after OAuth'); return; }
    const email = session.user.email || '';
    console.info('[admin-login] session for:', email);
    if (!validateDomain(email)) {
      const msg = `You're signed in as ${email || 'an unknown account'}. Admin access requires a @${ALLOWED} account — choose "Use a different account" in the Google popup and try again.`;
      console.warn('[admin-login] domain rejected:', email);
      setLoginError(msg);
      await supabase.auth.signOut();
      return;
    }
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin');
    if (roles && roles.length > 0) {
      console.info('[admin-login] existing admin role found, going to MFA');
      await handleMfaFlow();
      return;
    }
    console.info('[admin-login] no role yet, attempting invite claim');
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
      const claimData = (await claimRes.json()) as { success?: boolean; error?: string };
      if (claimData.success) {
        console.info('[admin-login] claim succeeded');
        await handleMfaFlow();
        return;
      }
      console.warn('[admin-login] claim failed:', claimRes.status, claimData);
    } catch (e) {
      console.error('[admin-login] claim threw:', e);
    }
    setLoginError(`Access denied — no admin invite found for ${email}. Ask an existing admin to invite this exact email.`);
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
              try { await supabase.auth.refreshSession(); } catch (e) { console.warn('refreshSession on restore failed', e); }
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
    try { await supabase.auth.refreshSession(); } catch (e) { console.warn('refreshSession after enroll failed', e); }
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
    try { await supabase.auth.refreshSession(); } catch (e) { console.warn('refreshSession after verify failed', e); }
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

  const evLabel =
    currentEventKey === ALL_EVENTS_KEY
      ? 'All Events'
      : events.find((e) => e.tag === currentEventKey)?.label || currentEventKey || '—';


  useEffect(() => {
    if (screen !== 'app') return;
    runFilter(allScores);
  }, [allScores, screen, runFilter, search, showFlagged, hideZero]);

  useEffect(() => {
    if (screen !== 'app') return;
    const t = setInterval(() => {
      void loadStats();
    }, 60000);
    return () => clearInterval(t);
  }, [loadStats, screen]);

  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const page = filteredScores.slice(start, end);
  const totalF = filteredScores.length;

  const onSaveTz = async () => {
    setTimezoneErr('');
    if (!timezoneVal) {
      setTimezoneErr('Select a timezone');
      return;
    }
    const res = (await restApi(
      'PATCH',
      'settings',
      { value: timezoneVal, updated_at: new Date().toISOString() },
      'key=eq.leaderboard_timezone'
    )) as unknown[] | null;
    // PATCH against a missing row returns [] (truthy but empty). Treat that as a failure.
    if (res && Array.isArray(res) && res.length > 0) {
      toastMsg('Timezone saved');
    } else {
      setTimezoneErr('Could not save — settings row missing. Contact an admin.');
      toastMsg('Failed to save', 'err');
    }
  };

  const onToggleBackups = async (next: boolean) => {
    setBackupTogglingBusy(true);
    const prev = backupsEnabled;
    setBackupsEnabled(next);
    const res = await restApi(
      'PATCH',
      'settings',
      { value: next ? 'true' : 'false', updated_at: new Date().toISOString() },
      'key=eq.backups_enabled'
    );
    setBackupTogglingBusy(false);
    if (res) {
      toastMsg(next ? 'Automated backups ON' : 'Automated backups OFF');
    } else {
      setBackupsEnabled(prev);
      toastMsg('Failed to update backup setting', 'err');
    }
  };


  const onRunBackupNow = async () => {
    setBackupBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-scores', {
        body: { force: true },
      });
      if (error) throw error;
      const d = data as { ok?: boolean; filename?: string; row_count?: number; error?: string };
      if (d?.error) throw new Error(d.error);
      if (d?.ok && d.filename) {
        toastMsg(`Backup saved (${d.row_count ?? 0} rows)`);
        await loadBackupSettings();
        await loadBackupsList();
      } else {
        toastMsg('Backup ran but returned no file', 'err');
      }
    } catch (e) {
      console.error('backup-scores:', e);
      toastMsg(e instanceof Error ? e.message : 'Backup failed', 'err');
    } finally {
      setBackupBusy(false);
    }
  };

  const onDownloadBackup = async (filename: string) => {
    setDownloadingName(filename);
    try {
      const { data, error } = await supabase.functions.invoke('backup-scores', {
        body: { action: 'download', filename },
      });
      if (error) throw error;
      const d = data as { url?: string; error?: string };
      if (d?.error || !d?.url) throw new Error(d?.error || 'No URL returned');
      // Trigger download
      const a = document.createElement('a');
      a.href = d.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('download backup:', e);
      toastMsg(e instanceof Error ? e.message : 'Download failed', 'err');
    } finally {
      setDownloadingName(null);
    }
  };

  const onLoadMoreBackups = async () => {
    const next = backupsListLimit + 10;
    setBackupsListLimit(next);
    await loadBackupsList(next);
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
        s.email ?? '',
        s.score,
        `${s.city_flag || ''} ${s.city_reached || ''}`,
        s.best_combo ?? 0,
        s.event_tag ?? '',
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

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

  const onCreateEvent = async () => {
    setEventErr('');
    const label = newEventLabel.trim();
    if (label.length < 2 || label.length > 80) {
      setEventErr('Event name must be 2–80 characters');
      return;
    }
    const tag = (newEventTag.trim() ? slugify(newEventTag) : slugify(label));
    if (!tag) {
      setEventErr('Could not generate a tag — enter one manually');
      return;
    }
    if (events.some((e) => e.tag === tag)) {
      setEventErr(`Event tag "${tag}" already exists`);
      return;
    }
    const { error } = await supabase.from('events').insert({ tag, label });
    if (error) {
      setEventErr(error.message);
      return;
    }
    setNewEventLabel('');
    setNewEventTag('');
    toastMsg('Event created');
    await loadEvents();
    setCurrentEventKey(tag);
  };

  const onSetActiveEvent = async () => {
    if (currentEventKey === ALL_EVENTS_KEY) {
      toastMsg('Select a specific event first', 'err');
      return;
    }
    const res = await restApi(
      'PATCH',
      'settings',
      { value: currentEventKey, updated_at: new Date().toISOString() },
      'key=eq.active_event'
    );
    if (res) {
      setActiveEventTag(currentEventKey);
      toastMsg('Active event updated');
    } else toastMsg('Failed to update active event', 'err');
  };

  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let cur: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cell += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { cur.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
          if (cell !== '' || cur.length > 0) { cur.push(cell); rows.push(cur); cur = []; cell = ''; }
          if (c === '\r' && text[i + 1] === '\n') i++;
        } else cell += c;
      }
    }
    if (cell !== '' || cur.length > 0) { cur.push(cell); rows.push(cur); }
    return rows;
  };

  const onImportCsv = async (file: File) => {
    setImportBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text).filter((r) => r.length > 1);
      if (rows.length < 2) {
        toastMsg('CSV is empty', 'err');
        return;
      }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name.toLowerCase());
      const iName = idx('Name');
      const iEmail = idx('Email');
      const iScore = idx('Score');
      const iCity = idx('City');
      const iCombo = idx('Combo');
      const iEvent = idx('Event');
      const iDate = idx('Date');
      if (iName < 0 || iEmail < 0 || iScore < 0) {
        toastMsg('CSV must have Name, Email, Score columns', 'err');
        return;
      }
      const fallbackTag =
        currentEventKey === ALL_EVENTS_KEY ? activeEventTag : currentEventKey;
      const parsed = rows.slice(1).map((r) => {
        const cityCell = (iCity >= 0 ? r[iCity] || '' : '').trim();
        const flagMatch = cityCell.match(/^(\p{Extended_Pictographic}\uFE0F?|🇨🇦|🤠|🗽|🌴|🌊|🇬🇧|🇦🇺|🤖)\s*/u);
        const flag = flagMatch ? flagMatch[1] : '';
        const cityName = cityCell.replace(/^\S+\s*/, '').trim();
        return {
          player_name: (r[iName] || '').trim(),
          email: (r[iEmail] || '').trim(),
          score: Number((r[iScore] || '0').replace(/[^0-9.-]/g, '')),
          city_reached: cityName || 'Vancouver',
          city_flag: flag || '🇨🇦',
          best_combo: iCombo >= 0 ? Number((r[iCombo] || '0').replace(/[^0-9.-]/g, '')) : 0,
          event_tag: (iEvent >= 0 ? r[iEvent] || '' : '').trim() || fallbackTag,
          created_at: iDate >= 0 ? r[iDate] || null : null,
        };
      });
      const proceed = window.confirm(
        `Import ${parsed.length} row(s)?\n\nThis will INSERT new rows. No existing data will be modified or deleted.`
      );
      if (!proceed) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toastMsg('Session expired', 'err'); return; }
      const { ok, status, data: out } = await callEdgeFnWithMfaRetry(
        'admin-import-scores',
        { rows: parsed },
      );
      if (!ok) {
        toastMsg(`Import failed: ${(out?.error as string) || status}`, 'err');
        return;
      }
      toastMsg(`Imported ${out.inserted}, skipped ${out.skipped}`);
      if (Array.isArray(out.errors) && out.errors.length > 0) {
        console.warn('Import errors:', out.errors);
      }
      await loadAll();
    } catch (e) {
      console.error('CSV import:', e);
      toastMsg('CSV import failed', 'err');
    } finally {
      setImportBusy(false);
    }
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
                <option value={ALL_EVENTS_KEY}>All Events</option>
                {events.map((ev) => (
                  <option key={ev.tag} value={ev.tag}>
                    {ev.label}{ev.tag === activeEventTag ? ' ● active' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void onSetActiveEvent()}
                disabled={currentEventKey === ALL_EVENTS_KEY || currentEventKey === activeEventTag}
                title="Make this the event used by the public game and leaderboard"
              >
                Set active
              </button>
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
              <div className="section-title">Scores — {evLabel}</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 640, marginBottom: 12 }}>
                Removed scores stay in the database for audit — they only disappear from public leaderboards.
              </p>
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
                  Export CSV
                </button>
                <label
                  className="btn btn-ghost btn-sm"
                  style={{ cursor: importBusy ? 'wait' : 'pointer', opacity: importBusy ? 0.6 : 1 }}
                  title="Upload a CSV in the same format as the export"
                >
                  {importBusy ? 'Importing…' : 'Import CSV'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    disabled={importBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void onImportCsv(f);
                    }}
                  />
                </label>
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
                      <th>Duration</th>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="empty-cell" style={{ textAlign: 'center' }}>
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
                          <td className="muted-cell">
                            {typeof s.duration_s === 'number' && s.duration_s >= 0
                              ? `${Math.floor(s.duration_s / 60)}:${String(s.duration_s % 60).padStart(2, '0')}`
                              : '—'}
                          </td>
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
                                  const confirmMsg = s.flagged
                                    ? 'Restore this score to public leaderboards?'
                                    : 'Hide this score from public leaderboards? The row will be kept in the database.';
                                  if (!window.confirm(confirmMsg)) return;
                                  // Flag/unflag every row tied to the same run (lead-capture row + final score)
                                  // so the player doesn't reappear on the leaderboard with a 0-score lead row.
                                  const filter = s.run_id ? `run_id=eq.${s.run_id}` : `id=eq.${s.id}`;
                                  const r = await restApi('PATCH', 'scores', { flagged: !s.flagged }, filter);
                                  if (r) {
                                    void loadAll();
                                    toastMsg(s.flagged ? 'Restored to leaderboard' : 'Removed from leaderboard');
                                  } else {
                                    toastMsg('Update failed', 'err');
                                  }
                                }}
                              >
                                {s.flagged ? 'Restore to leaderboard' : 'Remove from leaderboard'}
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
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Admins</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void loadAdminList()}
                      style={{ marginLeft: 'auto' }}
                    >
                      Refresh
                    </button>
                  </div>
                  {adminListErr && (
                    <div className="login-err" style={{ display: 'block', marginBottom: 8 }}>
                      Could not load admins: {adminListErr}
                    </div>
                  )}
                  <div className="admin-list">
                    {admins.length === 0
                      ? (adminListErr ? '—' : 'Loading…')
                      : admins.map((a) => (
                          <div key={a.user_id || a.email} className="admin-card" style={{ marginBottom: 8 }}>
                            <div>
                              {a.email}
                              {a.user_id === myUserId ? ' (You)' : ''}
                              {a.status === 'pending' ? ' · pending invite' : ''}
                            </div>
                          </div>
                        ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-title">Events</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 640, marginBottom: 12 }}>
                Create new events here. The <strong>active event</strong> is the one new game runs are tagged with and the only one shown on the public leaderboard. Existing scores are never modified.
              </p>
              <div className="field" style={{ maxWidth: 480 }}>
                <label htmlFor="newEventLabel">New event name</label>
                <input
                  id="newEventLabel"
                  type="text"
                  value={newEventLabel}
                  onChange={(e) => setNewEventLabel(e.target.value)}
                  placeholder="e.g. RSA Conference 2026"
                />
              </div>
              <div className="field" style={{ maxWidth: 480 }}>
                <label htmlFor="newEventTag">Tag (optional — auto-generated)</label>
                <input
                  id="newEventTag"
                  type="text"
                  value={newEventTag}
                  onChange={(e) => setNewEventTag(e.target.value)}
                  placeholder={newEventLabel ? slugify(newEventLabel) : 'rsa-conference-2026'}
                />
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={() => void onCreateEvent()}>
                  Create event
                </button>
              </div>
              {eventErr && <div className="login-err" style={{ display: 'block' }}>{eventErr}</div>}
              <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
                Active event: <strong style={{ color: 'var(--cooper)' }}>{activeEventTag}</strong>
              </div>
            </div>

            <div className="section">
              <div className="section-title">Backups</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 640, marginBottom: 12 }}>
                Automated CSV backups of the <strong>scores</strong> table run every 3 hours when enabled. Files are saved to the <code>scores-backups</code> bucket in Cloud storage and pruned after 30 days. Turn this off between events to save on usage.
              </p>
              <div className="btn-row" style={{ alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={backupsEnabled}
                    disabled={backupTogglingBusy}
                    onChange={(e) => void onToggleBackups(e.target.checked)}
                  />
                  <span>Automated backups: <strong style={{ color: backupsEnabled ? 'var(--cooper)' : 'var(--muted)' }}>{backupsEnabled ? 'ON' : 'OFF'}</strong></span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={backupBusy}
                  onClick={() => void onRunBackupNow()}
                >
                  {backupBusy ? 'Running…' : 'Run backup now'}
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                {backupsLastRun ? (
                  <>
                    Last backup:{' '}
                    <strong style={{ color: 'var(--text)' }}>
                      {new Date(backupsLastRun.at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET
                    </strong>{' '}
                    — {backupsLastRun.row_count.toLocaleString()} rows · <code>{backupsLastRun.filename}</code>
                  </>
                ) : (
                  <>No backups yet.</>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>Backups (last 2 days)</strong>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    disabled={backupsListBusy}
                    onClick={() => void loadBackupsList()}
                  >
                    {backupsListBusy ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
                {backupsList.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {backupsListBusy ? 'Loading…' : 'No backups in the last 2 days.'}
                  </div>
                ) : (
                  <>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {backupsList.map((b) => (
                        <li
                          key={b.name}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 12, padding: '6px 10px',
                            border: '1px solid var(--border, #2a2a2a)', borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</code>
                            <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                              {b.created_at
                                ? new Date(b.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' }) + ' ET'
                                : '—'}
                              {b.size != null ? ` · ${(b.size / 1024).toFixed(1)} KB` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
                            disabled={downloadingName === b.name}
                            onClick={() => void onDownloadBackup(b.name)}
                          >
                            {downloadingName === b.name ? 'Preparing…' : 'Download'}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {backupsList.length < backupsListTotal && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12 }}
                          disabled={backupsListBusy}
                          onClick={() => void onLoadMoreBackups()}
                        >
                          {backupsListBusy ? 'Loading…' : `Load more (${backupsListTotal - backupsList.length} remaining)`}
                        </button>
                      </div>
                    )}
                  </>
                )}
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
