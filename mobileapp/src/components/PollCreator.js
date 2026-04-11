import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../store/ThemeContext';

export default function PollCreator({ onSubmit, onClose, accentColor = '#ea4c89' }) {
  const { isDark } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiChoice, setMultiChoice] = useState(false);

  const addOption = () => { if (options.length < 10) setOptions([...options, '']); };
  const removeOption = (i) => { if (options.length > 2) setOptions(options.filter((_, j) => j !== i)); };
  const updateOption = (i, val) => { const o = [...options]; o[i] = val; setOptions(o); };

  const handleSubmit = () => {
    const q = question.trim();
    const opts = options.map(o => o.trim()).filter(Boolean);
    if (!q) return;
    if (opts.length < 2) return;
    onSubmit?.({ question: q, options: opts, multiChoice });
  };

  const bg = isDark ? '#1e293b' : '#fff';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const valid = question.trim() && options.filter(o => o.trim()).length >= 2;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: textColor }]}>Create Poll</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color={subColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[s.label, { color: subColor }]}>Question</Text>
        <TextInput
          style={[s.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
          placeholder="Ask a question..."
          placeholderTextColor={subColor}
          value={question}
          onChangeText={setQuestion}
          multiline
          maxLength={300}
        />

        <Text style={[s.label, { color: subColor, marginTop: 16 }]}>Options</Text>
        {options.map((opt, i) => (
          <View key={i} style={s.optRow}>
            <View style={[s.optNum, { backgroundColor: accentColor + '20' }]}>
              <Text style={[s.optNumText, { color: accentColor }]}>{i + 1}</Text>
            </View>
            <TextInput
              style={[s.optInput, { backgroundColor: inputBg, color: textColor, borderColor }]}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={subColor}
              value={opt}
              onChangeText={(v) => updateOption(i, v)}
              maxLength={100}
            />
            {options.length > 2 && (
              <TouchableOpacity onPress={() => removeOption(i)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={subColor} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {options.length < 10 && (
          <TouchableOpacity style={s.addBtn} onPress={addOption} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={accentColor} />
            <Text style={[s.addText, { color: accentColor }]}>Add option</Text>
          </TouchableOpacity>
        )}

        <View style={[s.switchRow, { borderTopColor: borderColor }]}>
          <Text style={[s.switchLabel, { color: textColor }]}>Allow multiple choices</Text>
          <Switch value={multiChoice} onValueChange={setMultiChoice} trackColor={{ true: accentColor }} />
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[s.submitBtn, { backgroundColor: valid ? accentColor : (isDark ? '#334155' : '#e2e8f0') }]}
        onPress={handleSubmit} disabled={!valid} activeOpacity={0.8}>
        <Ionicons name="paper-plane-outline" size={18} color={valid ? '#fff' : subColor} />
        <Text style={[s.submitText, { color: valid ? '#fff' : subColor }]}>Send Poll</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  body: { paddingHorizontal: 20, maxHeight: 400 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 48 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optNumText: { fontSize: 13, fontWeight: '800' },
  optInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addText: { fontSize: 14, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginVertical: 16, paddingVertical: 14, borderRadius: 14 },
  submitText: { fontSize: 15, fontWeight: '700' },
});
