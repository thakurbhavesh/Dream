import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../src/components/Avatar';
import { useToast } from '../../src/components/Toast';
import { useTheme } from '../../src/store/ThemeContext';
import { useAuth } from '../../src/store/AuthContext';
import useSocket from '../../src/hooks/useSocket';
import api from '../../src/api/config';

export default function BroadcastScreen() {
  const { theme: t, isDark } = useTheme();
  const { user } = useAuth();
  const { sendMessage, connected } = useSocket();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const ACCENT = t.accent;
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const bg = isDark ? '#0b141a' : '#fff';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/chat/contacts');
        const rows = (data?.data?.contacts || data?.data?.rows || data?.data || []).map(c => ({
          id: c.user_id || c.id, name: c.name || c.email, avatar: c.profile_url || c.avatar, email: c.email,
        }));
        setContacts(rows.filter(c => String(c.id) !== String(user?.id)));
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const toggleSelect = (c) => {
    setSelected(prev => prev.find(s => String(s.id) === String(c.id))
      ? prev.filter(s => String(s.id) !== String(c.id))
      : [...prev, c]);
  };

  const handleSend = useCallback(async () => {
    if (!message.trim() || selected.length === 0) return;
    setSending(true);
    let success = 0;
    let failed = 0;
    for (const contact of selected) {
      try {
        const threadId = `dm-${contact.id}`;
        if (connected) {
          const res = await sendMessage(threadId, message.trim(), 'text');
          if (res?.ok || res?.message) { success++; continue; }
        }
        await api.post(`/chat/threads/${threadId}/messages`, { message: message.trim(), message_type: 'text' });
        success++;
      } catch { failed++; }
    }
    setSending(false);
    if (success > 0) toast(`Sent to ${success} contact${success > 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`, 'success');
    else toast('All failed', 'error');
    if (success > 0) router.back();
  }, [message, selected, connected, sendMessage, toast]);

  const filtered = search.trim()
    ? contacts.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()))
    : contacts;

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Broadcast</Text>
          <Text style={s.headerSub}>{selected.length} selected</Text>
        </View>
      </View>

      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={[s.chipRow, { borderBottomColor: borderColor }]}>
          {selected.map(c => (
            <TouchableOpacity key={c.id} style={[s.chip, { backgroundColor: ACCENT + '15' }]} onPress={() => toggleSelect(c)}>
              <Avatar uri={c.avatar} name={c.name} size={22} />
              <Text style={[s.chipName, { color: ACCENT }]}>{c.name?.split(' ')[0]}</Text>
              <Ionicons name="close" size={12} color={ACCENT} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={[s.searchBar, { backgroundColor: inputBg }]}>
        <Ionicons name="search" size={16} color={subColor} />
        <TextInput style={[s.searchInput, { color: textColor }]} placeholder="Search contacts..."
          placeholderTextColor={subColor} value={search} onChangeText={setSearch} />
      </View>

      {/* Contacts */}
      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item: c }) => {
            const sel = selected.some(s => String(s.id) === String(c.id));
            return (
              <TouchableOpacity style={[s.contactRow, { borderBottomColor: borderColor }]}
                onPress={() => toggleSelect(c)} activeOpacity={0.6}>
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
        />
      )}

      {/* Message input + send */}
      {selected.length > 0 && (
        <View style={[s.footer, { backgroundColor: isDark ? '#1f2c34' : '#f8fafc', paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={[s.msgInput, { backgroundColor: inputBg, borderColor }]}>
            <TextInput style={[s.msgText, { color: textColor }]} placeholder="Type broadcast message..."
              placeholderTextColor={subColor} value={message} onChangeText={setMessage} multiline maxLength={2000} />
          </View>
          <TouchableOpacity style={[s.sendBtn, { backgroundColor: message.trim() ? ACCENT : (isDark ? '#334155' : '#e2e8f0') }]}
            onPress={handleSend} disabled={!message.trim() || sending} activeOpacity={0.8}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> :
              <Ionicons name="send" size={19} color={message.trim() ? '#fff' : subColor} />}
          </TouchableOpacity>
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
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18 },
  chipName: { fontSize: 12, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginVertical: 8, borderRadius: 14, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontSize: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  contactName: { fontSize: 15, fontWeight: '600' },
  contactEmail: { fontSize: 12, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 8, paddingTop: 8 },
  msgInput: { flex: 1, borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120 },
  msgText: { fontSize: 15 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 3 },
});
