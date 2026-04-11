import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import { useToast } from '../../../src/components/Toast';
import api from '../../../src/api/config';

export default function DepartmentsScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tab, setTab] = useState('dept'); // dept | desig
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, dsRes] = await Promise.all([
        api.get('/departments?limit=100').catch(() => null),
        api.get('/designations?limit=100').catch(() => null),
      ]);
      setDepartments(dRes?.data?.data?.rows || dRes?.data?.data || []);
      setDesignations(dsRes?.data?.data?.rows || dsRes?.data?.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setAdding(true);
    try {
      if (tab === 'dept') {
        await api.post('/departments', { name: addName.trim() });
      } else {
        await api.post('/designations', { name: addName.trim() });
      }
      toast(`${tab === 'dept' ? 'Department' : 'Designation'} added`, 'success');
      setAddName('');
      load();
    } catch (e) { toast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setAdding(false); }
  };

  const handleDelete = (item, type) => {
    Alert.alert('Delete', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const id = type === 'dept' ? item.department_id : item.designation_id;
          await api.delete(`/${type === 'dept' ? 'departments' : 'designations'}/${id}`);
          toast('Deleted', 'success');
          load();
        } catch { toast('Failed — may have assigned users', 'error'); }
      }},
    ]);
  };

  const data = tab === 'dept' ? departments : designations;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Departments & Designations</Text>
      </View>

      {/* Tabs */}
      <View style={[s.tabRow, { backgroundColor: cardBg }]}>
        {[{ key: 'dept', label: 'Departments', count: departments.length }, { key: 'desig', label: 'Designations', count: designations.length }].map(tb => (
          <TouchableOpacity key={tb.key} style={[s.tab, tab === tb.key && { borderBottomColor: ACCENT }]}
            onPress={() => setTab(tb.key)} activeOpacity={0.7}>
            <Text style={[s.tabText, { color: tab === tb.key ? ACCENT : subColor }]}>{tb.label} ({tb.count})</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add new */}
      <View style={[s.addRow, { backgroundColor: cardBg }]}>
        <TextInput style={[s.addInput, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', color: textColor }]}
          placeholder={`New ${tab === 'dept' ? 'department' : 'designation'} name`} placeholderTextColor={subColor}
          value={addName} onChangeText={setAddName} />
        <TouchableOpacity style={[s.addBtn, { backgroundColor: addName.trim() ? ACCENT : subColor }]}
          onPress={handleAdd} disabled={!addName.trim() || adding} activeOpacity={0.8}>
          {adding ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => String(item.department_id || item.designation_id || i)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          renderItem={({ item, index }) => (
            <View style={[s.itemCard, { backgroundColor: cardBg }]}>
              <View style={[s.itemNum, { backgroundColor: `${ACCENT}12` }]}>
                <Text style={[s.itemNumText, { color: ACCENT }]}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.itemName, { color: textColor }]}>{item.name}</Text>
                <Text style={[s.itemMeta, { color: subColor }]}>Status: {item.status || 'active'}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item, tab)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<View style={s.empty}><Text style={[s.emptyText, { color: subColor }]}>No {tab === 'dept' ? 'departments' : 'designations'} yet</Text></View>}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff' },

  tabRow: { flexDirection: 'row', elevation: 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '700' },

  addRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  addInput: { flex: 1, borderRadius: 12, paddingHorizontal: 14, height: 44, fontSize: 14 },
  addBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginTop: 8, padding: 14, borderRadius: 14, elevation: 1 },
  itemNum: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemNumText: { fontSize: 13, fontWeight: '800' },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 8, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14 },
});
