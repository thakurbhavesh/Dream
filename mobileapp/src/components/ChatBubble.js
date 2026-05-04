import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Dimensions, Modal, Pressable, Vibration, Platform, ScrollView, Animated, PanResponder, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const TEXT_LIMIT = 300; // chars before "Show more"

// Detect emoji-only messages (1-8 emoji, no other text)
const EMOJI_REGEX = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\u20E3|[\u{1F1E0}-\u{1F1FF}])+$/u;
const isEmojiOnly = (txt) => {
  if (!txt || txt.length > 32) return false;
  const trimmed = txt.trim();
  return EMOJI_REGEX.test(trimmed) && trimmed.length <= 32;
};

// Links → external browser, Files/Images/Videos → in-app preview
const openInApp = (url, color) => url && WebBrowser.openBrowserAsync(url, { presentationStyle: 'pageSheet', controlsColor: color || '#ea4c89' });
const openExternal = (url) => url && Linking.openURL(url);

// URL regex — detects both https://... AND bare domains like teamchatx.com, google.com/path
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+(?:com|org|net|io|dev|app|co|in|me|info|biz|xyz|tech|ai|cloud|edu|gov|mil|pro|site|online|store|shop|blog|design|agency|studio|media|world|space|live|digital|solutions|software|systems|services|team|chat|work|zone|link|click|page|wiki|tv|fm|gg|ly|to|cc|us|uk|de|fr|jp|cn|ru|br|au|ca|eu))(?:\/[^\s<>"{}|\\^`\[\]]*)?)/gi;

// Parse text into parts: plain text + clickable links
const parseTextWithLinks = (txt, textColor, linkColor) => {
  if (!txt) return null;
  const parts = [];
  let lastIndex = 0;
  let match;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(txt)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Text key={`t-${lastIndex}`} style={{ color: textColor }}>{txt.slice(lastIndex, match.index)}</Text>);
    }
    const raw = match[0];
    // Auto-prepend https:// for bare domains
    const href = raw.match(/^https?:\/\//) ? raw : `https://${raw}`;
    parts.push(
      <Text key={`l-${match.index}`} style={{ color: linkColor, textDecorationLine: 'underline', fontWeight: '500' }}
        onPress={() => Linking.openURL(href)}>{raw}</Text>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < txt.length) {
    parts.push(<Text key={`t-${lastIndex}`} style={{ color: textColor }}>{txt.slice(lastIndex)}</Text>);
  }
  return parts.length > 0 ? parts : <Text style={{ color: textColor }}>{txt}</Text>;
};

const { width: W } = Dimensions.get('window');
const MAX_BUB = W * 0.82;

const EXT_MAP = {
  pdf: { icon: 'document-text', color: '#ef4444', bg: '#fee2e2', label: 'PDF' },
  doc: { icon: 'document-text', color: '#2563eb', bg: '#dbeafe', label: 'DOC' },
  docx: { icon: 'document-text', color: '#2563eb', bg: '#dbeafe', label: 'DOCX' },
  xls: { icon: 'grid', color: '#22c55e', bg: '#dcfce7', label: 'XLS' },
  xlsx: { icon: 'grid', color: '#22c55e', bg: '#dcfce7', label: 'XLSX' },
  csv: { icon: 'grid', color: '#14b8a6', bg: '#ccfbf1', label: 'CSV' },
  ppt: { icon: 'easel', color: '#f59e0b', bg: '#fef3c7', label: 'PPT' },
  pptx: { icon: 'easel', color: '#f59e0b', bg: '#fef3c7', label: 'PPTX' },
  zip: { icon: 'archive', color: '#8b5cf6', bg: '#ede9fe', label: 'ZIP' },
  rar: { icon: 'archive', color: '#8b5cf6', bg: '#ede9fe', label: 'RAR' },
  txt: { icon: 'document-outline', color: '#64748b', bg: '#f1f5f9', label: 'TXT' },
  sql: { icon: 'server', color: '#f97316', bg: '#fff7ed', label: 'SQL' },
  css: { icon: 'code-slash', color: '#06b6d4', bg: '#cffafe', label: 'CSS' },
  js: { icon: 'code-slash', color: '#eab308', bg: '#fefce8', label: 'JS' },
  json: { icon: 'code-slash', color: '#64748b', bg: '#f1f5f9', label: 'JSON' },
  html: { icon: 'globe', color: '#ef4444', bg: '#fee2e2', label: 'HTML' },
  mp3: { icon: 'musical-notes', color: '#8b5cf6', bg: '#ede9fe', label: 'MP3' },
  mp4: { icon: 'videocam', color: '#f59e0b', bg: '#fef3c7', label: 'MP4' },
  png: { icon: 'image', color: '#14b8a6', bg: '#ccfbf1', label: 'PNG' },
  jpg: { icon: 'image', color: '#3b82f6', bg: '#dbeafe', label: 'JPG' },
  jpeg: { icon: 'image', color: '#3b82f6', bg: '#dbeafe', label: 'JPEG' },
  gif: { icon: 'image', color: '#ec4899', bg: '#fce7f3', label: 'GIF' },
  svg: { icon: 'image', color: '#f97316', bg: '#fff7ed', label: 'SVG' },
  webp: { icon: 'image', color: '#22c55e', bg: '#dcfce7', label: 'WEBP' },
};

const getExt = (name) => name ? (name.split('.').pop() || '').toLowerCase() : '';
const getFileInfo = (name, mime) => {
  const ext = getExt(name);
  if (EXT_MAP[ext]) return EXT_MAP[ext];
  if (mime?.includes('pdf')) return EXT_MAP.pdf;
  if (mime?.includes('sheet') || mime?.includes('excel')) return EXT_MAP.xlsx;
  if (mime?.includes('presentation')) return EXT_MAP.pptx;
  if (mime?.includes('word')) return EXT_MAP.docx;
  return { icon: 'document-outline', color: '#64748b', bg: '#f1f5f9', label: ext.toUpperCase() || 'FILE' };
};

const resolveUrl = (c, m) =>
  c?.fileUrl || c?.file_url || c?.url || c?.downloadUrl || m?.fileUrl || m?.file_url || m?.url || m?.downloadUrl || '';
const resolveName = (c, m) =>
  c?.fileName || c?.file_name || m?.fileName || m?.file_name || '';
const resolveSize = (c, m) => {
  const s = c?.fileSize || c?.file_size || m?.fileSize || m?.file_size || '';
  if (typeof s === 'number') {
    if (s < 1024) return `${s} B`;
    if (s < 1048576) return `${(s / 1024).toFixed(1)} KB`;
    return `${(s / 1048576).toFixed(1)} MB`;
  }
  return s;
};
const resolveMime = (c, m) =>
  c?.mimeType || c?.fileType || c?.file_type || m?.mimeType || m?.fileType || '';
const isImageUrl = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') ||
    lower.includes('.gif') || lower.includes('.webp') || lower.includes('.svg') || lower.includes('image/');
};

