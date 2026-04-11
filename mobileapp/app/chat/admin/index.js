import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Linking } from 'react-native';
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
  const [userCount, setUserCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');

  const loadAll = useCallback(async () => {
    try {
      const [meRes, contactsRes, groupsRes] = await Promise.all([
        api.get('/auth/me').catch(() => null),
        api.get('/chat/contacts').catch(() => null),
        api.get('/groups?status=active&limit=200').catch(() => null),
      ]);
      const d = meRes?.data?.data || meRes?.data || {};
      setStats({
        totalMembers: d?.counts?.total_members || 0,
        activeMembers: d?.counts?.active_members || 0,
        devices: d?.counts?.user_devices || 0,
        org: d?.organization || {},
        plan: d?.current_plan || {},
        usage: d?.usage || {},
      });
      // Count from contacts (reliable)
      const contacts = contactsRes?.data?.data?.contacts || contactsRes?.data?.data?.rows || contactsRes?.data?.data || [];
      setUserCount(Array.isArray(contacts) ? contacts.length : 0);
      const groups = groupsRes?.data?.data?.rows || groupsRes?.data?.data || [];
      setGroupCount(Array.isArray(groups) ? groups.length : 0);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, []);
  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const STAT_CARDS = [
    { label: 'Users', value: userCount, icon: 'people', color: '#3b82f6', route: '/chat/admin/users' },
    { label: 'Groups', value: groupCount, icon: 'chatbubbles', color: '#8b5cf6', route: '/chat/admin/groups' },
    { label: 'Members', value: stats?.totalMembers || 0, icon: 'person-add', color: '#22c55e' },
    { label: 'Devices', value: stats?.devices || 0, icon: 'phone-portrait', color: '#f59e0b' },
  ];

  const MENU = [
    { icon: 'people', label: 'User Management', desc: 'View, edit roles, activate/deactivate', color: '#3b82f6', route: '/chat/admin/users' },
    { icon: 'chatbubbles', label: 'Groups', desc: 'Manage groups, airtime, members', color: '#8b5cf6', route: '/chat/admin/groups' },
    { icon: 'briefcase', label: 'Departments', desc: 'Departments & designations', color: '#22c55e', route: '/chat/admin/departments' },
    { icon: 'options', label: 'Controls', desc: 'Edit/recall limits, message settings', color: '#f59e0b', route: '/chat/admin/controls' },
    { icon: 'document-text', label: 'Activity Logs', desc: 'Full audit trail', color: '#ef4444', route: '/chat/admin/logs' },
    { icon: 'shield-checkmark', label: 'OTP Logs', desc: 'Verification history', color: '#14b8a6', route: '/chat/admin/otp-logs' },
    { icon: 'card', label: 'Payment History', desc: 'Invoices & transactions', color: '#635bff', route: '/chat/admin/payments' },
    { icon: 'server', label: 'Plan & Storage', desc: 'Subscription & usage', color: '#06b6d4', route: '/chat/admin/billing' },
  ];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Admin Panel</Text>
          <Text style={s.headerOrg}>{stats?.org?.name || 'Organization'}</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={s.refreshBtn}>
          <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} />}>

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
          <>
            {/* Stats */}
            <View style={s.statsRow}>
              {STAT_CARDS.map((c, i) => (
                <TouchableOpacity key={i} style={[s.statCard, { backgroundColor: cardBg }]}
                  onPress={() => c.route && router.push(c.route)} activeOpacity={c.route ? 0.6 : 1}>
                  <View style={[s.statIcon, { backgroundColor: `${c.color}12` }]}>
                    <Ionicons name={c.icon} size={18} color={c.color} />
                  </View>
                  <Text style={[s.statValue, { color: textColor }]}>{c.value}</Text>
                  <Text style={[s.statLabel, { color: subColor }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Plan Card */}
            {stats?.plan?.plan_name && (
              <View style={[s.planCard, { backgroundColor: isDark ? '#0f172a' : '#eff6ff', borderColor: isDark ? '#1e3a5f' : '#bfdbfe' }]}>
                <View style={s.planTop}>
                  <Ionicons name="diamond" size={20} color="#3b82f6" />
                  <Text style={[s.planName, { color: '#3b82f6' }]}>{stats.plan.plan_name}</Text>
                  <View style={[s.planStatus, { backgroundColor: '#22c55e15' }]}>
                    <Text style={s.planStatusText}>{stats.plan.subscription_status || 'Active'}</Text>
                  </View>
                </View>
                <View style={s.planMeta}>
                  <Text style={[s.planMetaText, { color: subColor }]}>
                    {stats.plan.max_users || '∞'} users · {stats.usage?.storage_used_mb || 0}/{stats.usage?.storage_limit_mb || '∞'} MB
                  </Text>
                </View>
                <TouchableOpacity style={[s.upgradeBtn, { backgroundColor: '#3b82f6' }]}
                  onPress={() => router.push('/chat/admin/billing')} activeOpacity={0.8}>
                  <Ionicons name="arrow-up-circle" size={16} color="#fff" />
                  <Text style={s.upgradeBtnText}>Manage Plan</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Menu */}
            <Text style={[s.sectionTitle, { color: textColor }]}>Management</Text>
            {MENU.map((item, i) => (
              <TouchableOpacity key={i} style={[s.menuCard, { backgroundColor: cardBg }]}
                onPress={() => router.push(item.route)} activeOpacity={0.6}>
                <View style={[s.menuIcon, { backgroundColor: `${item.color}10` }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuLabel, { color: textColor }]}>{item.label}</Text>
                  <Text style={[s.menuDesc, { color: subColor }]}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={subColor} />
              </TouchableOpacity>
            ))}

            {/* Quick Actions */}
            <Text style={[s.sectionTitle, { color: textColor }]}>Quick Actions</Text>
            <View style={s.quickRow}>
              <TouchableOpacity style={[s.quickCard, { backgroundColor: cardBg }]}
                onPress={() => router.push('/chat/create-group')} activeOpacity={0.6}>
                <Ionicons name="add-circle" size={24} color="#8b5cf6" />
                <Text style={[s.quickLabel, { color: textColor }]}>New Group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.quickCard, { backgroundColor: cardBg }]}
                onPress={() => router.push('/chat/broadcast')} activeOpacity={0.6}>
                <Ionicons name="megaphone" size={24} color="#f59e0b" />
                <Text style={[s.quickLabel, { color: textColor }]}>Broadcast</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.quickCard, { backgroundColor: cardBg }]}
                onPress={() => router.push('/chat/admin/logs')} activeOpacity={0.6}>
                <Ionicons name="analytics" size={24} color="#06b6d4" />
                <Text style={[s.quickLabel, { color: textColor }]}>Logs</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 14, paddingBottom: 16, elevation: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  headerOrg: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  refreshBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14 },
  statCard: { width: '47%', flexGrow: 1, padding: 16, borderRadius: 18, elevation: 2, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, fontWeight: '700' },

  planCard: { marginHorizontal: 14, marginBottom: 14, padding: 18, borderRadius: 18, borderWidth: 1 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5, flex: 1 },
  planStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  planStatusText: { fontSize: 10, fontWeight: '800', color: '#22c55e', textTransform: 'uppercase' },
  planMeta: { marginTop: 8 },
  planMetaText: { fontSize: 12 },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 12, borderRadius: 12 },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginHorizontal: 18, marginTop: 8, marginBottom: 10, letterSpacing: -0.1 },

  menuCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginBottom: 8, padding: 16, borderRadius: 18, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  menuIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '800' },
  menuDesc: { fontSize: 12, marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 10 },
  quickCard: { flex: 1, alignItems: 'center', gap: 8, padding: 18, borderRadius: 16, elevation: 1 },
  quickLabel: { fontSize: 12, fontWeight: '700' },
});
