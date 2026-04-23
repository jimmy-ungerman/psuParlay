import { useState, useEffect } from 'react';
import { api } from '../api/index.js';

export default function AdminPanel() {
  const [invites, setInvites] = useState([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const appBase = window.location.origin;

  async function load() {
    setLoading(true);
    try {
      const res = await api.getInvites();
      setInvites(res.invites || []);
    } finally {
      setLoading(false);
    }
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

  function copyLink(token, id) {
    navigator.clipboard.writeText(`${appBase}/invite/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const pending = invites.filter(i => !i.used_by);
  const used = invites.filter(i => i.used_by);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Generate Invite</h2>
        <form onSubmit={createInvite} className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (e.g. Mike)"
            maxLength={100}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
          >
            {creating ? '...' : 'Create'}
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading invites...</p>
      ) : (
        <>
          {/* Pending invites */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pending ({pending.length})</h3>
              <div className="space-y-2">
                {pending.map(invite => (
                  <div key={invite.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{invite.label || 'Unlabeled'}</p>
                      <p className="text-gray-600 text-xs font-mono truncate">{`${appBase}/invite/${invite.token}`}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => copyLink(invite.token, invite.id)}
                        className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        {copiedId === invite.id ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => deleteInvite(invite.id)}
                        className="text-xs bg-red-600/10 text-red-500 hover:bg-red-600/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length === 0 && (
            <p className="text-gray-600 text-sm">No pending invites.</p>
          )}

          {/* Used invites */}
          {used.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Used ({used.length})</h3>
              <div className="space-y-2">
                {used.map(invite => (
                  <div key={invite.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-3 flex items-center justify-between opacity-60">
                    <div>
                      <p className="text-gray-400 text-sm">{invite.label || 'Unlabeled'}</p>
                      <p className="text-gray-600 text-xs">Registered as <span className="text-gray-500">{invite.used_by_name}</span></p>
                    </div>
                    <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">Used</span>
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
