import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import api from '../../../src/api/config';

const getEventColor = (action) => {
  if (!action) return '#64748b';
  const a = action.toLowerCase();
  if (a.includes('login') || a.includes('auth')) return '#3b82f6';
  if (a.includes('create') || a.includes('add') || a.includes('register')) return '#22c55e';
  if (a.includes('delete') || a.includes('remove') || a.includes('revoke')) return '#ef4444';
  if (a.includes('update') || a.includes('edit') || a.includes('change')) return '#f59e0b';
  return '#64748b';
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function ActivityLogsScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100, offset: 0 };
      if (filter !== 'all') params.action_category = filter;
      const { data } = await api.get('/activity-logs', { params });
      setLogs(data?.data?.rows || data?.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const FILTERS = ['all', 'auth', 'user', 'group', 'message', 'system'];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Activity Logs</Text>
        <View style={s.badge}><Text style={s.badgeText}>{logs.length}</Text></View>
      </View>

      {/* Filters */}
      <View style={[s.filterWrap, { backgroundColor: cardBg }]}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[s.filterChip, filter === f && { backgroundColor: `${ACCENT}15`, borderColor: ACCENT }]}
            onPress={() => setFilter(f)} activeOpacity={0.7}>
            <Text style={[s.filterText, { color: filter === f ? ACCENT : subColor }]}>{f[0].toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList
          data={logs}
          keyExtractor={(item, i) => String(item.log_id || i)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          renderItem={({ item }) => {
            const color = getEventColor(item.action);
            return (
              <View style={[s.logCard, { backgroundColor: cardBg }]}>
                <View style={[s.logDot, { backgroundColor: `${color}15` }]}>
                  <View style={[s.logDotInner, { backgroundColor: color }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.logAction, { color: textColor }]}>{item.action || item.description || 'Activity'}</Text>
                  {item.description && item.description !== item.action && (
                    <Text style={[s.logDesc, { color: subColor }]} numberOfLines={2}>{item.description}</Text>
                  )}
                  <View style={s.logMeta}>
                    <Text style={[s.logTime, { color: subColor }]}>{fmtDate(item.occurred_at || item.created_at)}</Text>
                    {item.ip_address && <Text style={[s.logIp, { color: subColor }]}> · {item.ip_address}</Text>}
                    {item.status && (
                      <View style={[s.statusBadge, { backgroundColor: item.is_successful ? '#22c55e15' : '#ef444415' }]}>
                        <Text style={[s.statusText, { color: item.is_successful ? '#22c55e' : '#ef4444' }]}>{item.status}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<View style={s.empty}><Ionicons name="document-text-outline" size={44} color={subColor} /><Text style={[s.emptyText, { color: subColor }]}>No logs found</Text></View>}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingVertical: 10, elevation: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
  filterText: { fontSize: 11, fontWeight: '700' },

  logCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 14, marginTop: 6, padding: 14, borderRadius: 14, elevation: 1 },
  logDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  logDotInner: { width: 10, height: 10, borderRadius: 5 },
  logAction: { fontSize: 14, fontWeight: '700' },
  logDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  logMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  logTime: { fontSize: 11 },
  logIp: { fontSize: 11 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginLeft: 4 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14 },
});
