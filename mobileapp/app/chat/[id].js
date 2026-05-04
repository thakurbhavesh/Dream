import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Image,
  Platform, ActivityIndicator, ImageBackground, Keyboard,
  Animated, Dimensions, Pressable, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import Avatar from '../../src/components/Avatar';
import ChatBubble from '../../src/components/ChatBubble';
import EmojiPicker from '../../src/components/EmojiPicker';
import GifPicker from '../../src/components/GifPicker';
import PollCreator from '../../src/components/PollCreator';
import ImageViewer from '../../src/components/ImageViewer';
import { toggleStarredMessage } from './starred';
import { useToast } from '../../src/components/Toast';
import { useTheme } from '../../src/store/ThemeContext';
import { getMessages, uploadFile, sendMessageRest, aiSmartReplies, aiSmartCompose } from '../../src/api/chat';
import { getCachedMessages, cacheMessages, appendCachedMessage, updateCachedMessage } from '../../src/services/cache';
import { enqueue, dequeue, getQueue, processQueue, isOnline } from '../../src/services/offlineQueue';
import api from '../../src/api/config';
import useSocket from '../../src/hooks/useSocket';
import { useAuth } from '../../src/store/AuthContext';
import { useCall } from '../../src/store/CallContext';
import * as Haptics from 'expo-haptics';

const chatBg = require('../../assets/chat-bg-pattern.png');
const { width: W } = Dimensions.get('window');

// Date separator formatter
const getDateLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

// Add date separators between messages
const addDateSeparators = (msgs) => {
  if (!msgs?.length) return [];
  const result = [];
  let lastDate = '';
  for (const msg of msgs) {
    const raw = msg?.createdAt || msg?.metadata?.sentAt || '';
    const dateStr = raw ? new Date(raw).toDateString() : '';
    if (dateStr && dateStr !== lastDate) {
      result.push({ _type: 'date', _label: getDateLabel(raw), _key: `date-${dateStr}` });
      lastDate = dateStr;
    }
    result.push(msg);
  }
  return result;
};

