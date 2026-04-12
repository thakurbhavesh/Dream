import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
let RTCView;
try {
  RTCView = require('react-native-webrtc').RTCView;
} catch (e) {
  // Stub for Expo Go
  RTCView = ({ style }) => <View style={style} />;
}
import { router, useLocalSearchParams } from 'expo-router';
import Avatar from '../src/components/Avatar';
import { useCall } from '../src/store/CallContext';

const { width: W, height: H } = Dimensions.get('window');

const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function CallScreen() {
  const { type } = useLocalSearchParams(); // 'audio' | 'video'
  const insets = useSafeAreaInsets();
  const {
    callState, callType, remoteUser,
    localStream, remoteStream, screenStream,
    isMuted, isVideoOff, isSpeaker, callDuration,
    endCall, toggleMute, toggleVideo, toggleSpeaker, flipCamera,
  } = useCall();

  const isVideo = (callType || type) === 'video';
  const ringbackRef = useRef(null);

  // Outgoing ringback sound — plays while waiting for answer
  useEffect(() => {
    let mounted = true;

    const playRingback = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/ringback.wav'),
          { isLooping: true, volume: 0.7, shouldPlay: true }
        );
        if (mounted) {
          ringbackRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (e) {
        console.log('[CallScreen] ringback error:', e.message);
      }
    };

    const stopRingback = async () => {
      if (ringbackRef.current) {
        try {
          await ringbackRef.current.stopAsync();
          await ringbackRef.current.unloadAsync();
        } catch {}
        ringbackRef.current = null;
      }
    };

    if (callState === 'outgoing') {
      playRingback();
    } else {
      stopRingback();
    }

    return () => {
      mounted = false;
      stopRingback();
    };
  }, [callState]);

  // If call ended, go back
  useEffect(() => {
    if (callState === 'idle') {
      if (router.canGoBack()) router.back();
    }
  }, [callState]);

  const statusText = callState === 'outgoing' ? 'Calling...'
    : callState === 'active' ? formatDuration(callDuration)
    : 'Connecting...';

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Screen share (full screen — takes priority) */}
      {screenStream && callState === 'active' ? (
        <>
          <RTCView
            streamURL={screenStream.toURL()}
            style={s.remoteVideo}
            objectFit="contain"
            mirror={false}
          />
          {/* Screen share label */}
          <View style={[s.screenShareBadge, { top: insets.top + 16 }]}>
            <Ionicons name="desktop-outline" size={14} color="#fff" />
            <Text style={s.screenShareText}>{remoteUser?.name} is sharing screen</Text>
          </View>
          {/* Remote video as small PIP when screen sharing */}
          {remoteStream && (
            <View style={[s.localVideo, { top: insets.top + 52, right: 16 }]}>
              <RTCView streamURL={remoteStream.toURL()} style={s.localVideoStream} objectFit="cover" mirror={false} zOrder={1} />
            </View>
          )}
        </>
      ) : isVideo && remoteStream && callState === 'active' ? (
        /* Remote video (full screen background) */
        <RTCView
          streamURL={remoteStream.toURL()}
          style={s.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      ) : (
        <View style={s.audioBg}>
          <View style={s.avatarWrap}>
            <Avatar uri={remoteUser?.avatar} name={remoteUser?.name} size={120} />
          </View>
          <Text style={s.remoteName}>{remoteUser?.name || 'Unknown'}</Text>
          <Text style={s.statusText}>{statusText}</Text>
        </View>
      )}

      {/* Local video (small PIP) */}
      {isVideo && localStream && callState === 'active' && !screenStream && (
        <View style={[s.localVideo, { top: insets.top + 16 }]}>
          <RTCView
            streamURL={localStream.toURL()}
            style={s.localVideoStream}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
          <TouchableOpacity style={s.flipBtn} onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Top info for video call */}
      {isVideo && callState === 'active' && (
        <View style={[s.topInfo, { top: insets.top + 16 }]}>
          <Text style={s.topName}>{remoteUser?.name}</Text>
          <Text style={s.topDuration}>{formatDuration(callDuration)}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={[s.controls, { paddingBottom: insets.bottom + 24 }]}>
        {/* Row 1: Secondary controls */}
        <View style={s.controlRow}>
          {!isVideo && (
            <ControlBtn
              icon={isSpeaker ? 'volume-high' : 'volume-medium'}
              label="Speaker"
              active={isSpeaker}
              onPress={toggleSpeaker}
            />
          )}
          {isVideo && (
            <ControlBtn
              icon={isVideoOff ? 'videocam-off' : 'videocam'}
              label="Camera"
              active={!isVideoOff}
              onPress={toggleVideo}
            />
          )}
          <ControlBtn
            icon={isMuted ? 'mic-off' : 'mic'}
            label="Mute"
            active={!isMuted}
            onPress={toggleMute}
          />
          {isVideo && (
            <ControlBtn
              icon="camera-reverse"
              label="Flip"
              onPress={flipCamera}
            />
          )}
        </View>

        {/* End call button */}
        <TouchableOpacity style={s.endBtn} onPress={endCall} activeOpacity={0.8}>
          <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ControlBtn({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={s.ctrlBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.ctrlIcon, active === false && s.ctrlIconInactive]}>
        <Ionicons name={icon} size={22} color={active === false ? '#333' : '#fff'} />
      </View>
      {label && <Text style={s.ctrlLabel}>{label}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111827' },

  // Audio call background
  audioBg: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarWrap: { marginBottom: 20 },
  remoteName: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  statusText: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },

  // Remote video
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Screen share
  screenShareBadge: { position: 'absolute', left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  screenShareText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Local PIP video
  localVideo: {
    position: 'absolute', right: 16,
    width: 110, height: 160, borderRadius: 14,
    overflow: 'hidden', elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  localVideoStream: { width: '100%', height: '100%' },
  flipBtn: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, padding: 4,
  },

  // Top info (video)
  topInfo: { position: 'absolute', left: 16 },
  topName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topDuration: { fontSize: 13, color: '#d1d5db', marginTop: 2 },

  // Controls
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 16 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 28 },
  ctrlBtn: { alignItems: 'center' },
  ctrlIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  ctrlIconInactive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  ctrlLabel: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  endBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
});
