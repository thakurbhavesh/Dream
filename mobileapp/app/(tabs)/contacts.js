import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, RefreshControl, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../src/components/Avatar';
import { getContacts } from '../../src/api/chat';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import useSocket from '../../src/hooks/useSocket';

export default function ContactsScreen() {
  const { user } = useAuth();
  const { theme: t } = useTheme();
  const { on } = useSocket();
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const data = await getContacts();
      const rows = (data?.contacts || data?.rows || data || []).map(c => ({
        id: c.user_id || c.id,
        name: c.name || c.email,
        email: c.email,
        avatar: c.profile_url || c.avatar,
        department: c.department_name || c.department || '',
        designation: c.designation_name || c.designation || '',
        status: c.status || c.membership_status,
      }));
      setContacts(rows);
    } catch (err) {
      console.warn('[contacts]', err?.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Track online/offline via socket
  useEffect(() => {
    const unsub1 = on('user:online', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid) setOnlineUsers(prev => new Set(prev).add(uid));
    });
    const unsub2 = on('user:offline', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid) setOnlineUsers(prev => { const s = new Set(prev); s.delete(uid); return s; });
    });
    return () => { unsub1(); unsub2(); };
  }, [on]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = search.trim()
    ? contacts.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase()))
    : contacts;

  // Group by first letter
  const grouped = {};
  filtered.forEach(c => {
    const letter = (c.name || '?')[0].toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  });
  const sections = Object.keys(grouped).sort().map(letter => ({ title: letter, data: grouped[letter] }));

  const openChat = (contact) => {
    router.push(`/chat/dm-${contact.id}?name=${encodeURIComponent(contact.name || '')}&avatar=${encodeURIComponent(contact.avatar || '')}`);
  };

  const openSelf = () => {
    router.push(`/chat/dm-${user?.id}?name=Myself&avatar=${encodeURIComponent(user?.avatar || '')}`);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={s.header}>
        <Text style={[s.title, { color: t.text }]}>Contacts</Text>
        <View style={[s.count, { backgroundColor: t.accentBg }]}><Text style={{ fontSize: 12, fontWeight: '800', color: t.accent }}>{contacts.length}</Text></View>
      </View>

      <View style={s.searchWrap}>
        <View style={[s.searchBox, { backgroundColor: t.surfaceAlt || (t.mode === 'dark' ? '#1e293b' : '#f1f5f9') }]}>
          <Ionicons name="search" size={16} color={t.textTer} />
          <TextInput style={[s.searchInput, { color: t.text }]} placeholder="Search contacts..." placeholderTextColor={t.textTer}
            value={search} onChangeText={setSearch} />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.accent]} />}
        ListHeaderComponent={
          /* Myself row */
          <TouchableOpacity style={[s.myselfRow, { borderBottomColor: t.border }]} onPress={openSelf} activeOpacity={0.65}>
            <View style={[s.myselfAvatar, { backgroundColor: t.accentBg || '#eef2ff' }]}>
              <Text style={s.myselfEmoji}>📌</Text>
            </View>
            <View style={s.myselfBody}>
              <Text style={[s.myselfName, { color: t.text }]}>Myself</Text>
              <Text style={[s.myselfSub, { color: t.textSec }]}>Message yourself</Text>
            </View>
          </TouchableOpacity>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[s.sectionHeader, { color: t.accent, backgroundColor: t.mode === 'dark' ? '#0f172a' : '#f8fafc' }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={[s.contactRow, { borderBottomColor: t.borderLight || t.border }]} onPress={() => openChat(item)} activeOpacity={0.65}>
            <Avatar uri={item.avatar} name={item.name} size={46} online={onlineUsers.has(String(item.id))} />
            <View style={s.contactBody}>
              <Text style={[s.contactName, { color: t.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[s.contactSub, { color: t.textSec }]} numberOfLines={1}>{item.designation || item.department || item.email}</Text>
            </View>
            <TouchableOpacity style={[s.chatBtn, { backgroundColor: t.accentBg || '#eef2ff' }]} onPress={() => openChat(item)}>
              <Ionicons name="chatbubble-outline" size={18} color={t.accent} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={48} color={t.textTer} />
            <Text style={[s.emptyText, { color: t.textTer }]}>No contacts found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.3 },
  count: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '400' },

  // Myself
  myselfRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: 4, borderRadius: 14 },
  myselfAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  myselfEmoji: { fontSize: 22 },
  myselfBody: { flex: 1 },
  myselfName: { fontSize: 16, fontWeight: '700' },
  myselfSub: { fontSize: 13, marginTop: 2 },

  // Section header
  sectionHeader: { fontSize: 12, fontWeight: '800', paddingHorizontal: 20, paddingVertical: 8, letterSpacing: 0.8, textTransform: 'uppercase' },

  // Contact row
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  contactBody: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600' },
  contactSub: { fontSize: 13, marginTop: 2, lineHeight: 17 },
  chatBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '500' },
});
