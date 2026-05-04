import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import {
  getMeetingById,
  rsvpMeeting,
  changeMeetingStatus,
  deleteMeeting,
} from '../../src/api/meetings';

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme: t } = useTheme();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await getMeetingById(id);
      setMeeting(m?.meeting || m);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) Alert.alert('Not found', 'This meeting no longer exists.');
      else console.warn('[meeting] load failed:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const isHost = meeting && Number(meeting.host_id) === Number(user?.id);
  const status = String(meeting?.status || '').toLowerCase();
  const isLive = status === 'live' || status === 'active';
  const isPast = status === 'ended' || status === 'completed';
  const participants = meeting?.participants || [];

  const copyCode = async () => {
    if (!meeting?.meeting_id) return;
    await Clipboard.setStringAsync(String(meeting.meeting_id));
    Alert.alert('Copied', `Meeting code copied: ${meeting.meeting_id}`);
  };

  const copyLink = async () => {
    if (!meeting?.meeting_id) return;
    const link = `https://dream-phi-three.vercel.app/app/meeting?join=${meeting.meeting_id}`;
    await Clipboard.setStringAsync(link);
    Alert.alert('Copied', 'Invite link copied to clipboard.');
  };

  const setRsvp = async (rsvp) => {
    setBusy(true);
    try {
      await rsvpMeeting(id, rsvp);
      await load();
    } catch (e) {
      Alert.alert('Failed', e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  const startMeeting = async () => {
    setBusy(true);
    try {
      await changeMeetingStatus(id, 'live');
      await load();
    } catch (e) {
      Alert.alert('Failed', e?.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  const endMeeting = async () => {
    Alert.alert('End meeting?', 'This will end the meeting for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await changeMeetingStatus(id, 'ended');
          await load();
        } catch (e) {
          Alert.alert('Failed', e?.response?.data?.message || e.message);
        } finally { setBusy(false); }
      }},
    ]);
  };

  const removeMeeting = () => {
    Alert.alert('Delete meeting?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await deleteMeeting(id);
          router.back();
        } catch (e) {
          Alert.alert('Failed', e?.response?.data?.message || e.message);
          setBusy(false);
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]}>
        <Text style={[s.empty, { color: t.textSec }]}>Meeting not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Meeting',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontWeight: '700' },
          headerTintColor: t.text,
        }}
      />
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        >
          {/* Status badge */}
          <View style={s.statusRow}>
            {isLive && (
              <View style={[s.badge, { backgroundColor: '#dc262615' }]}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>LIVE</Text>
              </View>
            )}
            {isPast && (
              <View style={[s.badge, { backgroundColor: t.surfaceAlt }]}>
                <Text style={[s.badgeTxt, { color: t.textSec }]}>ENDED</Text>
              </View>
            )}
            {!isLive && !isPast && (
              <View style={[s.badge, { backgroundColor: t.accentBg }]}>
                <Text style={[s.badgeTxt, { color: t.accent }]}>SCHEDULED</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={[s.title, { color: t.text }]}>{meeting.title || 'Untitled meeting'}</Text>
          {!!meeting.description && (
            <Text style={[s.description, { color: t.textSec }]}>{meeting.description}</Text>
          )}

          {/* Meta card */}
          <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
            <View style={s.metaRow}>
              <Ionicons name="calendar-outline" size={18} color={t.textTer} />
              <Text style={[s.metaLabel, { color: t.textSec }]}>When</Text>
              <Text style={[s.metaValue, { color: t.text }]}>
                {formatDateTime(meeting.scheduled_at || meeting.started_at || meeting.created_at)}
              </Text>
            </View>
            {!!meeting.duration_minutes && (
              <>
                <View style={[s.divider, { backgroundColor: t.borderLight }]} />
                <View style={s.metaRow}>
                  <Ionicons name="hourglass-outline" size={18} color={t.textTer} />
                  <Text style={[s.metaLabel, { color: t.textSec }]}>Duration</Text>
                  <Text style={[s.metaValue, { color: t.text }]}>{meeting.duration_minutes}m</Text>
                </View>
              </>
            )}
            {!!meeting.recurrence_rule && meeting.recurrence_rule !== 'none' && (
              <>
                <View style={[s.divider, { backgroundColor: t.borderLight }]} />
                <View style={s.metaRow}>
                  <Ionicons name="repeat-outline" size={18} color={t.textTer} />
                  <Text style={[s.metaLabel, { color: t.textSec }]}>Repeats</Text>
                  <Text style={[s.metaValue, { color: t.text }]}>{meeting.recurrence_rule}</Text>
                </View>
              </>
            )}
          </View>

          {/* Code + link */}
          {!!meeting.meeting_id && (
            <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
              <Text style={[s.cardLabel, { color: t.textSec }]}>Meeting code</Text>
              <Text style={[s.code, { color: t.text }]}>{meeting.meeting_id}</Text>
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={[s.smallBtn, { backgroundColor: t.accentBg }]}
                  onPress={copyCode}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy-outline" size={14} color={t.accent} />
                  <Text style={[s.smallBtnTxt, { color: t.accent }]}>Copy code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.smallBtn, { backgroundColor: t.accentBg }]}
                  onPress={copyLink}
                  activeOpacity={0.7}
                >
                  <Ionicons name="link-outline" size={14} color={t.accent} />
                  <Text style={[s.smallBtnTxt, { color: t.accent }]}>Copy link</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Passcode */}
          {!!meeting.passcode && (
            <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
              <Text style={[s.cardLabel, { color: t.textSec }]}>Passcode</Text>
              <Text style={[s.code, { color: t.text }]}>{meeting.passcode}</Text>
            </View>
          )}

          {/* Participants */}
          {participants.length > 0 && (
            <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
              <Text style={[s.cardLabel, { color: t.textSec }]}>Participants ({participants.length})</Text>
              {participants.slice(0, 10).map((p, i) => (
                <View key={p.id || p.user_id || i} style={s.participantRow}>
                  <View style={[s.avatarFallback, { backgroundColor: t.accentBg }]}>
                    <Text style={{ color: t.accent, fontWeight: '700', fontSize: 12 }}>
                      {(p.display_name || p.email || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[s.participantName, { color: t.text }]} numberOfLines={1}>
                    {p.display_name || p.email || `User #${p.user_id}`}
                  </Text>
                  {p.role === 'host' && (
                    <View style={[s.roleBadge, { backgroundColor: t.accentBg }]}>
                      <Text style={[s.roleBadgeTxt, { color: t.accent }]}>HOST</Text>
                    </View>
                  )}
                  {p.role === 'co_host' && (
                    <View style={[s.roleBadge, { backgroundColor: '#10b98115' }]}>
                      <Text style={[s.roleBadgeTxt, { color: '#10b981' }]}>CO-HOST</Text>
                    </View>
                  )}
                </View>
              ))}
              {participants.length > 10 && (
                <Text style={[s.metaLabel, { color: t.textTer, marginTop: 8 }]}>
                  +{participants.length - 10} more
                </Text>
              )}
            </View>
          )}

          {/* RSVP (non-host, not past) */}
          {!isHost && !isPast && (
            <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
              <Text style={[s.cardLabel, { color: t.textSec }]}>Will you attend?</Text>
              <View style={s.rsvpRow}>
                {['yes', 'maybe', 'no'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.rsvpBtn, { borderColor: t.inputBorder }]}
                    onPress={() => setRsvp(r)}
                    disabled={busy}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.rsvpTxt, { color: t.text }]}>
                      {r === 'yes' ? '✓ Yes' : r === 'maybe' ? '? Maybe' : '✗ No'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

        </ScrollView>

        {/* Action bar */}
        <View style={[s.actionBar, { backgroundColor: t.surface, borderTopColor: t.borderLight }]}>
          {isHost && !isLive && !isPast && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.accent }]}
              onPress={async () => {
                await startMeeting();
                router.push(`/meetings/room/${id}`);
              }}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Ionicons name="videocam" size={18} color="#fff" />
              <Text style={s.actionTxt}>Start meeting</Text>
            </TouchableOpacity>
          )}
          {isLive && !isHost && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.accent }]}
              onPress={() => router.push(`/meetings/room/${id}`)}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Ionicons name="enter" size={18} color="#fff" />
              <Text style={s.actionTxt}>Join now</Text>
            </TouchableOpacity>
          )}
          {isHost && isLive && (
            <>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: t.accent }]}
                onPress={() => router.push(`/meetings/room/${id}`)}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Ionicons name="enter" size={18} color="#fff" />
                <Text style={s.actionTxt}>Rejoin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.iconBtn, { backgroundColor: '#dc262615' }]}
                onPress={endMeeting}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Ionicons name="stop" size={18} color="#dc2626" />
              </TouchableOpacity>
            </>
          )}
          {isHost && !isLive && (
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: t.surfaceAlt }]}
              onPress={removeMeeting}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={t.textSec} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  statusRow: { flexDirection: 'row', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' },
  liveTxt: { fontSize: 11, fontWeight: '900', color: '#dc2626', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  description: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 14 },
  cardLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  code: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  smallBtnTxt: { fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  metaLabel: { fontSize: 13, width: 80 },
  metaValue: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  divider: { height: 1, marginVertical: 6 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatarFallback: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  participantName: { flex: 1, fontSize: 14 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  rsvpTxt: { fontSize: 13, fontWeight: '600' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 16 },
  noteTxt: { flex: 1, fontSize: 12, lineHeight: 17 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  actionTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  iconBtn: { width: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
