import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
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
  const [filter, setFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Try multiple endpoints — use whichever works
      let rows = [];
      const endpoints = [
        { url: '/org-users', params: { limit: 200, all: true } },
        { url: '/users', params: { limit: 200 } },
        { url: '/chat/contacts', params: {} },
      ];
      for (const ep of endpoints) {
        try {
          const { data } = await api.get(ep.url, { params: ep.params });
          const d = data?.data || data;
          rows = d?.rows || d?.contacts || (Array.isArray(d) ? d : []);
          if (rows.length > 0) break;
        } catch { continue; }
      }
      // Normalize field names
      rows = rows.map(u => ({
        id: u.user_id || u.id,
        name: u.name || u.email,
        email: u.email,
        avatar: u.profile_url || u.avatar,
        role_id: Number(u.role_id) || 4,
        status: u.status || u.membership_status || 'active',
        department: u.department_name || u.department || '',
        designation: u.designation_name || u.designation || '',
        mobile: u.mobile || '',
        last_login: u.last_login_at || '',
      }));
      setUsers(rows);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, []);

  // Filtered list
  const filtered = users.filter(u => {
    if (filter === 'admin' && u.role_id >= 4) return false;
    if (filter === 'active' && u.status !== 'active') return false;
    if (filter === 'inactive' && u.status === 'active') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  const toggleStatus = (u) => {
    const isActive = u.status === 'active';
    Alert.alert(isActive ? 'Deactivate' : 'Activate', `${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: isActive ? 'Deactivate' : 'Activate', style: isActive ? 'destructive' : 'default', onPress: async () => {
        try {
          await api.patch(`/org-users/${u.id}/${isActive ? 'deactivate' : 'activate'}`);
          setUsers(prev => prev.map(p => p.id === u.id ? { ...p, status: isActive ? 'inactive' : 'active' } : p));
          toast(`${u.name} ${isActive ? 'deactivated' : 'activated'}`, 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  };

  const changeRole = (u) => {
    Alert.alert('Change Role', `${u.name}\nCurrent: ${ROLE_MAP[u.role_id]}`, [
      { text: 'User', onPress: () => updateRole(u, 4) },
      { text: 'Admin', onPress: () => updateRole(u, 2) },
      { text: 'Super Admin', onPress: () => updateRole(u, 3) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const updateRole = async (u, roleId) => {
    try {
      await api.patch(`/org-users/${u.id}`, { role_id: roleId });
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, role_id: roleId } : p));
      toast(`${ROLE_MAP[roleId]}`, 'success');
    } catch { toast('Failed', 'error'); }
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Users</Text>
        <View style={s.badge}><Text style={s.badgeText}>{filtered.length}</Text></View>
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: cardBg }]}>
        <View style={[s.searchBox, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
          <Ionicons name="search" size={16} color={subColor} />
          <TextInput style={[s.searchInput, { color: textColor }]} placeholder="Search users..."
            placeholderTextColor={subColor} value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={subColor} /></TouchableOpacity> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          {['all', 'active', 'inactive', 'admin'].map(f => (
            <TouchableOpacity key={f} style={[s.chip, filter === f && { backgroundColor: `${ACCENT}15`, borderColor: ACCENT }]}
              onPress={() => setFilter(f)} activeOpacity={0.7}>
              <Text style={[s.chipText, { color: filter === f ? ACCENT : subColor }]}>
                {f === 'admin' ? 'Admins' : f[0].toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
        <FlatList
          data={filtered}
          keyExtractor={u => String(u.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          renderItem={({ item: u }) => {
            const roleColor = ROLE_COLORS[u.role_id] || '#64748b';
            const isActive = u.status === 'active';
            return (
              <TouchableOpacity style={[s.card, { backgroundColor: cardBg, opacity: isActive ? 1 : 0.5 }]}
                onPress={() => setSelectedUser(selectedUser?.id === u.id ? null : u)} activeOpacity={0.7}>
                <Avatar uri={u.avatar} name={u.name} size={46} status={isActive ? 'Online' : 'offline'} />
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={[s.name, { color: textColor }]} numberOfLines={1}>{u.name}</Text>
                    <View style={[s.roleBadge, { backgroundColor: `${roleColor}15` }]}>
                      <Text style={[s.roleText, { color: roleColor }]}>{ROLE_MAP[u.role_id] || 'User'}</Text>
                    </View>
                  </View>
                  <Text style={[s.email, { color: subColor }]} numberOfLines={1}>{u.email}</Text>
                  {u.department ? <Text style={[s.dept, { color: subColor }]}>{[u.department, u.designation].filter(Boolean).join(' · ')}</Text> : null}

                  {/* Expanded actions */}
                  {selectedUser?.id === u.id && (
                    <View style={s.actionsRow}>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: `${ACCENT}12` }]} onPress={() => changeRole(u)}>
                        <Ionicons name="shield" size={15} color={ACCENT} />
                        <Text style={[s.actionText, { color: ACCENT }]}>Role</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: isActive ? '#ef444412' : '#22c55e12' }]} onPress={() => toggleStatus(u)}>
                        <Ionicons name={isActive ? 'close-circle' : 'checkmark-circle'} size={15} color={isActive ? '#ef4444' : '#22c55e'} />
                        <Text style={[s.actionText, { color: isActive ? '#ef4444' : '#22c55e' }]}>{isActive ? 'Deactivate' : 'Activate'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#f59e0b12' }]}
                        onPress={() => { router.push(`/chat/dm-${u.id}?name=${encodeURIComponent(u.name)}&avatar=${encodeURIComponent(u.avatar || '')}`); }}>
                        <Ionicons name="chatbubble" size={15} color="#f59e0b" />
                        <Text style={[s.actionText, { color: '#f59e0b' }]}>Chat</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <Ionicons name={selectedUser?.id === u.id ? 'chevron-up' : 'chevron-down'} size={16} color={subColor} />
              </TouchableOpacity>
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  searchWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, elevation: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontSize: 14 },
  filterScroll: { gap: 8, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' },
  chipText: { fontSize: 12, fontWeight: '700' },

  card: { marginHorizontal: 14, marginTop: 8, padding: 14, borderRadius: 18, elevation: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '800', letterSpacing: -0.1 },
  email: { fontSize: 12, marginTop: 2 },
  dept: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, minHeight: 36 },
  actionText: { fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
