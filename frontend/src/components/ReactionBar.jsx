import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/index.js';

const EMOJIS = ['🔥', '💀', '🤡', '🐐', '💸', '😬'];

export default function ReactionBar({ pickId, reactions = [], onUpdate }) {
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const myReaction = reactions.find(r => r.user_id === user?.id)?.emoji;

  const counts = {};
  for (const r of reactions) counts[r.emoji] = (counts[r.emoji] || 0) + 1;

  // Close picker when clicking outside
  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  async function handleClick(emoji) {
    setPickerOpen(false);
    try {
      await api.toggleReaction(pickId, emoji);
      onUpdate?.();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
      {/* Active reactions */}
      {EMOJIS.filter(e => counts[e]).map(emoji => {
        const isMine = myReaction === emoji;
        return (
          <button
            key={emoji}
            onClick={() => handleClick(emoji)}
            title={reactions.filter(r => r.emoji === emoji).map(r => r.username).join(', ')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border ${
              isMine
                ? 'bg-blue-600/30 border-blue-500/50 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{counts[emoji]}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen(o => !o)}
          className={`flex items-center justify-center w-7 h-6 rounded-full border text-xs transition-colors ${
            pickerOpen
              ? 'bg-gray-700 border-gray-500 text-gray-200'
              : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
          }`}
        >
          {myReaction ?? '+'}
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full left-0 mb-2 flex gap-1.5 bg-gray-800 border border-gray-700 rounded-2xl px-3 py-2 shadow-2xl z-20">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleClick(emoji)}
                className={`text-xl leading-none transition-transform hover:scale-125 active:scale-110 ${
                  myReaction === emoji ? 'opacity-40' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
