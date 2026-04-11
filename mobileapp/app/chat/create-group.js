import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Switch, ActivityIndicator, Platform, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../src/components/Avatar';
import { useToast } from '../../src/components/Toast';
import { useTheme } from '../../src/store/ThemeContext';
import { useAuth } from '../../src/store/AuthContext';
import api from '../../src/api/config';

export default function CreateGroupScreen() {
  const { theme: t, isDark } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAirtime, setIsAirtime] = useState(false);
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]); // [{id, name, avatar}]
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1); // 1=details, 2=members

  const ACCENT = t.accent;
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const bg = isDark ? '#0b141a' : '#fff';
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  // Load contacts
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/chat/contacts');
        const rows = (data?.data?.contacts || data?.data?.rows || data?.data || []).map(c => ({
          id: c.user_id || c.id,
          name: c.name || c.email,
          avatar: c.profile_url || c.avatar,
          email: c.email,
        }));
        setContacts(rows.filter(c => String(c.id) !== String(user?.id)));
      } catch {}
      finally { setLoading(false); }
    })();
  }, [user?.id]);

  const toggleMember = useCallback((contact) => {
    setSelected(prev => {
      const exists = prev.find(s => String(s.id) === String(contact.id));
      if (exists) return prev.filter(s => String(s.id) !== String(contact.id));
      return [...prev, contact];
    });
  }, []);

  const isSelected = (id) => selected.some(s => String(s.id) === String(id));

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { toast('Group name required', 'error'); return; }
    if (selected.length < 1) { toast('Add at least 1 member', 'error'); return; }
    setCreating(true);
    try {
      const members = selected.map(s => ({ user_id: s.id, is_admin: false, status: 'active' }));
      const { data } = await api.post('/chat/groups/create', {
        group_name: name.trim(),
        group_description: description.trim(),
        is_airtime: isAirtime,
        members,
      });
      const group = data?.data || data;
      toast('Group created!', 'success');
      const threadId = group?.threadId || `group-${group?.group_id || group?.id}`;
      router.replace(`/chat/${threadId}?name=${encodeURIComponent(name.trim())}&avatar=`);
    } catch (e) {
      toast(e?.response?.data?.message || 'Failed to create group', 'error');
    }
    finally { setCreating(false); }
  }, [name, description, isAirtime, selected, toast]);

  const filteredContacts = contacts.filter(c =>
    !search || (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{step === 1 ? 'New Group' : 'Add Members'}</Text>
        <View style={{ flex: 1 }} />
        {step === 1 ? (
          <TouchableOpacity onPress={() => { if (!name.trim()) { toast('Enter group name', 'error'); return; } setStep(2); }}
            style={[s.nextBtn, { backgroundColor: '#ffffff30' }]}>
            <Text style={s.nextText}>Next</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleCreate} disabled={creating}
            style={[s.nextBtn, { backgroundColor: '#ffffff30' }]}>
            {creating ? <ActivityIndicator size="small" color="#fff" /> :
              <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={s.nextText}>Create</Text></>}
          </TouchableOpacity>
        )}
      </View>

      {step === 1 ? (
        /* ─── Step 1: Group Details ─── */
        <ScrollView style={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}>
          <View style={[s.avatarCircle, { backgroundColor: ACCENT + '20' }]}>
            <Ionicons name="people" size={40} color={ACCENT} />
          </View>

          <Text style={[s.label, { color: subColor }]}>Group Name *</Text>
          <TextInput
            style={[s.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="Enter group name"
            placeholderTextColor={subColor}
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />

          <Text style={[s.label, { color: subColor }]}>Description (optional)</Text>
          <TextInput
            style={[s.input, s.inputMulti, { backgroundColor: inputBg, color: textColor, borderColor }]}
            placeholder="What's this group about?"
            placeholderTextColor={subColor}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
          />

          <View style={[s.switchRow, { borderColor }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.switchLabel, { color: textColor }]}>Announcement Only</Text>
              <Text style={[s.switchDesc, { color: subColor }]}>Only admins can send messages</Text>
            </View>
            <Switch value={isAirtime} onValueChange={setIsAirtime} trackColor={{ true: ACCENT }} />
          </View>
        </ScrollView>
      ) : (
        /* ─── Step 2: Add Members ─── */
        <View style={{ flex: 1 }}>
          {/* Selected chips */}
          {selected.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipRow} style={[s.chipScroll, { borderBottomColor: borderColor }]}>
              {selected.map(m => (
                <TouchableOpacity key={m.id} style={[s.chip, { backgroundColor: ACCENT + '15' }]}
                  onPress={() => toggleMember(m)}>
                  <Avatar uri={m.avatar} name={m.name} size={24} />
                  <Text style={[s.chipName, { color: ACCENT }]} numberOfLines={1}>{m.name?.split(' ')[0]}</Text>
                  <Ionicons name="close" size={14} color={ACCENT} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Search */}
          <View style={[s.searchBar, { backgroundColor: inputBg }]}>
            <Ionicons name="search" size={16} color={subColor} />
            <TextInput
              style={[s.searchInput, { color: textColor }]}
              placeholder="Search contacts..."
              placeholderTextColor={subColor}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Contact list */}
          {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
            <FlatList
              data={filteredContacts}
              keyExtractor={c => String(c.id)}
              renderItem={({ item: c }) => {
                const sel = isSelected(c.id);
                return (
                  <TouchableOpacity style={[s.contactRow, { borderBottomColor: borderColor }]}
                    onPress={() => toggleMember(c)} activeOpacity={0.6}>
                    <Avatar uri={c.avatar} name={c.name} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.contactName, { color: textColor }]}>{c.name}</Text>
                      {c.email && <Text style={[s.contactEmail, { color: subColor }]}>{c.email}</Text>}
                    </View>
                    <View style={[s.check, sel && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
                      {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={[s.empty, { color: subColor }]}>No contacts found</Text>}
            />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 12, elevation: 4 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  nextText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  body: { flex: 1, padding: 20 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },

  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },

  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  switchLabel: { fontSize: 15, fontWeight: '700' },
  switchDesc: { fontSize: 12, marginTop: 2 },

  chipScroll: { maxHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  chipRow: { gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  chipName: { fontSize: 13, fontWeight: '600', maxWidth: 80 },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginVertical: 8, borderRadius: 12, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 14 },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  contactName: { fontSize: 15, fontWeight: '600' },
  contactEmail: { fontSize: 12, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },

  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
});
