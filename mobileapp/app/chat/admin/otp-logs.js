import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Modal, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../../src/components/Avatar';
import { useTheme } from '../../../src/store/ThemeContext';
import api from '../../../src/api/config';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–';
const fmtFull = (d) => d ? `${fmtDate(d)} ${fmtTime(d)}` : '–';

const ST = {
  verified: { color: '#22c55e', icon: 'checkmark-circle', bg: '#22c55e' },
  pending: { color: '#f59e0b', icon: 'time', bg: '#f59e0b' },
  expired: { color: '#64748b', icon: 'close-circle', bg: '#64748b' },
  failed: { color: '#ef4444', icon: 'alert-circle', bg: '#ef4444' },
};

export default function OtpLogsScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');
  const divider = t.divider || (isDark ? '#334155' : '#e2e8f0');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/otp-logs');
      setLogs((data?.data?.rows || data?.data || []).slice(0, 25));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);
  const stats = { total: logs.length, verified: logs.filter(l => l.status === 'verified').length, expired: logs.filter(l => l.status === 'expired').length, pending: logs.filter(l => l.status === 'pending').length };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>OTP Verifications</Text>
        <TouchableOpacity onPress={onRefresh} style={s.backBtn}>
          <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[s.statsRow, { backgroundColor: cardBg }]}>
        {[{ l: 'Total', v: stats.total, c: ACCENT }, { l: 'Verified', v: stats.verified, c: '#22c55e' }, { l: 'Expired', v: stats.expired, c: '#64748b' }, { l: 'Pending', v: stats.pending, c: '#f59e0b' }].map((x, i) => (
          <View key={i} style={s.statItem}>
            <Text style={[s.statNum, { color: x.c }]}>{x.v}</Text>
            <Text style={[s.statName, { color: subColor }]}>{x.l}</Text>
          </View>
        ))}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
        {['all', 'verified', 'pending', 'expired'].map(f => (
          <TouchableOpacity key={f} style={[s.chip, { backgroundColor: filter === f ? `${ACCENT}15` : cardBg, borderColor: filter === f ? ACCENT : divider }]}
            onPress={() => setFilter(f)} activeOpacity={0.7}>
            <Text style={[s.chipText, { color: filter === f ? ACCENT : subColor }]}>{f[0].toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList data={filtered} keyExtractor={(x, i) => String(x.otp_id || i)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} />}
          renderItem={({ item }) => {
            const st = ST[item.status] || ST.pending;
            return (
              <TouchableOpacity style={[s.card, { backgroundColor: cardBg }]} onPress={() => setDetail(item)} activeOpacity={0.6}>
                <Avatar uri={item.profile_url} name={item.name || item.email} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={s.cardTop}>
                    <Text style={[s.cardName, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
                    <View style={[s.statusBadge, { backgroundColor: `${st.color}15` }]}>
                      <Ionicons name={st.icon} size={11} color={st.color} />
                      <Text style={[s.statusText, { color: st.color }]}>{item.status}</Text>
                    </View>
                  </View>
                  <Text style={[s.cardSub, { color: subColor }]}>{item.email} · {item.purpose} · {item.type}</Text>
                  <Text style={[s.cardTime, { color: subColor }]}>{fmtFull(item.created_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={subColor} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<View style={s.empty}><Ionicons name="shield-checkmark-outline" size={44} color={subColor} /><Text style={[s.emptyText, { color: subColor }]}>No OTP logs</Text></View>}
        />
      )}

      {/* Detail Modal */}
      {detail && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setDetail(null)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 20 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: textColor }]}>OTP Details</Text>
                <TouchableOpacity onPress={() => setDetail(null)} style={s.modalClose}>
                  <Ionicons name="close" size={22} color={subColor} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* User info */}
                <View style={s.modalUserRow}>
                  <Avatar uri={detail.profile_url} name={detail.name} size={50} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.modalUserName, { color: textColor }]}>{detail.name}</Text>
                    <Text style={[s.modalUserEmail, { color: subColor }]}>{detail.email}</Text>
                  </View>
                  <View style={[s.modalStatusBig, { backgroundColor: `${(ST[detail.status] || ST.pending).color}15` }]}>
                    <Ionicons name={(ST[detail.status] || ST.pending).icon} size={16} color={(ST[detail.status] || ST.pending).color} />
                    <Text style={[s.modalStatusText, { color: (ST[detail.status] || ST.pending).color }]}>{detail.status}</Text>
                  </View>
                </View>

                {/* OTP Code */}
                <View style={[s.otpCodeCard, { backgroundColor: isDark ? '#0f172a' : '#f0f9ff', borderColor: isDark ? '#1e3a5f' : '#bfdbfe' }]}>
                  <Text style={[s.otpCodeLabel, { color: subColor }]}>OTP CODE</Text>
                  <Text style={[s.otpCode, { color: textColor }]}>{detail.otp_code || '••••••'}</Text>
                </View>

                {/* Details */}
                <View style={[s.detailCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                  {[
                    { label: 'OTP ID', value: `#${detail.otp_id}` },
                    { label: 'Type', value: detail.type },
                    { label: 'Purpose', value: detail.purpose },
                    { label: 'Identifier', value: detail.identifier },
                    { label: 'Attempts', value: `${detail.attempt_count} / ${detail.max_attempts}` },
                    { label: 'IP Address', value: detail.ip_address || '–' },
                    { label: 'Created', value: fmtFull(detail.created_at) },
                    { label: 'Expires', value: fmtFull(detail.expires_at) },
                    { label: 'Verified', value: detail.verified_at ? fmtFull(detail.verified_at) : '–' },
                  ].map((r, i) => (
                    <View key={i} style={[s.detailRow, { borderBottomColor: divider }]}>
                      <Text style={[s.detailLabel, { color: subColor }]}>{r.label}</Text>
                      <Text style={[s.detailValue, { color: textColor }]}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff' },

  statsRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 10, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statName: { fontSize: 10, fontWeight: '700' },

  filterScroll: { gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' },
  chipText: { fontSize: 12, fontWeight: '700' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 6, padding: 14, borderRadius: 16, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardSub: { fontSize: 11, marginTop: 2 },
  cardTime: { fontSize: 10, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalClose: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  modalUserRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 16 },
  modalUserName: { fontSize: 17, fontWeight: '800' },
  modalUserEmail: { fontSize: 13, marginTop: 2 },
  modalStatusBig: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  modalStatusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  otpCodeCard: { marginHorizontal: 20, marginBottom: 14, padding: 18, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  otpCodeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  otpCode: { fontSize: 32, fontWeight: '900', letterSpacing: 8, fontVariant: ['tabular-nums'] },

  detailCard: { marginHorizontal: 20, padding: 16, borderRadius: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
});
