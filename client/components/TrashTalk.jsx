import { useState, useEffect, useRef } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function TrashTalk({ week, season }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef(null);

  async function load() {
    if (!week || !season) return;
    try {
      const res = await api.getComments(week, season);
      setComments(res.comments || []);
    } catch {}
  }

  useEffect(() => { load(); }, [week, season]);

  // Poll every 20 seconds for new comments
  useEffect(() => {
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [week, season]);

  async function handlePost(e) {
    e.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      const res = await api.postComment(draft.trim(), week, season);
      setComments(prev => [...prev, res.comment]);
      setDraft('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteComment(id);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch {}
  }

  const remaining = 280 - draft.length;

  return (
    <div className="border-t border-gray-800 mt-4 pt-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Trash Talk</h3>

      {comments.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">No comments yet. Start the trash talk.</p>
      ) : (
        <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
          {comments.map(c => {
            const isMe = c.user_id === user?.id;
            return (
              <div key={c.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && (
                    <span className="text-xs text-gray-500 mb-0.5 ml-1">{c.username}</span>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                  }`}>
                    {c.content}
                  </div>
                  <div className={`flex items-center gap-2 mt-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs text-gray-600">{timeAgo(c.created_at)}</span>
                    {isMe && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs text-gray-700 hover:text-red-500 transition-colors"
                      >
                        delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handlePost} className="flex flex-col gap-2">
        <div className="relative">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, 280))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(e); } }}
            placeholder="Say something..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
          />
          {draft.length > 200 && (
            <span className={`absolute bottom-2 right-3 text-xs ${remaining < 20 ? 'text-red-400' : 'text-gray-500'}`}>
              {remaining}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || posting}
          className="self-end bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {posting ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
