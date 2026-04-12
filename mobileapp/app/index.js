import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/store/AuthContext';

const { width } = Dimensions.get('window');
const P = '#ea4c89';
const PD = '#c13584';
const RADIUS = Math.min(width * 0.32, 110);
const ICON = 36;
const COUNT = 8;

const ICONS = [
  { name: 'chatbubble-ellipses', color: '#3b82f6', bg: '#dbeafe' },
  { name: 'people', color: '#8b5cf6', bg: '#ede9fe' },
  { name: 'document-text', color: '#ef4444', bg: '#fee2e2' },
  { name: 'image', color: '#14b8a6', bg: '#ccfbf1' },
  { name: 'mic', color: '#f59e0b', bg: '#fef3c7' },
  { name: 'videocam', color: '#ec4899', bg: '#fce7f3' },
  { name: 'lock-closed', color: '#22c55e', bg: '#dcfce7' },
  { name: 'send', color: '#0ea5e9', bg: '#e0f2fe' },
];

export default function Splash() {
  const { user, loading } = useAuth();
  const [done, setDone] = useState(false);

  const ring = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const logoOp = useRef(new Animated.Value(0)).current;
  const iconAn = useRef(ICONS.map(() => new Animated.Value(0))).current;
  const iconOp = useRef(ICONS.map(() => new Animated.Value(0))).current;
  const spin = useRef(new Animated.Value(0)).current;
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(15)).current;
  const tagOp = useRef(new Animated.Value(0)).current;
  const dotsOp = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Spin forever
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true })).start();

    // Sequence 3.5s
    Animated.sequence([
      // Ring
      Animated.spring(ring, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
      // Logo
      Animated.parallel([
        Animated.spring(logo, { toValue: 1, tension: 50, friction: 5, useNativeDriver: true }),
        Animated.timing(logoOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // Icons one by one
      Animated.stagger(100, iconAn.map((a, i) => Animated.parallel([
        Animated.spring(a, { toValue: 1, tension: 65, friction: 6, useNativeDriver: true }),
        Animated.timing(iconOp[i], { toValue: 1, duration: 200, useNativeDriver: true }),
      ]))),
      // Title inside
      Animated.parallel([
        Animated.spring(titleY, { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
        Animated.timing(titleOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.timing(tagOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(dotsOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setDone(true));
  }, []);

  if (done) {
    if (loading) {
      // Show a minimal loading screen instead of white blank
      return (
        <View style={{ flex: 1, backgroundColor: PD, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="chatbubbles" size={40} color="#fff" />
        </View>
      );
    }
    if (user) return <Redirect href="/(tabs)/chats" />;
    return <Redirect href="/(auth)/onboarding" />;
  }

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const ringS = ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const insets = useSafeAreaInsets();
  const BOX = RADIUS * 2 + ICON;

  return (
    <Animated.View style={[z.root, { opacity: fade }]}>
      <LinearGradient colors={[PD, P, '#f9a8d4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={z.grad}>
        <View style={[z.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={z.center}>

            {/* Dashed ring */}
            <Animated.View style={[z.ring, { width: BOX, height: BOX, borderRadius: BOX / 2, opacity: ring, transform: [{ scale: ringS }] }]} />

            {/* Orbiting icons */}
            <Animated.View style={{ width: BOX, height: BOX, position: 'absolute', transform: [{ rotate: rotation }] }}>
              {ICONS.map((ic, i) => {
                const a = (i / COUNT) * Math.PI * 2 - Math.PI / 2;
                const cx = BOX / 2 + Math.cos(a) * RADIUS - ICON / 2;
                const cy = BOX / 2 + Math.sin(a) * RADIUS - ICON / 2;
                return (
                  <Animated.View key={i} style={{
                    position: 'absolute', left: cx, top: cy, width: ICON, height: ICON,
                    opacity: iconOp[i], transform: [{ scale: iconAn[i] }, { rotate: counterRot }],
                  }}>
                    <View style={[z.iconBg, { backgroundColor: ic.bg }]}>
                      <Ionicons name={ic.name} size={16} color={ic.color} />
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>

            {/* Center — mascot only inside ring */}
            <Animated.View style={[z.centerContent, { opacity: logoOp, transform: [{ scale: logo }] }]}>
              <View style={z.logoBg}>
                <Ionicons name="chatbubbles" size={30} color="#fff" />
              </View>
            </Animated.View>
          </View>

          {/* Below circle — Powered by + dots clearly below orbit */}
          <View style={z.below}>
            <Animated.Text style={[z.poweredText, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>Powered by TeamChatX</Animated.Text>
            <Animated.View style={{ opacity: dotsOp, marginTop: 16 }}><Dots /></Animated.View>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function Dots() {
  const d = [useRef(new Animated.Value(0.2)).current, useRef(new Animated.Value(0.2)).current, useRef(new Animated.Value(0.2)).current];
  useEffect(() => {
    d.forEach((a, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 200),
      Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.2, duration: 400, useNativeDriver: true }),
    ])).start());
  }, []);
  return (
    <View style={z.dots}>{d.map((a, i) => <Animated.View key={i} style={[z.dot, { opacity: a, transform: [{ scale: a }] }]} />)}</View>
  );
}

const z = StyleSheet.create({
  root: { flex: 1 },
  grad: { flex: 1 },
  safe: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { width: RADIUS * 2 + ICON + 20, height: RADIUS * 2 + ICON + 20, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' },
  iconBg: {
    width: ICON, height: ICON, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 5 }, android: { elevation: 4 } }),
  },
  centerContent: { position: 'absolute', alignItems: 'center', zIndex: 10 },
  logoBg: {
    width: 62, height: 62, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  below: { alignItems: 'center', marginTop: 28 },
  poweredText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
});
