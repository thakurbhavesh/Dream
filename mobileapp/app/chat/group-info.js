import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Switch, ActivityIndicator, ScrollView, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../src/components/Avatar';
import { useToast } from '../../src/components/Toast';
import { useTheme } from '../../src/store/ThemeContext';
import { useAuth } from '../../src/store/AuthContext';
import api from '../../src/api/config';

const TABS = [
  { key: 'members', label: 'Members', icon: 'people' },
  { key: 'timeline', label: 'Timeline', icon: 'time' },
];

export default function GroupInfoScreen() {
  const { threadId, name: paramName, avatar: paramAvatar } = useLocalSearchParams();
  const { theme: t, isDark } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const groupId = threadId?.replace('group-', '');

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('members');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [allContacts, setAllContacts] = useState([]);

  const ACCENT = t.accent;
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const bg = isDark ? '#0b141a' : '#fff';
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  // Determine if current user is admin
  const myMembership = members.find(m => String(m.user_id || m.id) === String(user?.id));
  const isAdmin = myMembership?.is_admin || String(group?.created_by) === String(user?.id) || user?.role_id === 1;

  // Load group info + members
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [groupRes, membersRes] = await Promise.all([
          api.get(`/groups/${groupId}`).catch(() => null),
          api.get(`/group-members?group_id=${groupId}&limit=500`).catch(() => null),
        ]);
        const g = groupRes?.data?.data || groupRes?.data || {};
        setGroup(g);
        setEditName(g.group_name || paramName || '');
        setEditDesc(g.group_description || '');

        const mems = membersRes?.data?.data?.rows || membersRes?.data?.data || membersRes?.data?.rows || [];
        setMembers(mems.filter(m => m.status === 'active' || !m.status));
      } catch {}
      finally { setLoading(false); }
    })();
  }, [groupId]);

  // Load timeline when tab changes
  useEffect(() => {
    if (tab !== 'timeline') return;
    (async () => {
      try {
        const { data } = await api.get(`/group-timeline?group_id=${groupId}&limit=100`);
        setTimeline(data?.data?.rows || data?.data || data?.rows || []);
      } catch { setTimeline([]); }
    })();
  }, [tab, groupId]);

  // Save group details
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.patch(`/groups/${groupId}`, {
        group_name: editName.trim(),
        group_description: editDesc.trim(),
      });
      setGroup(prev => ({ ...prev, group_name: editName.trim(), group_description: editDesc.trim() }));
      setEditing(false);
      toast('Group updated', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Update failed', 'error'); }
    finally { setSaving(false); }
  }, [groupId, editName, editDesc, toast]);

  // Toggle airtime
  const toggleAirtime = useCallback(async (val) => {
    try {
      await api.patch(`/groups/${groupId}`, { is_airtime: val });
      setGroup(prev => ({ ...prev, is_airtime: val }));
      toast(val ? 'Announcement mode on' : 'Announcement mode off', 'success');
    } catch { toast('Failed', 'error'); }
  }, [groupId, toast]);

  // Toggle member admin
  const toggleAdmin = useCallback(async (member) => {
    const memberId = member.group_member_id || member.id;
    const newAdmin = !member.is_admin;
    try {
      await api.patch(`/group-members/${memberId}`, { is_admin: newAdmin });
      setMembers(prev => prev.map(m => (m.group_member_id || m.id) === memberId ? { ...m, is_admin: newAdmin } : m));
      toast(newAdmin ? 'Promoted to admin' : 'Admin removed', 'success');
    } catch { toast('Failed', 'error'); }
  }, [toast]);

  // Remove member
  const removeMember = useCallback(async (member) => {
    const memberId = member.group_member_id || member.id;
    Alert.alert('Remove Member', `Remove ${member.user_name || member.name} from group?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.patch(`/group-members/${memberId}`, { status: 'kicked' });
          setMembers(prev => prev.filter(m => (m.group_member_id || m.id) !== memberId));
          toast('Member removed', 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  }, [toast]);

  // Add member
  const addMember = useCallback(async (contact) => {
    try {
      await api.post('/group-members', { group_id: parseInt(groupId), user_id: contact.id, is_admin: false, status: 'active' });
      setMembers(prev => [...prev, { user_id: contact.id, user_name: contact.name, is_admin: false, status: 'active', profile_url: contact.avatar }]);
      toast(`${contact.name} added`, 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Failed to add', 'error'); }
  }, [groupId, toast]);

  // Leave group
  const handleLeave = useCallback(() => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/chat/groups/${groupId}/leave`);
          toast('Left group', 'success');
          router.replace('/(tabs)/chats');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  }, [groupId, toast]);

  // Load contacts for add member
  useEffect(() => {
    if (!showAddMember) return;
    (async () => {
      try {
        const { data } = await api.get('/chat/contacts');
        const rows = (data?.data?.contacts || data?.data?.rows || data?.data || []).map(c => ({
          id: c.user_id || c.id, name: c.name || c.email, avatar: c.profile_url || c.avatar, email: c.email,
        }));
        const memberIds = members.map(m => String(m.user_id || m.id));
        setAllContacts(rows.filter(c => !memberIds.includes(String(c.id))));
      } catch {}
    })();
  }, [showAddMember, members]);

  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const eventIcon = (type) => {
    if (type?.includes('created')) return { icon: 'add-circle', color: '#22c55e' };
    if (type?.includes('removed') || type?.includes('kicked')) return { icon: 'remove-circle', color: '#ef4444' };
    if (type?.includes('added')) return { icon: 'person-add', color: '#3b82f6' };
    if (type?.includes('updated') || type?.includes('patched')) return { icon: 'create', color: '#f59e0b' };
    return { icon: 'ellipse', color: subColor };
  };

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
          <Text style={s.headerTitle}>Group Info</Text>
        </View>
        <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.headerTitle}>Group Info</Text>
        <View style={{ flex: 1 }} />
        {isAdmin && !editing && (
          <TouchableOpacity onPress={() => setEditing(true)} style={s.editBtn}>
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Group profile */}
        <View style={s.profileSection}>
          <View style={[s.avatarCircle, { backgroundColor: ACCENT + '20' }]}>
            <Ionicons name="people" size={44} color={ACCENT} />
          </View>
          {editing ? (
            <View style={s.editSection}>
              <TextInput style={[s.editInput, { backgroundColor: inputBg, color: textColor, borderColor }]}
                value={editName} onChangeText={setEditName} placeholder="Group name" placeholderTextColor={subColor} maxLength={100} />
              <TextInput style={[s.editInput, s.editMulti, { backgroundColor: inputBg, color: textColor, borderColor }]}
                value={editDesc} onChangeText={setEditDesc} placeholder="Description" placeholderTextColor={subColor} multiline maxLength={500} />
              <View style={s.editActions}>
                <TouchableOpacity style={[s.editCancel, { borderColor }]} onPress={() => { setEditing(false); setEditName(group?.group_name || ''); setEditDesc(group?.group_description || ''); }}>
                  <Text style={[s.editCancelText, { color: subColor }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.editSave, { backgroundColor: ACCENT }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.editSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={[s.groupName, { color: textColor }]}>{group?.group_name || paramName}</Text>
              {group?.group_description ? <Text style={[s.groupDesc, { color: subColor }]}>{group.group_description}</Text> : null}
              <Text style={[s.memberCount, { color: subColor }]}>
                {members.length} member{members.length !== 1 ? 's' : ''}
                {group?.is_airtime ? '  ·  Announcement' : ''}
              </Text>
            </>
          )}
        </View>

        {/* Settings (admin only) */}
        {isAdmin && !editing && (
          <View style={[s.settingsSection, { borderColor }]}>
            <View style={s.settingRow}>
              <Ionicons name="megaphone-outline" size={20} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={[s.settingLabel, { color: textColor }]}>Announcement Only</Text>
                <Text style={[s.settingDesc, { color: subColor }]}>Only admins can send messages</Text>
              </View>
              <Switch value={!!group?.is_airtime} onValueChange={toggleAirtime} trackColor={{ true: ACCENT }} />
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={[s.tabRow, { borderColor }]}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && { borderBottomColor: ACCENT }]}
              onPress={() => setTab(t.key)} activeOpacity={0.7}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? ACCENT : subColor} />
              <Text style={[s.tabLabel, { color: tab === t.key ? ACCENT : subColor }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Members */}
        {tab === 'members' && (
          <View style={s.listSection}>
            {isAdmin && (
              <TouchableOpacity style={[s.addMemberBtn, { backgroundColor: ACCENT + '12' }]}
                onPress={() => setShowAddMember(true)} activeOpacity={0.7}>
                <View style={[s.addMemberIcon, { backgroundColor: ACCENT }]}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                </View>
                <Text style={[s.addMemberText, { color: ACCENT }]}>Add Members</Text>
              </TouchableOpacity>
            )}
            {members.map(m => {
              const mName = m.user_name || m.name || 'Unknown';
              const mId = m.user_id || m.id;
              const isSelf = String(mId) === String(user?.id);
              const isOwner = String(mId) === String(group?.created_by);
              return (
                <View key={mId} style={[s.memberRow, { borderBottomColor: borderColor }]}>
                  <Avatar uri={m.profile_url || m.avatar} name={mName} size={44} isGlobal={!!(m.is_global_member || m.isGlobalMember)} />
                  <View style={{ flex: 1 }}>
                    <View style={s.memberNameRow}>
                      <Text style={[s.memberName, { color: textColor }]}>{mName}{isSelf ? ' (You)' : ''}</Text>
                      {isOwner && (
                        <View style={[s.roleBadge, { backgroundColor: '#f59e0b20' }]}>
                          <Text style={[s.roleText, { color: '#f59e0b' }]}>Owner</Text>
                        </View>
                      )}
                      {m.is_admin && !isOwner && (
                        <View style={[s.roleBadge, { backgroundColor: ACCENT + '20' }]}>
                          <Text style={[s.roleText, { color: ACCENT }]}>Admin</Text>
                        </View>
                      )}
                      {(m.is_global_member || m.isGlobalMember) && (
                        <View style={[s.roleBadge, { backgroundColor: '#FFB02020' }]}>
                          <Text style={[s.roleText, { color: '#FFB020' }]}>Global</Text>
                        </View>
                      )}
                    </View>
                    {m.user_email && <Text style={[s.memberEmail, { color: subColor }]}>{m.user_email}</Text>}
                  </View>
                  {isAdmin && !isSelf && !isOwner && (
                    <View style={s.memberActions}>
                      <TouchableOpacity onPress={() => toggleAdmin(m)} hitSlop={8} style={s.memberActionBtn}>
                        <Ionicons name={m.is_admin ? 'shield' : 'shield-outline'} size={18} color={m.is_admin ? ACCENT : subColor} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeMember(m)} hitSlop={8} style={s.memberActionBtn}>
                        <Ionicons name="remove-circle-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Timeline */}
        {tab === 'timeline' && (
          <View style={s.listSection}>
            {timeline.length === 0 ? (
              <Text style={[s.empty, { color: subColor }]}>No events yet</Text>
            ) : timeline.map((ev, i) => {
              const { icon, color } = eventIcon(ev.event_type);
              return (
                <View key={ev.timeline_id || i} style={[s.timelineRow, { borderBottomColor: borderColor }]}>
                  <View style={[s.timelineDot, { backgroundColor: color + '20' }]}>
                    <Ionicons name={icon} size={16} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.timelineDesc, { color: textColor }]}>{ev.event_description || ev.event_type}</Text>
                    <Text style={[s.timelineTime, { color: subColor }]}>
                      {ev.actor ? `by ${ev.actor}` : ''}{ev.event_at ? `  ·  ${fmtDate(ev.event_at)}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Leave / Delete */}
        <View style={[s.dangerSection, { borderColor }]}>
          <TouchableOpacity style={s.dangerBtn} onPress={handleLeave}>
            <Ionicons name="exit-outline" size={20} color="#ef4444" />
            <Text style={s.dangerText}>Leave Group</Text>
          </TouchableOpacity>
        </View>

        {/* Safe area bottom spacing */}
        <View style={{ height: insets.bottom + 50 }} />
      </ScrollView>

      {/* Add Member Modal */}
      {showAddMember && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: isDark ? '#1e293b' : '#fff', paddingBottom: insets.bottom }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: textColor }]}>Add Members</Text>
                <TouchableOpacity onPress={() => setShowAddMember(false)}><Ionicons name="close" size={22} color={subColor} /></TouchableOpacity>
              </View>
              <View style={[s.modalSearch, { backgroundColor: inputBg }]}>
                <Ionicons name="search" size={16} color={subColor} />
                <TextInput style={[s.modalSearchInput, { color: textColor }]}
                  placeholder="Search..." placeholderTextColor={subColor} value={addSearch} onChangeText={setAddSearch} autoFocus />
              </View>
              <FlatList
                data={allContacts.filter(c => !addSearch || (c.name || '').toLowerCase().includes(addSearch.toLowerCase()))}
                keyExtractor={c => String(c.id)}
                renderItem={({ item: c }) => (
                  <TouchableOpacity style={[s.modalRow, { borderBottomColor: borderColor }]}
                    onPress={() => { addMember(c); setAllContacts(prev => prev.filter(p => String(p.id) !== String(c.id))); }}
                    activeOpacity={0.6}>
                    <Avatar uri={c.avatar} name={c.name} size={40} />
                    <Text style={[s.modalRowName, { color: textColor }]}>{c.name}</Text>
                    <Ionicons name="add-circle" size={22} color={ACCENT} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={[s.empty, { color: subColor }]}>No contacts to add</Text>}
              />
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header — premium elevated
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  editBtn: { padding: 10, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  // Profile — premium card feel
  profileSection: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  groupName: { fontSize: 24, fontWeight: '900', marginBottom: 6, letterSpacing: -0.3, textAlign: 'center' },
  groupDesc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginBottom: 8, lineHeight: 20 },
  memberCount: { fontSize: 13, fontWeight: '700' },

  // Edit section
  editSection: { width: '100%', paddingHorizontal: 20, marginTop: 10 },
  editInput: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 12 },
  editMulti: { minHeight: 80, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editCancel: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  editCancelText: { fontSize: 14, fontWeight: '700' },
  editSave: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', elevation: 2 },
  editSaveText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Settings — card style
  settingsSection: {
    marginHorizontal: 14, marginTop: 8, borderRadius: 18, overflow: 'hidden',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16 },
  settingLabel: { fontSize: 15, fontWeight: '700' },
  settingDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },

  // Tabs — premium pill
  tabRow: { flexDirection: 'row', marginHorizontal: 14, marginTop: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 14, fontWeight: '800' },

  // Members list
  listSection: { paddingBottom: 12 },
  addMemberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16,
    marginHorizontal: 14, marginTop: 8, borderRadius: 16,
  },
  addMemberIcon: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  addMemberText: { fontSize: 15, fontWeight: '800' },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 68,
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  memberName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  memberEmail: { fontSize: 12, marginTop: 2 },
  roleBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  roleText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  memberActions: { flexDirection: 'row', gap: 2 },
  memberActionBtn: { padding: 8, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },

  // Timeline
  timelineRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timelineDot: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    elevation: 1,
  },
  timelineDesc: { fontSize: 14, fontWeight: '600', marginBottom: 3, lineHeight: 19 },
  timelineTime: { fontSize: 11, fontWeight: '500' },

  // Danger section
  dangerSection: {
    marginHorizontal: 14, marginTop: 16, paddingHorizontal: 4, paddingVertical: 4,
    borderRadius: 16, borderWidth: 1, borderColor: '#fee2e2',
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, minHeight: 52,
  },
  dangerText: { fontSize: 15, fontWeight: '800', color: '#ef4444' },

  // Modal — premium sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    maxHeight: '75%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 18,
    elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 12 },
  modalTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.2 },
  modalSearch: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, borderRadius: 14, paddingHorizontal: 14, height: 44, marginBottom: 10 },
  modalSearchInput: { flex: 1, fontSize: 14.5 },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 58,
  },
  modalRowName: { flex: 1, fontSize: 15, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 50, fontSize: 14, fontWeight: '500' },
});
