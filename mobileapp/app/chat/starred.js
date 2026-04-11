import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Avatar from '../../src/components/Avatar';
import { useTheme } from '../../src/store/ThemeContext';

const STARRED_KEY = 'starred_messages';

// Public helper to add/remove starred messages
export const toggleStarredMessage = async (message, threadId) => {
  const raw = await AsyncStorage.getItem(STARRED_KEY);
  const list = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex(m => m.id === message.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({ ...message, _threadId: threadId, _starredAt: new Date().toISOString() });
  }
  await AsyncStorage.setItem(STARRED_KEY, JSON.stringify(list.slice(0, 200)));
  return idx < 0; // true if starred, false if unstarred
};

export const isMessageStarred = async (messageId) => {
  const raw = await AsyncStorage.getItem(STARRED_KEY);
  const list = raw ? JSON.parse(raw) : [];
  return list.some(m => m.id === messageId);
};

export default function StarredScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STARRED_KEY);
        setMessages(raw ? JSON.parse(raw) : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const unstar = async (msg) => {
    const raw = await AsyncStorage.getItem(STARRED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(m => m.id !== msg.id);
    await AsyncStorage.setItem(STARRED_KEY, JSON.stringify(filtered));
    setMessages(filtered);
  };

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#fff';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Ionicons name="star" size={18} color="#fbbf24" />
        <Text style={s.headerTitle}>Starred Messages</Text>
        <Text style={s.headerCount}>{messages.length}</Text>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
        <FlatList
          data={messages}
          keyExtractor={(item, i) => item.id || String(i)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          renderItem={({ item }) => {
            const c = item.content || {};
            const text = c.text || c.fileName || c.url || item.type || '';
            const time = item._starredAt || item.createdAt || '';
            return (
              <TouchableOpacity style={[s.row, { backgroundColor: cardBg, borderColor: isDark ? '#334155' : '#f1f5f9' }]}
                onPress={() => router.push(`/chat/${item._threadId}?name=&avatar=`)} activeOpacity={0.7}>
                <Avatar uri={item.author?.avatar} name={item.author?.name} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Text style={[s.rowName, { color: textColor }]}>{item.author?.name || 'You'}</Text>
                    <Text style={[s.rowTime, { color: subColor }]}>
                      {time ? new Date(time).toLocaleDateString([], { day: '2-digit', month: 'short' }) : ''}
                    </Text>
                  </View>
                  <Text style={[s.rowText, { color: subColor }]} numberOfLines={2}>{text}</Text>
                </View>
                <TouchableOpacity onPress={() => unstar(item)} hitSlop={8} style={s.unstarBtn}>
                  <Ionicons name="star" size={18} color="#eab308" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="star-outline" size={52} color={subColor} />
              <Text style={[s.emptyTitle, { color: subColor }]}>No starred messages</Text>
              <Text style={[s.emptySub, { color: subColor }]}>Long-press a message and tap Star</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12, elevation: 4 },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  headerCount: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, marginTop: 8, padding: 14, borderRadius: 16, borderWidth: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  rowName: { fontSize: 14, fontWeight: '700' },
  rowTime: { fontSize: 11 },
  rowText: { fontSize: 13, lineHeight: 18 },
  unstarBtn: { padding: 6 },
  empty: { alignItems: 'center', paddingTop: 100, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13 },
});
