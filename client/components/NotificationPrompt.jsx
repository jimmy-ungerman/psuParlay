import { usePushNotifications } from '../hooks/usePushNotifications.js';

export default function NotificationPrompt() {
  const { supported, permission, subscribed, subscribe, unsubscribe } = usePushNotifications();

  if (!supported || permission === 'denied') return null;
  if (subscribed) return null;
  if (permission === 'granted') return null; // already decided, subscribe is auto-handled

  return (
    <div className="mx-4 mt-3 rounded-xl bg-blue-600/10 border border-blue-600/30 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-white">Get pick alerts</p>
        <p className="text-xs text-gray-400">Know when someone locks in or trash talks</p>
      </div>
      <button
        onClick={subscribe}
        className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
      >
        Enable
      </button>
    </div>
  );
}