// Colors — dark mode aware
const getColors = (isDark) => isDark ? {
  OWN_BG: '#005c4b', OWN_TEXT: '#e9edef', OTHER_BG: '#1f2c34', OTHER_TEXT: '#e9edef',
  OWN_META: '#7cb39a', OTHER_META: '#8696a0',
  DEL_BG: '#1f2c34', DEL_BORDER: '#2a3942', DEL_TEXT: '#8696a0',
  MENU_BG: '#233138', MENU_BORDER: '#2a3942',
} : {
  OWN_BG: '#dcf8c6', OWN_TEXT: '#303030', OTHER_BG: '#ffffff', OTHER_TEXT: '#303030',
  OWN_META: '#6d9b5d', OTHER_META: '#8696a0',
  DEL_BG: '#fff', DEL_BORDER: '#e2e8f0', DEL_TEXT: '#8696a0',
  MENU_BG: '#fff', MENU_BORDER: '#f1f5f9',
};

// Group sender colors
const SENDER_COLORS = ['#e15d44', '#ff6f61', '#9b59b6', '#00bcd4', '#e67e22', '#27ae60', '#2980b9', '#8e44ad'];
const getSenderColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

// Time limits (same as web frontend default: 5 minutes)
const EDIT_LIMIT_MS = 5 * 60 * 1000;
const RECALL_LIMIT_MS = 5 * 60 * 1000;

const isWithinTimeLimit = (createdAt, limitMs) => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return created + limitMs > Date.now();
};

// Message action menu items
const getActions = (isOwn, type, message, viewerIsAdmin) => {
  const actions = [];
  const createdAt = message?.createdAt || message?.metadata?.sentAt;
  // Destructive — admins can delete/recall any message
  if (isOwn || viewerIsAdmin) {
    actions.push({ key: 'delete', icon: 'trash-outline', label: 'Delete', color: '#ef4444' });
    if (isOwn && isWithinTimeLimit(createdAt, RECALL_LIMIT_MS)) {
      actions.push({ key: 'recall', icon: 'arrow-undo-outline', label: 'Unsend', color: '#f59e0b' });
    }
    if (isOwn && (type === 'text' || type === 'link' || type === 'code') && isWithinTimeLimit(createdAt, EDIT_LIMIT_MS)) {
      actions.push({ key: 'edit', icon: 'create-outline', label: 'Edit', color: '#64748b' });
    }
  } else {
    actions.push({ key: 'delete', icon: 'trash-outline', label: 'Delete', color: '#ef4444' });
  }
  // Select
  actions.push({ key: 'select', icon: 'checkbox-outline', label: 'Select', color: '#64748b' });
  // Copy
  if (type === 'text' || type === 'link' || type === 'code' || type === 'emoji') {
    actions.push({ key: 'copy', icon: 'copy-outline', label: 'Copy', color: '#64748b' });
  }
  // AI features
  if (type === 'text' || type === 'link' || type === 'code') {
    actions.push({ key: 'translate', icon: 'language-outline', label: 'Translate', color: '#06b6d4' });
    actions.push({ key: 'summarize', icon: 'sparkles-outline', label: 'Summarize', color: '#8b5cf6' });
    actions.push({ key: 'tone', icon: 'options-outline', label: 'Adjust tone', color: '#10b981' });
  }
  // Actions
  actions.push({ key: 'reply', icon: 'arrow-undo', label: 'Reply', color: '#3b82f6' });
  actions.push({ key: 'forward', icon: 'share-outline', label: 'Forward', color: '#8b5cf6' });
  actions.push({ key: 'info', icon: 'information-circle-outline', label: 'Info', color: '#3b82f6' });
  const isPinned = message?.metadata?.pinned;
  actions.push({ key: 'pin', icon: isPinned ? 'pin' : 'pin-outline', label: isPinned ? 'Unpin' : 'Pin', color: '#f59e0b' });
  const isStarred = message?.metadata?.starred;
  actions.push({ key: 'star', icon: isStarred ? 'star' : 'star-outline', label: isStarred ? 'Unstar' : 'Star', color: '#eab308' });
  return actions;
};

