import { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/store/AuthContext';
import { useTheme } from '../../../src/store/ThemeContext';
import useMeeting, { isWebrtcAvailable } from '../../../src/hooks/useMeeting';
import { getMeetingById } from '../../../src/api/meetings';

// react-native-webrtc's <RTCView> renders the live stream. Lazy-required so
// Expo Go (no native module) doesn't crash on import.
let RTCView = null;
try { RTCView = require('react-native-webrtc').RTCView; } catch {}

const { width: SCREEN_W } = Dimensions.get('window');

const fmtDuration = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
};

const initialsOf = (name) => {
  const n = String(name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const ParticipantTile = ({ participant, theme: t, isLocal, isPinned, onPin, dimensions }) => {
  const stream = participant?.stream;
  const isVideoOff = !participant?.video;
  const handRaised = !!participant?.handRaised;

  return (
    <View style={[s.tile, dimensions, isPinned && { borderColor: t.accent, borderWidth: 2 }]}>
      {!isVideoOff && stream && RTCView ? (
        <RTCView
          streamURL={stream.toURL ? stream.toURL() : ''}
          style={s.video}
          objectFit="cover"
          mirror={isLocal}
        />
      ) : (
        <View style={[s.placeholder, { backgroundColor: '#0f172a' }]}>
          <View style={[s.avatarFallback, { backgroundColor: '#334155' }]}>
            <Text style={s.avatarTxt}>{initialsOf(participant?.userName || 'You')}</Text>
          </View>
        </View>
      )}

      {/* Overlays */}
      <View style={s.tileOverlay}>
        <View style={s.tileNameRow}>
          <Text style={s.tileName} numberOfLines={1}>
            {isLocal ? 'You' : (participant?.userName || 'Guest')}
          </Text>
          {!participant?.audio && (
            <Ionicons name="mic-off" size={12} color="#fff" style={{ marginLeft: 4 }} />
          )}
        </View>
        {handRaised && (
          <View style={s.handBadge}>
            <Text style={{ fontSize: 14 }}>✋</Text>
          </View>
        )}
      </View>
      {!isLocal && (
        <TouchableOpacity style={s.pinBtn} onPress={onPin} hitSlop={8}>
          <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={14} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function MeetingRoomScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme: t } = useTheme();
  const meeting = useMeeting();
  const insets = useSafeAreaInsets();
  // Bottom controls dock sits ABOVE the home indicator; everything above it
  // (scroll content, reactions feed) needs the same offset so nothing hides
  // behind the dock.
  const controlsBottom = Math.max(insets.bottom, 12);
  const controlsHeight = 68; // ctrlBtn 48 + 10 padding * 2
  const scrollBottomPad = controlsBottom + controlsHeight + 16;
  const [meetingData, setMeetingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const joinedRef = useRef(false);

  const userName = useMemo(() => (
    user?.name || user?.email?.split?.('@')[0] || 'User'
  ), [user]);

  // Load meeting data + auto-join the room
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await getMeetingById(id);
        if (cancelled) return;
        const data = m?.meeting || m;
        setMeetingData(data);
        const roomId = data?.meeting_id || data?.id;
        if (!isWebrtcAvailable()) {
          Alert.alert(
            'Video unavailable',
            'WebRTC is not available in Expo Go. Build the app with EAS to use the meeting room.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }
        if (joinedRef.current) return;
        joinedRef.current = true;
        const res = await meeting.joinMeeting({ meetingRoomId: roomId, meetingData: data, userName });
        if (cancelled) return;
        if (res?.error) {
          Alert.alert('Could not join', String(res.error), [{ text: 'OK', onPress: () => router.back() }]);
        }
      } catch (e) {
        if (!cancelled) Alert.alert('Failed to load meeting', e?.response?.data?.message || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      // Always leave on unmount
      try { meeting.leaveMeeting(); } catch {}
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the screen from sleeping while in a meeting? Skipped — needs expo-keep-awake (already in deps?).

  const isHost = meetingData && Number(meetingData.host_id) === Number(user?.id);
  const allTiles = useMemo(() => {
    const me = {
      socketId: 'self',
      userId: user?.id,
      userName,
      stream: meeting.localStream,
      audio: !meeting.isMuted,
      video: !meeting.isVideoOff,
      handRaised: meeting.handRaised,
      isLocal: true,
    };
    return [me, ...meeting.participants.map((p) => ({ ...p, isLocal: false }))];
  }, [meeting.localStream, meeting.isMuted, meeting.isVideoOff, meeting.handRaised, meeting.participants, user?.id, userName]);

  const pinnedTile = useMemo(() => {
    if (!meeting.pinnedSocketId) return null;
    return allTiles.find((p) => p.socketId === meeting.pinnedSocketId) || null;
  }, [allTiles, meeting.pinnedSocketId]);

  const otherTiles = pinnedTile
    ? allTiles.filter((p) => p.socketId !== pinnedTile.socketId)
    : allTiles;

  // Compute grid tile size
  const gridTileSize = useMemo(() => {
    const n = otherTiles.length;
    if (n <= 1) return { width: SCREEN_W - 16, height: 220 };
    if (n === 2) return { width: SCREEN_W / 2 - 12, height: 220 };
    if (n <= 4) return { width: SCREEN_W / 2 - 12, height: 160 };
    return { width: SCREEN_W / 3 - 10, height: 130 };
  }, [otherTiles.length]);

  const handleLeave = () => {
    Alert.alert('Leave meeting?', 'You can rejoin later with the meeting code.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { meeting.leaveMeeting(); router.back(); } },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: '#0f172a' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 80 }} />
        <Text style={s.loadingTxt}>Joining meeting…</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <SafeAreaView style={[s.container, { backgroundColor: '#0f172a' }]} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {meetingData?.title || 'Meeting'}
            </Text>
            <View style={s.headerMeta}>
              <View style={s.liveDot} />
              <Text style={s.headerTime}>{fmtDuration(meeting.duration)}</Text>
              <Text style={s.headerCount}> · {allTiles.length} participant{allTiles.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.headerBtn} onPress={() => setShowParticipants(true)} hitSlop={8}>
            <Ionicons name="people-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stage: pinned tile (if any) + grid */}
        <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: scrollBottomPad }}>
          {pinnedTile && (
            <ParticipantTile
              participant={pinnedTile}
              theme={t}
              isLocal={pinnedTile.isLocal}
              isPinned
              onPin={() => meeting.pinParticipant(pinnedTile.socketId)}
              dimensions={{ width: SCREEN_W - 16, height: 280, marginBottom: 8 }}
            />
          )}
          <View style={s.grid}>
            {otherTiles.map((p) => (
              <ParticipantTile
                key={p.socketId}
                participant={p}
                theme={t}
                isLocal={p.isLocal}
                isPinned={false}
                onPin={() => !p.isLocal && meeting.pinParticipant(p.socketId)}
                dimensions={gridTileSize}
              />
            ))}
          </View>

          {/* Reactions feed */}
          {meeting.reactions.length > 0 && (
            <View style={s.reactionsBar}>
              {meeting.reactions.slice(-5).map((r) => (
                <Text key={r.id} style={s.reactionItem}>
                  {r.reaction === 'hand-raise' || r.reaction === 'hand-lower' ? '✋' : r.reaction} {r.userName}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Bottom controls */}
        <View style={[s.controls, { bottom: controlsBottom }]}>
          <TouchableOpacity
            style={[s.ctrlBtn, meeting.isMuted ? s.ctrlOff : s.ctrlOn]}
            onPress={meeting.toggleMute}
            activeOpacity={0.8}
          >
            <Ionicons name={meeting.isMuted ? 'mic-off' : 'mic'} size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.ctrlBtn, meeting.isVideoOff ? s.ctrlOff : s.ctrlOn]}
            onPress={meeting.toggleVideo}
            activeOpacity={0.8}
          >
            <Ionicons name={meeting.isVideoOff ? 'videocam-off' : 'videocam'} size={20} color="#fff" />
          </TouchableOpacity>
          {!meeting.isVideoOff && (
            <TouchableOpacity style={[s.ctrlBtn, s.ctrlOn]} onPress={meeting.switchCamera} activeOpacity={0.8}>
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.ctrlBtn, meeting.handRaised ? { backgroundColor: '#f59e0b' } : s.ctrlOn]}
            onPress={meeting.toggleHandRaise}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 18 }}>✋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.ctrlBtn, s.ctrlOn]} onPress={() => setShowChat(true)} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={20} color="#fff" />
            {meeting.chatMessages.length > 0 && (
              <View style={s.badgeDot}>
                <Text style={s.badgeTxt}>{meeting.chatMessages.length > 9 ? '9+' : meeting.chatMessages.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[s.ctrlBtn, s.endBtn]} onPress={handleLeave} activeOpacity={0.85}>
            <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Chat panel */}
        <Modal visible={showChat} animationType="slide" transparent onRequestClose={() => setShowChat(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={s.chatOverlay}
          >
            <View style={[s.chatPanel, { backgroundColor: '#1e293b' }]}>
              <View style={s.chatHeader}>
                <Text style={s.chatTitle}>In-meeting chat</Text>
                <TouchableOpacity onPress={() => setShowChat(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={meeting.chatMessages}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={{ padding: 12 }}
                renderItem={({ item }) => (
                  <View style={s.chatMsg}>
                    <Text style={s.chatMsgAuthor}>{item.userName || 'Guest'}</Text>
                    <Text style={s.chatMsgBody}>{item.message}</Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={[s.chatMsgBody, { textAlign: 'center', marginTop: 40 }]}>
                    No messages yet. Say hi!
                  </Text>
                }
              />
              <View style={s.chatInputRow}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Type a message"
                  placeholderTextColor="#64748b"
                  style={s.chatInput}
                  onSubmitEditing={() => {
                    if (chatInput.trim()) { meeting.sendChatMessage(chatInput); setChatInput(''); }
                  }}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[s.chatSendBtn, { backgroundColor: t.accent }]}
                  onPress={() => {
                    if (chatInput.trim()) { meeting.sendChatMessage(chatInput); setChatInput(''); }
                  }}
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Participants panel */}
        <Modal visible={showParticipants} animationType="slide" transparent onRequestClose={() => setShowParticipants(false)}>
          <View style={s.chatOverlay}>
            <View style={[s.chatPanel, { backgroundColor: '#1e293b' }]}>
              <View style={s.chatHeader}>
                <Text style={s.chatTitle}>Participants ({allTiles.length})</Text>
                <TouchableOpacity onPress={() => setShowParticipants(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={allTiles}
                keyExtractor={(item) => String(item.socketId)}
                contentContainerStyle={{ padding: 12 }}
                renderItem={({ item }) => (
                  <View style={s.participantRow}>
                    <View style={[s.smallAvatar, { backgroundColor: '#334155' }]}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                        {initialsOf(item.userName)}
                      </Text>
                    </View>
                    <Text style={s.participantName} numberOfLines={1}>
                      {item.isLocal ? `${item.userName} (You)` : item.userName}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {!item.audio && <Ionicons name="mic-off" size={14} color="#94a3b8" />}
                      {!item.video && <Ionicons name="videocam-off" size={14} color="#94a3b8" />}
                      {item.handRaised && <Text>✋</Text>}
                    </View>
                    {isHost && !item.isLocal && (
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Remove participant?', `Remove ${item.userName} from the meeting?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => meeting.removeParticipant(item.socketId, item.userId) },
                          ]);
                        }}
                        hitSlop={8}
                        style={{ marginLeft: 8 }}
                      >
                        <Ionicons name="person-remove-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
              {isHost && (
                <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
                  <TouchableOpacity
                    style={[s.muteAllBtn, { backgroundColor: t.accent }]}
                    onPress={() => {
                      meeting.muteAll();
                      setShowParticipants(false);
                    }}
                  >
                    <Ionicons name="mic-off" size={16} color="#fff" />
                    <Text style={s.muteAllTxt}>Mute everyone</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  loadingTxt: { color: '#94a3b8', textAlign: 'center', marginTop: 12, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerTime: { color: '#94a3b8', fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  headerCount: { color: '#64748b', fontSize: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 6 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
  video: { flex: 1, width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarFallback: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tileOverlay: { position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileNameRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tileName: { color: '#fff', fontSize: 11, fontWeight: '600', maxWidth: 100 },
  handBadge: { backgroundColor: 'rgba(245,158,11,0.9)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  pinBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(15,23,42,0.6)', padding: 6, borderRadius: 14 },
  reactionsBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingHorizontal: 8 },
  reactionItem: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  controls: {
    position: 'absolute', left: 12, right: 12, bottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 10, borderRadius: 30, backgroundColor: 'rgba(30,41,59,0.95)',
  },
  ctrlBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ctrlOn: { backgroundColor: '#475569' },
  ctrlOff: { backgroundColor: '#ef4444' },
  endBtn: { backgroundColor: '#dc2626', width: 56, height: 48, borderRadius: 24 },
  badgeDot: { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  chatOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  chatPanel: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', minHeight: 320 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#334155' },
  chatTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  chatMsg: { paddingVertical: 6 },
  chatMsgAuthor: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  chatMsgBody: { color: '#f1f5f9', fontSize: 14, marginTop: 2 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  chatInput: { flex: 1, color: '#fff', backgroundColor: '#0f172a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  chatSendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  participantName: { flex: 1, color: '#f1f5f9', fontSize: 14 },
  muteAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  muteAllTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
