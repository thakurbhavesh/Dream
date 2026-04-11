import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/store/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { clearAllCache } from '../../src/services/cache';

const formatSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

export default function StorageScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(null);

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#fff';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      // Cache dir size
      let cacheSize = 0;
      try {
        const cacheInfo = await FileSystem.getInfoAsync(FileSystem.cacheDirectory);
        cacheSize = cacheInfo?.size || 0;
      } catch {}

      // Document dir size
      let docSize = 0;
      try {
        const docInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
        docSize = docInfo?.size || 0;
      } catch {}

      // AsyncStorage keys count
      let asyncKeys = 0;
      try {
        const keys = await AsyncStorage.getAllKeys();
        asyncKeys = keys.length;
      } catch {}

      // Count cached messages/threads
      let cachedThreads = 0;
      let cachedMessages = 0;
      let starredCount = 0;
      let draftCount = 0;
      try {
        const keys = await AsyncStorage.getAllKeys();
        cachedThreads = keys.filter(k => k.startsWith('threads')).length;
        cachedMessages = keys.filter(k => k.startsWith('msgs-')).length;
        draftCount = keys.filter(k => k.startsWith('draft-')).length;
        const starred = await AsyncStorage.getItem('starred_messages');
        starredCount = starred ? JSON.parse(starred).length : 0;
      } catch {}

      setStats({ cacheSize, docSize, asyncKeys, cachedThreads, cachedMessages, starredCount, draftCount, total: cacheSize + docSize });
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, []);

  const clearCache = useCallback(async (type) => {
    Alert.alert('Clear ' + type, `Are you sure? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        setClearing(type);
        try {
          if (type === 'All Cache') {
            await clearAllCache();
            try { await FileSystem.deleteAsync(FileSystem.cacheDirectory, { idempotent: true }); } catch {}
          } else if (type === 'Message Cache') {
            const keys = await AsyncStorage.getAllKeys();
            const msgKeys = keys.filter(k => k.startsWith('msgs-'));
            if (msgKeys.length) await AsyncStorage.multiRemove(msgKeys);
          } else if (type === 'Drafts') {
            const keys = await AsyncStorage.getAllKeys();
            const draftKeys = keys.filter(k => k.startsWith('draft-'));
            if (draftKeys.length) await AsyncStorage.multiRemove(draftKeys);
          } else if (type === 'Downloads') {
            try { await FileSystem.deleteAsync(FileSystem.cacheDirectory, { idempotent: true }); } catch {}
          }
          toast(`${type} cleared`, 'success');
          await loadStats();
        } catch { toast('Failed', 'error'); }
        finally { setClearing(null); }
      }},
    ]);
  }, [toast, loadStats]);

  const ITEMS = stats ? [
    { icon: 'folder-outline', label: 'Total Storage', value: formatSize(stats.total), color: ACCENT },
    { icon: 'chatbubbles-outline', label: 'Message Cache', value: `${stats.cachedMessages} chats`, color: '#3b82f6', action: 'Message Cache' },
    { icon: 'download-outline', label: 'Downloads & Media', value: formatSize(stats.cacheSize), color: '#8b5cf6', action: 'Downloads' },
    { icon: 'document-outline', label: 'App Data', value: formatSize(stats.docSize), color: '#22c55e' },
    { icon: 'create-outline', label: 'Drafts', value: `${stats.draftCount} saved`, color: '#f59e0b', action: 'Drafts' },
    { icon: 'star-outline', label: 'Starred Messages', value: `${stats.starredCount} starred`, color: '#eab308' },
  ] : [];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Storage & Data</Text>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 50 }]}>
          {/* Usage bar */}
          <View style={[s.usageCard, { backgroundColor: cardBg }]}>
            <Text style={[s.usageTitle, { color: textColor }]}>Storage Used</Text>
            <Text style={[s.usageValue, { color: ACCENT }]}>{formatSize(stats?.total || 0)}</Text>
            <View style={[s.usageBar, { backgroundColor: isDark ? '#0f172a' : '#e2e8f0' }]}>
              <View style={[s.usageFill, { backgroundColor: ACCENT, width: `${Math.min((stats?.total || 0) / (50 * 1048576) * 100, 100)}%` }]} />
            </View>
          </View>

          {/* Items */}
          {ITEMS.map((item, i) => (
            <View key={i} style={[s.row, { backgroundColor: cardBg }]}>
              <View style={[s.rowIcon, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { color: textColor }]}>{item.label}</Text>
                <Text style={[s.rowValue, { color: subColor }]}>{item.value}</Text>
              </View>
              {item.action && (
                <TouchableOpacity style={[s.clearBtn, { backgroundColor: '#ef444412' }]}
                  onPress={() => clearCache(item.action)} disabled={!!clearing}>
                  {clearing === item.action ? <ActivityIndicator size="small" color="#ef4444" /> :
                    <Text style={s.clearText}>Clear</Text>}
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Clear all */}
          <TouchableOpacity style={[s.clearAllBtn, { borderColor: '#ef4444' }]}
            onPress={() => clearCache('All Cache')} disabled={!!clearing} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={s.clearAllText}>Clear All Cache</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 12, elevation: 4 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  body: { padding: 12, gap: 8 },
  usageCard: { borderRadius: 18, padding: 20, marginBottom: 8, alignItems: 'center' },
  usageTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  usageValue: { fontSize: 28, fontWeight: '900', marginBottom: 12 },
  usageBar: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16 },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '700' },
  rowValue: { fontSize: 12, marginTop: 2 },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  clearText: { fontSize: 12, fontWeight: '800', color: '#ef4444' },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, marginTop: 12 },
  clearAllText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
});
