import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { registerExpoPushSubscription } from '../api/chat';

// Configure notification behavior — show even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if user is viewing the same thread
    const data = notification.request.content.data;
    const activeThread = await SecureStore.getItemAsync('activeThread').catch(() => null);
    const isSameThread = activeThread && data?.threadId === activeThread;

    return {
      shouldShowBanner: !isSameThread, // Don't show banner if viewing same thread
      shouldShowList: true,
      shouldPlaySound: !isSameThread,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

// Request permission
export const requestNotificationPermission = async () => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

// Action category for chat notifications — adds a "Reply" inline text input
// (iOS UNNotificationAction with textInput, Android RemoteInput) and a
// "Mark as read" plain button. Wired to the category id "chat-message"
// which we attach to every message notification.
export const CHAT_NOTIF_CATEGORY = 'chat-message';

const setupChatActionCategory = async () => {
  try {
    await Notifications.setNotificationCategoryAsync(CHAT_NOTIF_CATEGORY, [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a reply…',
        },
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'mark-read',
        buttonTitle: 'Mark as read',
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (err) {
    console.log('[notif] action category register failed:', err?.message);
  }
};

// Setup notification channels (Android) + chat action category (both OS)
export const setupNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    // Main messages channel
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'Chat message notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 100, 200],
      sound: 'default',
      lightColor: '#ea4c89',
      enableVibrate: true,
      showBadge: true,
    });

    // Group messages channel
    await Notifications.setNotificationChannelAsync('groups', {
      name: 'Group Messages',
      description: 'Group chat notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 80, 150],
      sound: 'default',
      lightColor: '#8b5cf6',
      enableVibrate: true,
      showBadge: true,
    });
  }
  await setupChatActionCategory();
};

// Deduplicate — track last notification to prevent double
let lastNotifKey = '';
let lastNotifTime = 0;

// Show local notification for incoming message
export const showMessageNotification = async ({ senderName, message, threadId, type = 'text', isGroup = false, groupName = '' }) => {
  // Deduplicate — same thread + sender within 2 seconds = skip
  const notifKey = `${threadId}-${senderName}-${Date.now()}`;
  const now = Date.now();
  if (notifKey.slice(0, -13) === lastNotifKey.slice(0, -13) && now - lastNotifTime < 2000) return;
  lastNotifKey = notifKey;
  lastNotifTime = now;

  // Don't show if user is viewing this exact thread
  const activeThread = await SecureStore.getItemAsync('activeThread').catch(() => null);
  if (AppState.currentState === 'active' && activeThread === threadId) return;

  // Build notification body
  let body = message || '';
  if (type === 'image') body = '📷 Photo';
  else if (type === 'video') body = '🎬 Video';
  else if (type === 'file') body = '📄 Document';
  else if (type === 'audio') body = '🎵 Voice message';
  else if (type === 'link') body = '🔗 Link';
  else if (type === 'emoji') body = message || '😊';
  else if (body.length > 120) body = body.slice(0, 120) + '...';

  // Build title
  let title = senderName || 'New message';
  if (isGroup && groupName) title = `${senderName} in ${groupName}`;

  const channelId = isGroup ? 'groups' : 'messages';

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        subtitle: isGroup ? groupName : undefined, // iOS subtitle
        data: { threadId, type: 'message', senderName },
        sound: 'default',
        badge: 1,
        // Attach the action category so iOS shows the inline reply box and
        // Android renders the Reply / Mark-as-read buttons.
        categoryIdentifier: CHAT_NOTIF_CATEGORY,
        ...(Platform.OS === 'android' ? {
          channelId,
          color: '#ea4c89',
          sticky: false,
        } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    console.log('[notif] failed:', e.message);
  }
};

// Set active thread (to suppress notifications for current chat)
export const setActiveThread = async (threadId) => {
  try {
    if (threadId) await SecureStore.setItemAsync('activeThread', threadId);
    else await SecureStore.deleteItemAsync('activeThread');
  } catch {}
};

// Clear all notifications
export const clearNotifications = async () => {
  try { await Notifications.dismissAllNotificationsAsync(); } catch {}
};

// Set badge count
export const setBadgeCount = async (count) => {
  try { await Notifications.setBadgeCountAsync(count); } catch {}
};

// ─── Expo push token registration ────────────────────────────────────
// Get an Expo push token (sent through Expo's push service → APNS/FCM)
// and register it with our backend so server-initiated notifications
// reach the device when the app is killed.
const TOKEN_CACHE_KEY = 'expoPushToken';

export const registerExpoTokenWithBackend = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return null;
    }
    // Resolve project id (Expo Go vs EAS build)
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      undefined;
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResult?.data;
    if (!token) return null;

    // Skip re-register if backend already has this token for this user
    const last = await SecureStore.getItemAsync(TOKEN_CACHE_KEY).catch(() => null);
    if (last === token) return token;

    await registerExpoPushSubscription(token);
    await SecureStore.setItemAsync(TOKEN_CACHE_KEY, token).catch(() => {});
    return token;
  } catch (err) {
    console.log('[notif] expo token registration failed:', err?.message);
    return null;
  }
};