// ─── Schedule modal: simple date+time entry → emits message:schedule ─────
function ScheduleMessageModal({ isDark, theme, initialText, onCancel, onSchedule }) {
  const pad = (n) => String(n).padStart(2, '0');
  const def = (() => {
    const d = new Date(Date.now() + 60 * 60_000); // 1h from now
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  })();
  const [date, setDate] = useState(def.date);
  const [time, setTime] = useState(def.time);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const iso = new Date(`${date}T${time}:00`).toISOString();
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts) || ts <= Date.now() + 30_000) {
      Alert.alert('Pick a time at least 1 minute in the future');
      return;
    }
    setSubmitting(true);
    await onSchedule({ sendAt: iso });
    setSubmitting(false);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <View style={[z.scheduleSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="time-outline" size={20} color={theme.accent} />
            <Text style={[z.scheduleTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Schedule message</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onCancel} hitSlop={10}>
              <Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>
          <Text style={[z.scheduleLabel, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>
            "{(initialText || '').slice(0, 80)}{initialText && initialText.length > 80 ? '…' : ''}"
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[z.scheduleLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Date</Text>
              <TextInput
                style={[z.scheduleInput, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#0f172a' }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                value={date}
                onChangeText={setDate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[z.scheduleLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Time</Text>
              <TextInput
                style={[z.scheduleInput, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#f1f5f9' : '#0f172a' }]}
                placeholder="HH:MM"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                value={time}
                onChangeText={setTime}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[{ backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1, padding: 14, borderRadius: 12, alignItems: 'center' }]}
            disabled={submitting}
            onPress={submit}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Schedule message</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ChatScreen() {
  const { id: threadId, name, avatar } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme: t, isDark } = useTheme();
  const { sendMessage, on, focusThread, emit, connected, reconnect } = useSocket();
  const { startCall } = useCall();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [contactList, setContactList] = useState([]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchType, setSearchType] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);
  const [translateMsg, setTranslateMsg] = useState(null); // { text, original } — shows language picker
  const [toneMsg, setToneMsg] = useState(null); // { text, original } — shows tone picker
  const [smartReplies, setSmartReplies] = useState([]); // string[] up to 3
  const [smartReplyFor, setSmartReplyFor] = useState(null); // last incoming msg id we already fetched for
  const [composeHint, setComposeHint] = useState(''); // ghost completion
  const composeTimerRef = useRef(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  // New features
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState(null); // { online, lastSeen }
  const [isMuted, setIsMuted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [showGif, setShowGif] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [viewImage, setViewImage] = useState(null); // { uri, caption }
  const [chatWallpaper, setChatWallpaper] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null); // string or null
  const [mentionList, setMentionList] = useState([]);
  // Group state
  const [groupInfo, setGroupInfo] = useState(null); // { is_airtime, is_admin, memberStatus }
  const isAirtime = isGroup && groupInfo?.is_airtime;
  const isGroupAdmin = groupInfo?.is_admin;
  const hasLeftGroup = isGroup && (groupInfo?.memberStatus === 'left' || groupInfo?.memberStatus === 'kicked');
  const recordingTimer = useRef(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [showForward, setShowForward] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardContacts, setForwardContacts] = useState([]);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardSelected, setForwardSelected] = useState([]); // multi-select
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);
  const isGroup = threadId?.startsWith('group-');

  // Track keyboard to remove insets.bottom padding when keyboard is open
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const s1 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const s2 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // Scroll-to-bottom fab
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollBtnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scrollBtnAnim, { toValue: showScrollBtn ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showScrollBtn]);

  // Load wallpaper
  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const wp = await AsyncStorage.getItem(`wallpaper-${threadId}`);
        if (wp) setChatWallpaper(wp);
      } catch {}
    })();
  }, [threadId]);

  useEffect(() => {
    (async () => {
      // 1. Load from cache instantly
      const cached = await getCachedMessages(threadId);
      if (cached && cached.length) { setMessages(cached); setLoading(false); }

      // 2. Fetch fresh from API
      try {
        const data = await getMessages(threadId);
        const fresh = data?.messages || data || [];
        setMessages(fresh);
        cacheMessages(threadId, fresh); // Update cache
      } catch {
        if (!cached?.length) toast('Failed to load messages', 'error');
      }
      finally { setLoading(false); }
    })();
  }, [threadId]);

  useEffect(() => {
    if (threadId) {
      focusThread(threadId);
      // Suppress notifications for this thread
      import('../../src/services/notifications').then(n => n.setActiveThread(threadId));
    }
    // Load group info for admin checks
    if (isGroup) {
      const gId = threadId.replace('group-', '');
      (async () => {
        try {
          const [gRes, mRes] = await Promise.all([
            api.get(`/groups/${gId}`).catch(() => null),
            api.get(`/group-members?group_id=${gId}&limit=500`).catch(() => null),
          ]);
          const g = gRes?.data?.data || gRes?.data || {};
          const mems = mRes?.data?.data?.rows || mRes?.data?.data || mRes?.data?.rows || [];
          const me = mems.find(m => String(m.user_id || m.id) === String(user?.id));
          setGroupInfo({
            is_airtime: !!g.is_airtime,
            is_admin: !!(me?.is_admin || String(g.created_by) === String(user?.id) || user?.role_id === 1),
            memberStatus: me?.status || 'active',
          });
        } catch {}
      })();
    }
    return () => {
      focusThread(null);
      import('../../src/services/notifications').then(n => n.setActiveThread(null));
    };
  }, [threadId, focusThread]);

  // When socket reconnects, refresh messages to catch missed ones
  useEffect(() => {
    if (connected && !loading && !hasLeftGroup) {
      focusThread(threadId);
      (async () => {
        // Process offline queue — auto-retry queued messages
        try {
          const result = await processQueue(async (msg) => {
            if (msg._threadId !== threadId) return; // skip other threads
            const res = await sendMessage(msg._threadId, msg.content?.text, 'text', msg._meta);
            if (res?.message) {
              setMessages(prev => prev.map(m => m.id === msg.id ? { ...res.message, status: 'sent' } : m));
              await dequeue(msg.id);
            }
          });
          if (result.sent > 0) toast(`${result.sent} queued message${result.sent > 1 ? 's' : ''} sent`, 'success');
        } catch {}
        // Reload messages to catch any missed during disconnect
        try {
          const data = await getMessages(threadId);
          const fresh = data?.messages || data || [];
          if (fresh.length > 0) { setMessages(fresh); cacheMessages(threadId, fresh); }
        } catch {}
      })();
    }
  }, [connected]);

  // Search with debounce + type filter
  const doSearch = useCallback(async (q, type) => {
    if ((!q || q.trim().length < 2) && !type) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const params = { limit: 50, threadId };
      if (q && q.trim().length >= 2) params.q = q.trim();
      if (type) params.types = type;
      const { data } = await api.get('/chat/search', { params });
      const r = data?.data || data;
      setSearchResults(r?.results || r?.messages || r || []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [threadId]);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(q, searchType), 400);
  }, [doSearch, searchType]);

  const handleSearchType = useCallback((type) => {
    const newType = searchType === type ? null : type;
    setSearchType(newType);
    doSearch(searchQuery, newType);
  }, [searchQuery, searchType, doSearch]);

  useEffect(() => {
    const unsub1 = on('message:new', (data) => {
      if (data?.threadId === threadId && data?.message && !hasLeftGroup) {
        const msg = data.message;
        setMessages(prev => {
          // Skip if this is our own message (already shown optimistically)
          const isOwnEcho = String(msg?.author?.id) === String(user?.id) && prev.some(m => m.id?.startsWith('temp-') && m.content?.text === msg?.content?.text);
          if (isOwnEcho) {
            // Replace temp with real
            return prev.map(m => (m.id?.startsWith('temp-') && m.content?.text === msg?.content?.text) ? { ...msg, status: 'sent' } : m);
          }
          return [...prev, msg];
        });
        appendCachedMessage(threadId, msg);
      }
    });

    // Message edited by other user
    const unsub2 = on('message:edited', (data) => {
      if (data?.threadId === threadId && data?.message) {
        const edited = data.message;
        setMessages(prev => prev.map(m =>
          m.id === edited.id ? { ...m, ...edited, content: { ...m.content, ...edited.content }, metadata: { ...m.metadata, ...edited.metadata, edited: true } } : m
        ));
      }
    });

    // Message deleted/recalled by other user
    const unsub3 = on('message:deleted', (data) => {
      if (data?.threadId === threadId && data?.messageId) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId ? { ...m, content: { ...m.content, recalled: true, text: '' } } : m
        ));
      }
    });

    // Read ack — update tick status (blue double check)
    const unsub4 = on('message:read_ack', (data) => {
      if (data?.threadId === threadId) {
        setMessages(prev => prev.map(m =>
          m.direction === 'outgoing' && m.status !== 'read' ? { ...m, status: 'read' } : m
        ));
      }
    });
    // Delivered ack — update to grey double check
    const unsub4b = on('message:delivered_ack', (data) => {
      if (data?.threadId === threadId) {
        const ids = Array.isArray(data?.messageIds) ? new Set(data.messageIds.map(String)) : null;
        setMessages(prev => prev.map(m => {
          if (m.direction !== 'outgoing') return m;
          if (m.status === 'read') return m;
          if (ids && !ids.has(String(m.id))) return m;
          return { ...m, status: 'delivered' };
        }));
      }
    });

    // Typing indicator
    const unsub5 = on('typing:update', (data) => {
      if (data?.threadId === threadId) {
        setTypingUsers(data.users?.filter(u => String(u.id) !== String(user?.id)) || []);
      }
    });

    // Online status — real-time
    const otherId = threadId?.replace('dm-', '').replace('group-', '');
    const unsub6 = on('user:online', (data) => {
      if (String(data?.userId) === String(otherId)) setOnlineStatus({ online: true, status: data?.status || 'Online' });
    });
    const unsub7 = on('user:offline', (data) => {
      if (String(data?.userId) === String(otherId)) setOnlineStatus({ online: false, lastSeen: data?.lastSeen || new Date().toISOString() });
    });
    // Status change (Away/Busy/DND)
    const unsubStatus = on('user:status', (data) => {
      if (String(data?.userId) === String(otherId)) setOnlineStatus({ online: true, status: data?.status });
    });
    // Bulk online list on connect — get initial status
    const unsubOnlineList = on('users:online_list', (data) => {
      const list = data?.users || data || [];
      const found = list.find(u => String(u.userId || u.user_id || u.id) === String(otherId));
      if (found) setOnlineStatus({ online: true, status: found.status || found.activity_status || 'Online' });
      else if (!isGroup) setOnlineStatus({ online: false });
    });

    // Reactions
    // Reactions — backend sends array format: [{emoji, users: [{id, name}]}]
    const unsub8 = on('message:reacted', (data) => {
      if (data?.threadId === threadId && data?.messageId) {
        setMessages(prev => prev.map(m => {
          if (m.id !== data.messageId) return m;
          const meta = { ...(m.metadata || {}) };
          // Clone reactions array from metadata
          const reactions = Array.isArray(meta.reactions) ? meta.reactions.map(r => ({ ...r, users: [...r.users] })) : [];
          const emoji = data.emoji;
          const existingIdx = reactions.findIndex(r => r.emoji === emoji);

          if (data.action === 'removed' || data.action === 'remove') {
            if (existingIdx >= 0) {
              reactions[existingIdx].users = reactions[existingIdx].users.filter(u => String(u.id) !== String(data.userId));
              if (reactions[existingIdx].users.length === 0) reactions.splice(existingIdx, 1);
            }
          } else {
            // added
            if (existingIdx >= 0) {
              if (!reactions[existingIdx].users.find(u => String(u.id) === String(data.userId))) {
                reactions[existingIdx].users.push({ id: data.userId, name: data.userName });
              }
            } else {
              reactions.push({ emoji, users: [{ id: data.userId, name: data.userName }] });
            }
          }
          meta.reactions = reactions;
          return { ...m, metadata: meta, _viewerId: user?.id };
        }));
      }
    });

    // Mute sync
    const unsub9 = on('thread:mute_update', (data) => {
      if (data?.threadId === threadId) setIsMuted(!!data.muted);
    });

    // Pin sync from other users
    const unsub10 = on('message:pinned', (data) => {
      if (data?.threadId === threadId && data?.messageId) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId ? { ...m, metadata: { ...m.metadata, pinned: !!data.pinned, pinnedBy: data.pinnedBy } } : m
        ));
      }
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub4b(); unsub5(); unsub6(); unsub7(); unsubStatus(); unsubOnlineList(); unsub8(); unsub9(); unsub10(); };
  }, [threadId, on, user?.id]);

  // Text formatting helpers
  const applyFormat = useCallback((type) => {
    const wrap = type === 'bold' ? '**' : type === 'italic' ? '_' : '~~';
    setText(prev => prev + wrap + wrap);
    inputRef.current?.focus();
  }, []);

  // Typing indicator — emit on text change
  const typingTimer = useRef(null);
  const handleTextChange = useCallback((val) => {
    setText(val);
    // @mention detection
    const mentionMatch = val.match(/@(\w*)$/);
    if (mentionMatch && isGroup) {
      setMentionQuery(mentionMatch[1]);
    } else {
      setMentionQuery(null);
    }
    if (connected && val.trim()) {
      emit('typing:start', { threadId });
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => emit('typing:stop', { threadId }), 2000);
    }
  }, [connected, emit, threadId, isGroup]);

  // Draft save/load
  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const draft = await AsyncStorage.getItem(`draft-${threadId}`);
        if (draft) setText(draft);
      } catch {}
    })();
  }, [threadId]);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (text.trim()) await AsyncStorage.setItem(`draft-${threadId}`, text);
        else await AsyncStorage.removeItem(`draft-${threadId}`);
      } catch {}
    };
    const timer = setTimeout(saveDraft, 500);
    return () => clearTimeout(timer);
  }, [text, threadId]);

  // Reaction handler
  const handleReact = useCallback(async (messageId, emoji) => {
    try {
      await emit('message:react', { threadId, messageId, emoji });
    } catch { toast('Reaction failed', 'error'); }
  }, [threadId, emit, toast]);

  // Mute toggle
  const handleMuteToggle = useCallback(async () => {
    try {
      await emit('thread:mute', { threadId, muted: !isMuted });
      setIsMuted(!isMuted);
      toast(isMuted ? 'Unmuted' : 'Muted', 'success');
    } catch { toast('Failed', 'error'); }
  }, [threadId, emit, isMuted, toast]);

  // @mention — load group members
  useEffect(() => {
    if (isGroup && mentionQuery !== null) {
      (async () => {
        try {
          const { data } = await api.get(`/chat/threads/${threadId}/members`);
          const members = data?.data?.members || data?.members || data?.data || [];
          const filtered = members.filter(m =>
            String(m.id || m.user_id) !== String(user?.id) &&
            (!mentionQuery || (m.name || '').toLowerCase().includes(mentionQuery.toLowerCase()))
          ).slice(0, 6);
          setMentionList(filtered);
        } catch { setMentionList([]); }
      })();
    } else {
      setMentionList([]);
    }
  }, [mentionQuery, isGroup, threadId, user?.id]);

  const handleMentionSelect = useCallback((member) => {
    setText(prev => prev.replace(/@\w*$/, `@${member.name || member.email} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  }, []);

  // GIF send
  const handleGifSelect = useCallback(async (gif) => {
    setShowGif(false);
    try {
      const res = connected ? await sendMessage(threadId, gif.url, 'gif', { gifUrl: gif.url, previewUrl: gif.previewUrl, source: gif.source }) : null;
      if (res?.ok && res?.message) setMessages(prev => [...prev, res.message]);
      else {
        const restRes = await sendMessageRest(threadId, gif.url, 'gif', { gifUrl: gif.url, previewUrl: gif.previewUrl, source: gif.source });
        if (restRes) setMessages(prev => [...prev, restRes]);
      }
    } catch { toast('Failed to send GIF', 'error'); }
  }, [threadId, sendMessage, connected, toast]);

  // Poll send
  const handlePollSubmit = useCallback(async (poll) => {
    setShowPoll(false);
    try {
      const meta = { question: poll.question, options: poll.options, multiChoice: poll.multiChoice, votes: {} };
      const res = connected ? await sendMessage(threadId, poll.question, 'poll', meta) : null;
      if (res?.ok && res?.message) setMessages(prev => [...prev, res.message]);
      else {
        const restRes = await sendMessageRest(threadId, poll.question, 'poll', meta);
        if (restRes) setMessages(prev => [...prev, restRes]);
      }
      toast('Poll sent', 'success');
    } catch { toast('Failed to send poll', 'error'); }
  }, [threadId, sendMessage, connected, toast]);

  // Poll vote
  const handlePollVote = useCallback(async (messageId, optionIndex) => {
    try {
      await emit('message:poll_vote', { threadId, messageId, optionIndex });
    } catch { toast('Vote failed', 'error'); }
  }, [threadId, emit, toast]);

  const scrollToEnd = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollBtn(false);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true); setText(''); setShowEmoji(false); setShowAttach(false);
    // Clear draft & stop typing
    try { const AS = require('@react-native-async-storage/async-storage').default; AS.removeItem(`draft-${threadId}`); } catch {}
    if (connected) emit('typing:stop', { threadId });

    try {
      // ─── EDIT MODE ───
      if (editingMsg) {
        const editId = editingMsg.id;
        const editText = editingMsg.text;
        setEditingMsg(null);
        try {
          // Try REST first (more reliable), then socket
          let success = false;
          try {
            await api.put(`/chat/threads/${threadId}/messages/${editId}`, { message: trimmed });
            success = true;
          } catch {
            // Fallback to socket
            if (connected) {
              try {
                const res = await emit('message:edit', { threadId, messageId: editId, message: trimmed });
                success = !!(res?.ok || res?.message);
              } catch {}
            }
          }
          if (success) {
            setMessages(prev => prev.map(m =>
              m.id === editId ? { ...m, content: { ...m.content, text: trimmed }, metadata: { ...m.metadata, edited: true } } : m
            ));
            toast('Message edited', 'success');
          } else {
            // Restore edit mode so user can retry
            setEditingMsg({ id: editId, text: editText });
            setText(trimmed);
            toast('Edit failed — try again', 'error');
          }
        } catch {
          setEditingMsg({ id: editId, text: editText });
          setText(trimmed);
          toast('Edit failed', 'error');
        }
        setSending(false);
        return;
      }

      // ─── NORMAL SEND — OPTIMISTIC ───
      const meta = replyTo ? { replyTo } : null;
      setReplyTo(null);
      setSending(false); // unlock button immediately

      // Add optimistic message instantly
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        type: 'text',
        direction: 'outgoing',
        author: { id: user?.id, name: user?.name },
        content: { text: trimmed },
        metadata: { sentAt: new Date().toISOString(), ...(meta || {}) },
        status: 'sending',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
      setTimeout(scrollToEnd, 50);

      // Send in background — queue if offline
      const online = await isOnline();
      if (!online || !connected) {
        // Queue for later
        await enqueue({ ...optimistic, _threadId: threadId, _meta: meta });
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'queued' } : m));
      } else {
        try {
          let realMsg = null;
          const res = await sendMessage(threadId, trimmed, 'text', meta);
          realMsg = res?.message || (res?.ok ? res : null);
          if (!realMsg) {
            const restRes = await sendMessageRest(threadId, trimmed, 'text', meta);
            realMsg = restRes;
          }
          if (realMsg) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...realMsg, status: 'sent' } : m));
          } else {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
          }
        } catch {
          // Queue for retry
          await enqueue({ ...optimistic, _threadId: threadId, _meta: meta });
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'queued' } : m));
        }
      }
      return; // already handled setSending above
    } catch (e) {
      toast('Failed to send', 'error');
      setText(trimmed);
    }
    finally { setSending(false); }
  }, [text, threadId, sendMessage, sending, toast, scrollToEnd, replyTo, connected, editingMsg, emit]);

  // Forward handler
  const toggleForwardSelect = useCallback((id) => {
    setForwardSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleForwardSend = useCallback(async () => {
    if (!forwardMsg || !forwardSelected.length) return;
    setShowForward(false);
    const c = forwardMsg.content || {};
    const fwdMeta = {
      ...(forwardMsg.metadata || {}),
      forwarded: true,
      forwardedBy: user?.name || 'You',
      ...(c.fileName ? { fileName: c.fileName, fileUrl: c.fileUrl, fileKey: c.fileKey, fileType: c.fileType, fileSize: c.fileSize || c.rawSize } : {}),
    };
    let success = 0;
    for (const targetUserId of forwardSelected) {
      try {
        await emit('message:forward', {
          targetThreadId: `dm-${targetUserId}`,
          message: c?.text || c?.url || c?.code || forwardMsg?.message || '',
          message_type: forwardMsg?.type || 'text',
          metadata: fwdMeta,
        });
        success++;
      } catch {}
    }
    toast(`Forwarded to ${success} contact${success > 1 ? 's' : ''}`, 'success');
    setForwardMsg(null);
    setForwardSelected([]);
  }, [forwardMsg, forwardSelected, emit, toast, user]);

  // Helper: send file message with socket + REST fallback
  const sendFileMessage = useCallback(async (msgType, meta) => {
    let res = connected ? await sendMessage(threadId, '', msgType, meta) : null;
    if (!res || res?.error) {
      try {
        const restRes = await sendMessageRest(threadId, '', msgType, meta);
        if (restRes) { setMessages(prev => [...prev, restRes]); return; }
      } catch (e) { throw new Error(e?.response?.data?.message || 'Send failed'); }
    }
    if (res?.ok && res?.message) setMessages(prev => [...prev, res.message]);
    else if (res?.message) setMessages(prev => [...prev, res.message]);
  }, [threadId, sendMessage, connected]);

  // Helper: request permissions
  const ensurePermission = useCallback(async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { toast('Camera permission required', 'warning'); return false; }
    } else if (type === 'gallery') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { toast('Gallery permission required', 'warning'); return false; }
    } else if (type === 'mic') {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') { toast('Microphone permission required', 'warning'); return false; }
    }
    return true;
  }, [toast]);

  // Pick files → add to preview queue (not sent yet)
  const handleImagePick = useCallback(async () => {
    setShowAttach(false);
    if (!(await ensurePermission('gallery'))) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 5,
      });
      if (result.canceled || !result.assets?.length) return;
      const files = result.assets.map(a => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: a.uri,
        name: a.fileName || `photo-${Date.now()}.${(a.mimeType || 'image/jpeg').split('/')[1] || 'jpg'}`,
        mimeType: a.mimeType || a.type || 'image/jpeg',
        size: a.fileSize || 0,
        type: (a.mimeType || '').startsWith('video') ? 'video' : 'image',
      }));
      setPendingFiles(prev => [...prev, ...files]);
    } catch (err) { toast('Failed to pick', 'error'); }
  }, [ensurePermission, toast]);

  const handleCameraPick = useCallback(async () => {
    setShowAttach(false);
    if (!(await ensurePermission('camera'))) return;
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      setPendingFiles(prev => [...prev, {
        id: `${Date.now()}-cam`,
        uri: a.uri,
        name: `camera-${Date.now()}.jpg`,
        mimeType: a.mimeType || 'image/jpeg',
        size: a.fileSize || 0,
        type: 'image',
      }]);
    } catch (err) { toast('Camera failed', 'error'); }
  }, [ensurePermission, toast]);

  const handleFilePick = useCallback(async () => {
    setShowAttach(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (result.canceled || !result.assets?.length) return;
      const files = result.assets.map(a => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: a.uri,
        name: a.name || 'file',
        mimeType: a.mimeType || 'application/octet-stream',
        size: a.size || 0,
        type: 'file',
      }));
      setPendingFiles(prev => [...prev, ...files]);
    } catch (err) { toast('Failed to pick', 'error'); }
  }, [toast]);

  // Remove file from preview
  const removePendingFile = useCallback((id) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Send all pending files — optimistic: show in chat immediately with progress
  const sendPendingFiles = useCallback(async () => {
    if (!pendingFiles.length) return;
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);

    // Add optimistic placeholder messages immediately
    const placeholders = filesToSend.map(file => ({
      id: `temp-${file.id}`,
      type: file.type,
      direction: 'outgoing',
      author: { id: user?.id, name: user?.name },
      content: { fileName: file.name, text: '', _localUri: file.uri },
      metadata: { sentAt: new Date().toISOString() },
      status: 'uploading',
      _uploading: true,
      createdAt: new Date().toISOString(),
    }));
    setMessages(prev => [...prev, ...placeholders]);
    setTimeout(scrollToEnd, 100);

    // Upload each file in background
    for (const file of filesToSend) {
      const tempId = `temp-${file.id}`;
      try {
        const uploaded = await uploadFile({ uri: file.uri, mimeType: file.mimeType, name: file.name });
        const meta = { fileName: uploaded.file_name, fileUrl: uploaded.file_url, fileKey: uploaded.file_key, fileType: uploaded.file_type, fileSize: uploaded.file_size };
        // Send via socket/REST
        const res = connected ? await sendMessage(threadId, '', file.type, meta) : null;
        let realMsg = res?.message || res;
        if (!realMsg || res?.error) {
          try {
            realMsg = await sendMessageRest(threadId, '', file.type, meta);
          } catch {}
        }
        // Replace placeholder with real message
        setMessages(prev => prev.map(m => m.id === tempId ? (realMsg ? { ...realMsg, _uploading: false } : { ...m, status: 'sent', _uploading: false }) : m));
      } catch (err) {
        // Mark as failed
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed', _uploading: false } : m));
        toast(err?.message || 'Upload failed', 'error');
      }
    }
  }, [pendingFiles, user, connected, sendMessage, threadId, toast, scrollToEnd]);

  // ─── Audio Recording (expo-audio) ───
  const startRecording = useCallback(async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) { toast('Microphone permission required', 'warning'); return; }
      audioRecorder.record();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (err) { toast('Failed to start recording', 'error'); }
  }, [audioRecorder, toast]);

  const cancelRecording = useCallback(() => {
    if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
    try { audioRecorder.stop(); } catch {}
    setIsRecording(false); setRecordingDuration(0);
  }, [audioRecorder]);

  const stopAndSendRecording = useCallback(async () => {
    if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
    if (!isRecording) return;
    setSending(true);
    try {
      audioRecorder.stop();
      setIsRecording(false);
      const uri = audioRecorder.uri;
      const duration = recordingDuration;
      setRecordingDuration(0);

      if (!uri) throw new Error('No recording URI');
      const uploaded = await uploadFile({ uri, mimeType: 'audio/m4a', name: `voice-${Date.now()}.m4a` });
      const meta = {
        fileName: uploaded.file_name, fileUrl: uploaded.file_url, fileKey: uploaded.file_key,
        fileType: uploaded.file_type, fileSize: uploaded.file_size, duration,
      };
      await sendFileMessage('audio', meta);
      toast('Voice message sent', 'success');
    } catch (err) { toast(err?.message || 'Send failed', 'error'); }
    finally { setSending(false); }
  }, [isRecording, audioRecorder, recordingDuration, sendFileMessage, toast]);

  // ─── Audio File Pick (not recording, pick existing audio) ───
  const handleAudioPick = useCallback(async () => {
    setShowAttach(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      setSending(true);
      const uploaded = await uploadFile({ uri: file.uri, mimeType: file.mimeType || 'audio/mpeg', name: file.name || 'audio.mp3' });
      const meta = { fileName: uploaded.file_name, fileUrl: uploaded.file_url, fileKey: uploaded.file_key, fileType: uploaded.file_type, fileSize: uploaded.file_size };
      await sendFileMessage('audio', meta);
      toast('Audio sent', 'success');
    } catch (err) { toast(err?.message || 'Failed to send audio', 'error'); }
    finally { setSending(false); }
  }, [sendFileMessage, toast]);

  // ─── Location Send ───
  const handleLocationSend = useCallback(async () => {
    setShowAttach(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast('Location permission required', 'warning'); return; }
      toast('Getting location...', 'info');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      // Try reverse geocode for address
      let address = '';
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) address = [geo.name, geo.street, geo.city, geo.region, geo.country].filter(Boolean).join(', ');
      } catch {}
      const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const text = address ? `📍 ${address}\n${mapUrl}` : `📍 Location\n${mapUrl}`;
      const res = connected ? await sendMessage(threadId, text, 'location', { latitude, longitude, address, mapUrl }) : null;
      if (res?.ok && res?.message) setMessages(prev => [...prev, res.message]);
      else {
        const restRes = await sendMessageRest(threadId, text, 'location', { latitude, longitude, address, mapUrl });
        if (restRes) setMessages(prev => [...prev, restRes]);
      }
      toast('Location sent', 'success');
    } catch (err) { toast(err?.message || 'Failed to send location', 'error'); }
  }, [threadId, sendMessage, connected, toast]);

  // ─── Contact Share ───
  const handleContactShare = useCallback(async () => {
    setShowAttach(false);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') { toast('Contacts permission required', 'warning'); return; }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails] });
      if (!data.length) { toast('No contacts found', 'info'); return; }
      // Show contact picker modal
      setContactList(data.slice(0, 100)); // limit for performance
      setShowContactPicker(true);
    } catch (err) { toast('Failed to load contacts', 'error'); }
  }, [toast]);

  const handleContactSelect = useCallback(async (contact) => {
    const name = contact.name || 'Unknown';
    const phone = contact.phoneNumbers?.[0]?.number || '';
    const email = contact.emails?.[0]?.email || '';
    const lines = [`👤 ${name}`];
    if (phone) lines.push(`📱 ${phone}`);
    if (email) lines.push(`📧 ${email}`);
    const text = lines.join('\n');
    try {
      setShowContactPicker(false);
      const res = connected ? await sendMessage(threadId, text, 'text', { sharedContact: { name, phone, email } }) : null;
      if (res?.ok && res?.message) setMessages(prev => [...prev, res.message]);
      else {
        const restRes = await sendMessageRest(threadId, text, 'text', { sharedContact: { name, phone, email } });
        if (restRes) setMessages(prev => [...prev, restRes]);
      }
      toast('Contact shared', 'success');
    } catch { setShowContactPicker(false); toast('Failed to share contact', 'error'); }
  }, [threadId, sendMessage, connected, toast]);

  const handleScroll = useCallback((e) => {
    // Inverted list — offset 0 = bottom (newest). Higher offset = scrolled up (older)
    const offsetY = e.nativeEvent.contentOffset.y;
    setShowScrollBtn(offsetY > 300);
  }, []);

  // Message actions handler
  const handleMessageAction = useCallback(async (action, msg) => {
    const msgId = msg?.id;
    if (!msgId) return;

    if (action === 'copy') {
      const copyText = msg?.content?.text || msg?.content?.url || msg?.content?.code || msg?.message || '';
      if (copyText) {
        // React Native Clipboard
        try {
          const Clipboard = require('expo-clipboard');
          await Clipboard.setStringAsync(copyText);
          toast('Copied', 'success');
        } catch { toast('Copy failed', 'error'); }
      }
    } else if (action === 'delete') {
      try {
        await emit('message:delete', { threadId, messageId: msgId });
        setMessages(prev => prev.filter(m => m.id !== msgId));
        toast('Message deleted', 'success');
      } catch { toast('Delete failed', 'error'); }
    } else if (action === 'recall') {
      try {
        await emit('message:recall', { threadId, messageId: msgId });
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: { ...m.content, recalled: true } } : m));
        toast('Message unsent', 'success');
      } catch { toast('Unsend failed', 'error'); }
    } else if (action === 'edit') {
      const curText = msg?.content?.text || msg?.message || '';
      setEditingMsg({ id: msgId, text: curText });
      setText(curText);
      setReplyTo(null);
      inputRef.current?.focus();
    } else if (action === 'reply') {
      const c = msg?.content || {};
      const snippet = c?.text || c?.url || c?.code || c?.fileName || (msg?.type === 'image' ? 'Photo' : msg?.type === 'video' ? 'Video' : msg?.type === 'audio' ? 'Voice message' : 'Message');
      setReplyTo({
        messageId: msgId,
        authorId: msg?.author?.id,
        authorName: String(msg?.author?.id) === String(user?.id) ? 'You' : (msg?.author?.name || ''),
        isSelf: String(msg?.author?.id) === String(user?.id),
        snippet: snippet.length > 80 ? snippet.slice(0, 80) + '...' : snippet,
        type: msg?.type || 'text',
        fileName: c?.fileName || null,
      });
      inputRef.current?.focus();
    } else if (action === 'forward') {
      setForwardMsg(msg);
      setShowForward(true);
      // Load contacts for forward picker
      try {
        const { data } = await api.get('/chat/contacts');
        const rows = (data?.data?.contacts || data?.data?.rows || data?.data || []).map(c => ({
          id: c.user_id || c.id,
          name: c.name || c.email,
          avatar: c.profile_url || c.avatar,
        }));
        setForwardContacts(rows);
      } catch {}
    } else if (action === 'pin') {
      const isPinned = msg?.metadata?.pinned;
      try {
        await emit('message:pin', { threadId, messageId: msgId, pinned: !isPinned });
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, metadata: { ...m.metadata, pinned: !isPinned } } : m));
        toast(isPinned ? 'Unpinned' : 'Pinned', 'success');
      } catch { toast('Pin failed', 'error'); }
    } else if (action === 'translate') {
      const msgText = msg?.content?.text || msg?.content?.url || msg?.content?.code || '';
      if (!msgText) return toast('Nothing to translate', 'info');
      // Show language picker first
      setTranslateMsg({ text: msgText, original: msgText });
    } else if (action === 'tone') {
      const msgText = msg?.content?.text || msg?.content?.url || msg?.content?.code || '';
      if (!msgText) return toast('Nothing to adjust', 'info');
      setToneMsg({ text: msgText, original: msgText });
    } else if (action === 'summarize') {
      const c = msg?.content || {};
      const msgText = c?.text || c?.url || c?.code || '';
      if (!msgText && !c?.fileUrl) return toast('Nothing to summarize', 'info');
      toast('Summarizing...', 'info');
      try {
        const body = { text: msgText || undefined, fileUrl: c?.fileUrl || undefined, fileName: c?.fileName || undefined, fileType: c?.fileType || undefined, fileKey: c?.fileKey || undefined };
        const { data } = await api.post('/translate/summarize', body);
        const r = data?.data || data;
        const summary = r?.summary || r?.text || '';
        if (summary) {
          setAiResult({ type: 'summarize', text: summary, original: msgText });
        } else { toast('Summarize failed', 'error'); }
      } catch (e) { toast(e?.response?.data?.message || 'Summarize failed', 'error'); }
    } else if (action === 'info') {
      // Fetch detailed info from backend
      setInfoMsg({ ...msg, _loading: true });
      try {
        const res = await emit('message:info', { messageId: msgId, threadId });
        if (res?.ok && res?.info) {
          setInfoMsg({ ...msg, _info: res.info, _loading: false });
        } else {
          setInfoMsg({ ...msg, _loading: false });
        }
      } catch { setInfoMsg({ ...msg, _loading: false }); }
    } else if (action === 'select') {
      // Toggle select mode
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, _selected: !m._selected } : m
      ));
      toast('Tap messages to select, long press for actions', 'info');
    } else if (action === 'star') {
      try {
        const starred = await toggleStarredMessage(msg, threadId);
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, metadata: { ...m.metadata, starred } } : m));
        toast(starred ? 'Starred' : 'Unstarred', 'success');
      } catch { toast('Failed', 'error'); }
    } else if (action === 'retry') {
      // Retry sending a failed/queued message
      const text = msg?.content?.text;
      if (!text) return;
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sending' } : m));
      try {
        let realMsg = null;
        if (connected) {
          const res = await sendMessage(threadId, text, 'text', msg?.metadata?.replyTo ? { replyTo: msg.metadata.replyTo } : null);
          realMsg = res?.message;
        }
        if (!realMsg) {
          realMsg = await sendMessageRest(threadId, text, 'text');
        }
        if (realMsg) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...realMsg, status: 'sent' } : m));
          await dequeue(msgId);
          toast('Sent', 'success');
        }
      } catch {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'failed' } : m));
        toast('Still offline', 'error');
      }
    }
  }, [threadId, emit, toast, connected, sendMessage]);

  const displayMessages = searchResults || messages;
  // For inverted FlatList — reverse so newest is first (renders at bottom)
  const data = addDateSeparators(displayMessages).slice().reverse();

  // ─── Smart replies: refresh chips when a new incoming msg lands and the
  // composer is empty ──────────────────────────────────────────────────
  useEffect(() => {
    if (text.trim()) { setSmartReplies([]); return; }
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (!last || last.direction === 'outgoing' || String(last.author?.id) === String(user?.id)) {
      setSmartReplies([]);
      return;
    }
    const lastText = last?.content?.text || last?.message || '';
    if (!lastText || lastText.length < 2) return;
    if (smartReplyFor === last.id) return; // already fetched
    setSmartReplyFor(last.id);
    let cancelled = false;
    (async () => {
      try {
        const r = await aiSmartReplies(lastText, { senderName: last?.author?.name || '' });
        if (cancelled) return;
        const list = (r?.suggestions || []).filter(Boolean).slice(0, 3);
        setSmartReplies(list);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [messages, text, smartReplyFor, user?.id]);

  // ─── Smart compose: fetch ghost completion ~800ms after typing stops
  useEffect(() => {
    if (composeTimerRef.current) clearTimeout(composeTimerRef.current);
    const t2 = text.trim();
    if (t2.length < 6 || /[.!?]\s*$/.test(t2)) { setComposeHint(''); return; }
    composeTimerRef.current = setTimeout(async () => {
      try {
        const r = await aiSmartCompose(t2, { threadType: isGroup ? 'group' : 'dm' });
        const completion = (r?.completions?.[0] || '').trim();
        if (!completion) { setComposeHint(''); return; }
        // Show only the trailing portion the user hasn't typed yet
        const lower = completion.toLowerCase();
        const lowerText = t2.toLowerCase();
        if (lower.startsWith(lowerText)) {
          setComposeHint(completion.slice(t2.length));
        } else {
          setComposeHint(completion);
        }
      } catch { setComposeHint(''); }
    }, 800);
    return () => { if (composeTimerRef.current) clearTimeout(composeTimerRef.current); };
  }, [text, isGroup]);

  // Brand colors from theme
  const BRAND = t.accent;
  const headerBg = isDark ? '#1f2c34' : BRAND;
  const chatBgColor = isDark ? '#0b141a' : '#efeae2';
  const footerBg = isDark ? '#1f2c34' : '#f0f2f5';
  const inputBg = isDark ? '#2a3942' : '#ffffff';
  const inputBorder = isDark ? '#2a3942' : '#e0e0e0';

  return (
    <KeyboardAvoidingView
      style={[z.root, { backgroundColor: chatBgColor }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />
      {/* ─── Header ─── */}
      <View style={[z.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={z.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={z.headerTap} activeOpacity={0.7}
          onPress={() => {
            if (isGroup) {
              router.push(`/chat/group-info?threadId=${threadId}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}`);
            } else {
              const otherId = threadId?.replace('dm-', '');
              router.push(`/chat/profile?threadId=${threadId}&userId=${otherId}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}`);
            }
          }}>
          <Avatar uri={avatar} name={name} size={36} />
          <View style={z.headerInfo}>
            <Text style={z.headerName} numberOfLines={1}>{name}</Text>
            <Text style={[z.headerStatus,
              !connected && { color: '#fca5a5' },
              onlineStatus?.online === true && { color: '#86efac' },
              onlineStatus?.status === 'Away' && { color: '#fcd34d' },
              onlineStatus?.status === 'Busy' && { color: '#fca5a5' },
            ]}>
              {typingUsers.length > 0
                ? (isGroup ? `${typingUsers.map(u => u.name?.split(' ')[0]).join(', ')} typing ` : 'typing ') + '•••'
                : !connected ? 'Connecting...'
                : onlineStatus?.online === true ? (onlineStatus?.status === 'Away' ? 'Away' : onlineStatus?.status === 'Busy' ? 'Busy' : onlineStatus?.status === 'DND' ? 'Do Not Disturb' : 'Online')
                : onlineStatus?.lastSeen ? `Last seen ${new Date(onlineStatus.lastSeen).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`
                : onlineStatus?.online === false ? 'Offline'
                : isGroup ? 'tap for info'
                : 'tap for info'}
            </Text>
          </View>
        </TouchableOpacity>
        {!threadId?.startsWith('group-') && (
          <>
            <TouchableOpacity style={z.hdrBtn} onPress={() => {
              const otherId = threadId?.replace('dm-', '');
              startCall({ id: otherId, name, avatar }, 'video');
              router.push('/call?type=video');
            }}>
              <Ionicons name="videocam" size={19} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={z.hdrBtn} onPress={() => {
              const otherId = threadId?.replace('dm-', '');
              startCall({ id: otherId, name, avatar }, 'audio');
              router.push('/call?type=audio');
            }}>
              <Ionicons name="call" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={z.hdrBtn} onPress={() => { setShowSearch(!showSearch); setSearchQuery(''); setSearchResults(null); setSearchType(null); setTimeout(() => searchRef.current?.focus(), 200); }}>
          <Ionicons name={showSearch ? 'close' : 'search'} size={19} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={z.hdrBtn} onPress={() => setShowMenu(true)}><Ionicons name="ellipsis-vertical" size={18} color="#fff" /></TouchableOpacity>
      </View>

      {/* Advanced search bar */}
      {showSearch && (
        <View style={[z.searchWrap, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
          <View style={z.searchRow}>
            <View style={[z.searchInputWrap, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
              <Ionicons name="search" size={16} color={isDark ? '#8696a0' : '#94a3b8'} />
              <TextInput
                ref={searchRef}
                style={[z.searchInput, { color: isDark ? '#e9edef' : '#0f172a' }]}
                placeholder="Search messages..."
                placeholderTextColor={isDark ? '#8696a0' : '#94a3b8'}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
                returnKeyType="search"
              />
              {searching && <ActivityIndicator size="small" color={BRAND} />}
              {(searchQuery.length > 0 || searchType) && !searching && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); setSearchType(null); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={isDark ? '#8696a0' : '#94a3b8'} />
                </TouchableOpacity>
              )}
            </View>
            {searchResults && (
              <Text style={[z.searchCount, { color: isDark ? '#8696a0' : '#64748b' }]}>{searchResults.length}</Text>
            )}
          </View>
          {/* Type filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={z.chipRow} keyboardShouldPersistTaps="handled">
            {[
              { key: 'text', icon: 'text', label: 'Aa' },
              { key: 'image', icon: 'images', label: null },
              { key: 'video', icon: 'videocam', label: null },
              { key: 'file', icon: 'document', label: null },
              { key: 'link', icon: 'link', label: null },
              { key: 'audio', icon: 'mic', label: null },
              { key: 'code', icon: 'code-slash', label: null },
            ].map(f => {
              const active = searchType === f.key;
              return (
                <TouchableOpacity key={f.key}
                  style={[z.chip, { backgroundColor: active ? `${BRAND}15` : (isDark ? '#0f172a' : '#f1f5f9'), borderColor: active ? BRAND : 'transparent' }]}
                  onPress={() => handleSearchType(f.key)} activeOpacity={0.7}>
                  {f.label ? (
                    <Text style={[z.chipText, { color: active ? BRAND : (isDark ? '#8696a0' : '#64748b') }]}>{f.label}</Text>
                  ) : (
                    <Ionicons name={f.icon} size={16} color={active ? BRAND : (isDark ? '#8696a0' : '#64748b')} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ─── Messages ─── */}
      {/* Connection status banner */}
      {!connected && (
        <TouchableOpacity style={z.offlineBanner} onPress={reconnect} activeOpacity={0.7}>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
          <Text style={z.offlineText}>No connection — tap to reconnect</Text>
          <ActivityIndicator size="small" color="#fff" />
        </TouchableOpacity>
      )}

      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ImageBackground source={chatWallpaper ? { uri: chatWallpaper } : chatBg} style={{ flex: 1 }}
            resizeMode={chatWallpaper ? 'cover' : 'repeat'}
            imageStyle={chatWallpaper ? { opacity: 0.15 } : { opacity: isDark ? 0.03 : 0.08, tintColor: isDark ? '#fff' : undefined }}>
            {loading ? (
              <View style={z.loader}><ActivityIndicator size="large" color={BRAND} /></View>
            ) : data.length === 0 ? (
              <View style={z.emptyState}>
                <Ionicons name="chatbubbles-outline" size={64} color={isDark ? '#3a4a54' : '#c8d6de'} />
                <Text style={[z.emptyTitle, { color: isDark ? '#8696a0' : '#667781' }]}>No messages yet</Text>
                <Text style={[z.emptySubtitle, { color: isDark ? '#5a6b75' : '#8696a0' }]}>
                  Send a message to start the conversation
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={data}
                keyExtractor={(item, i) => item._key || item.id || String(i)}
                renderItem={({ item }) => {
                  if (item._type === 'date') {
                    return (
                      <View style={z.dateRow}>
                        <View style={[z.dateBadge, { backgroundColor: isDark ? '#233138' : '#fff' }]}>
                          <Text style={[z.dateText, { color: isDark ? '#8696a0' : '#54656f' }]}>{item._label}</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <ChatBubble
                      message={{ ...item, _viewerId: user?.id }}
                      isOwn={item.direction === 'outgoing' || String(item.author?.id) === String(user?.id)}
                      showName={isGroup}
                      onAction={(action, msg) => handleMessageAction(action, msg)}
                      onReact={handleReact}
                      onPollVote={handlePollVote}
                      onImagePress={(uri, caption) => setViewImage({ uri, caption })}
                      accentColor={BRAND}
                      textSize={t.fontSize}
                      viewerIsAdmin={isGroupAdmin}
                      isDark={isDark}
                    />
                  );
                }}
                contentContainerStyle={[z.msgList, data.length === 0 && { flex: 1 }]}
                inverted
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={100}
                removeClippedSubviews={true}
                maxToRenderPerBatch={15}
                windowSize={10}
                initialNumToRender={20}
              />
            )}

            {/* Scroll-to-bottom FAB */}
            <Animated.View style={[z.scrollFab, {
              opacity: scrollBtnAnim,
              transform: [{ scale: scrollBtnAnim }],
              backgroundColor: isDark ? '#233138' : '#fff',
            }]}>
              <TouchableOpacity onPress={scrollToEnd} style={z.scrollFabBtn}>
                <Ionicons name="chevron-down" size={20} color={isDark ? '#8696a0' : '#54656f'} />
              </TouchableOpacity>
            </Animated.View>
          </ImageBackground>
        </View>

        {/* ─── Attachment Menu ─── */}
        {showAttach && (
          <View style={[z.attachMenu, { backgroundColor: isDark ? '#233138' : '#fff' }]}>
            {[
              { icon: 'document', label: 'Document', color: '#7c5cfc', bg: '#ede9fe', onPress: handleFilePick },
              { icon: 'camera', label: 'Camera', color: '#e91e63', bg: '#fce7f3', onPress: handleCameraPick },
              { icon: 'images', label: 'Gallery', color: '#8b5cf6', bg: '#ede9fe', onPress: handleImagePick },
              { icon: 'musical-notes', label: 'Audio', color: '#f59e0b', bg: '#fef3c7', onPress: handleAudioPick },
              { icon: 'location', label: 'Location', color: '#22c55e', bg: '#dcfce7', onPress: handleLocationSend },
              { icon: 'person', label: 'Contact', color: '#2563eb', bg: '#dbeafe', onPress: handleContactShare },
              { icon: 'videocam', label: 'Video', color: '#f59e0b', bg: '#fef3c7', onPress: async () => {
                setShowAttach(false);
                if (!(await ensurePermission('camera'))) return;
                try {
                  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 0.7, videoMaxDuration: 120 });
                  if (result.canceled || !result.assets?.[0]) return;
                  const a = result.assets[0];
                  setPendingFiles(prev => [...prev, { id: `${Date.now()}-vid`, uri: a.uri, name: `video-${Date.now()}.mp4`, mimeType: a.mimeType || 'video/mp4', size: a.fileSize || 0, type: 'video' }]);
                } catch { toast('Video recording failed', 'error'); }
              }},
              { icon: 'logo-youtube', label: 'GIF', color: '#ec4899', bg: '#fce7f3', onPress: () => { setShowAttach(false); setShowGif(true); } },
              { icon: 'stats-chart', label: 'Poll', color: '#8b5cf6', bg: '#ede9fe', onPress: () => { setShowAttach(false); setShowPoll(true); } },
            ].map(a => (
              <TouchableOpacity key={a.label} style={z.attachItem} onPress={a.onPress} activeOpacity={0.7}>
                <View style={[z.attachIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={[z.attachLabel, { color: isDark ? '#d1d7db' : '#54656f' }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Language Picker for Translate ─── */}
        {translateMsg && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setTranslateMsg(null)}>
            <View style={z.aiOverlay}>
              <View style={[z.langSheet, { backgroundColor: isDark ? '#1e293b' : '#fff', paddingBottom: insets.bottom + 16 }]}>
                <View style={z.aiHeader}>
                  <Ionicons name="language-outline" size={20} color="#06b6d4" />
                  <Text style={[z.aiTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Translate to</Text>
                  <TouchableOpacity onPress={() => setTranslateMsg(null)} hitSlop={10}>
                    <Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                  {[
                    { code: 'English', flag: '🇬🇧' },
                    { code: 'Hindi', flag: '🇮🇳' },
                    { code: 'Spanish', flag: '🇪🇸' },
                    { code: 'French', flag: '🇫🇷' },
                    { code: 'German', flag: '🇩🇪' },
                    { code: 'Chinese', flag: '🇨🇳' },
                    { code: 'Japanese', flag: '🇯🇵' },
                    { code: 'Korean', flag: '🇰🇷' },
                    { code: 'Arabic', flag: '🇸🇦' },
                    { code: 'Portuguese', flag: '🇧🇷' },
                    { code: 'Russian', flag: '🇷🇺' },
                    { code: 'Italian', flag: '🇮🇹' },
                    { code: 'Bengali', flag: '🇧🇩' },
                    { code: 'Tamil', flag: '🇮🇳' },
                    { code: 'Telugu', flag: '🇮🇳' },
                    { code: 'Marathi', flag: '🇮🇳' },
                    { code: 'Gujarati', flag: '🇮🇳' },
                    { code: 'Urdu', flag: '🇵🇰' },
                  ].map(lang => (
                    <TouchableOpacity key={lang.code}
                      style={[z.langRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                      onPress={async () => {
                        const msgText = translateMsg.text;
                        setTranslateMsg(null);
                        toast('Translating...', 'info');
                        try {
                          const { data } = await api.post('/translate', { text: msgText, targetLanguage: lang.code });
                          const r = data?.data || data;
                          const translated = r?.translated || r?.translatedText || '';
                          if (translated) {
                            setAiResult({ type: 'translate', text: translated, original: msgText, lang: lang.code });
                          } else { toast('Translation failed', 'error'); }
                        } catch (e) { toast(e?.response?.data?.message || 'Translation failed', 'error'); }
                      }} activeOpacity={0.6}>
                      <Text style={z.langFlag}>{lang.flag}</Text>
                      <Text style={[z.langName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{lang.code}</Text>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? '#475569' : '#cbd5e1'} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* ─── Tone Picker Modal ─── */}
        {toneMsg && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setToneMsg(null)}>
            <View style={z.aiOverlay}>
              <View style={[z.aiSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                <View style={z.aiHeader}>
                  <View style={[z.aiIconWrap, { backgroundColor: '#10b98112' }]}>
                    <Ionicons name="options-outline" size={20} color="#10b981" />
                  </View>
                  <Text style={[z.aiTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Adjust tone</Text>
                  <TouchableOpacity onPress={() => setToneMsg(null)} hitSlop={10}>
                    <Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} />
                  </TouchableOpacity>
                </View>
                <View style={[z.aiOriginal, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', marginHorizontal: 16, marginTop: 8 }]}>
                  <Text style={[z.aiOrigLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Original</Text>
                  <Text style={[z.aiOrigText, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={3}>{toneMsg.original}</Text>
                </View>
                <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                  {[
                    { key: 'professional', label: 'Professional', icon: 'briefcase-outline' },
                    { key: 'friendly', label: 'Friendly', icon: 'happy-outline' },
                    { key: 'formal', label: 'Formal', icon: 'school-outline' },
                    { key: 'diplomatic', label: 'Diplomatic', icon: 'leaf-outline' },
                  ].map(opt => (
                    <TouchableOpacity key={opt.key}
                      style={[z.langRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                      onPress={async () => {
                        const msgText = toneMsg.text;
                        setToneMsg(null);
                        toast('Adjusting tone...', 'info');
                        try {
                          const { data } = await api.post('/translate/tone-adjust', { text: msgText, tone: opt.key });
                          const r = data?.data || data;
                          const adjusted = r?.adjusted || r?.text || '';
                          if (adjusted) {
                            setAiResult({ type: 'tone', text: adjusted, original: msgText, lang: opt.label });
                          } else { toast('Failed', 'error'); }
                        } catch (e) { toast(e?.response?.data?.message || 'Failed', 'error'); }
                      }} activeOpacity={0.6}>
                      <Ionicons name={opt.icon} size={18} color="#10b981" />
                      <Text style={[z.langName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{opt.label}</Text>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? '#475569' : '#cbd5e1'} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* ─── AI Result Modal (Translate / Summarize / Tone) ─── */}
        {aiResult && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setAiResult(null)}>
            <View style={z.aiOverlay}>
              <View style={[z.aiSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                <View style={z.aiHeader}>
                  {(() => {
                    const meta = aiResult.type === 'translate'
                      ? { bg: '#06b6d412', icon: 'language-outline', color: '#06b6d4', title: `Translation${aiResult.lang ? ` (${aiResult.lang})` : ''}` }
                      : aiResult.type === 'tone'
                        ? { bg: '#10b98112', icon: 'options-outline', color: '#10b981', title: `${aiResult.lang || 'Adjusted'} tone` }
                        : { bg: '#8b5cf612', icon: 'sparkles-outline', color: '#8b5cf6', title: 'Summary' };
                    return (
                      <>
                        <View style={[z.aiIconWrap, { backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={20} color={meta.color} />
                        </View>
                        <Text style={[z.aiTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{meta.title}</Text>
                      </>
                    );
                  })()}
                  <TouchableOpacity onPress={() => setAiResult(null)} hitSlop={10}>
                    <Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={z.aiBody} showsVerticalScrollIndicator={true} nestedScrollEnabled>
                  {aiResult.original ? (
                    <View style={[z.aiOriginal, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                      <Text style={[z.aiOrigLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Original</Text>
                      <Text style={[z.aiOrigText, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={4}>{aiResult.original}</Text>
                    </View>
                  ) : null}
                  <Text style={[z.aiResultText, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{aiResult.text}</Text>
                </ScrollView>
                <View style={z.aiActions}>
                  <TouchableOpacity style={[z.aiBtn, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}
                    onPress={async () => {
                      try { const C = require('expo-clipboard'); await C.setStringAsync(aiResult.text); toast('Copied', 'success'); }
                      catch { toast('Copy failed', 'error'); }
                    }}>
                    <Ionicons name="copy-outline" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                    <Text style={[z.aiBtnText, { color: isDark ? '#94a3b8' : '#64748b' }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[z.aiBtn, { backgroundColor: BRAND }]}
                    onPress={() => { setText(aiResult.text); setAiResult(null); }}>
                    <Ionicons name="arrow-redo-outline" size={16} color="#fff" />
                    <Text style={[z.aiBtnText, { color: '#fff' }]}>Use as Reply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ─── Message Info Modal (WhatsApp-style) ─── */}
        {infoMsg && (() => {
          const inf = infoMsg._info || {};
          const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
          const reads = inf?.receipts?.read || [];
          const delivered = inf?.receipts?.delivered || [];
          const senderLoc = inf?.sender?.location || infoMsg?.metadata?.senderLocation || '';
          const senderDevice = inf?.sender?.device || '';
          return (
            <Modal visible transparent animationType="slide" onRequestClose={() => setInfoMsg(null)}>
              <View style={z.aiOverlay}>
                <View style={[z.infoSheet, { backgroundColor: isDark ? '#1e293b' : '#fff', paddingBottom: insets.bottom + 16 }]}>
                  <View style={z.aiHeader}>
                    <Ionicons name="information-circle" size={22} color={BRAND} />
                    <Text style={[z.aiTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Message Info</Text>
                    <TouchableOpacity onPress={() => setInfoMsg(null)} hitSlop={10}>
                      <Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                  </View>

                  {infoMsg._loading ? (
                    <ActivityIndicator color={BRAND} style={{ marginVertical: 30 }} />
                  ) : (
                    <ScrollView style={z.aiBody} showsVerticalScrollIndicator={true} nestedScrollEnabled>
                      {/* Message preview */}
                      {infoMsg?.content?.text && (
                        <View style={[z.infoSection, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 8 }]}>
                          <Text style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }} numberOfLines={3}>{infoMsg.content.text}</Text>
                        </View>
                      )}

                      {/* Sender info */}
                      <View style={z.infoSection}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Sent by</Text>
                        <Text style={[z.infoSecTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
                          {String(infoMsg?.author?.id) === String(user?.id) ? 'You' : (infoMsg?.author?.name || inf?.sender?.name || 'Unknown')}
                        </Text>
                        <Text style={[z.infoSecSub, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                          {fmtDate(inf?.sendTime || infoMsg?.metadata?.sentAt)}
                        </Text>
                        {(senderDevice || senderLoc) ? (
                          <View style={z.infoDeviceRow}>
                            {senderDevice ? <><Ionicons name="phone-portrait-outline" size={12} color={isDark ? '#64748b' : '#94a3b8'} /><Text style={[z.infoDeviceText, { color: isDark ? '#64748b' : '#94a3b8' }]}>{senderDevice}</Text></> : null}
                            {senderLoc ? <><Ionicons name="location-outline" size={12} color={isDark ? '#64748b' : '#94a3b8'} /><Text style={[z.infoDeviceText, { color: isDark ? '#64748b' : '#94a3b8' }]}>{senderLoc}</Text></> : null}
                          </View>
                        ) : null}
                      </View>

                      {/* Read receipts */}
                      <View style={[z.infoSection, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? '#334155' : '#f1f5f9' }]}>
                        <View style={z.infoTickRow}>
                          <Ionicons name="checkmark-done" size={16} color="#53bdeb" />
                          <Text style={[z.infoTickLabel, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Read</Text>
                          <Text style={[z.infoTickCount, { color: isDark ? '#64748b' : '#94a3b8' }]}>{reads.length} read</Text>
                        </View>
                        {reads.length > 0 ? reads.map((r, i) => (
                          <View key={i} style={z.infoReceiptRow}>
                            <Avatar uri={r.avatar} name={r.name} size={36} />
                            <View style={{ flex: 1 }}>
                              <Text style={[z.infoReceiptName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{r.name}</Text>
                              <Text style={[z.infoReceiptMeta, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                                {r.readAt ? `Read • ${fmtDate(r.readAt)}` : 'Read'}{r.device ? ` • ${r.device}` : ''}
                              </Text>
                              {r.location ? <Text style={[z.infoReceiptMeta, { color: isDark ? '#64748b' : '#94a3b8' }]}>{r.location}</Text> : null}
                            </View>
                          </View>
                        )) : (
                          <Text style={[z.infoEmpty, { color: isDark ? '#475569' : '#cbd5e1' }]}>Not read yet</Text>
                        )}
                      </View>

                      {/* Delivered receipts */}
                      <View style={[z.infoSection, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? '#334155' : '#f1f5f9' }]}>
                        <View style={z.infoTickRow}>
                          <Ionicons name="checkmark-done" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                          <Text style={[z.infoTickLabel, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Delivered</Text>
                          <Text style={[z.infoTickCount, { color: isDark ? '#64748b' : '#94a3b8' }]}>{delivered.length} delivered</Text>
                        </View>
                        {delivered.map((r, i) => (
                          <View key={i} style={z.infoReceiptRow}>
                            <Avatar uri={r.avatar} name={r.name} size={36} />
                            <View style={{ flex: 1 }}>
                              <Text style={[z.infoReceiptName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{r.name}</Text>
                              <Text style={[z.infoReceiptMeta, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                                {r.deliveredAt ? `Delivered • ${fmtDate(r.deliveredAt)}` : 'Delivered'}{r.device ? ` • ${r.device}` : ''}
                              </Text>
                              {r.location ? <Text style={[z.infoReceiptMeta, { color: isDark ? '#64748b' : '#94a3b8' }]}>{r.location}</Text> : null}
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Timeline */}
                      <View style={[z.infoSection, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? '#334155' : '#f1f5f9' }]}>
                        <Text style={[z.infoTickLabel, { color: isDark ? '#f1f5f9' : '#0f172a', marginBottom: 8 }]}>Timeline</Text>
                        {[
                          { label: 'Sent', time: inf?.sendTime || infoMsg?.metadata?.sentAt, icon: 'checkmark', color: isDark ? '#64748b' : '#94a3b8' },
                          { label: 'Delivered', time: inf?.deliveredTime, icon: 'checkmark-done', color: isDark ? '#64748b' : '#94a3b8' },
                          { label: 'Read', time: inf?.readTime || infoMsg?.metadata?.readAt, icon: 'checkmark-done', color: '#53bdeb' },
                          inf?.editTime ? { label: 'Edited', time: inf.editTime, icon: 'create-outline', color: '#f59e0b' } : null,
                        ].filter(Boolean).map((t, i) => (
                          <View key={i} style={z.timelineRow}>
                            <View style={[z.timelineDot, { backgroundColor: t.time ? t.color : (isDark ? '#334155' : '#e2e8f0') }]}>
                              <Ionicons name={t.icon} size={10} color={t.time ? '#fff' : (isDark ? '#64748b' : '#94a3b8')} />
                            </View>
                            {i < 3 && <View style={[z.timelineLine, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />}
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={[z.timelineLabel, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{t.label}</Text>
                              <Text style={[z.timelineTime, { color: isDark ? '#64748b' : '#94a3b8' }]}>{t.time ? fmtDate(t.time) : '—'}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </View>
              </View>
            </Modal>
          );
        })()}

        <View>
        {/* ─── File Preview Queue ─── */}
        {pendingFiles.length > 0 && (
          <View style={[z.previewBar, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={z.previewScroll}>
              {pendingFiles.map(f => {
                const isImg = f.type === 'image';
                const ext = (f.name.split('.').pop() || '').toUpperCase();
                const sizeLabel = f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : f.size > 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${f.size} B`;
                return (
                  <View key={f.id} style={[z.previewItem, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                    <TouchableOpacity style={z.previewClose} onPress={() => removePendingFile(f.id)}>
                      <Ionicons name="close-circle" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                    </TouchableOpacity>
                    {isImg ? (
                      <Image source={{ uri: f.uri }} style={z.previewThumb} resizeMode="cover" />
                    ) : (
                      <View style={[z.previewFileBadge, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                        <Text style={[z.previewExt, { color: isDark ? '#94a3b8' : '#64748b' }]}>{ext}</Text>
                      </View>
                    )}
                    <Text style={[z.previewName, { color: t.text }]} numberOfLines={1}>{f.name}</Text>
                    <Text style={[z.previewSize, { color: t.textTer }]}>{sizeLabel}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[z.previewSendBtn, { backgroundColor: BRAND }]} onPress={sendPendingFiles}
              disabled={sending} activeOpacity={0.8}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> :
                <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Edit Bar ─── */}
        {editingMsg && (
          <View style={[z.replyBar, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
            <View style={[z.replyAccent, { backgroundColor: '#f59e0b' }]} />
            <View style={z.replyBody}>
              <Text style={[z.replyAuthor, { color: '#f59e0b' }]}>Editing message</Text>
              <Text style={[z.replySnippet, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{editingMsg.text}</Text>
            </View>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setText(''); }} hitSlop={8} style={z.replyClose}>
              <Ionicons name="close" size={18} color={isDark ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Reply Preview Bar ─── */}
        {replyTo && !editingMsg && (
          <View style={[z.replyBar, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
            <View style={[z.replyAccent, { backgroundColor: BRAND }]} />
            <View style={z.replyBody}>
              <Text style={[z.replyAuthor, { color: BRAND }]}>{replyTo.authorName}</Text>
              <Text style={[z.replySnippet, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{replyTo.snippet}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={8} style={z.replyClose}>
              <Ionicons name="close" size={18} color={isDark ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Forward Modal ─── */}
        {showForward && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowForward(false)}>
            <View style={[z.fwdOverlay]}>
              <View style={[z.fwdSheet, { backgroundColor: isDark ? '#1e293b' : '#fff', paddingBottom: insets.bottom }]}>
                <View style={z.fwdHeader}>
                  <Text style={[z.fwdTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Forward to {forwardSelected.length > 0 ? `(${forwardSelected.length})` : ''}</Text>
                  <TouchableOpacity onPress={() => { setShowForward(false); setForwardSelected([]); }}><Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
                </View>
                <View style={[z.fwdSearch, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
                  <Ionicons name="search" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                  <TextInput style={[z.fwdSearchInput, { color: isDark ? '#f1f5f9' : '#0f172a' }]}
                    placeholder="Search contacts..." placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                    value={forwardSearch} onChangeText={setForwardSearch} />
                </View>
                <FlatList
                  data={forwardContacts.filter(c => !forwardSearch || (c.name || '').toLowerCase().includes(forwardSearch.toLowerCase()))}
                  keyExtractor={c => String(c.id)}
                  renderItem={({ item: c }) => {
                    const sel = forwardSelected.includes(c.id);
                    return (
                      <TouchableOpacity style={[z.fwdRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                        onPress={() => toggleForwardSelect(c.id)} activeOpacity={0.6}>
                        <Avatar uri={c.avatar} name={c.name} size={42} />
                        <Text style={[z.fwdName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{c.name}</Text>
                        <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={sel ? BRAND : (isDark ? '#334155' : '#cbd5e1')} />
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<Text style={[z.fwdEmpty, { color: isDark ? '#64748b' : '#94a3b8' }]}>No contacts</Text>}
                />
                {forwardSelected.length > 0 && (
                  <TouchableOpacity style={[z.fwdSendBtn, { backgroundColor: BRAND }]} onPress={handleForwardSend} activeOpacity={0.8}>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={z.fwdSendText}>Forward to {forwardSelected.length}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
        )}

        {/* ─── Contact Picker Modal ─── */}
        {showContactPicker && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowContactPicker(false)}>
            <View style={z.fwdOverlay}>
              <View style={[z.fwdSheet, { backgroundColor: isDark ? '#1e293b' : '#fff', paddingBottom: insets.bottom }]}>
                <View style={z.fwdHeader}>
                  <Text style={[z.fwdTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Share Contact</Text>
                  <TouchableOpacity onPress={() => setShowContactPicker(false)}>
                    <Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={contactList}
                  keyExtractor={(c, i) => c.id || String(i)}
                  renderItem={({ item: c }) => (
                    <TouchableOpacity
                      style={[z.fwdRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                      onPress={() => handleContactSelect(c)} activeOpacity={0.6}>
                      <View style={[z.contactAvatar, { backgroundColor: isDark ? '#0f172a' : '#e0f2fe' }]}>
                        <Ionicons name="person" size={18} color={isDark ? '#38bdf8' : '#2563eb'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[z.fwdName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{c.name || 'Unknown'}</Text>
                        {c.phoneNumbers?.[0]?.number ? (
                          <Text style={{ fontSize: 12, color: isDark ? '#64748b' : '#94a3b8' }}>{c.phoneNumbers[0].number}</Text>
                        ) : null}
                      </View>
                      <Ionicons name="share-outline" size={16} color={BRAND} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={[z.fwdEmpty, { color: isDark ? '#64748b' : '#94a3b8' }]}>No contacts</Text>}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* ─── Header Menu Modal ─── */}
        {showMenu && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
            <Pressable style={z.menuOverlay} onPress={() => setShowMenu(false)}>
              <View style={[z.menuSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                {[
                  { icon: isMuted ? 'notifications-outline' : 'notifications-off-outline', label: isMuted ? 'Unmute' : 'Mute', onPress: () => { setShowMenu(false); handleMuteToggle(); } },
                  { icon: 'images-outline', label: 'Media & Files', onPress: () => { setShowMenu(false); router.push(`/chat/media?threadId=${threadId}&name=${encodeURIComponent(name || '')}`); } },
                  { icon: 'star-outline', label: 'Starred Messages', onPress: () => { setShowMenu(false); router.push('/chat/starred'); } },
                  { icon: 'image-outline', label: 'Set Wallpaper', onPress: async () => {
                    setShowMenu(false);
                    try {
                      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
                      if (!result.canceled && result.assets?.[0]) {
                        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                        await AsyncStorage.setItem(`wallpaper-${threadId}`, result.assets[0].uri);
                        setChatWallpaper(result.assets[0].uri);
                        toast('Wallpaper set', 'success');
                      }
                    } catch { toast('Failed', 'error'); }
                  }},
                  ...(chatWallpaper ? [{ icon: 'close-circle-outline', label: 'Remove Wallpaper', onPress: async () => {
                    setShowMenu(false);
                    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                    await AsyncStorage.removeItem(`wallpaper-${threadId}`);
                    setChatWallpaper(null);
                    toast('Wallpaper removed', 'success');
                  }}] : []),
                  { icon: 'timer-outline', label: 'Disappearing Messages', onPress: () => {
                    setShowMenu(false);
                    const { Alert } = require('react-native');
                    Alert.alert('Disappearing Messages', 'Auto-delete messages after:', [
                      { text: 'Off', onPress: () => { emit('thread:disappearing', { threadId, duration: 0 }); toast('Disappearing off', 'info'); } },
                      { text: '24 Hours', onPress: () => { emit('thread:disappearing', { threadId, duration: 86400 }); toast('Messages disappear after 24h', 'success'); } },
                      { text: '7 Days', onPress: () => { emit('thread:disappearing', { threadId, duration: 604800 }); toast('Messages disappear after 7 days', 'success'); } },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }},
                  { icon: 'download-outline', label: 'Export Chat', onPress: async () => {
                    setShowMenu(false);
                    try {
                      const txt = messages.map(m => {
                        const t = m?.createdAt ? new Date(m.createdAt).toLocaleString() : '';
                        const author = m?.author?.name || (m?.direction === 'outgoing' ? 'You' : name);
                        const content = m?.content?.text || m?.content?.fileName || m?.type || '';
                        return `[${t}] ${author}: ${content}`;
                      }).join('\n');
                      const { File, Paths } = require('expo-file-system/next');
                      const Sharing = require('expo-sharing');
                      const file = new File(Paths.cache, `chat-export-${Date.now()}.txt`);
                      file.text = txt;
                      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
                      else toast('Sharing not available', 'error');
                    } catch { toast('Export failed', 'error'); }
                  }},
                ].map((item, i) => (
                  <TouchableOpacity key={i} style={[z.menuItem, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                    onPress={item.onPress} activeOpacity={0.6}>
                    <Ionicons name={item.icon} size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                    <Text style={[z.menuItemText, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </Modal>
        )}

        {/* ─── @Mention suggestions ─── */}
        {mentionList.length > 0 && (
          <View style={[z.mentionBar, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
            {mentionList.map(m => (
              <TouchableOpacity key={m.id || m.user_id} style={[z.mentionItem, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                onPress={() => handleMentionSelect(m)} activeOpacity={0.6}>
                <Avatar uri={m.profile_url || m.avatar} name={m.name} size={30} />
                <Text style={[z.mentionName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Formatting toolbar ─── */}
        {showFormatBar && (
          <View style={[z.formatBar, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
            {[
              { icon: 'text', label: 'B', style: { fontWeight: '900' }, type: 'bold' },
              { icon: 'text', label: 'I', style: { fontStyle: 'italic' }, type: 'italic' },
              { icon: 'text', label: 'S', style: { textDecorationLine: 'line-through' }, type: 'strike' },
            ].map(f => (
              <TouchableOpacity key={f.type} style={[z.formatBtn, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}
                onPress={() => applyFormat(f.type)} activeOpacity={0.7}>
                <Text style={[z.formatLabel, { color: isDark ? '#f1f5f9' : '#0f172a' }, f.style]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Left group banner ─── */}
        {hasLeftGroup ? (
          <View style={[z.airtimeBanner, { backgroundColor: isDark ? '#1e293b' : '#fee2e2' }]}>
            <Ionicons name="exit-outline" size={18} color="#ef4444" />
            <Text style={[z.airtimeText, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
              {groupInfo?.memberStatus === 'kicked' ? 'You were removed from this group' : 'You left this group'}
            </Text>
          </View>
        ) : (isAirtime && !isGroupAdmin) ? (
          <View style={[z.airtimeBanner, { backgroundColor: isDark ? '#1e293b' : '#fef3c7' }]}>
            <Ionicons name="megaphone-outline" size={18} color="#f59e0b" />
            <Text style={[z.airtimeText, { color: isDark ? '#fbbf24' : '#92400e' }]}>Only admins can send messages</Text>
          </View>
        ) : null}

        {/* ─── Footer ─── */}
        <View style={[z.footer, {
          backgroundColor: footerBg,
          paddingBottom: kbOpen ? 2 : Math.max(insets.bottom, 6),
          display: (hasLeftGroup || (isAirtime && !isGroupAdmin)) ? 'none' : 'flex',
        }]}>
          {/* AI Smart Reply chips */}
          {!isRecording && smartReplies.length > 0 && !text.trim() && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 6 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[z.smartChip, { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: BRAND }]}>
                <Ionicons name="sparkles" size={11} color={BRAND} />
                <Text style={[z.smartChipLabel, { color: BRAND }]}>AI</Text>
              </View>
              {smartReplies.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[z.smartChip, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
                  onPress={() => { setText(s); setSmartReplies([]); inputRef.current?.focus(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[z.smartChipLabel, { color: isDark ? '#e2e8f0' : '#0f172a' }]} numberOfLines={1}>
                    {s.length > 60 ? s.slice(0, 60) + '…' : s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Smart compose ghost hint */}
          {!isRecording && composeHint && text.trim() && (
            <TouchableOpacity
              style={[z.composeHint, { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: BRAND }]}
              onPress={() => { setText(text + composeHint); setComposeHint(''); inputRef.current?.focus(); }}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={11} color={BRAND} />
              <Text style={[z.composeHintTxt, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
                {composeHint.trim()}
              </Text>
              <Text style={[z.composeHintAccept, { color: BRAND }]}>Tap to add</Text>
            </TouchableOpacity>
          )}

          {!isRecording && (
          <View style={[z.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <TouchableOpacity onPress={() => { setShowEmoji(!showEmoji); setShowAttach(false); setShowGif(false); Keyboard.dismiss(); }} style={z.footerIcon}>
              <Ionicons name={showEmoji ? 'keypad' : 'happy-outline'} size={23} color={isDark ? '#8696a0' : '#54656f'} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={[z.textInput, { color: isDark ? '#e9edef' : '#303030' }]}
              placeholder="Message"
              placeholderTextColor={isDark ? '#8696a0' : '#99a5ad'}
              value={text}
              onChangeText={handleTextChange}
              multiline
              maxLength={5000}
              onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
            />

            <TouchableOpacity onPress={() => { setShowAttach(!showAttach); setShowEmoji(false); Keyboard.dismiss(); }} style={z.footerIcon}>
              <Ionicons name="attach" size={23} color={isDark ? '#8696a0' : '#54656f'} style={{ transform: [{ rotate: '-45deg' }] }} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowFormatBar(!showFormatBar)} style={z.footerIcon}>
              <Ionicons name="text" size={19} color={showFormatBar ? BRAND : (isDark ? '#8696a0' : '#54656f')} />
            </TouchableOpacity>

            {!text.trim() && (
              <TouchableOpacity onPress={handleCameraPick} style={z.footerIcon}>
                <Ionicons name="camera" size={21} color={isDark ? '#8696a0' : '#54656f'} />
              </TouchableOpacity>
            )}
          </View>
          )}

          {/* Send / Mic button */}
          {isRecording ? (
            /* Recording mode — hide input row, show recording controls */
            <View style={z.recordingRow}>
              <TouchableOpacity onPress={cancelRecording} style={[z.recordCancelBtn, { backgroundColor: `${t.red}15` }]}>
                <Ionicons name="trash-outline" size={18} color={t.red} />
              </TouchableOpacity>
              <View style={z.recordingInfo}>
                <View style={[z.recordDot, { backgroundColor: t.red }]} />
                <Text style={[z.recordTime, { color: t.red }]}>
                  {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                </Text>
              </View>
              <TouchableOpacity onPress={stopAndSendRecording} style={[z.sendBtn, { backgroundColor: BRAND }]} activeOpacity={0.7}>
                <Ionicons name="send" size={19} color="#fff" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={text.trim() ? handleSend : startRecording}
              onLongPress={text.trim() ? () => setScheduleModal(true) : startRecording}
              style={[z.sendBtn, { backgroundColor: text.trim() ? BRAND : (isDark ? '#2a3942' : '#e2e8f0') }]}
              disabled={sending}
              activeOpacity={0.7}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> :
                text.trim() ? <Ionicons name="send" size={19} color="#fff" style={{ marginLeft: 2 }} /> :
                <Ionicons name="mic" size={22} color={isDark ? '#8696a0' : '#54656f'} />}
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Schedule message modal ─── */}
        {scheduleModal && (
          <ScheduleMessageModal
            isDark={isDark}
            theme={t}
            initialText={text}
            onCancel={() => setScheduleModal(false)}
            onSchedule={async ({ sendAt }) => {
              try {
                const res = await emit('message:schedule', {
                  threadId,
                  message: text.trim(),
                  messageType: 'text',
                  sendAt,
                });
                if (res?.ok) {
                  setText('');
                  setScheduleModal(false);
                  toast('Scheduled', 'success');
                } else {
                  toast(res?.error || 'Schedule failed', 'error');
                }
              } catch (e) {
                toast(e?.message || 'Schedule failed', 'error');
              }
            }}
          />
        )}

        {/* ─── Emoji Picker ─── */}
        {showEmoji && <EmojiPicker onSelect={e => setText(prev => prev + e)} onClose={() => setShowEmoji(false)} />}

        {/* ─── GIF Picker ─── */}
        {showGif && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowGif(false)}>
            <View style={z.aiOverlay}>
              <GifPicker onSelect={handleGifSelect} onClose={() => setShowGif(false)} />
            </View>
          </Modal>
        )}

        {/* ─── Poll Creator ─── */}
        {showPoll && (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowPoll(false)}>
            <View style={z.aiOverlay}>
              <PollCreator onSubmit={handlePollSubmit} onClose={() => setShowPoll(false)} accentColor={BRAND} />
            </View>
          </Modal>
        )}

        {/* ─── Image Viewer ─── */}
        <ImageViewer visible={!!viewImage} uri={viewImage?.uri} caption={viewImage?.caption} onClose={() => setViewImage(null)} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const z = StyleSheet.create({
  root: { flex: 1 },

  // Header — premium elevated
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingRight: 4, paddingBottom: 12,
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8,
    zIndex: 10,
  },
  backBtn: { padding: 8, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ef4444', paddingVertical: 6 },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Advanced search — premium
  searchWrap: {
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, height: 40 },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  searchCount: { fontSize: 13, fontWeight: '900', minWidth: 26, textAlign: 'center' },
  chipRow: { gap: 7, paddingBottom: 6 },
  chip: { width: 38, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '900' },

  // Reply bar — premium elevated
  replyBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, marginBottom: 4,
    borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  replyAccent: { width: 4, alignSelf: 'stretch' },
  replyBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  replyAuthor: { fontSize: 12.5, fontWeight: '800', marginBottom: 2 },
  replySnippet: { fontSize: 13, lineHeight: 18 },
  replyClose: { padding: 12, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  // Forward modal
  fwdOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  fwdSheet: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  fwdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  fwdTitle: { fontSize: 18, fontWeight: '800' },
  fwdSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 40, marginBottom: 8 },
  fwdSearchInput: { flex: 1, fontSize: 14 },
  fwdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  fwdName: { flex: 1, fontSize: 15, fontWeight: '600' },
  fwdEmpty: { textAlign: 'center', paddingVertical: 30, fontSize: 14 },
  fwdSendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginVertical: 12, paddingVertical: 14, borderRadius: 14 },
  fwdSendText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 4 },
  headerInfo: { flex: 1, marginRight: 4 },
  headerName: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  headerStatus: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginTop: 1 },
  hdrBtn: { padding: 8, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },

  // Messages
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgList: { paddingVertical: 6, paddingBottom: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 13, marginTop: 6 },

  // Date separator — frosted pill
  dateRow: { alignItems: 'center', marginVertical: 10 },
  dateBadge: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  dateText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },

  // Scroll FAB — premium floating
  scrollFab: {
    position: 'absolute', bottom: 10, right: 14,
    width: 40, height: 40, borderRadius: 20,
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  scrollFabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Attachment menu — premium grid
  attachMenu: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    paddingVertical: 24, paddingHorizontal: 16, gap: 16,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16,
  },
  attachItem: { alignItems: 'center', width: (W - 64) / 3 },
  attachIcon: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  attachLabel: { fontSize: 12, fontWeight: '600' },

  // Footer — premium input area
  footer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 7,
    paddingHorizontal: 8, paddingTop: 6,
  },
  inputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    borderRadius: 25, borderWidth: 1.5,
    paddingHorizontal: 4, paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    minHeight: 48, maxHeight: 130,
  },
  footerIcon: { padding: 8, paddingBottom: Platform.OS === 'ios' ? 8 : 10, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1, fontSize: 16, paddingHorizontal: 6,
    paddingTop: Platform.OS === 'ios' ? 10 : 12,
    paddingBottom: Platform.OS === 'ios' ? 10 : 12,
    maxHeight: 110, letterSpacing: -0.1,
  },
  // AI result + Info modals
  aiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  aiSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingTop: 16, paddingBottom: 16 },
  langSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 16 },
  infoSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '65%', paddingTop: 16 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)' },
  aiIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  aiBody: { paddingHorizontal: 20, paddingTop: 14, flexGrow: 0, flexShrink: 1 },
  aiOriginal: { padding: 12, borderRadius: 12, marginBottom: 14 },
  aiOrigLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  aiOrigText: { fontSize: 13, lineHeight: 18 },
  aiResultText: { fontSize: 15, lineHeight: 22 },
  aiActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  aiBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  aiBtnText: { fontSize: 13, fontWeight: '700' },
  // Language picker
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  langFlag: { fontSize: 22 },
  langName: { flex: 1, fontSize: 15, fontWeight: '600' },

  // Info modal sections
  infoSection: { paddingVertical: 14 },
  infoSecTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  infoSecSub: { fontSize: 12 },
  infoDeviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  infoDeviceText: { fontSize: 11 },
  infoTickRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  infoTickLabel: { fontSize: 14, fontWeight: '700', flex: 1 },
  infoTickCount: { fontSize: 12 },
  infoReceiptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoReceiptName: { fontSize: 14, fontWeight: '600' },
  infoReceiptMeta: { fontSize: 11, marginTop: 1 },
  infoEmpty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  // Timeline
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, position: 'relative' },
  timelineDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineLine: { position: 'absolute', left: 10, top: 22, width: 2, height: 28 },
  timelineLabel: { fontSize: 13, fontWeight: '600' },
  timelineTime: { fontSize: 11, marginTop: 1 },

  // File preview — premium cards
  previewBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 10, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  previewScroll: { gap: 10 },
  previewItem: {
    width: 115, borderRadius: 14, padding: 8, alignItems: 'center', position: 'relative',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  previewClose: {
    position: 'absolute', top: -7, right: -7, zIndex: 2, backgroundColor: '#fff', borderRadius: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3,
  },
  previewThumb: { width: 98, height: 74, borderRadius: 10, marginBottom: 6 },
  previewFileBadge: { width: 98, height: 74, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  previewExt: { fontSize: 14, fontWeight: '900' },
  previewName: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  previewSize: { fontSize: 9, marginTop: 2, fontWeight: '500' },
  previewSendBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6,
  },

  // Recording — premium recording UI
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  recordCancelBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    elevation: 1,
  },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recordDot: { width: 10, height: 10, borderRadius: 5 },
  recordTime: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 0.5 },

  // Send button — premium floating
  sendBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6,
  },

  // Airtime banner
  airtimeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  airtimeText: { fontSize: 13, fontWeight: '600' },

  // Formatting toolbar
  formatBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  formatBtn: { width: 36, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  formatLabel: { fontSize: 16, fontWeight: '700' },

  // @Mention suggestions
  mentionBar: { maxHeight: 200, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  mentionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  mentionName: { fontSize: 14, fontWeight: '600' },

  // Header menu modal
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menuSheet: {
    position: 'absolute', top: 80, right: 12, borderRadius: 14, paddingVertical: 4, minWidth: 200,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  menuItemText: { fontSize: 15, fontWeight: '600' },
  smartChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, maxWidth: 220 },
  smartChipLabel: { fontSize: 12, fontWeight: '600' },
  composeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8, marginBottom: 4, borderRadius: 12, borderWidth: 1 },
  composeHintTxt: { flex: 1, fontSize: 13, fontStyle: 'italic' },
  composeHintAccept: { fontSize: 11, fontWeight: '700' },
  scheduleSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  scheduleTitle: { fontSize: 16, fontWeight: '700' },
  scheduleLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  scheduleInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
});
