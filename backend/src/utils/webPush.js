/**
 * Web Push (VAPID) helper.
 *
 * Env vars (set in .env):
 *   VAPID_PUBLIC_KEY   — base64url encoded public key
 *   VAPID_PRIVATE_KEY  — base64url encoded private key
 *   VAPID_SUBJECT      — "mailto:you@example.com" or a site URL
 *
 * Generate keys once:
 *   node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log(k);"
 */
const webpush = require('web-push');
const db = require('../config/database');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@teamchatx.local';

let configured = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch (err) {
    console.error('[webPush] setVapidDetails failed:', err.message);
  }
} else {
  console.warn('[webPush] VAPID keys missing — background push disabled. Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env');
}

const isConfigured = () => configured;
const getPublicKey = () => PUBLIC_KEY;

const isExpoEndpoint = (endpoint) => typeof endpoint === 'string' && endpoint.startsWith('expo:');

/** Save a subscription (upsert by endpoint).
 * Accepts both web push (with p256dh/auth keys) and Expo (endpoint = 'expo:<token>',
 * keys empty). For Expo subscriptions we store empty strings for p256dh/auth so
 * the existing NOT NULL constraint is respected.
 */
const saveSubscription = async (userId, subscription, userAgent) => {
  if (!subscription || !subscription.endpoint) {
    throw new Error('Invalid subscription');
  }
  const { endpoint } = subscription;
  const expo = isExpoEndpoint(endpoint);
  if (!expo && !subscription.keys) {
    throw new Error('Invalid subscription');
  }
  const p256dh = expo ? '' : (subscription.keys?.p256dh || '');
  const auth = expo ? '' : (subscription.keys?.auth || '');
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           last_used_at = NOW()`,
    [userId, endpoint, p256dh, auth, userAgent || (expo ? 'expo' : null)]
  );
};

const deleteSubscription = async (endpoint) => {
  if (!endpoint) return;
  await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
};

const deleteByUser = async (userId) => {
  await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
};

/** Send a push notification to an Expo token via the Expo push service.
 * Returns true on success, false on failure. Stale tokens (DeviceNotRegistered)
 * are dropped.
 */
const sendExpoPush = async (subscriptionId, expoToken, payload) => {
  const obj = typeof payload === 'string' ? (() => { try { return JSON.parse(payload); } catch { return { body: payload }; } })() : (payload || {});
  const message = {
    to: expoToken,
    title: obj.title || obj.senderName || 'New message',
    body: obj.body || obj.message || '',
    sound: 'default',
    priority: 'high',
    data: obj.data || obj,
  };
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([message]),
    });
    const json = await res.json().catch(() => null);
    const ticket = json?.data?.[0];
    const errorType = ticket?.details?.error;
    if (errorType === 'DeviceNotRegistered') {
      db.query(`DELETE FROM push_subscriptions WHERE subscription_id = $1`, [subscriptionId])
        .catch(() => {});
      return false;
    }
    if (ticket?.status === 'error') {
      console.warn('[expoPush] error:', ticket.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[expoPush] send failed:', err.message);
    return false;
  }
};

/**
 * Send push to a user across all registered devices (web + Expo mobile).
 * Stale subscriptions (404/410, DeviceNotRegistered) are auto-removed.
 */
const sendPushToUser = async (userId, payload) => {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const { rows } = await db.query(
    `SELECT subscription_id, endpoint, p256dh, auth
     FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  if (!rows.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  await Promise.all(rows.map(async (row) => {
    if (isExpoEndpoint(row.endpoint)) {
      const expoToken = row.endpoint.slice('expo:'.length);
      const ok = await sendExpoPush(row.subscription_id, expoToken, payload);
      if (ok) {
        sent++;
        db.query(`UPDATE push_subscriptions SET last_used_at = NOW() WHERE subscription_id = $1`, [row.subscription_id])
          .catch(() => {});
      } else {
        failed++;
      }
      return;
    }

    // Web push (VAPID) path — only available when configured
    if (!configured) { failed++; return; }
    const sub = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(sub, body, { TTL: 60 });
      sent++;
      db.query(`UPDATE push_subscriptions SET last_used_at = NOW() WHERE subscription_id = $1`, [row.subscription_id])
        .catch(() => {});
    } catch (err) {
      failed++;
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        db.query(`DELETE FROM push_subscriptions WHERE subscription_id = $1`, [row.subscription_id])
          .catch(() => {});
      } else {
        console.warn('[webPush] send failed:', status, err?.message);
      }
    }
  }));
  return { sent, failed };
};

module.exports = {
  isConfigured,
  getPublicKey,
  saveSubscription,
  deleteSubscription,
  deleteByUser,
  sendPushToUser,
};
