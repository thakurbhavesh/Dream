import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, Dimensions, Modal, Pressable, Vibration, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const TEXT_LIMIT = 300; // chars before "Show more"

// Links → external browser, Files/Images/Videos → in-app preview
const openInApp = (url, color) => url && WebBrowser.openBrowserAsync(url, { presentationStyle: 'pageSheet', controlsColor: color || '#ea4c89' });
const openExternal = (url) => url && Linking.openURL(url);

// URL regex for auto-detection in text
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;

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
    const href = match[0];
    parts.push(
      <Text key={`l-${match.index}`} style={{ color: linkColor, textDecorationLine: 'underline' }}
        onPress={() => Linking.openURL(href)}>{href}</Text>
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

// Colors
const OWN_BG = '#dcf8c6';
const OWN_TEXT = '#303030';
const OTHER_BG = '#ffffff';
const OTHER_TEXT = '#303030';
const OWN_META = '#6d9b5d';
const OTHER_META = '#8696a0';

// Group sender colors
const SENDER_COLORS = ['#e15d44', '#ff6f61', '#9b59b6', '#00bcd4', '#e67e22', '#27ae60', '#2980b9', '#8e44ad'];
const getSenderColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

// Message action menu items
const getActions = (isOwn, type) => {
  const actions = [];
  // Destructive
  if (isOwn) {
    actions.push({ key: 'delete', icon: 'trash-outline', label: 'Delete', color: '#ef4444' });
    actions.push({ key: 'recall', icon: 'arrow-undo-outline', label: 'Unsend', color: '#f59e0b' });
    if (type === 'text' || type === 'link' || type === 'code') {
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
  }
  // Actions
  actions.push({ key: 'reply', icon: 'arrow-undo', label: 'Reply', color: '#3b82f6' });
  actions.push({ key: 'forward', icon: 'share-outline', label: 'Forward', color: '#8b5cf6' });
  actions.push({ key: 'info', icon: 'information-circle-outline', label: 'Info', color: '#3b82f6' });
  actions.push({ key: 'pin', icon: 'pin-outline', label: 'Pin', color: '#f59e0b' });
  return actions;
};

// ─── Audio Player Sub-component ───
function AudioPlayerWidget({ url, duration: metaDuration, isOwn, metaColor, Footer }) {
  const player = useAudioPlayer(url || '');
  const status = useAudioPlayerStatus(player);

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
          {Footer}
        </View>
      </View>
    </View>
  );
}

export default function ChatBubble({ message, isOwn, showName, onAction, accentColor = '#ea4c89', textSize = 15 }) {
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

  const showImage = (type === 'image' || (type === 'file' && isImageUrl(url || name))) && url;
  // Show link card for any link-type message (with or without preview)
  const isLink = type === 'link';

  // Recalled = hidden from everyone (unsent)
  if (c?.recalled) return null;

  // Deleted = show placeholder only
  if (c?.deleted) {
    return (
      <View style={[z.row, isOwn ? z.rowOwn : z.rowOther]}>
        <View style={z.delBubble}>
          <Ionicons name="ban-outline" size={13} color="#8696a0" />
          <Text style={z.delText}>This message was deleted</Text>
        </View>
      </View>
    );
  }

  const bg = isOwn ? OWN_BG : OTHER_BG;
  const metaColor = isOwn ? OWN_META : OTHER_META;
  const textColor = isOwn ? OWN_TEXT : OTHER_TEXT;

  const Tick = () => {
    if (!isOwn) return null;
    const st = message?.status;
    if (st === 'read') return <Ionicons name="checkmark-done" size={14} color="#53bdeb" />;
    if (st === 'delivered') return <Ionicons name="checkmark-done" size={14} color="#8696a0" />;
    if (st === 'sent') return <Ionicons name="checkmark" size={14} color="#8696a0" />;
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

  const actions = getActions(isOwn, type);

  return (
    <View style={[z.row, isOwn ? z.rowOwn : z.rowOther]}>
      {/* Action Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={z.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={z.menuCard}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {actions.map((a, i) => (
                <TouchableOpacity key={a.key} style={[z.menuItem, i < actions.length - 1 && z.menuItemBorder]}
                  onPress={() => handleAction(a.key)} activeOpacity={0.6}>
                  <View style={[z.menuIconWrap, { backgroundColor: `${a.color}12` }]}>
                    <Ionicons name={a.icon} size={16} color={a.color} />
                  </View>
                  <Text style={[z.menuLabel, { color: a.key === 'delete' || a.key === 'recall' ? a.color : '#334155' }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Tail */}
      <Pressable onLongPress={handleLongPress} delayLongPress={300}
        style={[z.bubble, { backgroundColor: bg, maxWidth: MAX_BUB }]}>
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

        {/* Forwarded */}
        {forwarded && (
          <View style={z.fwdRow}>
            <Ionicons name="arrow-redo" size={12} color="#8696a0" />
            <Text style={z.fwdText}>Forwarded</Text>
          </View>
        )}

        {/* ── Image ── */}
        {showImage && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => openInApp(url, ACCENT)} style={z.imgWrap}>
            <Image source={{ uri: url }} style={z.img} resizeMode="cover" />
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
          let host = c?.displayHost || '';
          if (!host && linkHref) try { host = new URL(linkHref).hostname.replace('www.', ''); } catch {}
          const hasPreview = c?.title || c?.thumbnail;
          return (
            <>
              <TouchableOpacity style={z.linkCard} activeOpacity={0.7}
                onPress={() => openExternal(linkHref)}>
                {/* Thumbnail */}
                {c?.thumbnail && <Image source={{ uri: c.thumbnail }} style={z.linkThumb} resizeMode="cover" />}

                {/* Preview body */}
                <View style={[z.linkPreviewBody, { backgroundColor: isOwn ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.03)' }]}>
                  <View style={[z.linkAccent, { backgroundColor: ACCENT }]} />
                  <View style={z.linkContent}>
                    {hasPreview && c?.title ? (
                      <Text style={[z.linkTitle, { color: textColor }]} numberOfLines={2}>{c.title}</Text>
                    ) : null}
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
                  <Text style={[z.linkFullUrl, { color: isOwn ? '#054640' : '#027eb5' }]}
                    numberOfLines={2}>{linkHref}</Text>
                </View>
              </TouchableOpacity>
              <Footer />
            </>
          );
        })()}

        {/* ── Text with auto-linked URLs + Show more/less ── */}
        {!showImage && !isLink && (text || (!isMedia)) ? (() => {
          const isLong = text.length > TEXT_LIMIT;
          const display = isLong && !expanded ? text.slice(0, TEXT_LIMIT) + '...' : text;
          const linkColor = isOwn ? '#054640' : '#027eb5';
          return (
            <View style={z.textWrap}>
              <Text style={[z.text, { fontSize: textSize }]}>{parseTextWithLinks(display, textColor, linkColor)}</Text>
              {isLong && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7} style={z.showMoreBtn}>
                  <Text style={[z.showMoreText, { color: linkColor }]}>{expanded ? 'Show less' : 'Show more'}</Text>
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
    </View>
  );
}

const z = StyleSheet.create({
  row: { marginVertical: 3, paddingHorizontal: 8 },
  rowOwn: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },

  bubble: {
    borderRadius: 10, overflow: 'visible',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.08, shadowRadius: 1,
  },

  // WhatsApp-style notch
  notch: { position: 'absolute', top: 0, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  notchOwn: { right: -6 },
  notchOther: { left: -6 },

  delBubble: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  delText: { fontSize: 13, color: '#8696a0', fontStyle: 'italic' },

  sender: { fontSize: 12, fontWeight: '700', marginBottom: 1, paddingHorizontal: 10, paddingTop: 6 },

  // Reply context in bubble
  replyCtx: { flexDirection: 'row', marginHorizontal: 4, marginTop: 4, marginBottom: 2, borderRadius: 6, overflow: 'hidden' },
  replyCtxAccent: { width: 3 },
  replyCtxBody: { flex: 1, paddingHorizontal: 8, paddingVertical: 5 },
  replyCtxAuthor: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  replyCtxSnippet: { fontSize: 12, lineHeight: 16 },

  fwdRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingTop: 4 },
  fwdText: { fontSize: 11, color: '#8696a0', fontStyle: 'italic' },

  // Image
  imgWrap: { borderRadius: 6, overflow: 'hidden', margin: 3 },
  img: { width: MAX_BUB - 10, height: 220, borderRadius: 6 },
  imgOverlay: { position: 'absolute', bottom: 0, right: 0, paddingHorizontal: 8, paddingVertical: 4, borderTopLeftRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)' },
  imgCaption: { padding: 6, paddingTop: 4 },

  // Video
  videoWrap: { padding: 4, paddingBottom: 6 },
  videoThumb: { width: '100%', height: 160, backgroundColor: '#1a1a2e', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  videoPlay: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.8)' },
  videoBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  videoDur: { fontSize: 10, color: '#fff', fontWeight: '600' },
  videoName: { fontSize: 13, fontWeight: '500', paddingHorizontal: 8, marginTop: 4 },
  videoSize: { fontSize: 11, paddingHorizontal: 8, marginTop: 1 },

  // Audio
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, minWidth: 200 },
  audioPlayBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  audioCenter: { flex: 1 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 1.5 },
  waveBar: { width: 2.5, borderRadius: 1.25 },
  audioDurRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  audioDur: { fontSize: 11 },

  // File
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 12, minWidth: 220 },
  fileBadge: { width: 42, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 1 },
  badgeLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.3 },
  fileInfo: { flex: 1 },
  fName: { fontSize: 13, fontWeight: '600' },
  fileMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  fSize: { fontSize: 11 },
  fDot: { fontSize: 11 },

  // Link preview
  linkCard: { margin: 4, borderRadius: 8, overflow: 'hidden', minWidth: 240 },
  linkThumb: { width: '100%', height: 130 },
  linkPreviewBody: { flexDirection: 'row', borderRadius: 6 },
  linkAccent: { width: 4, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
  linkContent: { flex: 1, padding: 8, paddingLeft: 10 },
  linkTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2, lineHeight: 19 },
  linkDesc: { fontSize: 12, lineHeight: 17, marginBottom: 3 },
  linkHostRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  linkHostText: { fontSize: 11, fontWeight: '500' },
  linkUrlWrap: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 2 },
  linkFullUrl: { fontSize: 14, lineHeight: 19, textDecorationLine: 'underline' },

  // Text
  textWrap: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6 },
  text: { fontSize: 15, lineHeight: 21 },

  // Action menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 18, width: 220, paddingVertical: 6,
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24,
  },
  menuIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  menuLabel: { fontSize: 14, fontWeight: '600' },

  // Show more/less
  showMoreBtn: { marginTop: 4 },
  showMoreText: { fontSize: 13, fontWeight: '600' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2, paddingLeft: 8 },
  footerInline: { marginTop: 0, paddingLeft: 0 },
  ft: { fontSize: 11 },
});
