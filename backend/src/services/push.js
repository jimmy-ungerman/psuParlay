import webpush from 'web-push';
import pool from '../db/index.js';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@psuparlay.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

async function getSubscriptionsForUser(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );
  return rows;
}

async function getAllSubscriptions() {
  const { rows } = await pool.query('SELECT * FROM push_subscriptions');
  return rows;
}

async function sendToSubscription(sub, payload) {
  const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
  try {
    await webpush.sendNotification(pushSub, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — remove it
      await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
    } else {
      console.error('Push send error:', err.message);
    }
  }
}

export async function sendPushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const subs = await getSubscriptionsForUser(userId);
  await Promise.all(subs.map(s => sendToSubscription(s, payload)));
}

export async function sendPushToAll(payload, excludeUserId = null) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const subs = await getAllSubscriptions();
  const filtered = excludeUserId ? subs.filter(s => s.user_id !== excludeUserId) : subs;
  await Promise.all(filtered.map(s => sendToSubscription(s, payload)));
}
