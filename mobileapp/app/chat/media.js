import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../src/store/ThemeContext';
import api from '../../src/api/config';

const { width: W } = Dimensions.get('window');
const TABS = [
  { key: 'media', label: 'Media', icon: 'images', types: 'image,video' },
  { key: 'files', label: 'Files', icon: 'document', types: 'file' },
  { key: 'links', label: 'Links', icon: 'link', types: 'link' },
  { key: 'pinned', label: 'Pinned', icon: 'pin', types: null },
];
const COL = 3;
const GAP = 2;
const THUMB = (W - GAP * (COL + 1)) / COL;

export default function MediaScreen() {
  const { threadId, name } = useLocalSearchParams();
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('media');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const current = TABS.find(t => t.key === tab);
        if (tab === 'pinned') {
          const { data } = await api.get(`/chat/threads/${threadId}/pinned`);
          setItems(data?.data?.messages || data?.messages || data?.data || []);
        } else {
          const { data } = await api.get('/chat/search', { params: { threadId, types: current.types, limit: 100 } });
          const r = data?.data || data;
          setItems(r?.results || r?.messages || r || []);
        }
      } catch { setItems([]); }
      finally { setLoading(false); }
    })();
  }, [tab, threadId]);

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#fff';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  const openUrl = (url) => url && WebBrowser.openBrowserAsync(url, { presentationStyle: 'pageSheet' });

  const renderMedia = ({ item }) => {
    const c = item?.content || {};
    const m = item?.metadata || {};
    const url = c?.fileUrl || c?.file_url || c?.url || m?.fileUrl || '';
    const type = item?.type;

    if (tab === 'media') {
      return (
        <TouchableOpacity style={s.mediaThumb} onPress={() => openUrl(url)} activeOpacity={0.8}>
          <Image source={{ uri: url }} style={s.mediaImg} resizeMode="cover" />
          {type === 'video' && (
            <View style={s.videoOverlay}>
              <Ionicons name="play-circle" size={28} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      );
    }
    if (tab === 'files') {
      const fname = c?.fileName || c?.file_name || m?.fileName || 'File';
      const ext = (fname.split('.').pop() || '').toUpperCase();
      return (
        <TouchableOpacity style={[s.fileRow, { backgroundColor: cardBg }]} onPress={() => openUrl(url)} activeOpacity={0.7}>
          <View style={[s.fileBadge, { backgroundColor: ACCENT + '20' }]}>
            <Text style={[s.fileExt, { color: ACCENT }]}>{ext}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.fileName, { color: textColor }]} numberOfLines={1}>{fname}</Text>
            <Text style={[s.fileMeta, { color: subColor }]}>
              {item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
            </Text>
          </View>
          <Ionicons name="download-outline" size={20} color={subColor} />
        </TouchableOpacity>
      );
    }
    if (tab === 'links') {
      const linkUrl = c?.url || c?.text || '';
      let host = '';
      try { host = new URL(linkUrl).hostname.replace('www.', ''); } catch {}
      return (
        <TouchableOpacity style={[s.linkRow, { backgroundColor: cardBg }]} onPress={() => Linking.openURL(linkUrl)} activeOpacity={0.7}>
          <Ionicons name="globe-outline" size={20} color={ACCENT} />
          <View style={{ flex: 1 }}>
            <Text style={[s.linkTitle, { color: textColor }]} numberOfLines={1}>{c?.title || host || linkUrl}</Text>
            <Text style={[s.linkUrl, { color: subColor }]} numberOfLines={1}>{linkUrl}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={subColor} />
        </TouchableOpacity>
      );
    }
    // Pinned
    const text = c?.text || c?.fileName || item?.type || '';
    return (
      <View style={[s.pinnedRow, { backgroundColor: cardBg }]}>
        <Ionicons name="pin" size={14} color={ACCENT} />
        <View style={{ flex: 1 }}>
          <Text style={[s.pinnedAuthor, { color: ACCENT }]}>{item?.author?.name || 'User'}</Text>
          <Text style={[{ color: textColor, fontSize: 14 }]} numberOfLines={2}>{text}</Text>
          <Text style={[s.fileMeta, { color: subColor }]}>{item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{name || 'Media & Files'}</Text>
      </View>

      {/* Tabs */}
      <View style={[s.tabRow, { backgroundColor: isDark ? '#1f2c34' : '#f8fafc' }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && { borderBottomColor: ACCENT }]}
            onPress={() => setTab(t.key)} activeOpacity={0.7}>
            <Ionicons name={t.icon} size={16} color={tab === t.key ? ACCENT : subColor} />
            <Text style={[s.tabLabel, { color: tab === t.key ? ACCENT : subColor }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => item?.id || String(i)}
          numColumns={tab === 'media' ? COL : 1}
          key={tab === 'media' ? 'grid' : 'list'}
          renderItem={renderMedia}
          contentContainerStyle={[tab === 'media' ? s.mediaGrid : s.listPad, { paddingBottom: insets.bottom + 50 }]}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name={TABS.find(t => t.key === tab)?.icon || 'images'} size={48} color={subColor} />
              <Text style={[s.emptyText, { color: subColor }]}>No {tab} found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 12, elevation: 4 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  tabRow: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 13, fontWeight: '700' },

  mediaGrid: { padding: GAP },
  mediaThumb: { width: THUMB, height: THUMB, margin: GAP / 2 },
  mediaImg: { width: '100%', height: '100%' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },

  listPad: { padding: 12, gap: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12 },
  fileBadge: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileExt: { fontSize: 11, fontWeight: '900' },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileMeta: { fontSize: 11, marginTop: 2 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12 },
  linkTitle: { fontSize: 14, fontWeight: '600' },
  linkUrl: { fontSize: 12, marginTop: 2 },

  pinnedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12 },
  pinnedAuthor: { fontSize: 12, fontWeight: '700', marginBottom: 2 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, marginTop: 10 },
});
