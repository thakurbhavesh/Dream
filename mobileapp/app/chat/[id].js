import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Image,
  Platform, ActivityIndicator, ImageBackground, Keyboard, KeyboardAvoidingView,
  Animated, Dimensions,
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
import { useToast } from '../../src/components/Toast';
import { useTheme } from '../../src/store/ThemeContext';
import { getMessages, uploadFile, sendMessageRest } from '../../src/api/chat';
import { getCachedMessages, cacheMessages, appendCachedMessage, updateCachedMessage } from '../../src/services/cache';
import api from '../../src/api/config';
import useSocket from '../../src/hooks/useSocket';
import { useAuth } from '../../src/store/AuthContext';

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

export default function ChatScreen() {
  const { id: threadId, name, avatar } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme: t, isDark } = useTheme();
  const { sendMessage, on, focusThread, emit, connected, reconnect } = useSocket();
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [showForward, setShowForward] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardContacts, setForwardContacts] = useState([]);
  const [forwardSearch, setForwardSearch] = useState('');
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);
  const isGroup = threadId?.startsWith('group-');

  // Keyboard — on Android softwareKeyboardLayoutMode:"resize" handles it natively
  // On iOS we need KeyboardAvoidingView (handled at root level)
  // No manual animation needed — removes double-offset bug

  // Scroll-to-bottom fab
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollBtnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scrollBtnAnim, { toValue: showScrollBtn ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showScrollBtn]);

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
    return () => {
      focusThread(null);
      import('../../src/services/notifications').then(n => n.setActiveThread(null));
    };
  }, [threadId, focusThread]);

  // When socket reconnects, refresh messages to catch missed ones
  useEffect(() => {
    if (connected && !loading) {
      focusThread(threadId);
      // Reload messages to catch any missed during disconnect
      (async () => {
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
      if (data?.threadId === threadId && data?.message) {
        setMessages(prev => [...prev, data.message]);
        appendCachedMessage(threadId, data.message); // Cache new message
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

    // Read ack — update tick status
    const unsub4 = on('message:read_ack', (data) => {
      if (data?.threadId === threadId) {
        setMessages(prev => prev.map(m =>
          m.direction === 'outgoing' && m.status !== 'read' ? { ...m, status: 'read' } : m
        ));
      }
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [threadId, on]);

  const scrollToEnd = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollBtn(false);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true); setText(''); setShowEmoji(false); setShowAttach(false);

    try {
      // ─── EDIT MODE ───
      if (editingMsg) {
        const editId = editingMsg.id;
        const editText = editingMsg.text;
        setEditingMsg(null);
        try {
          // Try socket first
          let success = false;
          if (connected) {
            const res = await emit('message:edit', { threadId, messageId: editId, message: trimmed });
            success = !!(res?.ok || res?.message);
          }
          // Fallback to REST
          if (!success) {
            try {
              await api.put(`/chat/threads/${threadId}/messages/${editId}`, { message: trimmed });
              success = true;
            } catch {}
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

      // ─── NORMAL SEND ───
      const meta = replyTo ? { replyTo } : null;
      setReplyTo(null);

      // Try socket first
      let res = null;
      let usedSocket = false;
      if (connected) {
        res = await sendMessage(threadId, trimmed, 'text', meta);
        usedSocket = true;
      }

      // Socket failed — fallback to REST
      if (!usedSocket || res?.error) {
        try {
          const restRes = await sendMessageRest(threadId, trimmed, 'text', meta);
          if (restRes) {
            setMessages(prev => [...prev, restRes]);
            setTimeout(scrollToEnd, 100);
            return;
          }
        } catch (restErr) {
          toast(restErr?.response?.data?.message || 'Send failed', 'error');
          setText(trimmed);
          return;
        }
      }

      // Socket succeeded
      if (res?.ok && res?.message) {
        setMessages(prev => [...prev, res.message]);
        setTimeout(scrollToEnd, 100);
      } else if (res?.message) {
        setMessages(prev => [...prev, res.message]);
        setTimeout(scrollToEnd, 100);
      }
    } catch (e) {
      toast('Failed to send', 'error');
      setText(trimmed);
    }
    finally { setSending(false); }
  }, [text, threadId, sendMessage, sending, toast, scrollToEnd, replyTo, connected, editingMsg, emit]);

  // Forward handler
  const handleForwardTo = useCallback(async (targetUserId) => {
    if (!forwardMsg) return;
    setShowForward(false);
    const c = forwardMsg.content || {};
    const fwdMeta = {
      ...(forwardMsg.metadata || {}),
      forwarded: true,
      forwardedBy: user?.name || 'You',
      ...(c.fileName ? { fileName: c.fileName, fileUrl: c.fileUrl, fileKey: c.fileKey, fileType: c.fileType, fileSize: c.fileSize || c.rawSize } : {}),
    };
    try {
      await emit('message:forward', {
        targetThreadId: `dm-${targetUserId}`,
        message: c?.text || c?.url || c?.code || forwardMsg?.message || '',
        message_type: forwardMsg?.type || 'text',
        metadata: fwdMeta,
      });
      toast('Message forwarded', 'success');
    } catch { toast('Forward failed', 'error'); }
    setForwardMsg(null);
  }, [forwardMsg, emit, toast, user]);

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

  // Send all pending files
  const sendPendingFiles = useCallback(async () => {
    if (!pendingFiles.length) return;
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    setSending(true);
    try {
      for (const file of filesToSend) {
        const uploaded = await uploadFile({ uri: file.uri, mimeType: file.mimeType, name: file.name });
        const meta = { fileName: uploaded.file_name, fileUrl: uploaded.file_url, fileKey: uploaded.file_key, fileType: uploaded.file_type, fileSize: uploaded.file_size };
        await sendFileMessage(file.type, meta);
      }
      toast(filesToSend.length > 1 ? `${filesToSend.length} files sent` : 'File sent', 'success');
    } catch (err) { toast(err?.message || 'Upload failed', 'error'); }
    finally { setSending(false); }
  }, [pendingFiles, sendFileMessage, toast]);

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
      try {
        await emit('message:pin', { threadId, messageId: msgId });
        toast('Message pinned', 'success');
      } catch { toast('Pin failed', 'error'); }
    } else if (action === 'translate') {
      const msgText = msg?.content?.text || msg?.content?.url || msg?.content?.code || '';
      if (!msgText) return toast('Nothing to translate', 'info');
      // Show language picker first
      setTranslateMsg({ text: msgText, original: msgText });
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
    }
  }, [threadId, emit, toast]);

  const displayMessages = searchResults || messages;
  // For inverted FlatList — reverse so newest is first (renders at bottom)
  const data = addDateSeparators(displayMessages).slice().reverse();

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            const otherId = threadId?.replace('dm-', '').replace('group-', '');
            router.push(`/chat/profile?threadId=${threadId}&userId=${otherId}&name=${encodeURIComponent(name || '')}&avatar=${encodeURIComponent(avatar || '')}`);
          }}>
          <Avatar uri={avatar} name={name} size={36} />
          <View style={z.headerInfo}>
            <Text style={z.headerName} numberOfLines={1}>{name}</Text>
            <Text style={[z.headerStatus, !connected && { color: '#fca5a5' }]}>
              {connected ? 'Online' : 'Connecting...'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={z.hdrBtn} onPress={() => { setShowSearch(!showSearch); setSearchQuery(''); setSearchResults(null); setSearchType(null); setTimeout(() => searchRef.current?.focus(), 200); }}>
          <Ionicons name={showSearch ? 'close' : 'search'} size={19} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={z.hdrBtn}><Ionicons name="ellipsis-vertical" size={18} color="#fff" /></TouchableOpacity>
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
          <ImageBackground source={chatBg} style={{ flex: 1 }} resizeMode="repeat"
            imageStyle={{ opacity: isDark ? 0.03 : 0.08, tintColor: isDark ? '#fff' : undefined }}>
            {loading ? (
              <View style={z.loader}><ActivityIndicator size="large" color={BRAND} /></View>
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
                      message={item}
                      isOwn={item.direction === 'outgoing' || String(item.author?.id) === String(user?.id)}
                      showName={isGroup}
                      onAction={(action, msg) => handleMessageAction(action, msg)}
                      accentColor={BRAND}
                      textSize={t.fontSize}
                    />
                  );
                }}
                contentContainerStyle={z.msgList}
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

        {/* ─── AI Result Modal (Translate / Summarize) ─── */}
        {aiResult && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setAiResult(null)}>
            <View style={z.aiOverlay}>
              <View style={[z.aiSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                <View style={z.aiHeader}>
                  <View style={[z.aiIconWrap, { backgroundColor: aiResult.type === 'translate' ? '#06b6d412' : '#8b5cf612' }]}>
                    <Ionicons name={aiResult.type === 'translate' ? 'language-outline' : 'sparkles-outline'}
                      size={20} color={aiResult.type === 'translate' ? '#06b6d4' : '#8b5cf6'} />
                  </View>
                  <Text style={[z.aiTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
                    {aiResult.type === 'translate' ? `Translation${aiResult.lang ? ` (${aiResult.lang})` : ''}` : 'Summary'}
                  </Text>
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
                      {/* Sender info */}
                      <View style={z.infoSection}>
                        <Text style={[z.infoSecTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>
                          {infoMsg?.author?.name || inf?.sender?.name || 'Unknown'}
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
                  <Text style={[z.fwdTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Forward to</Text>
                  <TouchableOpacity onPress={() => setShowForward(false)}><Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
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
                  renderItem={({ item: c }) => (
                    <TouchableOpacity style={[z.fwdRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                      onPress={() => handleForwardTo(c.id)} activeOpacity={0.6}>
                      <Avatar uri={c.avatar} name={c.name} size={42} />
                      <Text style={[z.fwdName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{c.name}</Text>
                      <Ionicons name="send" size={16} color={BRAND} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={[z.fwdEmpty, { color: isDark ? '#64748b' : '#94a3b8' }]}>No contacts</Text>}
                />
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

        {/* ─── Footer ─── */}
        <View style={[z.footer, { backgroundColor: footerBg, paddingBottom: Math.max(insets.bottom, 6) }]}>
          <View style={[z.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <TouchableOpacity onPress={() => { setShowEmoji(!showEmoji); setShowAttach(false); Keyboard.dismiss(); }} style={z.footerIcon}>
              <Ionicons name={showEmoji ? 'keypad' : 'happy-outline'} size={23} color={isDark ? '#8696a0' : '#54656f'} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={[z.textInput, { color: isDark ? '#e9edef' : '#303030' }]}
              placeholder="Message"
              placeholderTextColor={isDark ? '#8696a0' : '#99a5ad'}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={5000}
              onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
            />

            <TouchableOpacity onPress={() => { setShowAttach(!showAttach); setShowEmoji(false); Keyboard.dismiss(); }} style={z.footerIcon}>
              <Ionicons name="attach" size={23} color={isDark ? '#8696a0' : '#54656f'} style={{ transform: [{ rotate: '-45deg' }] }} />
            </TouchableOpacity>

            {!text.trim() && (
              <TouchableOpacity onPress={handleCameraPick} style={z.footerIcon}>
                <Ionicons name="camera" size={21} color={isDark ? '#8696a0' : '#54656f'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Send / Mic button */}
          {isRecording ? (
            /* Recording mode — cancel + stop/send */
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
              onLongPress={!text.trim() ? startRecording : undefined}
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

        {/* ─── Emoji Picker ─── */}
        {showEmoji && <EmojiPicker onSelect={e => setText(prev => prev + e)} onClose={() => setShowEmoji(false)} />}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const z = StyleSheet.create({
  root: { flex: 1 },

  // Header — WhatsApp green
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 6, paddingRight: 4, paddingBottom: 10,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
    zIndex: 10,
  },
  backBtn: { padding: 6 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ef4444', paddingVertical: 6 },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Advanced search
  searchWrap: {
    paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  searchCount: { fontSize: 13, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  chipRow: { gap: 6, paddingBottom: 4 },
  chip: { width: 36, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '800' },

  // Reply bar
  replyBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginBottom: 4, borderRadius: 12, overflow: 'hidden', elevation: 1 },
  replyAccent: { width: 4, alignSelf: 'stretch' },
  replyBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  replyAuthor: { fontSize: 12, fontWeight: '700', marginBottom: 1 },
  replySnippet: { fontSize: 13 },
  replyClose: { padding: 10 },

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
  contactAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 4 },
  headerInfo: { flex: 1, marginRight: 4 },
  headerName: { fontSize: 17, fontWeight: '600', color: '#fff' },
  headerStatus: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  hdrBtn: { padding: 8, minWidth: 36, alignItems: 'center' },

  // Messages
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgList: { paddingVertical: 6, paddingBottom: 8 },

  // Date separator
  dateRow: { alignItems: 'center', marginVertical: 8 },
  dateBadge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.08, shadowRadius: 1,
  },
  dateText: { fontSize: 12, fontWeight: '600' },

  // Scroll FAB
  scrollFab: {
    position: 'absolute', bottom: 8, right: 12,
    width: 38, height: 38, borderRadius: 19,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  scrollFabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Attachment menu
  attachMenu: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    paddingVertical: 20, paddingHorizontal: 16, gap: 20,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  attachItem: { alignItems: 'center', width: (W - 64) / 3 },
  attachIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  attachLabel: { fontSize: 12, fontWeight: '500' },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    paddingHorizontal: 6, paddingTop: 6,
  },
  inputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    borderRadius: 24, borderWidth: 1,
    paddingHorizontal: 4, paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    minHeight: 46, maxHeight: 120,
  },
  footerIcon: { padding: 8, paddingBottom: Platform.OS === 'ios' ? 8 : 10 },
  textInput: {
    flex: 1, fontSize: 16, paddingHorizontal: 4,
    paddingTop: Platform.OS === 'ios' ? 8 : 10,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    maxHeight: 100,
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

  // File preview
  previewBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  previewScroll: { gap: 8 },
  previewItem: { width: 110, borderRadius: 12, padding: 6, alignItems: 'center', position: 'relative' },
  previewClose: { position: 'absolute', top: -6, right: -6, zIndex: 2, backgroundColor: '#fff', borderRadius: 10 },
  previewThumb: { width: 96, height: 72, borderRadius: 8, marginBottom: 4 },
  previewFileBadge: { width: 96, height: 72, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  previewExt: { fontSize: 14, fontWeight: '800' },
  previewName: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  previewSize: { fontSize: 9, marginTop: 1 },
  previewSendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },

  // Recording
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  recordCancelBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  recordDot: { width: 8, height: 8, borderRadius: 4 },
  recordTime: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },

  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2,
  },
});
