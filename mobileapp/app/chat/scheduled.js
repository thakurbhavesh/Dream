import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/store/ThemeContext';
import useSocket from '../../src/hooks/useSocket';

const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function ScheduledMessagesScreen() {
  const { theme: t, isDark } = useTheme();
  const { emit, on, connected } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!connected) { setLoading(false); return; }
    try {
      const res = await emit('scheduled:list', {});
      if (res?.ok) {
        setItems((res.scheduled || []).filter((s) => s.status === 'pending'));
      }
    } catch (e) {
      console.warn('[scheduled] load failed:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [emit, connected]);

  useEffect(() => { load(); }, [load]);

  // Live updates — when a new schedule is added or one auto-sends
  useEffect(() => {
    const u1 = on('message:scheduled', (msg) => {
      if (!msg?.id) return;
      setItems((prev) => {
        if (prev.find((x) => x.id === msg.id)) return prev;
        return [...prev, msg].sort((a, b) => new Date(a.send_at) - new Date(b.send_at));
      });
    });
    const u2 = on('scheduled:sent', ({ id }) => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    });
    return () => { try { u1?.(); u2?.(); } catch {} };
  }, [on]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const cancelOne = (item) => {
    Alert.alert('Cancel scheduled message?', 'It will not be sent.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel send',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await emit('message:schedule:cancel', { id: item.id });
            if (res?.ok) {
              setItems((prev) => prev.filter((x) => x.id !== item.id));
            } else {
              Alert.alert('Failed', res?.error || 'Could not cancel');
            }
          } catch (e) {
            Alert.alert('Failed', e?.message || 'Could not cancel');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
      <View style={[s.icon, { backgroundColor: t.accentBg }]}>
        <Ionicons name="time-outline" size={20} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.thread, { color: t.textTer }]} numberOfLines={1}>
          To {String(item.thread_id || '').replace('dm-', 'user ').replace('group-', 'group ')}
        </Text>
        <Text style={[s.body, { color: t.text }]} numberOfLines={3}>{item.message}</Text>
        <Text style={[s.when, { color: t.accent }]}>📅 {fmt(item.send_at)}</Text>
      </View>
      <TouchableOpacity onPress={() => cancelOne(item)} hitSlop={8} style={{ padding: 6 }}>
        <Ionicons name="close-circle" size={22} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Scheduled Messages',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontWeight: '700' },
          headerTintColor: t.text,
        }}
      />
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={items.length === 0 ? s.emptyContainer : { padding: 12 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="time-outline" size={48} color={t.textQuad} />
                <Text style={[s.emptyTitle, { color: t.text }]}>No scheduled messages</Text>
                <Text style={[s.emptyHint, { color: t.textTer }]}>
                  Long-press the send button in any chat to schedule a message for later.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  thread: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { fontSize: 14, marginVertical: 4 },
  when: { fontSize: 12, fontWeight: '700' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyHint: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
