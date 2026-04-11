import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import { useToast } from '../../../src/components/Toast';
import api from '../../../src/api/config';

export default function GroupsAdminScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/groups?status=active&limit=100');
      setGroups(data?.data?.rows || data?.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const toggleAirtime = async (g) => {
    try {
      await api.patch(`/groups/${g.group_id}`, { is_airtime: !g.is_airtime });
      setGroups(prev => prev.map(p => p.group_id === g.group_id ? { ...p, is_airtime: !g.is_airtime } : p));
      toast(g.is_airtime ? 'Announcement off' : 'Announcement on', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const deleteGroup = (g) => {
    Alert.alert('Delete Group', `Delete "${g.group_name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.patch(`/groups/${g.group_id}`, { status: 'deleted' });
          setGroups(prev => prev.filter(p => p.group_id !== g.group_id));
          toast('Group deleted', 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Groups</Text>
        <View style={s.headerBadge}><Text style={s.badgeText}>{groups.length}</Text></View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList
          data={groups}
          keyExtractor={g => String(g.group_id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50, paddingTop: 8 }}
          renderItem={({ item: g }) => (
            <View style={[s.card, { backgroundColor: cardBg }]}>
              <View style={[s.gIcon, { backgroundColor: isDark ? '#0f172a' : '#ede9fe' }]}>
                <Ionicons name="people" size={22} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text style={[s.gName, { color: textColor }]}>{g.group_name}</Text>
                  {g.is_airtime && <Ionicons name="megaphone" size={12} color="#f59e0b" />}
                </View>
                <Text style={[s.gDesc, { color: subColor }]} numberOfLines={1}>{g.group_description || 'No description'}</Text>
                <Text style={[s.gMeta, { color: subColor }]}>{g.member_count || 0} members · {g.status}</Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity onPress={() => router.push(`/chat/group-info?threadId=group-${g.group_id}&name=${encodeURIComponent(g.group_name)}`)} style={s.aBtn}>
                  <Ionicons name="settings-outline" size={16} color={ACCENT} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleAirtime(g)} style={s.aBtn}>
                  <Ionicons name={g.is_airtime ? 'megaphone' : 'megaphone-outline'} size={16} color="#f59e0b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteGroup(g)} style={s.aBtn}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<View style={s.empty}><Text style={[s.emptyText, { color: subColor }]}>No groups</Text></View>}
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
  badgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 8, padding: 14, borderRadius: 16, elevation: 1 },
  gIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gName: { fontSize: 15, fontWeight: '700' },
  gDesc: { fontSize: 12, marginTop: 2 },
  gMeta: { fontSize: 11, marginTop: 2 },

  actions: { gap: 4 },
  aBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14 },
});
