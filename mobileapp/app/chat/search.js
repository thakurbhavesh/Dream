import { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
  ActivityIndicator, Image, Linking, Dimensions, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Avatar from '../../src/components/Avatar';
import { useTheme } from '../../src/store/ThemeContext';
import { useAuth } from '../../src/store/AuthContext';
import api from '../../src/api/config';
import { semanticSearchMessages, smartSearchMessages } from '../../src/api/chat';

const { width: W } = Dimensions.get('window');
// BRAND resolved from theme in component

// Type filter chips
const TYPE_FILTERS = [
  { key: null, label: 'All', icon: 'apps-outline' },
  { key: 'text', label: 'Text', icon: 'text-outline' },
  { key: 'image', label: 'Photos', icon: 'images-outline' },
  { key: 'video', label: 'Videos', icon: 'videocam-outline' },
  { key: 'file', label: 'Files', icon: 'document-outline' },
  { key: 'link', label: 'Links', icon: 'link-outline' },
  { key: 'audio', label: 'Audio', icon: 'mic-outline' },
  { key: 'code', label: 'Code', icon: 'code-slash-outline' },
];

const fmtTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diff = (now - d) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const fmtSize = (s) => {
  if (!s) return '';
  const n = Number(s);
  if (!n) return s;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

export default function SearchScreen() {
  const { theme: t, isDark } = useTheme();
  const BRAND = t.accent;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const timer = useRef(null);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchMode, setSearchMode] = useState('normal'); // 'normal' | 'semantic' | 'smart'
  const [aiNote, setAiNote] = useState(''); // interpretation / intent shown above results

  const doSearch = useCallback(async (q, type, mode) => {
    if ((!q || q.trim().length < 2) && !type) { setResults(null); setTotal(0); setAiNote(''); return; }
    setLoading(true);
    setAiNote('');
    try {
      // AI modes need a real query
      if (mode === 'semantic' && q && q.trim().length >= 2) {
        const r = await semanticSearchMessages(q.trim(), { limit: 50 });
        const items = r?.results || [];
        setResults(items);
        setTotal(items.length);
        if (r?.interpretation) setAiNote(r.interpretation);
        return;
      }
      if (mode === 'smart' && q && q.trim().length >= 2) {
        const r = await smartSearchMessages(q.trim(), { limit: 50 });
        const items = r?.results || [];
        setResults(items);
        setTotal(items.length);
        if (r?.filters?.intent) setAiNote(r.filters.intent);
        return;
      }
      // Normal text search (with optional type filter)
      const params = { limit: 50 };
      if (q && q.trim().length >= 2) params.q = q.trim();
      if (type) params.types = type;
      const { data } = await api.get('/chat/search', { params });
      const r = data?.data || data;
      const items = r?.results || r?.messages || r || [];
      setResults(items);
      setTotal(r?.total || items.length);
    } catch (e) {
      setResults([]);
      setTotal(0);
      if (mode !== 'normal') setAiNote('AI search unavailable — try Normal mode.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQuery = (q) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    const delay = searchMode === 'normal' ? 400 : 600;
    timer.current = setTimeout(() => doSearch(q, typeFilter, searchMode), delay);
  };

  const handleTypeFilter = (key) => {
    setTypeFilter(key);
    doSearch(query, key, searchMode);
  };

  const handleModeChange = (mode) => {
    setSearchMode(mode);
    doSearch(query, typeFilter, mode);
  };

  const cardBg = isDark ? '#1e293b' : '#fff';
  const chipBg = isDark ? '#0f172a' : '#f1f5f9';
  const chipActiveBg = `${BRAND}15`;

  const renderResult = ({ item }) => {
    const c = item?.content || {};
    const m = item?.metadata || {};
    const msgType = item?.type || 'text';
    const isOwn = String(item?.author?.id) === String(user?.id);
    const threadLabel = item?.groupName || (isOwn ? 'You' : item?.author?.name) || '';
    const time = m?.sentAt || item?.createdAt || '';
    const tid = item?.threadId || '';

    const navigateToChat = () => {
      const chatName = item?.groupName || item?.author?.name || '';
      router.push(`/chat/${tid}?name=${encodeURIComponent(chatName)}&avatar=${encodeURIComponent(item?.author?.avatar || '')}`);
    };

    // Image result
    if (msgType === 'image') {
      const imgUrl = c?.fileUrl || c?.file_url || m?.fileUrl || '';
      return (
        <TouchableOpacity style={[z.resultCard, { backgroundColor: cardBg }]} onPress={navigateToChat} activeOpacity={0.7}>
          <View style={z.resultHeader}>
            <Avatar uri={item?.author?.avatar} name={item?.author?.name} size={28} />
            <Text style={[z.resultName, { color: t.text }]}>{isOwn ? 'You' : item?.author?.name}</Text>
            {item?.groupName && <Text style={[z.resultGroup, { color: BRAND }]}>in {item.groupName}</Text>}
            <Text style={[z.resultTime, { color: t.textTer }]}>{fmtTime(time)}</Text>
          </View>
          {imgUrl ? <Image source={{ uri: imgUrl }} style={z.resultImg} resizeMode="cover" /> : null}
          {c?.fileName && <Text style={[z.resultFileMeta, { color: t.textTer }]}>{c.fileName} · {fmtSize(c?.rawSize || c?.fileSize)}</Text>}
        </TouchableOpacity>
      );
    }

    // File / video / audio
    if (['file', 'video', 'audio'].includes(msgType)) {
      const fn = c?.fileName || c?.file_name || 'File';
      const ext = (fn.split('.').pop() || '').toUpperCase();
      const iconMap = { video: 'videocam', audio: 'musical-notes', file: 'document-text' };
      const colorMap = { video: '#f59e0b', audio: '#8b5cf6', file: '#3b82f6' };
      return (
        <TouchableOpacity style={[z.resultCard, { backgroundColor: cardBg }]} onPress={navigateToChat} activeOpacity={0.7}>
          <View style={z.resultHeader}>
            <Avatar uri={item?.author?.avatar} name={item?.author?.name} size={28} />
            <Text style={[z.resultName, { color: t.text }]}>{isOwn ? 'You' : item?.author?.name}</Text>
            {item?.groupName && <Text style={[z.resultGroup, { color: BRAND }]}>in {item.groupName}</Text>}
            <Text style={[z.resultTime, { color: t.textTer }]}>{fmtTime(time)}</Text>
          </View>
          <View style={z.resultFileRow}>
            <View style={[z.fileBadge, { backgroundColor: `${colorMap[msgType] || '#64748b'}12` }]}>
              <Ionicons name={iconMap[msgType] || 'document'} size={18} color={colorMap[msgType] || '#64748b'} />
              {ext ? <Text style={[z.fileExt, { color: colorMap[msgType] || '#64748b' }]}>{ext}</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[z.fileName, { color: t.text }]} numberOfLines={1}>{fn}</Text>
              <Text style={[z.fileMeta, { color: t.textTer }]}>{fmtSize(c?.rawSize || c?.fileSize)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Link
    if (msgType === 'link') {
      const href = c?.url || c?.fileUrl || '';
      let host = c?.displayHost || '';
      if (!host && href) try { host = new URL(href).hostname.replace('www.', ''); } catch {}
      return (
        <TouchableOpacity style={[z.resultCard, { backgroundColor: cardBg }]} onPress={navigateToChat} activeOpacity={0.7}>
          <View style={z.resultHeader}>
            <Avatar uri={item?.author?.avatar} name={item?.author?.name} size={28} />
            <Text style={[z.resultName, { color: t.text }]}>{isOwn ? 'You' : item?.author?.name}</Text>
            {item?.groupName && <Text style={[z.resultGroup, { color: BRAND }]}>in {item.groupName}</Text>}
            <Text style={[z.resultTime, { color: t.textTer }]}>{fmtTime(time)}</Text>
          </View>
          <View style={z.linkResultRow}>
            <View style={[z.linkBubble, { backgroundColor: isDark ? '#0f172a' : BRAND + '08' }]}>
              <Ionicons name="globe-outline" size={16} color={BRAND} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[z.linkResultTitle, { color: t.text }]} numberOfLines={1}>{c?.title || href}</Text>
              {host ? <Text style={[z.linkResultHost, { color: BRAND }]}>{host}</Text> : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Text / emoji / code (default)
    const msgText = c?.text || c?.url || c?.code || '';
    return (
      <TouchableOpacity style={[z.resultCard, { backgroundColor: cardBg }]} onPress={navigateToChat} activeOpacity={0.7}>
        <View style={z.resultHeader}>
          <Avatar uri={item?.author?.avatar} name={item?.author?.name} size={28} />
          <Text style={[z.resultName, { color: t.text }]}>{isOwn ? 'You' : item?.author?.name}</Text>
          {item?.groupName && <Text style={[z.resultGroup, { color: BRAND }]}>in {item.groupName}</Text>}
          <Text style={[z.resultTime, { color: t.textTer }]}>{fmtTime(time)}</Text>
        </View>
        <Text style={[z.resultText, { color: t.textSec }]} numberOfLines={3}>{msgText}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[z.root, { backgroundColor: isDark ? '#0b141a' : '#f0f2f5' }]}>
      {/* ─── Header ─── */}
      <View style={[z.header, { backgroundColor: cardBg, paddingTop: insets.top + 6 }]}>
        {/* Search input row */}
        <View style={z.searchRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={t.text} />
          </TouchableOpacity>
          <View style={[z.inputWrap, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
            <Ionicons name="search" size={16} color={t.textTer} />
            <TextInput ref={inputRef} style={[z.input, { color: t.text }]}
              placeholder="Search messages, files, links..."
              placeholderTextColor={t.textTer}
              value={query} onChangeText={handleQuery}
              autoFocus returnKeyType="search" />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults(null); setTotal(0); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={t.textTer} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search-mode toggle (Normal / Semantic / Smart) */}
        <View style={[z.modeRow, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
          {[
            { key: 'normal', label: 'Normal', icon: 'search' },
            { key: 'semantic', label: 'Semantic', icon: 'sparkles' },
            { key: 'smart', label: 'Smart', icon: 'compass' },
          ].map((mode) => {
            const active = searchMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[z.modeBtn, active && { backgroundColor: isDark ? '#1e293b' : '#fff' }]}
                onPress={() => handleModeChange(mode.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={mode.icon} size={13} color={active ? BRAND : t.textTer} />
                <Text style={[z.modeLabel, { color: active ? BRAND : t.textTer }]}>{mode.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* AI interpretation hint */}
        {!!aiNote && (
          <View style={[z.aiNote, { backgroundColor: `${BRAND}15`, borderColor: BRAND }]}>
            <Ionicons name="sparkles-outline" size={12} color={BRAND} />
            <Text style={[z.aiNoteTxt, { color: BRAND }]} numberOfLines={2}>{aiNote}</Text>
          </View>
        )}

        {/* Type filter chips — only meaningful in normal mode */}
        {searchMode === 'normal' && (
          <FlatList
            data={TYPE_FILTERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={i => i.label}
            contentContainerStyle={z.chipRow}
            renderItem={({ item: f }) => {
              const active = typeFilter === f.key;
              return (
                <TouchableOpacity
                  style={[z.chip, { backgroundColor: active ? chipActiveBg : chipBg, borderColor: active ? BRAND : 'transparent' }]}
                  onPress={() => handleTypeFilter(active ? null : f.key)} activeOpacity={0.7}>
                  <Ionicons name={f.icon} size={14} color={active ? BRAND : t.textTer} />
                  <Text style={[z.chipLabel, { color: active ? BRAND : t.textTer }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* ─── Results ─── */}
      {loading ? (
        <View style={z.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : results === null ? (
        <View style={z.center}>
          <View style={[z.emptyCircle, { backgroundColor: isDark ? '#1e293b' : BRAND + '10' }]}>
            <Ionicons name="search" size={32} color={isDark ? '#475569' : BRAND} />
          </View>
          <Text style={[z.emptyTitle, { color: t.textSec }]}>Search across all chats</Text>
          <Text style={[z.emptySub, { color: t.textTer }]}>Find messages, photos, files, links and more</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={z.center}>
          <Ionicons name="search-outline" size={44} color={t.textTer} />
          <Text style={[z.emptyTitle, { color: t.textSec }]}>No results</Text>
          <Text style={[z.emptySub, { color: t.textTer }]}>Try different keywords or filters</Text>
        </View>
      ) : (
        <>
          <View style={z.countRow}>
            <Text style={[z.countText, { color: t.textTer }]}>{total} result{total !== 1 ? 's' : ''}</Text>
          </View>
          <FlatList
            data={results}
            keyExtractor={(item, i) => item.id || String(i)}
            renderItem={renderResult}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </>
      )}
    </View>
  );
}

const z = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingBottom: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginBottom: 8 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 14, height: 42 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },

  // Filter chips
  chipRow: { paddingHorizontal: 12, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  chipLabel: { fontSize: 12, fontWeight: '600' },

  // Results
  countRow: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontSize: 12, fontWeight: '600' },

  resultCard: {
    borderRadius: 14, padding: 12, marginBottom: 6,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 } }),
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  resultName: { fontSize: 13, fontWeight: '700' },
  resultGroup: { fontSize: 11, fontWeight: '600' },
  resultTime: { fontSize: 10, marginLeft: 'auto' },
  resultText: { fontSize: 14, lineHeight: 20 },

  // Image result
  resultImg: { width: '100%', height: 180, borderRadius: 10, marginBottom: 4 },
  resultFileMeta: { fontSize: 11, marginTop: 2 },

  // File result
  resultFileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileBadge: { width: 44, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 1 },
  fileExt: { fontSize: 7, fontWeight: '900' },
  fileName: { fontSize: 13, fontWeight: '600' },
  fileMeta: { fontSize: 11, marginTop: 1 },

  // Link result
  linkResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkBubble: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkResultTitle: { fontSize: 13, fontWeight: '600' },
  linkResultHost: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  // Empty
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
  modeRow: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 3 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 7 },
  modeLabel: { fontSize: 12, fontWeight: '700' },
  aiNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginBottom: 8, padding: 8, borderRadius: 8, borderWidth: 1 },
  aiNoteTxt: { flex: 1, fontSize: 11, fontStyle: 'italic' },
});
