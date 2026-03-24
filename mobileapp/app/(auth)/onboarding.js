import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const P = '#ea4c89';
const PD = '#c13584';
const isSmall = H < 700;

const COLS = 3;
const GAP = 8;
const PAD = 20;
const CARD_W = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;

const FEATURES = [
  { icon: 'chatbubble-ellipses', label: 'Chat', color: '#3b82f6', bg: '#dbeafe' },
  { icon: 'people', label: 'Groups', color: '#8b5cf6', bg: '#ede9fe' },
  { icon: 'document-text', label: 'Files', color: '#ef4444', bg: '#fee2e2' },
  { icon: 'image', label: 'Media', color: '#14b8a6', bg: '#ccfbf1' },
  { icon: 'mic', label: 'Voice', color: '#f59e0b', bg: '#fef3c7' },
  { icon: 'shield-checkmark', label: 'Secure', color: '#22c55e', bg: '#dcfce7' },
];

export default function OnboardingScreen() {
  const anims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(50)).current;
  const btnScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.stagger(80, anims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true })
      )),
      Animated.parallel([
        Animated.spring(cardSlide, { toValue: 0, tension: 45, friction: 10, useNativeDriver: true }),
        Animated.timing(cardFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.spring(btnScale, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const insets = useSafeAreaInsets();

  return (
    <View style={z.root}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, minHeight: H }}>

        {/* ─── Top Dark Section ─── */}
        <LinearGradient colors={['#050810', '#0c1222', '#111b33']}
          style={[z.top, { paddingTop: insets.top + 12 }]}>

          {/* Glow orbs */}
          <View style={z.glow1} />
          <View style={z.glow2} />

          {/* Header */}
          <View style={z.header}>
            <View style={z.logoShadow}>
              <LinearGradient colors={[P, PD]} style={z.logoBadge}>
                <Ionicons name="chatbubbles" size={15} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={z.logoText}>TeamChatX</Text>
          </View>

          <Text style={z.topTitle}>Everything you need{'\n'}to stay connected</Text>
          <Text style={z.topSub}>The most powerful team communication platform</Text>

          {/* Feature Grid */}
          <View style={z.grid}>
            {FEATURES.map((f, i) => (
              <Animated.View key={f.label}
                style={[z.gridItem, { opacity: anims[i], transform: [{ scale: anims[i] }] }]}>
                <View style={[z.gridIcon, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon} size={isSmall ? 20 : 22} color={f.color} />
                </View>
                <Text style={z.gridLabel}>{f.label}</Text>
              </Animated.View>
            ))}
          </View>
        </LinearGradient>

        {/* ─── Bottom White Card ─── */}
        <Animated.View style={[z.bottom, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
          <View style={[z.bottomInner, { paddingBottom: Math.max(insets.bottom, 24) }]}>

            <Text style={z.heading}>
              Your Team's{'\n'}<Text style={{ color: P }}>Chat Hub</Text>
            </Text>
            <Text style={z.desc}>
              Real-time messaging, file sharing, voice notes and end-to-end encryption — all in one app.
            </Text>

            {/* Trust badges */}
            <View style={z.trustRow}>
              {[
                { icon: 'lock-closed', text: 'Encrypted' },
                { icon: 'shield-checkmark', text: 'GDPR' },
                { icon: 'headset', text: '24/7 Support' },
              ].map(t => (
                <View key={t.text} style={z.trustBadge}>
                  <Ionicons name={t.icon} size={11} color="#22c55e" />
                  <Text style={z.trustText}>{t.text}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(auth)/register')}>
                <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={z.btn}>
                  <Text style={z.btnText}>Get Started</Text>
                  <View style={z.btnArrow}><Ionicons name="arrow-forward" size={16} color={P} /></View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={z.signinRow}>
              <Text style={z.signinText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={z.signinLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const z = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050810' },

  // Top section — NO flex:1, auto height based on content
  top: { paddingHorizontal: PAD, paddingBottom: 40, overflow: 'hidden' },

  // Glow orbs
  glow1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: `${P}08`, top: -40, right: -50 },
  glow2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#3b82f606', bottom: 20, left: -20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: isSmall ? 16 : 22 },
  logoShadow: { shadowColor: P, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  logoBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: -0.3 },

  topTitle: { fontSize: isSmall ? 22 : 26, fontWeight: '900', color: '#fff', lineHeight: isSmall ? 30 : 34, marginBottom: 6 },
  topSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: isSmall ? 16 : 22, fontWeight: '500' },

  // Grid — responsive sizes
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  gridItem: {
    width: CARD_W, paddingVertical: isSmall ? 12 : 16, alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
  },
  gridIcon: { width: isSmall ? 42 : 48, height: isSmall ? 42 : 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Bottom card — overlaps top by 24px
  bottom: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24,
  },
  bottomInner: { paddingHorizontal: 24, paddingTop: 24 },

  heading: { fontSize: isSmall ? 24 : 28, fontWeight: '900', color: '#0f172a', lineHeight: isSmall ? 32 : 36, marginBottom: 8 },
  desc: { fontSize: 14, color: '#64748b', lineHeight: 22, marginBottom: 14 },

  // Trust badges
  trustRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  trustText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },

  // CTA Button
  btn: {
    height: 54, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    ...Platform.select({
      ios: { shadowColor: P, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },

  signinRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  signinText: { fontSize: 14, color: '#94a3b8' },
  signinLink: { fontSize: 14, color: P, fontWeight: '800' },
});
