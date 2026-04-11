import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, RefreshControl, SectionList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../src/components/Avatar';
import ImageViewer from '../../src/components/ImageViewer';
import { getContacts, getThreads } from '../../src/api/chat';
import api from '../../src/api/config';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import useSocket from '../../src/hooks/useSocket';

export default function ContactsScreen() {
  const { user } = useAuth();
  const { theme: t, isDark } = useTheme();
  const { on } = useSocket();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [userStatuses, setUserStatuses] = useState({}); // { odne: 'Online' | 'Away' | 'Idle' | 'offline' }
  const [existingThreads, setExistingThreads] = useState(new Set()); // threadIds that have chats
  const [tab, setTab] = useState('people'); // 'people' | 'groups'
  const [deptFilter, setDeptFilter] = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null); // department name or null

  const load = useCallback(async () => {
    try {
      // Load contacts + groups + existing threads in parallel
      const [contactsRes, threadsRes] = await Promise.all([
        getContacts().catch(() => null),
        getThreads().catch(() => null),
      ]);

      // Contacts
      const rows = (contactsRes?.contacts || contactsRes?.rows || contactsRes || []).map(c => ({
        id: c.user_id || c.id,
        name: c.name || c.email,
        email: c.email,
        avatar: c.profile_url || c.avatar,
        department: c.department_name || c.department || '',
        designation: c.designation_name || c.designation || '',
        status: c.status || c.membership_status,
        isGlobal: !!(c.isGlobalMember || c.isGlobal || c.is_global || c.global_user || c.is_global_member),
      }));
      setContacts(rows);

      // Groups — backend returns { threads: [...] } with groups mixed in
      // Filter groups from combined threads array
      const allThreads = threadsRes?.threads || [];
      const separateGroups = threadsRes?.groupThreads || [];
      const groupThreads = [
        ...allThreads.filter(th => th.isGroup || th.threadType === 'group' || th.type === 'group'),
        ...separateGroups,
      ];
      const gRows = [];
      for (const th of groupThreads) {
        const gId = th.group_id || th.groupId || (th.id || '').replace('group-', '');
        gRows.push({
          id: gId,
          name: th.label || th.username || th.group_name || th.groupName,
          description: th.description || th.group_description || '',
          avatar: th.profilePicture || th.group_image || th.groupImage || '',
          memberCount: th.memberCount || th.member_count || 0,
          isAirtime: th.is_airtime,
          threadId: th.id || `group-${gId}`,
          memberStatus: th.hasLeft ? 'left' : (th.membershipStatus || 'active'),
        });
      }
      setGroups(gRows);

      // Existing threads — to know who has active chats
      const dmThreads = allThreads.filter(th => !th.isGroup && th.threadType !== 'group' && th.type !== 'group');
      const threadSet = new Set();
      dmThreads.forEach(th => {
        const tid = th.id || `dm-${th.user_id || th.other_user_id}`;
        threadSet.add(tid);
      });
      groupThreads.forEach(th => {
        threadSet.add(th.id || `group-${th.group_id || th.groupId}`);
      });
      setExistingThreads(threadSet);
    } catch (err) {
      console.warn('[contacts]', err?.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Track status via socket — Online, Away, Idle, offline
  useEffect(() => {
    const unsub1 = on('user:online', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid) setUserStatuses(prev => ({ ...prev, [uid]: data?.status || 'Online' }));
    });
    const unsub2 = on('user:offline', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid) setUserStatuses(prev => ({ ...prev, [uid]: 'offline' }));
    });
    const unsub3 = on('user:status', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid && data?.status) setUserStatuses(prev => ({ ...prev, [uid]: data.status }));
    });
    // Bulk online list on connect
    const unsub4 = on('users:online_list', (data) => {
      const list = data?.users || data || [];
      const map = {};
      list.forEach(u => {
        const uid = String(u.userId || u.user_id || u.id || u);
        map[uid] = u.status || u.activity_status || 'Online';
      });
      setUserStatuses(prev => ({ ...prev, ...map }));
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [on]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Filter
  // Get unique departments
  const departments = [...new Set(contacts.map(c => c.department).filter(Boolean))].sort();

  const filteredContacts = contacts.filter(c => {
    if (deptFilter && c.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredGroups = search.trim()
    ? groups.filter(g => (g.name || '').toLowerCase().includes(search.toLowerCase()) || (g.description || '').toLowerCase().includes(search.toLowerCase()))
    : groups;

  // Group contacts by first letter
  const grouped = {};
  filteredContacts.forEach(c => {
    const letter = (c.name || '?')[0].toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  });
  const sections = Object.keys(grouped).sort().map(letter => ({ title: letter, data: grouped[letter] }));

  const openChat = (contact) => {
    const threadId = `dm-${contact.id}`;
    // If existing chat, go to chats — otherwise open new chat
    router.push(`/chat/${threadId}?name=${encodeURIComponent(contact.name || '')}&avatar=${encodeURIComponent(contact.avatar || '')}`);
  };

  const openGroup = (group) => {
    router.push(`/chat/${group.threadId}?name=${encodeURIComponent(group.name || '')}&avatar=${encodeURIComponent(group.avatar || '')}`);
  };

  const openSelf = () => {
    router.push(`/chat/dm-${user?.id}?name=Myself&avatar=${encodeURIComponent(user?.avatar || '')}`);
  };

  const hasChat = (contactId) => existingThreads.has(`dm-${contactId}`);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={[s.title, { color: t.text }]}>Contacts</Text>
        <View style={[s.count, { backgroundColor: t.accentBg }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: t.accent }}>{tab === 'people' ? contacts.length : groups.length}</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={[s.tabRow, { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
        <TouchableOpacity style={[s.tab, tab === 'people' && { borderBottomColor: t.accent }]}
          onPress={() => setTab('people')} activeOpacity={0.7}>
          <Ionicons name="person" size={16} color={tab === 'people' ? t.accent : t.textTer} />
          <Text style={[s.tabLabel, { color: tab === 'people' ? t.accent : t.textTer }]}>People</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'groups' && { borderBottomColor: t.accent }]}
          onPress={() => setTab('groups')} activeOpacity={0.7}>
          <Ionicons name="people" size={16} color={tab === 'groups' ? t.accent : t.textTer} />
          <Text style={[s.tabLabel, { color: tab === 'groups' ? t.accent : t.textTer }]}>Groups</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchWrap}>
        <View style={[s.searchBox, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
          <Ionicons name="search" size={16} color={t.textTer} />
          <TextInput style={[s.searchInput, { color: t.text }]}
            placeholder={tab === 'people' ? 'Search contacts...' : 'Search groups...'}
            placeholderTextColor={t.textTer}
            value={search} onChangeText={setSearch} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={t.textTer} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Department filter chips — People tab only */}
      {tab === 'people' && departments.length > 0 && (
        <View style={s.deptRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}>
            <TouchableOpacity style={[s.deptChip, !deptFilter && { backgroundColor: `${t.accent}15`, borderColor: t.accent }]}
              onPress={() => setDeptFilter(null)} activeOpacity={0.7}>
              <Text style={[s.deptChipText, { color: !deptFilter ? t.accent : t.textTer }]}>All</Text>
            </TouchableOpacity>
            {departments.map(d => (
              <TouchableOpacity key={d} style={[s.deptChip, deptFilter === d && { backgroundColor: `${t.accent}15`, borderColor: t.accent }]}
                onPress={() => setDeptFilter(deptFilter === d ? null : d)} activeOpacity={0.7}>
                <Text style={[s.deptChipText, { color: deptFilter === d ? t.accent : t.textTer }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {tab === 'people' ? (
        /* ─── People Tab ─── */
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.accent]} />}
          ListHeaderComponent={
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
            <Text style={[s.sectionHeader, { color: t.accent, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const chatExists = hasChat(item.id);
            return (
              <TouchableOpacity style={[s.contactRow, { borderBottomColor: t.borderLight || t.border }]} onPress={() => openChat(item)} activeOpacity={0.65}>
                <Avatar uri={item.avatar} name={item.name} size={46} status={userStatuses[String(item.id)] || 'offline'} isGlobal={item.isGlobal}
                  onPress={item.avatar ? () => setViewPhoto({ uri: item.avatar, name: item.name }) : undefined} />
                <View style={s.contactBody}>
                  <Text style={[s.contactName, { color: t.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.contactSub, { color: t.textSec }]} numberOfLines={1}>{item.designation || item.department || item.email}</Text>
                </View>
                {chatExists ? (
                  <View style={[s.chatBadge, { backgroundColor: '#22c55e15' }]}>
                    <Ionicons name="chatbubble" size={14} color="#22c55e" />
                  </View>
                ) : null}
                <TouchableOpacity style={[s.chatBtn, { backgroundColor: t.accentBg || '#eef2ff' }]} onPress={() => openChat(item)}>
                  <Ionicons name="chatbubble-outline" size={18} color={t.accent} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={48} color={t.textTer} />
              <Text style={[s.emptyText, { color: t.textTer }]}>No contacts found</Text>
            </View>
          }
        />
      ) : (
        /* ─── Groups Tab ─── */
        <FlatList
          data={filteredGroups}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.accent]} />}
          ListHeaderComponent={
            <TouchableOpacity style={[s.createGroupRow, { borderBottomColor: t.border }]}
              onPress={() => router.push('/chat/create-group')} activeOpacity={0.65}>
              <View style={[s.createGroupIcon, { backgroundColor: t.accent }]}>
                <Ionicons name="add" size={22} color="#fff" />
              </View>
              <View style={s.myselfBody}>
                <Text style={[s.myselfName, { color: t.accent }]}>New Group</Text>
                <Text style={[s.myselfSub, { color: t.textSec }]}>Create a new group chat</Text>
              </View>
            </TouchableOpacity>
          }
          renderItem={({ item }) => {
            const isLeft = item.memberStatus === 'left' || item.memberStatus === 'kicked';
            return (
              <TouchableOpacity style={[s.contactRow, { borderBottomColor: t.borderLight || t.border, opacity: isLeft ? 0.55 : 1 }]}
                onPress={() => openGroup(item)} activeOpacity={0.65}>
                <View style={[s.groupAvatar, { backgroundColor: isLeft ? (isDark ? '#1e293b' : '#f1f5f9') : (isDark ? '#1e293b' : '#ede9fe') }]}>
                  <Ionicons name="people" size={22} color={isLeft ? '#94a3b8' : t.accent} />
                </View>
                <View style={s.contactBody}>
                  <View style={s.groupNameRow}>
                    <Text style={[s.contactName, { color: t.text }]} numberOfLines={1}>{item.name}</Text>
                    {isLeft && (
                      <View style={[s.leftBadge, { backgroundColor: '#fee2e2' }]}>
                        <Text style={s.leftBadgeText}>{item.memberStatus === 'kicked' ? 'Removed' : 'Left'}</Text>
                      </View>
                    )}
                    {!isLeft && item.isAirtime && (
                      <View style={[s.airtimeBadge, { backgroundColor: '#fef3c7' }]}>
                        <Ionicons name="megaphone" size={10} color="#f59e0b" />
                      </View>
                    )}
                  </View>
                  <Text style={[s.contactSub, { color: t.textSec }]} numberOfLines={1}>
                    {isLeft ? 'You can only view old messages' : (item.description || `${item.memberCount || ''} members`)}
                  </Text>
                </View>
                <TouchableOpacity style={[s.chatBtn, { backgroundColor: t.accentBg || '#eef2ff' }]} onPress={() => openGroup(item)}>
                  <Ionicons name={isLeft ? 'eye-outline' : 'chatbubble-outline'} size={18} color={isLeft ? '#94a3b8' : t.accent} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={48} color={t.textTer} />
              <Text style={[s.emptyText, { color: t.textTer }]}>No groups found</Text>
            </View>
          }
        />
      )}
      <ImageViewer visible={!!viewPhoto} uri={viewPhoto?.uri} caption={viewPhoto?.name} onClose={() => setViewPhoto(null)} />
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

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 14, fontWeight: '700' },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '400' },

  // Myself
  myselfRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: 4, borderRadius: 14 },
  myselfAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  myselfEmoji: { fontSize: 22 },
  myselfBody: { flex: 1 },
  myselfName: { fontSize: 16, fontWeight: '700' },
  myselfSub: { fontSize: 13, marginTop: 2 },

  // Create group
  createGroupRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  createGroupIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  // Section header
  sectionHeader: { fontSize: 12, fontWeight: '800', paddingHorizontal: 20, paddingVertical: 8, letterSpacing: 0.8, textTransform: 'uppercase' },

  // Contact row
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  contactBody: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600' },
  contactSub: { fontSize: 13, marginTop: 2, lineHeight: 17 },
  chatBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chatBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Group avatar
  groupAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  groupNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  airtimeBadge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  leftBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  leftBadgeText: { fontSize: 9, fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' },

  // Department filter
  deptRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)' },
  deptChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: 'transparent' },
  deptChipText: { fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '500' },
});
