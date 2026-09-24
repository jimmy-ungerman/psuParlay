import { useState, useEffect } from 'react';
import { api } from '../api/index.js';

function generateTempPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `psu-${s}`;
}

export default function AdminPanel() {
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const [oddsQuota, setOddsQuota] = useState(null);
  const [refreshingOdds, setRefreshingOdds] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  const [pwError, setPwError] = useState('');
  // { userId, username, tempPassword } — the last temp password to hand off.
  // Only dismissed by an explicit click on the modal's Done button — never
  // cleared as a side effect of load() or any other background state change,
  // so the admin always has a chance to copy it.
  const [pwResult, setPwResult] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const appBase = window.location.origin;

  async function load() {
    setLoading(true);
    try {
      const [inviteRes, userRes, quotaRes] = await Promise.all([
        api.getInvites(), api.getUsers(), api.getOddsQuota(),
      ]);
      setInvites(inviteRes.invites || []);
      setUsers(userRes.users || []);
      setOddsQuota(quotaRes);
    } finally {
      setLoading(false);
    }
  }

  async function refreshOdds() {
    setRefreshingOdds(true);
    setRefreshMsg('');
    try {
      const result = await api.refreshOdds();
      setRefreshMsg(`Checked ${result.checked}, updated ${result.updated}.`);
      const quotaRes = await api.getOddsQuota();
      setOddsQuota(quotaRes);
    } catch (err) {
      setRefreshMsg(err.message);
    } finally {
      setRefreshingOdds(false);
    }
  }

  async function toggleLinkAdmin(user) {
    const enabled = !user.is_link_admin;
    await api.setLinkAdmin(user.id, enabled);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_link_admin: enabled ? 1 : 0 } : u));
  }

  useEffect(() => { load(); }, []);

  async function createInvite(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createInvite(label);
      setLabel('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function deleteInvite(id) {
    if (!confirm('Revoke this invite?')) return;
    await api.deleteInvite(id);
    await load();
  }

  async function resetPassword(user) {
    if (!confirm(`Reset ${user.username}'s password? Their current password stops working immediately.`)) return;
    setPwError('');
    setPwResult(null);
    setResettingId(user.id);
    try {
      const tempPassword = generateTempPassword();
      await api.resetUserPassword(user.id, tempPassword);
      setPwResult({ userId: user.id, username: user.username, tempPassword });
      await load();
    } catch (err) {
      setPwError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const pending = invites.filter(i => !i.used_by);
  const used = invites.filter(i => i.used_by);

  return (
    <div className="p-4 flex flex-col gap-6">
      <div>
        <p className="eyebrow mb-3">Odds API</p>
        <div className="card p-3 flex flex-col gap-2">
          {oddsQuota?.mockMode ? (
            <p className="text-chalk-faint text-sm">No ODDS_API_KEY set — running on mock spreads.</p>
          ) : (
            <>
              {oddsQuota?.quota?.lastError && (
                <div className="rounded-lg bg-red-950/40 border border-red-900/60 px-3 py-2">
                  <p className="text-red-400 text-sm font-semibold">
                    Odds API failing: {oddsQuota.quota.lastError.code || 'error'}
                  </p>
                  <p className="text-red-400/80 text-xs">{oddsQuota.quota.lastError.message}</p>
                  <p className="text-red-400/60 text-xs">
                    since {new Date(oddsQuota.quota.lastError.at).toLocaleString()} — new games aren't being seeded until this clears
                  </p>
                </div>
              )}
              {oddsQuota?.quota ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-chalk text-sm">
                      <span className="font-semibold">{oddsQuota.quota.remaining}</span> credits remaining
                      {oddsQuota.quota.used != null && (
                        <span className="text-chalk-faint"> ({oddsQuota.quota.used} used this cycle)</span>
                      )}
                    </p>
                    <p className="text-chalk-faint text-xs">
                      as of {new Date(oddsQuota.quota.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-chalk-faint text-sm">No odds call has run yet this process — refresh to check.</p>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={refreshOdds}
              disabled={refreshingOdds || oddsQuota?.mockMode}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-navy-sink text-chalk-dim hover:text-chalk transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {refreshingOdds ? '…' : 'Refresh odds now'}
            </button>
            {refreshMsg && <p className="text-chalk-faint text-xs">{refreshMsg}</p>}
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">User roles</p>
        {loading ? (
          <p className="text-chalk-faint text-sm">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {users.filter(u => !u.is_admin).map(u => (
              <div key={u.id} className="card px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="text-sm text-chalk flex items-center gap-2 min-w-0">
                  <span className="truncate">{u.username}</span>
                  {!!u.must_change_password && (
                    <span className="streak-chip down flex-shrink-0">temp pw</span>
                  )}
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => resetPassword(u)}
                    disabled={resettingId === u.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-navy-sink text-chalk-dim hover:text-chalk transition-colors disabled:opacity-50"
                  >
                    {resettingId === u.id ? '…' : 'Reset pw'}
                  </button>
                  <button
                    onClick={() => toggleLinkAdmin(u)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      u.is_link_admin
                        ? 'bg-cash/20 text-cash hover:bg-cash/30'
                        : 'bg-navy-sink text-chalk-dim hover:text-chalk'
                    }`}
                  >
                    {u.is_link_admin ? 'Link admin ✓' : 'Link admin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pwError && <p className="banner banner-error">{pwError}</p>}

      <div>
        <p className="eyebrow mb-3">Generate invite</p>
        <form onSubmit={createInvite} className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (e.g. Mike)"
            maxLength={100}
            className="field !py-2.5 text-sm"
          />
          <button type="submit" disabled={creating} className="btn btn-primary flex-shrink-0">
            {creating ? '…' : 'Create'}
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-chalk-faint text-sm">Loading invites…</p>
      ) : (
        <>
          {pending.length > 0 ? (
            <div>
              <p className="eyebrow mb-2">Pending ({pending.length})</p>
              <div className="flex flex-col gap-2">
                {pending.map(invite => (
                  <div key={invite.id} className="card p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-chalk text-sm font-medium truncate">{invite.label || 'Unlabeled'}</p>
                      <p className="text-chalk-faint text-xs font-mono truncate">{`${appBase}/invite/${invite.token}`}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => copyText(`${appBase}/invite/${invite.token}`, invite.id)}
                        className="text-xs bg-cash/20 text-cash hover:bg-cash/30 px-3 py-1.5 rounded-lg transition-colors font-semibold"
                      >
                        {copiedId === invite.id ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => deleteInvite(invite.id)}
                        className="text-xs bg-bust/10 text-bust hover:bg-bust/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-chalk-faint text-sm">No pending invites.</p>
          )}

          {used.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Used ({used.length})</p>
              <div className="flex flex-col gap-2">
                {used.map(invite => (
                  <div key={invite.id} className="card p-3 flex items-center justify-between opacity-60">
                    <div>
                      <p className="text-chalk-dim text-sm">{invite.label || 'Unlabeled'}</p>
                      <p className="text-chalk-faint text-xs">Registered as <span className="text-chalk-dim">{invite.used_by_name}</span></p>
                    </div>
                    <span className="streak-chip up">Used</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {pwResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card p-5 max-w-sm w-full flex flex-col gap-3">
            <p className="text-chalk text-sm">
              Send <b>{pwResult.username}</b> this temp password — they'll set their own on next login. This won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm text-chalk bg-navy-sink rounded px-2 py-1.5 select-all flex-1 truncate">
                {pwResult.tempPassword}
              </code>
              <button
                onClick={() => copyText(pwResult.tempPassword, 'pw')}
                className="text-xs bg-cash/20 text-cash hover:bg-cash/30 px-3 py-1.5 rounded-lg transition-colors font-semibold flex-shrink-0"
              >
                {copiedId === 'pw' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setPwResult(null)} className="btn btn-primary mt-1">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
