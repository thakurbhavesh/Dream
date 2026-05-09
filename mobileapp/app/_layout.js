import { useEffect } from 'react';
import { Text, TextInput, Platform, LogBox } from 'react-native';
import { Stack, router } from 'expo-router';

// Suppress console logs in production builds
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}
// Suppress known non-critical warnings in dev
LogBox.ignoreLogs(['Method writeAsStringAsync', 'Non-serializable values']);
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/store/AuthContext';
import { ThemeProvider, useTheme } from '../src/store/ThemeContext';
import { ToastProvider } from '../src/components/Toast';
import { CallProvider, useCall } from '../src/store/CallContext';
import IncomingCall from '../src/components/IncomingCall';
import useSocket from '../src/hooks/useSocket';
import { sendMessageRest, markRead } from '../src/api/chat';
import ErrorBoundary from '../src/components/ErrorBoundary';
import {
  requestNotificationPermission,
  setupNotificationChannel,
  showMessageNotification,
  registerExpoTokenWithBackend,
} from '../src/services/notifications';

// Global font override
function FontOverride() {
  const { theme } = useTheme();
  useEffect(() => {
    const fontFamily = theme.fontFamily || (Platform.OS === 'ios' ? 'System' : 'sans-serif');
    const origText = Text.render;
    Text.render = function (props, ref) {
      const style = Array.isArray(props.style) ? props.style : [props.style];
      return origText.call(this, { ...props, style: [{ fontFamily }, ...style] }, ref);
    };
    const origInput = TextInput.render;
    TextInput.render = function (props, ref) {
      const style = Array.isArray(props.style) ? props.style : [props.style];
      return origInput.call(this, { ...props, style: [{ fontFamily }, ...style] }, ref);
    };
    return () => { Text.render = origText; TextInput.render = origInput; };
  }, [theme.fontFamily]);
  return null;
}

// Notification listener — shows local notification on incoming messages
function NotificationListener() {
  const { user } = useAuth();
  const { on } = useSocket();

  // Setup on mount
  useEffect(() => {
    requestNotificationPermission();
    setupNotificationChannel();
  }, []);

  // Register Expo push token with backend after auth (best-effort, non-blocking)
  useEffect(() => {
    if (!user) return;
    registerExpoTokenWithBackend().catch(() => {});
  }, [user?.id]);

  // Listen to socket notification events — with dedup to prevent double
  useEffect(() => {
    if (!user) return;
    let lastNotifId = '';
    let lastNotifTime = 0;

    const unsub1 = on('notification', (data) => {
      if (data?.type === 'message') {
        // Dedup: same thread + sender within 2 seconds = skip
        const nid = `${data.threadId}-${data.senderName}-${data.body || ''}`;
        const now = Date.now();
        if (nid === lastNotifId && now - lastNotifTime < 2000) return;
        lastNotifId = nid;
        lastNotifTime = now;

        showMessageNotification({
          senderName: data.senderName || data.title || 'New message',
          message: data.body || '',
          threadId: data.threadId,
          type: data.messageType || 'text',
        });
      }
    });

    return () => { unsub1(); };
  }, [user, on]);

  // Handle notification interactions — tap, inline reply, mark-as-read.
  // The "reply" / "mark-read" actions ship via the chat-message category
  // (see src/services/notifications.js). They opensAppToForeground=false
  // so the user stays where they were while the action runs in the background.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data || {};
      const threadId = data?.threadId;
      const actionId = response.actionIdentifier;
      const userText = response.userText; // populated only for inline-reply actions

      // Inline reply: send the user's typed text via REST so it works even
      // when the socket isn't connected (background notification context).
      if (actionId === 'reply' && threadId && userText && userText.trim()) {
        try {
          await sendMessageRest(threadId, userText.trim(), 'text');
        } catch (err) {
          console.log('[notif] inline reply failed:', err?.message);
        }
        return;
      }

      // Mark-as-read shortcut from the notification.
      if (actionId === 'mark-read' && threadId) {
        try { await markRead(threadId); } catch (err) {
          console.log('[notif] mark-read failed:', err?.message);
        }
        return;
      }

      // Default tap (no action id, or DEFAULT_ACTION_IDENTIFIER) opens the chat.
      if (threadId) {
        router.push(`/chat/${threadId}?name=&avatar=`);
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

function IncomingCallOverlay() {
  const { callState, callType, remoteUser, acceptCall, rejectCall } = useCall();
  return (
    <IncomingCall
      callState={callState}
      callType={callType}
      remoteUser={remoteUser}
      onAccept={acceptCall}
      onReject={rejectCall}
    />
  );
}

function InnerLayout() {
  const { isDark, theme } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#0b1120' : '#ffffff'} />
      <FontOverride />
      <NotificationListener />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="meetings" />
        <Stack.Screen name="call" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      </Stack>
      <IncomingCallOverlay />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <CallProvider>
                <InnerLayout />
            </CallProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
