import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/store/ThemeContext';
import { joinByCode } from '../../src/api/meetings';

export default function JoinMeetingScreen() {
  const { theme: t } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Enter a meeting code');
      return;
    }
    setLoading(true);
    try {
      const meeting = await joinByCode(trimmed);
      const id = meeting?.id || meeting?.meeting?.id;
      if (id) {
        router.replace(`/meetings/${id}`);
      } else {
        Alert.alert('Not found', 'No meeting matches that code.');
      }
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message
        || (status === 404 ? 'Meeting not found. Check the code.' : e.message || 'Failed to join');
      Alert.alert('Could not join', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Join Meeting',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontWeight: '700' },
          headerTintColor: t.text,
        }}
      />
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.flex}
        >
          <View style={s.body}>
            <View style={[s.iconCircle, { backgroundColor: t.accentBg }]}>
              <Ionicons name="enter" size={36} color={t.accent} />
            </View>
            <Text style={[s.heading, { color: t.text }]}>Join with a code</Text>
            <Text style={[s.hint, { color: t.textSec }]}>
              Ask the host for the meeting code. You'll join the room straight away.
            </Text>

            <Text style={[s.label, { color: t.textSec }]}>Meeting code</Text>
            <TextInput
              style={[s.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
              placeholder="e.g. AB12-XY-34"
              placeholderTextColor={t.textQuad}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: t.accent, opacity: loading || !code.trim() ? 0.6 : 1 }]}
              onPress={submit}
              disabled={loading || !code.trim()}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="videocam" size={18} color="#fff" />
                  <Text style={s.submitTxt}>Join</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  body: { flex: 1, padding: 24, paddingTop: 40, alignItems: 'stretch' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  heading: { fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  hint: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 32, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  submitTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
