import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import Avatar from './Avatar';

export default function IncomingCall({ callState, callType, remoteUser, onAccept, onReject }) {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef(null);

  const visible = callState === 'incoming';

  // Play/stop ringtone
  useEffect(() => {
    let mounted = true;

    const playRingtone = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/ringtone.wav'),
          { isLooping: true, volume: 1.0, shouldPlay: true }
        );
        if (mounted) {
          soundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (e) {
        console.log('[IncomingCall] ringtone error:', e.message);
      }
    };

    const stopRingtone = async () => {
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
      }
    };

    if (visible) {
      playRingtone();
    } else {
      stopRingtone();
    }

    return () => {
      mounted = false;
      stopRingtone();
    };
  }, [visible]);

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
      // Pulse animation on accept button
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
      // Vibrate
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 500, 300, 500, 300, 500], true);
      } else {
        Vibration.vibrate([500, 300, 500, 300, 500]);
      }
    } else {
      Animated.timing(slideAnim, { toValue: -300, duration: 200, useNativeDriver: true }).start();
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [visible]);

  if (!visible) return null;

  const isVideo = callType === 'video';

  const handleAccept = () => {
    onAccept();
    router.push(`/call?type=${callType}`);
  };

  return (
    <Animated.View style={[s.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={s.card}>
        <View style={s.info}>
          <Avatar uri={remoteUser?.avatar} name={remoteUser?.name} size={52} />
          <View style={s.textWrap}>
            <Text style={s.name} numberOfLines={1}>{remoteUser?.name || 'Unknown'}</Text>
            <Text style={s.type}>
              Incoming {isVideo ? 'video' : 'audio'} call...
            </Text>
          </View>
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={s.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={s.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    paddingHorizontal: 12, paddingTop: 50,
  },
  card: {
    backgroundColor: '#1e293b', borderRadius: 20, padding: 16,
    flexDirection: 'column', gap: 16,
    elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textWrap: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: '#fff' },
  type: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  rejectBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
  },
  acceptBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center',
  },
});
