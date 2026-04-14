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

/** Save a subscription (upsert by endpoint). */
const saveSubscription = async (userId, subscription, userAgent) => {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid subscription');
  }
  const { endpoint } = subscription;
  const { p256dh, auth } = subscription.keys;
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           last_used_at = NOW()`,
    [userId, endpoint, p256dh, auth, userAgent || null]
  );
};

const deleteSubscription = async (endpoint) => {
  if (!endpoint) return;
  await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
};

const deleteByUser = async (userId) => {
  await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
};

/**
 * Send push to a user across all registered devices.
 * Stale subscriptions (404/410) are auto-removed.
 */
const sendPushToUser = async (userId, payload) => {
  if (!configured) return { sent: 0, failed: 0, reason: 'not_configured' };
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
        // Subscription expired or unsubscribed — drop it
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
