import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../../src/components/Avatar';
import { useTheme } from '../../../src/store/ThemeContext';
import api from '../../../src/api/config';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

const STATUS_MAP = {
  verified: { color: '#22c55e', icon: 'checkmark-circle', label: 'Verified' },
  pending: { color: '#f59e0b', icon: 'time', label: 'Pending' },
  expired: { color: '#64748b', icon: 'close-circle', label: 'Expired' },
  failed: { color: '#ef4444', icon: 'alert-circle', label: 'Failed' },
};

export default function OtpLogsScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#f8fafc';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/otp-logs');
        const rows = data?.data?.rows || data?.data || [];
        // Latest 25 only
        setLogs(Array.isArray(rows) ? rows.slice(0, 25) : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  // Stats
  const total = logs.length;
  const verified = logs.filter(l => l.status === 'verified').length;
  const expired = logs.filter(l => l.status === 'expired').length;
  const pending = logs.filter(l => l.status === 'pending').length;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>OTP Verifications</Text>
        <View style={s.badge}><Text style={s.badgeText}>{total}</Text></View>
      </View>

      {/* Stats row */}
      <View style={[s.statsRow, { backgroundColor: cardBg }]}>
        {[
          { label: 'Total', value: total, color: ACCENT },
          { label: 'Verified', value: verified, color: '#22c55e' },
          { label: 'Expired', value: expired, color: '#64748b' },
          { label: 'Pending', value: pending, color: '#f59e0b' },
        ].map((st, i) => (
          <View key={i} style={s.statItem}>
            <Text style={[s.statNum, { color: st.color }]}>{st.value}</Text>
            <Text style={[s.statName, { color: subColor }]}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {['all', 'verified', 'pending', 'expired'].map(f => (
          <TouchableOpacity key={f} style={[s.filterChip, filter === f && { backgroundColor: `${ACCENT}15`, borderColor: ACCENT }]}
            onPress={() => setFilter(f)} activeOpacity={0.7}>
            <Text style={[s.filterText, { color: filter === f ? ACCENT : subColor }]}>{f[0].toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => String(item.otp_id || i)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          renderItem={({ item }) => {
            const st = STATUS_MAP[item.status] || STATUS_MAP.pending;
            return (
              <View style={[s.card, { backgroundColor: cardBg }]}>
                <Avatar uri={null} name={item.name || item.email} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={s.cardTop}>
                    <Text style={[s.cardName, { color: textColor }]} numberOfLines={1}>{item.name || 'User'}</Text>
                    <View style={[s.statusBadge, { backgroundColor: `${st.color}15` }]}>
                      <Ionicons name={st.icon} size={12} color={st.color} />
                      <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={[s.cardEmail, { color: subColor }]}>{item.email}</Text>
                  <View style={s.cardMeta}>
                    <Text style={[s.metaText, { color: subColor }]}>{item.purpose || 'login'}</Text>
                    <Text style={[s.metaText, { color: subColor }]}> · {fmtDate(item.created_at)} {fmtTime(item.created_at)}</Text>
                    <Text style={[s.metaText, { color: subColor }]}> · {item.attempt_count}/{item.max_attempts} attempts</Text>
                  </View>
                  {item.verified_at && (
                    <Text style={[s.verifiedAt, { color: '#22c55e' }]}>✓ Verified {fmtTime(item.verified_at)}</Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<View style={s.empty}><Ionicons name="shield-checkmark-outline" size={44} color={subColor} /><Text style={[s.emptyText, { color: subColor }]}>No OTP logs</Text></View>}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  statsRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 10, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statName: { fontSize: 10, fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' },
  filterText: { fontSize: 12, fontWeight: '700' },

  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 14, marginBottom: 6, padding: 14, borderRadius: 16, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardEmail: { fontSize: 12, marginTop: 2 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  metaText: { fontSize: 11 },
  verifiedAt: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
