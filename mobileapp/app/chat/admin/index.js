import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import { useAuth } from '../../../src/store/AuthContext';
import api from '../../../src/api/config';

export default function AdminDashboard() {
  const { theme: t, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#f8fafc';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      const d = data?.data || data;
      setStats({
        totalMembers: d?.counts?.total_members || 0,
        activeMembers: d?.counts?.active_members || 0,
        devices: d?.counts?.user_devices || 0,
        org: d?.organization || {},
        plan: d?.current_plan || {},
        usage: d?.usage || {},
      });
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, []);
  const onRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };

  // Count groups separately
  const [groupCount, setGroupCount] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/groups?status=active&limit=1');
        const total = data?.data?.totalCount || data?.data?.rows?.length || data?.data?.length || 0;
        setGroupCount(total);
      } catch {}
    })();
  }, []);

  const MENU_ITEMS = [
    { icon: 'people', label: 'Users', desc: 'Manage members & roles', color: '#3b82f6', route: '/chat/admin/users' },
    { icon: 'grid', label: 'Groups', desc: 'Manage group chats', color: '#8b5cf6', route: '/chat/admin/groups' },
    { icon: 'briefcase', label: 'Departments', desc: 'Departments & designations', color: '#22c55e', route: '/chat/admin/departments' },
    { icon: 'options', label: 'Controls', desc: 'Message & chat settings', color: '#f59e0b', route: '/chat/admin/controls' },
    { icon: 'receipt', label: 'Billing', desc: 'Plan & payments', color: '#06b6d4', route: '/chat/admin/billing' },
    { icon: 'document-text', label: 'Activity Logs', desc: 'Audit & history', color: '#ef4444', route: '/chat/admin/logs' },
  ];

  const STAT_CARDS = stats ? [
    { label: 'Active Users', value: stats.activeMembers, icon: 'people', color: '#3b82f6' },
    { label: 'Groups', value: groupCount, icon: 'chatbubbles', color: '#8b5cf6' },
    { label: 'Total Members', value: stats.totalMembers, icon: 'person-add', color: '#22c55e' },
    { label: 'Devices', value: stats.devices, icon: 'phone-portrait', color: '#f59e0b' },
  ] : [];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Admin Panel</Text>
          <Text style={s.headerSub}>{stats?.org?.name || 'Organization'}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} />}>

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
          <>
            {/* Stats Grid */}
            <View style={s.statsGrid}>
              {STAT_CARDS.map((c, i) => (
                <View key={i} style={[s.statCard, { backgroundColor: cardBg }]}>
                  <View style={[s.statIcon, { backgroundColor: `${c.color}12` }]}>
                    <Ionicons name={c.icon} size={20} color={c.color} />
                  </View>
                  <Text style={[s.statValue, { color: textColor }]}>{c.value}</Text>
                  <Text style={[s.statLabel, { color: subColor }]}>{c.label}</Text>
                </View>
              ))}
            </View>

            {/* Plan info */}
            {stats?.plan?.plan_name && (
              <View style={[s.planCard, { backgroundColor: cardBg }]}>
                <View style={[s.planBadge, { backgroundColor: `${ACCENT}12` }]}>
                  <Ionicons name="diamond" size={16} color={ACCENT} />
                  <Text style={[s.planName, { color: ACCENT }]}>{stats.plan.plan_name}</Text>
                </View>
                <View style={s.planRow}>
                  <Text style={[s.planMeta, { color: subColor }]}>Storage: {stats.usage?.storage_used_mb || 0} MB / {stats.usage?.storage_limit_mb || '∞'} MB</Text>
                </View>
              </View>
            )}

            {/* Menu */}
            <Text style={[s.sectionTitle, { color: textColor }]}>Management</Text>
            {MENU_ITEMS.map((item, i) => (
              <TouchableOpacity key={i} style={[s.menuItem, { backgroundColor: cardBg }]}
                onPress={() => router.push(item.route)} activeOpacity={0.6}>
                <View style={[s.menuIcon, { backgroundColor: `${item.color}12` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuLabel, { color: textColor }]}>{item.label}</Text>
                  <Text style={[s.menuDesc, { color: subColor }]}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={subColor} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  statCard: { width: '48%', flexGrow: 1, padding: 16, borderRadius: 16, elevation: 1, alignItems: 'center', gap: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, fontWeight: '600' },

  planCard: { marginHorizontal: 14, marginBottom: 14, padding: 16, borderRadius: 16, elevation: 1 },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  planName: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase' },
  planRow: { marginTop: 10 },
  planMeta: { fontSize: 12 },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginHorizontal: 18, marginTop: 8, marginBottom: 10 },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginBottom: 8, padding: 16, borderRadius: 16, elevation: 1 },
  menuIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '700' },
  menuDesc: { fontSize: 12, marginTop: 2 },
});