const SPEEDS = [1, 1.5, 2];

// ─── Audio Player Sub-component ───
function AudioPlayerWidget({ url, duration: metaDuration, isOwn, metaColor, Footer }) {
  const player = useAudioPlayer(url || '');
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(0);

  const isPlaying = status?.playing || false;
  const currentTime = status?.currentTime || 0;
  const totalDuration = status?.duration || metaDuration || 0;
  const progress = totalDuration > 0 ? Math.min(currentTime / totalDuration, 1) : 0;

  const formatTime = (sec) => {
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const togglePlay = () => {
    try {
      if (isPlaying) { player.pause(); }
      else { player.play(); }
    } catch {}
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    try { player.rate = SPEEDS[next]; } catch {}
  };

  const displayTime = isPlaying || currentTime > 0.5
    ? formatTime(currentTime)
    : (totalDuration > 0 ? formatTime(totalDuration) : '0:00');

  return (
    <View style={z.audioRow}>
      <TouchableOpacity style={[z.audioPlayBtn, { backgroundColor: isOwn ? '#4caf50' : '#ea4c89' }]} onPress={togglePlay}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
      </TouchableOpacity>
      <View style={z.audioCenter}>
        <View style={z.wave}>
          {[10, 16, 8, 20, 14, 22, 10, 18, 6, 16, 12, 20, 8, 14, 18, 10, 22, 6, 16, 12].map((h, i) => (
            <View key={i} style={[z.waveBar, {
              height: h,
              backgroundColor: (i / 20) <= progress ? (isOwn ? '#4caf50' : '#ea4c89') : (isOwn ? '#6d9b5d55' : '#8696a055'),
            }]} />
          ))}
        </View>
        <View style={z.audioDurRow}>
          <Text style={[z.audioDur, { color: metaColor }]}>{displayTime}</Text>
          <TouchableOpacity onPress={cycleSpeed} style={z.speedBtn} activeOpacity={0.6}>
            <Text style={[z.speedText, { color: isOwn ? '#4caf50' : '#ea4c89' }]}>{SPEEDS[speedIdx]}x</Text>
          </TouchableOpacity>
          {Footer}
        </View>
      </View>
    </View>
  );
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙄', '🥰', '🔥', '😭'];

// Poll sub-component
function PollWidget({ content, metadata, isOwn, accentColor, onVote, messageId }) {
  const question = content?.question || metadata?.question || '';
  const options = content?.options || metadata?.options || [];
  const votes = content?.votes || metadata?.votes || {};
  const multiChoice = content?.multiChoice || metadata?.multiChoice || false;
  const totalVotes = Object.values(votes).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : (arr || 0)), 0);

  return (
    <View style={{ padding: 10, minWidth: 220 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Ionicons name="stats-chart" size={14} color={accentColor} />
        <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {multiChoice ? 'Multiple Choice' : 'Poll'}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: isOwn ? '#303030' : '#303030', marginBottom: 10 }}>{question}</Text>
      {options.map((opt, i) => {
        const optText = typeof opt === 'string' ? opt : opt.text;
        const optVotes = Array.isArray(votes[i]) ? votes[i].length : (votes[i] || 0);
        const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
        return (
          <TouchableOpacity key={i} style={{
            borderWidth: 1.5, borderColor: accentColor + '30', borderRadius: 10, marginBottom: 6,
            paddingHorizontal: 12, paddingVertical: 10, position: 'relative', overflow: 'hidden',
          }} onPress={() => onVote?.(messageId, i)} activeOpacity={0.7}>
            <View style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
              backgroundColor: accentColor + '15', borderRadius: 10,
            }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#303030', flex: 1 }}>{optText}</Text>
              {totalVotes > 0 && <Text style={{ fontSize: 12, fontWeight: '700', color: accentColor }}>{pct}%</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={{ fontSize: 11, color: '#8696a0', marginTop: 4 }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</Text>
    </View>
  );
}

export default function ChatBubble({ message, isOwn, showName, onAction, accentColor = '#ea4c89', textSize = 15, onReact, onPollVote, viewerIsAdmin, onImagePress, isDark = false }) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const ACCENT = accentColor;
  const c = message?.content || {};
  const m = message?.metadata || {};
  const time = message?.createdAt || m?.sentAt || '';
  const timeLabel = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const type = message?.type || 'text';
  const isMedia = ['file', 'image', 'video', 'audio'].includes(type);
  // For link: content.url has URL. For code: content.code. For media: only use c.text (caption)
  const text = isMedia ? (c?.text || c?.caption || '') : (c?.text || (type === 'link' ? c?.url : '') || (type === 'code' ? c?.code : '') || message?.message || '');

  const url = resolveUrl(c, m);
  const name = resolveName(c, m);
  const size = resolveSize(c, m);
  const mime = resolveMime(c, m);
  const fi = getFileInfo(name, mime);

  const localUri = c?._localUri;
  const showImage = (type === 'image' || (type === 'file' && isImageUrl(url || name))) && (url || localUri);
  // Show link card for any link-type message (with or without preview)
  const isLink = type === 'link';

  // Recalled = hidden from everyone (unsent)
  if (c?.recalled) return null;

  // Deleted = show placeholder only
  if (c?.deleted) {
    return (
      <View style={[z.row, isOwn ? z.rowOwn : z.rowOther]}>
        <View style={[z.delBubble, { backgroundColor: C.DEL_BG, borderColor: C.DEL_BORDER }]}>
          <Ionicons name="ban-outline" size={13} color={C.DEL_TEXT} />
          <Text style={[z.delText, { color: C.DEL_TEXT }]}>This message was deleted</Text>
        </View>
      </View>
    );
  }

  const isUploading = message?._uploading;
  const isFailed = message?.status === 'failed';

  const C = getColors(isDark);
  const bg = isOwn ? C.OWN_BG : C.OTHER_BG;
  const metaColor = isOwn ? C.OWN_META : C.OTHER_META;
  const textColor = isOwn ? C.OWN_TEXT : C.OTHER_TEXT;

  const Tick = () => {
    if (!isOwn) return null;
    const st = message?.status;
    if (st === 'read') return <Ionicons name="checkmark-done" size={14} color="#53bdeb" />;
    if (st === 'delivered') return <Ionicons name="checkmark-done" size={14} color="#8696a0" />;
    if (st === 'sent') return <Ionicons name="checkmark" size={14} color="#8696a0" />;
    if (st === 'queued') return <Ionicons name="cloud-offline-outline" size={12} color="#f59e0b" />;
    if (st === 'failed') return <Ionicons name="alert-circle" size={12} color="#ef4444" />;
    return <Ionicons name="time-outline" size={11} color="#8696a0" />;
  };

  const Footer = ({ inline }) => (
    <View style={[z.footer, inline && z.footerInline]}>
      {m?.edited && <Text style={[z.ft, { color: metaColor }]}>edited</Text>}
      <Text style={[z.ft, { color: inline ? 'rgba(255,255,255,0.8)' : metaColor }]}>{timeLabel}</Text>
      <Tick />
    </View>
  );

  // Forwarded label
  const forwarded = m?.forwarded || c?.forwarded;

  const handleLongPress = () => {
    if (Platform.OS !== 'web') Vibration.vibrate(30);
    setShowMenu(true);
  };

  const handleAction = (key) => {
    setShowMenu(false);
    onAction?.(key, message);
  };

  // Swipe to reply
  const swipeX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dy) < 15,
    onPanResponderMove: (_, g) => {
      if (g.dx > 0) swipeX.setValue(Math.min(g.dx, 80)); // only swipe right
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > 60) {
        Vibration.vibrate(20);
        onAction?.('reply', message);
      }
      Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 40, friction: 8 }).start();
    },
  })).current;

  const actions = getActions(isOwn, type, message, viewerIsAdmin);

  const replyIconOpacity = swipeX.interpolate({ inputRange: [0, 40, 60], outputRange: [0, 0.5, 1], extrapolate: 'clamp' });
  const replyIconScale = swipeX.interpolate({ inputRange: [0, 60], outputRange: [0.5, 1], extrapolate: 'clamp' });

  return (
    <View style={[z.row, isOwn ? z.rowOwn : z.rowOther]}>
      {/* Swipe reply icon behind bubble */}
      <Animated.View style={[z.swipeReplyIcon, { opacity: replyIconOpacity, transform: [{ scale: replyIconScale }] }]}>
        <Ionicons name="arrow-undo" size={18} color="#3b82f6" />
      </Animated.View>
      {/* Action Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={z.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[z.menuCard, { backgroundColor: C.MENU_BG }]}>
            {/* Quick reactions row */}
            <View style={[z.quickReactRow, { borderBottomColor: C.MENU_BORDER }]}>
              {QUICK_REACTIONS.map(emoji => (
                <TouchableOpacity key={emoji} style={[z.quickReactBtn, { backgroundColor: isDark ? '#1a2c35' : '#f8fafc' }]}
                  onPress={() => { setShowMenu(false); onReact?.(message?.id, emoji); }} activeOpacity={0.6}>
                  <Text style={z.quickReactEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {actions.map((a, i) => (
                <TouchableOpacity key={a.key} style={[z.menuItem, i < actions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.MENU_BORDER }]}
                  onPress={() => handleAction(a.key)} activeOpacity={0.6}>
                  <View style={[z.menuIconWrap, { backgroundColor: `${a.color}12` }]}>
                    <Ionicons name={a.icon} size={16} color={a.color} />
                  </View>
                  <Text style={[z.menuLabel, { color: a.key === 'delete' || a.key === 'recall' ? a.color : (isDark ? '#e9edef' : '#334155') }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Tail — swipeable */}
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX: swipeX }], opacity: isUploading ? 0.7 : 1 }}>
      <Pressable onLongPress={isUploading ? undefined : handleLongPress} delayLongPress={300}
        style={[z.bubble, { backgroundColor: bg, maxWidth: MAX_BUB }]}>
        {/* Uploading overlay */}
        {isUploading && (
          <View style={z.uploadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={z.uploadingText}>Sending...</Text>
          </View>
        )}
        {isFailed && (
          <View style={[z.uploadingOverlay, { backgroundColor: 'rgba(239,68,68,0.85)' }]}>
            <Ionicons name="alert-circle" size={18} color="#fff" />
            <Text style={z.uploadingText}>Failed</Text>
          </View>
        )}
        {/* Notch */}
        <View style={[z.notch, isOwn ? z.notchOwn : z.notchOther, { borderBottomColor: bg }]} />

        {/* Group sender */}
        {showName && !isOwn && message?.author?.name && (
          <Text style={[z.sender, { color: getSenderColor(message.author.name) }]}>
            {message.author.name}
          </Text>
        )}

        {/* Reply context */}
        {m?.replyTo && (
          <View style={[z.replyCtx, { backgroundColor: isOwn ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)' }]}>
            <View style={[z.replyCtxAccent, { backgroundColor: ACCENT }]} />
            <View style={z.replyCtxBody}>
              <Text style={[z.replyCtxAuthor, { color: ACCENT }]}>{m.replyTo.authorName || 'User'}</Text>
              <Text style={[z.replyCtxSnippet, { color: metaColor }]} numberOfLines={1}>
                {m.replyTo.snippet || m.replyTo.fileName || 'Message'}
              </Text>
            </View>
          </View>
        )}

        {/* Pinned indicator */}
        {m?.pinned && (
          <View style={z.fwdRow}>
            <Ionicons name="pin" size={11} color="#f59e0b" />
            <Text style={[z.fwdText, { color: '#f59e0b' }]}>Pinned</Text>
          </View>
        )}

        {/* Forwarded */}
        {forwarded && (
          <View style={z.fwdRow}>
            <Ionicons name="arrow-redo" size={12} color="#8696a0" />
            <Text style={z.fwdText}>Forwarded</Text>
          </View>
        )}

        {/* ── Poll ── */}
        {type === 'poll' && (
          <>
            <PollWidget content={c} metadata={m} isOwn={isOwn} accentColor={ACCENT} onVote={onPollVote} messageId={message?.id} />
            <Footer />
          </>
        )}

        {/* ── GIF ── */}
        {type === 'gif' && (
          <View style={{ margin: 3, borderRadius: 8, overflow: 'hidden' }}>
            <Image source={{ uri: c?.url || c?.gifUrl || url }} style={{ width: MAX_BUB - 10, height: 200, borderRadius: 8 }} resizeMode="cover" />
            <View style={z.imgOverlay}><Footer inline /></View>
          </View>
        )}

        {/* ── Image ── */}
        {showImage && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => !isUploading && (onImagePress ? onImagePress(url || localUri, text) : openInApp(url, ACCENT))} style={z.imgWrap}>
            <Image source={{ uri: url || localUri }} style={z.img} resizeMode="cover" />
            {/* Gradient overlay for time on image */}
            <View style={z.imgOverlay}>
              <Footer inline />
            </View>
            {text ? (
              <View style={z.imgCaption}>
                <Text style={[z.text, { color: textColor }]}>{text}</Text>
                <Footer />
              </View>
            ) : null}
          </TouchableOpacity>
        )}

        {/* ── Video ── */}
        {type === 'video' && !showImage && (
          <TouchableOpacity style={z.videoWrap} activeOpacity={0.7} onPress={() => openInApp(url, ACCENT)}>
            <View style={z.videoThumb}>
              <View style={z.videoPlay}>
                <Ionicons name="play" size={28} color="#fff" />
              </View>
              <View style={z.videoBadge}>
                <Ionicons name="videocam" size={10} color="#fff" />
                <Text style={z.videoDur}>{c?.duration ? `${Math.floor(c.duration / 60)}:${String(Math.round(c.duration) % 60).padStart(2, '0')}` : ''}</Text>
              </View>
            </View>
            {name ? <Text style={[z.videoName, { color: textColor }]} numberOfLines={1}>{name}</Text> : null}
            {size ? <Text style={[z.videoSize, { color: metaColor }]}>{size}</Text> : null}
            <Footer />
          </TouchableOpacity>
        )}

        {/* ── Audio (waveform style with playback) ── */}
        {type === 'audio' && (
          <AudioPlayerWidget
            url={url}
            duration={c?.duration || 0}
            isOwn={isOwn}
            metaColor={metaColor}
            Footer={<Footer />}
          />
        )}

        {/* ── File (non-image) ── */}
        {type === 'file' && !showImage && (
          <TouchableOpacity style={z.fileRow} activeOpacity={0.7} onPress={() => openInApp(url, ACCENT)}>
            <View style={[z.fileBadge, { backgroundColor: fi.bg }]}>
              <Ionicons name={fi.icon} size={20} color={fi.color} />
              <Text style={[z.badgeLabel, { color: fi.color }]}>{fi.label}</Text>
            </View>
            <View style={z.fileInfo}>
              <Text style={[z.fName, { color: textColor }]} numberOfLines={2}>{name || 'Document'}</Text>
              <View style={z.fileMeta}>
                {size ? <Text style={[z.fSize, { color: metaColor }]}>{size}</Text> : null}
                <Text style={[z.fDot, { color: metaColor }]}>{size ? ' · ' : ''}{fi.label}</Text>
              </View>
            </View>
            <Ionicons name="download-outline" size={22} color={metaColor} />
          </TouchableOpacity>
        )}

        {/* ── Link ── */}
        {isLink && (() => {
          const linkHref = c?.url || url || text;
          const fullHref = linkHref?.match(/^https?:\/\//) ? linkHref : `https://${linkHref}`;
          let host = c?.displayHost || '';
          if (!host && fullHref) try { host = new URL(fullHref).hostname.replace('www.', ''); } catch {}
          const hasPreview = c?.title || c?.thumbnail;
          return (
            <>
              <TouchableOpacity style={z.linkCard} activeOpacity={0.7}
                onPress={() => openExternal(fullHref)}>
                {/* Thumbnail */}
                {c?.thumbnail && <Image source={{ uri: c.thumbnail }} style={z.linkThumb} resizeMode="cover" />}

                {/* Preview body */}
                <View style={[z.linkPreviewBody, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : (isOwn ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)') }]}>
                  <View style={[z.linkAccent, { backgroundColor: ACCENT }]} />
                  <View style={z.linkContent}>
                    {hasPreview && c?.title ? (
                      <Text style={[z.linkTitle, { color: textColor }]} numberOfLines={2}>{c.title}</Text>
                    ) : (
                      <Text style={[z.linkTitle, { color: textColor }]} numberOfLines={1}>{host || linkHref}</Text>
                    )}
                    {hasPreview && c?.description ? (
                      <Text style={[z.linkDesc, { color: metaColor }]} numberOfLines={2}>{c.description}</Text>
                    ) : null}
                    <View style={z.linkHostRow}>
                      <Ionicons name="globe-outline" size={12} color={metaColor} />
                      <Text style={[z.linkHostText, { color: metaColor }]} numberOfLines={1}>{host || linkHref}</Text>
                    </View>
                  </View>
                </View>

                {/* Full URL below preview */}
                <View style={z.linkUrlWrap}>
                  <Text style={[z.linkFullUrl, { color: isDark ? '#7dd3fc' : (isOwn ? '#054640' : '#027eb5') }]}
                    numberOfLines={2}>{linkHref}</Text>
                </View>
              </TouchableOpacity>
              <Footer />
            </>
          );
        })()}

        {/* ── Emoji-only large display ── */}
        {!showImage && !isLink && !isMedia && isEmojiOnly(text) ? (
          <View style={z.emojiOnlyWrap}>
            <Text style={z.emojiOnlyText}>{text}</Text>
            <Footer />
          </View>
        ) : null}

        {/* ── Code Snippet ── */}
        {type === 'code' && !showImage && (() => {
          const code = c?.code || text || '';
          const lang = c?.language || '';
          return (
            <View style={z.codeWrap}>
              {lang ? <Text style={z.codeLang}>{lang.toUpperCase()}</Text> : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={z.codeScroll}>
                <Text style={z.codeText}>{code}</Text>
              </ScrollView>
              <Footer />
            </View>
          );
        })()}

        {/* ── Text with auto-linked URLs + Show more/less ── */}
        {!showImage && !isLink && !isEmojiOnly(text) && type !== 'code' && (text || (!isMedia)) ? (() => {
          const isLong = text.length > TEXT_LIMIT;
          const display = isLong && !expanded ? text.slice(0, TEXT_LIMIT) + '...' : text;
          const linkColor = isDark ? '#7dd3fc' : (isOwn ? '#054640' : '#027eb5');

          // Detect first URL in text for mini preview
          URL_REGEX.lastIndex = 0;
          const firstUrlMatch = URL_REGEX.exec(text);
          let miniHost = '';
          let miniHref = '';
          if (firstUrlMatch) {
            miniHref = firstUrlMatch[0].match(/^https?:\/\//) ? firstUrlMatch[0] : `https://${firstUrlMatch[0]}`;
            try { miniHost = new URL(miniHref).hostname.replace('www.', ''); } catch {}
          }

          return (
            <View style={z.textWrap}>
              <Text style={[z.text, { fontSize: textSize }]}>{parseTextWithLinks(display, textColor, linkColor)}</Text>
              {isLong && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7} style={z.showMoreBtn}>
                  <Text style={[z.showMoreText, { color: linkColor }]}>{expanded ? 'Show less' : 'Show more'}</Text>
                </TouchableOpacity>
              )}
              {/* Mini link preview for text messages containing URLs */}
              {miniHost && type === 'text' && (
                <TouchableOpacity style={[z.miniLinkPreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
                  onPress={() => Linking.openURL(miniHref)} activeOpacity={0.7}>
                  <View style={[z.miniLinkAccent, { backgroundColor: ACCENT }]} />
                  <Ionicons name="globe-outline" size={14} color={metaColor} />
                  <Text style={[z.miniLinkHost, { color: linkColor }]} numberOfLines={1}>{miniHost}</Text>
                  <Ionicons name="open-outline" size={12} color={metaColor} />
                </TouchableOpacity>
              )}
              <Footer />
            </View>
          );
        })() : null}

        {/* Caption for media */}
        {isMedia && !showImage && c?.caption ? (() => {
          const cap = c.caption;
          const isLong = cap.length > TEXT_LIMIT;
          const display = isLong && !expanded ? cap.slice(0, TEXT_LIMIT) + '...' : cap;
          const linkColor = isOwn ? '#054640' : '#027eb5';
          return (
            <View style={z.textWrap}>
              <Text style={[z.text, { fontSize: textSize }]}>{parseTextWithLinks(display, textColor, linkColor)}</Text>
              {isLong && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7} style={z.showMoreBtn}>
                  <Text style={[z.showMoreText, { color: linkColor }]}>{expanded ? 'Show less' : 'Show more'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })() : null}

        {/* Footer for non-text (file/video/link) */}
        {(type === 'file' && !showImage) || isLink || (type === 'video' && !showImage) ? null : (!showImage && !isMedia && !isLink) ? null : null}
      </Pressable>
      </Animated.View>

      {/* ── Failed/Queued retry ── */}
      {isOwn && (message?.status === 'failed' || message?.status === 'queued') && (
        <TouchableOpacity style={[z.retryRow, isOwn ? z.retryOwn : z.retryOther]}
          onPress={() => onAction?.('retry', message)} activeOpacity={0.7}>
          <Ionicons name={message.status === 'queued' ? 'cloud-offline-outline' : 'alert-circle'} size={13}
            color={message.status === 'queued' ? '#f59e0b' : '#ef4444'} />
          <Text style={[z.retryText, { color: message.status === 'queued' ? '#f59e0b' : '#ef4444' }]}>
            {message.status === 'queued' ? 'Waiting for network' : 'Failed — tap to retry'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Reactions display ── */}
      {(() => {
        // Backend sends metadata.reactions as array: [{emoji, users: [{id,name}]}]
        const raw = message?.metadata?.reactions || message?.reactions;
        if (!raw) return null;
        // Normalize: support both array format and object format
        const reactionList = Array.isArray(raw)
          ? raw.filter(r => r?.emoji && r?.users?.length > 0)
          : Object.entries(raw).map(([emoji, users]) => ({ emoji, users: Array.isArray(users) ? users : [] })).filter(r => r.users.length > 0);
        if (reactionList.length === 0) return null;
        return (
          <View style={[z.reactionsRow, isOwn ? z.reactionsOwn : z.reactionsOther]}>
            {reactionList.map(r => {
              const isSelf = r.users.some(u => u.isSelf || String(u.id) === String(message?._viewerId));
              return (
                <TouchableOpacity key={r.emoji} style={[z.reactionBadge, { backgroundColor: isDark ? '#1f2c34' : '#fff', borderColor: isDark ? '#2a3942' : '#f1f5f9' }, isSelf && z.reactionSelf]}
                  onPress={() => onReact?.(message.id, r.emoji)} activeOpacity={0.7}>
                  <Text style={z.reactionEmoji}>{r.emoji}</Text>
                  {r.users.length > 1 && <Text style={z.reactionCount}>{r.users.length}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })()}
    </View>
  );
}

const z = StyleSheet.create({
  row: { marginVertical: 2, paddingHorizontal: 10 },
  rowOwn: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },

  bubble: {
    borderRadius: 18, overflow: 'visible',
    // Layered shadows for natural depth
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },

  // WhatsApp-style notch — concentric radius with bubble
  notch: { position: 'absolute', top: 0, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  notchOwn: { right: -5 },
  notchOther: { left: -5 },

  delBubble: { borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  delText: { fontSize: 13, fontStyle: 'italic' },

  sender: { fontSize: 12.5, fontWeight: '700', marginBottom: 2, paddingHorizontal: 12, paddingTop: 8 },

  // Reply context — concentric radius (outer 18 - padding 4 = inner 14)
  replyCtx: { flexDirection: 'row', marginHorizontal: 6, marginTop: 6, marginBottom: 3, borderRadius: 12, overflow: 'hidden' },
  replyCtxAccent: { width: 3.5 },
  replyCtxBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 6 },
  replyCtxAuthor: { fontSize: 11.5, fontWeight: '800', marginBottom: 2 },
  replyCtxSnippet: { fontSize: 12.5, lineHeight: 17 },

  fwdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 6 },
  fwdText: { fontSize: 11, color: '#8696a0', fontStyle: 'italic', fontWeight: '500' },

  // Image — concentric radius (outer 18 - margin 4 = inner 14)
  imgWrap: { borderRadius: 14, overflow: 'hidden', margin: 4 },
  img: { width: MAX_BUB - 12, height: 240, borderRadius: 14 },
  imgOverlay: {
    position: 'absolute', bottom: 0, right: 0, paddingHorizontal: 10, paddingVertical: 5,
    borderTopLeftRadius: 12, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  imgCaption: { padding: 8, paddingTop: 5 },

  // Video — premium player look
  videoWrap: { padding: 5, paddingBottom: 8 },
  videoThumb: {
    width: '100%', height: 180, backgroundColor: '#0f172a', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  videoPlay: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.85)',
  },
  videoBadge: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  videoDur: { fontSize: 10, color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  videoName: { fontSize: 13, fontWeight: '600', paddingHorizontal: 10, marginTop: 6 },
  videoSize: { fontSize: 11, paddingHorizontal: 10, marginTop: 2 },

  // Audio — polished waveform
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, minWidth: 180 },
  audioPlayBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    // Subtle inner shadow
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  audioCenter: { flex: 1 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 1.8 },
  waveBar: { width: 3, borderRadius: 1.5 },
  audioDurRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  audioDur: { fontSize: 11.5, fontWeight: '500', fontVariant: ['tabular-nums'] },
  speedBtn: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 36, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  speedText: { fontSize: 11, fontWeight: '800' },

  // File — premium card feel
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, minWidth: 180 },
  fileBadge: {
    width: 46, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2,
    // Subtle depth
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2,
  },
  badgeLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.4 },
  fileInfo: { flex: 1 },
  fName: { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1 },
  fileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  fSize: { fontSize: 11.5 },
  fDot: { fontSize: 11.5 },

  // Link preview — premium card
  linkCard: { margin: 5, borderRadius: 14, overflow: 'hidden', minWidth: 240 },
  linkThumb: { width: '100%', height: 140 },
  linkPreviewBody: { flexDirection: 'row', borderRadius: 10 },
  linkAccent: { width: 4, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  linkContent: { flex: 1, padding: 10, paddingLeft: 12 },
  linkTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 3, lineHeight: 20, letterSpacing: -0.2 },
  linkDesc: { fontSize: 12.5, lineHeight: 18, marginBottom: 4 },
  linkHostRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  linkHostText: { fontSize: 11, fontWeight: '600' },
  linkUrlWrap: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 3 },
  linkFullUrl: { fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },

  // Text — refined typography
  textWrap: { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 7 },
  text: { fontSize: 15.5, lineHeight: 22, letterSpacing: -0.1 },

  // Action menu — frosted glass effect
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 20, width: 230, paddingVertical: 6,
    // Premium layered shadow
    elevation: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 28,
  },
  menuIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 44 },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  menuLabel: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.1 },

  // Emoji-only — expressive
  emojiOnlyWrap: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4, alignItems: 'center' },
  emojiOnlyText: { fontSize: 52, lineHeight: 62 },

  // Code snippet — dev-grade
  codeWrap: { padding: 10, paddingBottom: 8 },
  codeLang: { fontSize: 9.5, fontWeight: '900', color: '#8b5cf6', letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  codeScroll: { backgroundColor: '#0f172a', borderRadius: 12, padding: 12, maxHeight: 220 },
  codeText: { fontSize: 12.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#e2e8f0', lineHeight: 19 },

  // Show more/less
  showMoreBtn: { marginTop: 5, paddingVertical: 2 },
  showMoreText: { fontSize: 13, fontWeight: '700' },

  // Mini link preview inside text messages
  miniLinkPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, borderRadius: 12 },
  miniLinkAccent: { width: 3, height: 18, borderRadius: 2 },
  miniLinkHost: { flex: 1, fontSize: 13, fontWeight: '600' },

  // Quick reactions — pill-shaped
  quickReactRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  quickReactBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickReactEmoji: { fontSize: 20 },

  // Reactions — floating pills
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -6, marginBottom: 4 },
  reactionsOwn: { justifyContent: 'flex-end', paddingRight: 12 },
  reactionsOther: { justifyContent: 'flex-start', paddingLeft: 12 },
  reactionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 7, paddingVertical: 3,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    borderWidth: 1.5, borderColor: '#f1f5f9',
  },
  reactionSelf: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  reactionEmoji: { fontSize: 15 },
  reactionCount: { fontSize: 11, fontWeight: '800', color: '#64748b' },

  // Uploading overlay
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 10,
  },
  uploadingText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Retry row
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, paddingHorizontal: 8 },
  retryOwn: { justifyContent: 'flex-end' },
  retryOther: { justifyContent: 'flex-start' },
  retryText: { fontSize: 11, fontWeight: '600' },

  // Swipe reply icon
  swipeReplyIcon: { position: 'absolute', left: 16, top: '50%', marginTop: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },

  // Footer — timestamp row
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3, paddingLeft: 10, paddingRight: 2 },
  footerInline: { marginTop: 0, paddingLeft: 0 },
  ft: { fontSize: 11, fontWeight: '400', fontVariant: ['tabular-nums'] },
});
