import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import { createMeeting } from '../../src/api/meetings';

const pad = (n) => String(n).padStart(2, '0');

const buildDefaultDateTime = () => {
  const d = new Date(Date.now() + 30 * 60_000);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

export default function CreateMeetingScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { theme: t } = useTheme();

  const initialMode = params.mode === 'scheduled' ? 'scheduled' : 'instant';
  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const def = useMemo(buildDefaultDateTime, []);
  const [date, setDate] = useState(def.date);
  const [time, setTime] = useState(def.time);
  const [enableVideo, setEnableVideo] = useState(true);
  const [enableAudio, setEnableAudio] = useState(true);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [loading, setLoading] = useState(false);

  const recurrenceOptions = [
    { key: 'none', label: 'No repeat' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  const submit = async () => {
    if (!user?.orgId) {
      Alert.alert('No organization', 'You must be part of an organization to host a meeting.');
      return;
    }
    let scheduled_at = null;
    if (mode === 'scheduled') {
      if (!date || !time) {
        Alert.alert('Pick a date and time');
        return;
      }
      const iso = new Date(`${date}T${time}:00`).toISOString();
      if (Number.isNaN(new Date(iso).getTime())) {
        Alert.alert('Invalid date/time');
        return;
      }
      scheduled_at = iso;
    }

    setLoading(true);
    try {
      const payload = {
        organization_id: user.orgId,
        title: title.trim() || (mode === 'scheduled' ? 'Scheduled Meeting' : 'Quick Meeting'),
        description: description.trim() || undefined,
        meeting_type: mode === 'scheduled' ? 'scheduled' : 'instant',
        scheduled_at,
        passcode: passcode.trim() || undefined,
        settings: {
          video_enabled: enableVideo,
          audio_enabled: enableAudio,
          waiting_room: waitingRoom,
        },
      };
      if (mode === 'scheduled' && recurrence !== 'none') {
        payload.recurrence_rule = recurrence;
      }

      const meeting = await createMeeting(payload);
      const id = meeting?.id || meeting?.meeting?.id;
      if (id) {
        router.replace(`/meetings/${id}`);
      } else {
        Alert.alert('Created', 'Meeting created successfully.');
        router.replace('/meetings');
      }
    } catch (e) {
      Alert.alert('Failed to create', e?.response?.data?.message || e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: mode === 'scheduled' ? 'Schedule Meeting' : 'New Meeting',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontWeight: '700' },
          headerTintColor: t.text,
        }}
      />
      <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          {/* Mode switcher */}
          <View style={[s.modeRow, { backgroundColor: t.surfaceAlt }]}>
            <TouchableOpacity
              style={[s.modeBtn, mode === 'instant' && { backgroundColor: t.surface, ...shadow }]}
              onPress={() => setMode('instant')}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={16} color={mode === 'instant' ? t.accent : t.textTer} />
              <Text style={[s.modeLabel, { color: mode === 'instant' ? t.accent : t.textTer }]}>Instant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, mode === 'scheduled' && { backgroundColor: t.surface, ...shadow }]}
              onPress={() => setMode('scheduled')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={16} color={mode === 'scheduled' ? t.accent : t.textTer} />
              <Text style={[s.modeLabel, { color: mode === 'scheduled' ? t.accent : t.textTer }]}>Scheduled</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={[s.label, { color: t.textSec }]}>Title</Text>
          <TextInput
            style={[s.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
            placeholder={mode === 'scheduled' ? 'Weekly Standup' : 'Quick chat'}
            placeholderTextColor={t.textQuad}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Description */}
          <Text style={[s.label, { color: t.textSec }]}>Description (optional)</Text>
          <TextInput
            style={[s.input, s.textarea, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
            placeholder="Agenda, links, etc."
            placeholderTextColor={t.textQuad}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
          />

          {/* Schedule fields */}
          {mode === 'scheduled' && (
            <>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: t.textSec }]}>Date</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={t.textQuad}
                    value={date}
                    onChangeText={setDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: t.textSec }]}>Time</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
                    placeholder="HH:MM"
                    placeholderTextColor={t.textQuad}
                    value={time}
                    onChangeText={setTime}
                  />
                </View>
              </View>

              <Text style={[s.label, { color: t.textSec }]}>Repeat</Text>
              <View style={s.recurrenceRow}>
                {recurrenceOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      s.chip,
                      { borderColor: t.inputBorder, backgroundColor: recurrence === opt.key ? t.accentBg : 'transparent' },
                    ]}
                    onPress={() => setRecurrence(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: recurrence === opt.key ? t.accent : t.textSec }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Passcode */}
          <Text style={[s.label, { color: t.textSec }]}>Passcode (optional)</Text>
          <TextInput
            style={[s.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.text }]}
            placeholder="Leave blank for no passcode"
            placeholderTextColor={t.textQuad}
            value={passcode}
            onChangeText={setPasscode}
            autoCapitalize="characters"
            maxLength={20}
          />

          {/* Toggles */}
          <View style={[s.toggleCard, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
            <View style={s.toggleRow}>
              <Ionicons name="videocam-outline" size={18} color={t.textSec} />
              <Text style={[s.toggleLabel, { color: t.text }]}>Video</Text>
              <Switch value={enableVideo} onValueChange={setEnableVideo} trackColor={{ true: t.accent }} />
            </View>
            <View style={[s.divider, { backgroundColor: t.borderLight }]} />
            <View style={s.toggleRow}>
              <Ionicons name="mic-outline" size={18} color={t.textSec} />
              <Text style={[s.toggleLabel, { color: t.text }]}>Audio</Text>
              <Switch value={enableAudio} onValueChange={setEnableAudio} trackColor={{ true: t.accent }} />
            </View>
            <View style={[s.divider, { backgroundColor: t.borderLight }]} />
            <View style={s.toggleRow}>
              <Ionicons name="hourglass-outline" size={18} color={t.textSec} />
              <Text style={[s.toggleLabel, { color: t.text }]}>Waiting room</Text>
              <Switch value={waitingRoom} onValueChange={setWaitingRoom} trackColor={{ true: t.accent }} />
            </View>
          </View>
        </ScrollView>

        {/* Submit bar */}
        <View style={[s.submitBar, { backgroundColor: t.surface, borderTopColor: t.borderLight }]}>
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: t.accent, opacity: loading ? 0.6 : 1 }]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={mode === 'scheduled' ? 'calendar' : 'videocam'} size={18} color="#fff" />
                <Text style={s.submitTxt}>{mode === 'scheduled' ? 'Schedule meeting' : 'Start now'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  android: { elevation: 1 },
});

const s = StyleSheet.create({
  container: { flex: 1 },
  modeRow: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  modeLabel: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  row: { flexDirection: 'row', gap: 10 },
  recurrenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  toggleCard: { borderRadius: 12, borderWidth: 1, marginTop: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  toggleLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 14 },
  submitBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, borderTopWidth: 1 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  submitTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
