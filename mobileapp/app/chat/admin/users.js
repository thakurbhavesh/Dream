import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../../src/components/Avatar';
import { useTheme } from '../../../src/store/ThemeContext';
import { useToast } from '../../../src/components/Toast';
import api from '../../../src/api/config';

const ROLE_MAP = { 1: 'Owner', 2: 'Admin', 3: 'Super Admin', 4: 'User' };
const ROLE_COLORS = { 1: '#f59e0b', 2: '#3b82f6', 3: '#8b5cf6', 4: '#64748b' };

export default function UsersScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active'); // active | inactive | all

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#f8fafc';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200, offset: 0 };
      if (search.trim()) params.search = search.trim();
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/org-users', { params });
      const rows = data?.data?.rows || data?.data || [];
      setUsers(Array.isArray(rows) ? rows : []);
    } catch {}
    finally { setLoading(false); }
  }, [search, filter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const toggleStatus = (u) => {
    const isActive = u.status === 'active';
    Alert.alert(isActive ? 'Deactivate User' : 'Activate User', `${isActive ? 'Deactivate' : 'Activate'} ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: isActive ? 'Deactivate' : 'Activate', style: isActive ? 'destructive' : 'default', onPress: async () => {
        try {
          await api.patch(`/org-users/${u.user_id || u.id}/${isActive ? 'deactivate' : 'activate'}`);
          setUsers(prev => prev.map(p => (p.user_id || p.id) === (u.user_id || u.id) ? { ...p, status: isActive ? 'inactive' : 'active' } : p));
          toast(`${u.name} ${isActive ? 'deactivated' : 'activated'}`, 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  };

  const changeRole = (u) => {
    const roles = [
      { text: 'User (role 4)', onPress: () => updateRole(u, 4) },
      { text: 'Admin (role 2)', onPress: () => updateRole(u, 2) },
      { text: 'Super Admin (role 3)', onPress: () => updateRole(u, 3) },
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Change Role', `Current: ${ROLE_MAP[u.role_id] || 'User'}`, roles);
  };

  const updateRole = async (u, roleId) => {
    try {
      await api.patch(`/org-users/${u.user_id || u.id}`, { role_id: roleId });
      setUsers(prev => prev.map(p => (p.user_id || p.id) === (u.user_id || u.id) ? { ...p, role_id: roleId } : p));
      toast(`Role changed to ${ROLE_MAP[roleId]}`, 'success');
    } catch { toast('Failed', 'error'); }
  };

  const resetPassword = (u) => {
    Alert.alert('Reset Password', `Send password reset to ${u.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', onPress: async () => {
        try {
          await api.post('/org-users/reset-password', { user_id: u.user_id || u.id });
          toast('Reset email sent', 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  };

  const filtered = users;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Users</Text>
        <View style={s.headerBadge}><Text style={s.headerBadgeText}>{users.length}</Text></View>
      </View>

      {/* Search + Filter */}
      <View style={[s.searchWrap, { backgroundColor: cardBg }]}>
        <View style={[s.searchBox, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
          <Ionicons name="search" size={16} color={subColor} />
          <TextInput style={[s.searchInput, { color: textColor }]} placeholder="Search users..."
            placeholderTextColor={subColor} value={search} onChangeText={setSearch} />
        </View>
        <View style={s.filterRow}>
          {['active', 'inactive', 'all'].map(f => (
            <TouchableOpacity key={f} style={[s.filterChip, filter === f && { backgroundColor: `${ACCENT}15`, borderColor: ACCENT }]}
              onPress={() => setFilter(f)} activeOpacity={0.7}>
              <Text style={[s.filterText, { color: filter === f ? ACCENT : subColor }]}>{f[0].toUpperCase() + f.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList
          data={filtered}
          keyExtractor={u => String(u.user_id || u.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          renderItem={({ item: u }) => {
            const isActive = u.status === 'active';
            const roleColor = ROLE_COLORS[u.role_id] || '#64748b';
            return (
              <View style={[s.userCard, { backgroundColor: cardBg, opacity: isActive ? 1 : 0.6 }]}>
                <Avatar uri={u.profile_url || u.avatar} name={u.name} size={44} />
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={[s.userName, { color: textColor }]} numberOfLines={1}>{u.name}</Text>
                    <View style={[s.roleBadge, { backgroundColor: `${roleColor}15` }]}>
                      <Text style={[s.roleText, { color: roleColor }]}>{ROLE_MAP[u.role_id] || 'User'}</Text>
                    </View>
                  </View>
                  <Text style={[s.userEmail, { color: subColor }]} numberOfLines={1}>{u.email}</Text>
                  {(u.department_name || u.designation_name) && (
                    <Text style={[s.userDept, { color: subColor }]}>{[u.department_name, u.designation_name].filter(Boolean).join(' · ')}</Text>
                  )}
                </View>
                <View style={s.actions}>
                  <TouchableOpacity onPress={() => changeRole(u)} style={[s.actionBtn, { backgroundColor: `${ACCENT}10` }]}>
                    <Ionicons name="shield-outline" size={16} color={ACCENT} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleStatus(u)} style={[s.actionBtn, { backgroundColor: isActive ? '#ef444410' : '#22c55e10' }]}>
                    <Ionicons name={isActive ? 'close-circle-outline' : 'checkmark-circle-outline'} size={16} color={isActive ? '#ef4444' : '#22c55e'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => resetPassword(u)} style={[s.actionBtn, { backgroundColor: '#f59e0b10' }]}>
                    <Ionicons name="key-outline" size={16} color="#f59e0b" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<View style={s.empty}><Ionicons name="people-outline" size={44} color={subColor} /><Text style={[s.emptyText, { color: subColor }]}>No users found</Text></View>}
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
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  headerBadgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  searchWrap: { paddingHorizontal: 14, paddingVertical: 10, elevation: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, height: 42, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' },
  filterText: { fontSize: 12, fontWeight: '700' },

  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginTop: 8, padding: 14, borderRadius: 16, elevation: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 15, fontWeight: '700', maxWidth: 140 },
  userEmail: { fontSize: 12, marginTop: 2 },
  userDept: { fontSize: 11, marginTop: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },

  actions: { gap: 4 },
  actionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14 },
});
