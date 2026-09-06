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

  const [newUsername, setNewUsername] = useState('');
  const [newTempPw, setNewTempPw] = useState(generateTempPassword());
  const [addingUser, setAddingUser] = useState(false);
  const [pwError, setPwError] = useState('');
  // { userId, username, tempPassword } — the last temp password to hand off
  const [pwResult, setPwResult] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const appBase = window.location.origin;

  async function load() {
    setLoading(true);
    try {
      const [inviteRes, userRes] = await Promise.all([api.getInvites(), api.getUsers()]);
      setInvites(inviteRes.invites || []);
      setUsers(userRes.users || []);
    } finally {
      setLoading(false);
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

  async function addUser(e) {
    e.preventDefault();
    setPwError('');
    setPwResult(null);
    setAddingUser(true);
    try {
      const { user } = await api.createUser(newUsername.trim(), newTempPw);
      setPwResult({ userId: user.id, username: user.username, tempPassword: newTempPw });
      setNewUsername('');
      setNewTempPw(generateTempPassword());
      await load();
    } catch (err) {
      setPwError(err.message);
    } finally {
      setAddingUser(false);
    }
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

      <div>
        <p className="eyebrow mb-3">Add user</p>
        <form onSubmit={addUser} className="flex flex-col gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Username"
            maxLength={50}
            required
            className="field !py-2.5 text-sm font-mono"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newTempPw}
              onChange={e => setNewTempPw(e.target.value)}
              placeholder="Temp password"
              minLength={6}
              required
              className="field !py-2.5 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setNewTempPw(generateTempPassword())}
              className="btn btn-ghost flex-shrink-0 !py-2 text-xs"
            >
              Generate
            </button>
          </div>
          <button type="submit" disabled={addingUser} className="btn btn-primary">
            {addingUser ? 'Adding…' : 'Add user'}
          </button>
        </form>
        {pwError && <p className="banner banner-error mt-2">{pwError}</p>}
        {pwResult && (
          <div className="banner banner-info mt-2 flex flex-col gap-2">
            <span>
              Send <b>{pwResult.username}</b> this temp password — they'll set their own on next login:
            </span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm text-chalk bg-navy-sink rounded px-2 py-1 select-all">
                {pwResult.tempPassword}
              </code>
              <button
                onClick={() => copyText(pwResult.tempPassword, 'pw')}
                className="text-xs bg-cash/20 text-cash hover:bg-cash/30 px-3 py-1.5 rounded-lg transition-colors font-semibold"
              >
                {copiedId === 'pw' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}
