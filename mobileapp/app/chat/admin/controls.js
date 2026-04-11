import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import { useToast } from '../../../src/components/Toast';
import api from '../../../src/api/config';

const CONTROL_ITEMS = [
  { key: 'edit', icon: 'create', label: 'Message Edit', desc: 'Allow users to edit sent messages', color: '#3b82f6', hasTime: true },
  { key: 'recall', icon: 'arrow-undo', label: 'Message Recall', desc: 'Allow users to unsend messages', color: '#f59e0b', hasTime: true },
  { key: 'delete', icon: 'trash', label: 'Message Delete', desc: 'Allow users to delete messages', color: '#ef4444' },
  { key: 'message_info', icon: 'information-circle', label: 'Message Info', desc: 'Show read receipts & delivery info', color: '#06b6d4' },
];

export default function ControlsScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [controls, setControls] = useState({});
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
      const results = {};
      for (const c of CONTROL_ITEMS) {
        try {
          const { data } = await api.get(`/organization-controls/${c.key}`);
          results[c.key] = data?.data || data || {};
        } catch { results[c.key] = {}; }
      }
      setControls(results);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const updateControl = async (key, updates) => {
    try {
      await api.put(`/organization-controls/${key}`, updates);
      setControls(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
      toast('Updated', 'success');
    } catch { toast('Failed', 'error'); }
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Controls</Text>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}>
          {CONTROL_ITEMS.map(c => {
            const ctrl = controls[c.key] || {};
            const enabled = ctrl.enabled !== false;
            return (
              <View key={c.key} style={[s.card, { backgroundColor: cardBg }]}>
                <View style={s.cardHeader}>
                  <View style={[s.cardIcon, { backgroundColor: `${c.color}12` }]}>
                    <Ionicons name={c.icon} size={20} color={c.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardLabel, { color: textColor }]}>{c.label}</Text>
                    <Text style={[s.cardDesc, { color: subColor }]}>{c.desc}</Text>
                  </View>
                  <Switch value={enabled}
                    onValueChange={v => updateControl(c.key, { enabled: v })}
                    trackColor={{ false: isDark ? '#334155' : '#e2e8f0', true: `${c.color}60` }} />
                </View>
                {c.hasTime && enabled && (
                  <View style={[s.timeRow, { borderTopColor: isDark ? '#334155' : '#f1f5f9' }]}>
                    <Text style={[s.timeLabel, { color: subColor }]}>Time limit (minutes)</Text>
                    <View style={s.timeChips}>
                      {[5, 15, 30, 60, null].map(m => {
                        const isActive = (m === null && !ctrl.time_limit_minutes) || ctrl.time_limit_minutes === m;
                        return (
                          <TouchableOpacity key={String(m)} style={[s.timeChip, isActive && { backgroundColor: `${c.color}15`, borderColor: c.color }]}
                            onPress={() => updateControl(c.key, { time_limit_minutes: m })} activeOpacity={0.7}>
                            <Text style={[s.timeChipText, { color: isActive ? c.color : subColor }]}>{m === null ? '∞' : `${m}m`}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },

  card: { marginHorizontal: 14, marginTop: 10, borderRadius: 16, padding: 16, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '700' },
  cardDesc: { fontSize: 12, marginTop: 2 },

  timeRow: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  timeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  timeChips: { flexDirection: 'row', gap: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  timeChipText: { fontSize: 13, fontWeight: '700' },
});
