import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import { getUpcomingMeetings, getPastMeetings, deleteMeeting } from '../../src/api/meetings';

const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time;
};

export default function MeetingsScreen() {
  const { user } = useAuth();
  const { theme: t, isDark } = useTheme();
  const [tab, setTab] = useState('upcoming');
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const orgId = user?.orgId;

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    try {
      const [u, p] = await Promise.all([
        getUpcomingMeetings(orgId).catch(() => null),
        getPastMeetings(orgId, { limit: 50 }).catch(() => null),
      ]);
      setUpcoming(u?.meetings || u?.rows || u || []);
      setPast(p?.meetings || p?.rows || p || []);
    } catch (e) {
      console.warn('[meetings] load failed:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = (m) => {
    Alert.alert(
      'Delete meeting?',
      `"${m.title || 'Untitled'}" will be removed for everyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeeting(m.id);
              setUpcoming((prev) => prev.filter((x) => x.id !== m.id));
            } catch (e) {
              Alert.alert('Failed', e?.response?.data?.message || e.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isPast = tab === 'past';
    const isHost = Number(item.host_id) === Number(user?.id);
    const when = formatWhen(item.scheduled_at || item.started_at || item.created_at);
    const status = String(item.status || '').toLowerCase();
    const isLive = status === 'live' || status === 'active';
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/meetings/${item.id}`)}
        style={[s.card, { backgroundColor: t.surface, borderColor: t.borderLight }]}
      >
        <View style={[s.icon, { backgroundColor: isLive ? '#dc262615' : t.accentBg }]}>
          <Ionicons
            name={isLive ? 'radio' : (isPast ? 'time-outline' : 'videocam-outline')}
            size={22}
            color={isLive ? '#dc2626' : t.accent}
          />
        </View>
        <View style={s.cardBody}>
          <View style={s.cardHeader}>
            <Text style={[s.title, { color: t.text }]} numberOfLines={1}>
              {item.title || 'Untitled meeting'}
            </Text>
            {isLive && (
              <View style={[s.liveBadge, { backgroundColor: '#dc262615' }]}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={[s.meta, { color: t.textSec }]} numberOfLines={1}>
            {when}{item.duration_minutes ? ` · ${item.duration_minutes}m` : ''}
            {isHost ? ' · You hosted' : ''}
          </Text>
          {!!item.meeting_id && (
            <Text style={[s.code, { color: t.textTer }]} numberOfLines={1}>
              Code: {item.meeting_id}
            </Text>
          )}
        </View>
        {!isPast && isHost && (
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10} style={s.delBtn}>
            <Ionicons name="trash-outline" size={18} color={t.textTer} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const data = tab === 'upcoming' ? upcoming : past;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Meetings',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontWeight: '700' },
          headerTintColor: t.text,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/meetings/join')} hitSlop={10} style={{ marginRight: 8 }}>
              <Ionicons name="enter-outline" size={22} color={t.accent} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['bottom']}>
        {/* Quick actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionCard, { backgroundColor: t.accent }]}
            activeOpacity={0.8}
            onPress={() => router.push('/meetings/create?mode=instant')}
          >
            <Ionicons name="videocam" size={20} color="#fff" />
            <Text style={s.actionTxt}>New Meeting</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionCard, { backgroundColor: t.surface, borderColor: t.borderLight, borderWidth: 1 }]}
            activeOpacity={0.7}
            onPress={() => router.push('/meetings/create?mode=scheduled')}
          >
            <Ionicons name="calendar-outline" size={20} color={t.accent} />
            <Text style={[s.actionTxt, { color: t.accent }]}>Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[s.tabRow, { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
          <TouchableOpacity
            style={[s.tab, tab === 'upcoming' && { borderBottomColor: t.accent }]}
            onPress={() => setTab('upcoming')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, { color: tab === 'upcoming' ? t.accent : t.textTer }]}>
              Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'past' && { borderBottomColor: t.accent }]}
            onPress={() => setTab('past')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, { color: tab === 'past' ? t.accent : t.textTer }]}>Past</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={data.length === 0 ? s.emptyContainer : { padding: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name={tab === 'upcoming' ? 'videocam-outline' : 'time-outline'} size={48} color={t.textQuad} />
                <Text style={[s.emptyTitle, { color: t.text }]}>
                  {tab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
                </Text>
                <Text style={[s.emptyHint, { color: t.textTer }]}>
                  {tab === 'upcoming' ? 'Start an instant meeting or schedule one.' : 'Past meetings will appear here.'}
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
  actionsRow: { flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 8 },
  actionCard: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  actionTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 13, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  code: { fontSize: 11, marginTop: 2, fontFamily: 'monospace' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' },
  liveTxt: { fontSize: 10, fontWeight: '900', color: '#dc2626' },
  delBtn: { padding: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyHint: { fontSize: 13, marginTop: 6, textAlign: 'center' },
});
