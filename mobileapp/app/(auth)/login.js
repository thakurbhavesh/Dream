import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, ScrollView, Keyboard, Dimensions, Animated, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import OtpInput from '../../src/components/OtpInput';
import { useToast } from '../../src/components/Toast';
import { login, loginWithOtp, loginBiometric } from '../../src/api/auth';
import { useAuth } from '../../src/store/AuthContext';

const { width: W, height: H } = Dimensions.get('window');
const P = '#ea4c89';
const PD = '#c13584';
const COOL = 30;

export default function LoginScreen() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errors, setErrors] = useState({});

  // Biometric
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasFingerprint, setHasFingerprint] = useState(false);
  const [hasFaceId, setHasFaceId] = useState(false);
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 15, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, damping: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  // Check biometric availability + saved credentials
  useEffect(() => {
    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (compatible && enrolled) {
          setBiometricAvailable(true);
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          setHasFingerprint(types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT));
          setHasFaceId(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) || types.includes(LocalAuthentication.AuthenticationType.IRIS));

          // Check if we have saved credentials
          const savedE = await SecureStore.getItemAsync('biometric_email');
          const savedP = await SecureStore.getItemAsync('biometric_password');
          if (savedE && savedP) {
            setHasSavedCreds(true);
            setSavedEmail(savedE);
          }
        }
      } catch {}
    })();
  }, []);

  // Biometric login — skip OTP since biometric already verified identity
  const handleBiometricLogin = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to TeamChatX',
        cancelLabel: 'Use password',
        disableDeviceFallback: false,
        fallbackLabel: 'Use password',
      });
      if (!result.success) return;

      setLoading(true);
      const savedE = await SecureStore.getItemAsync('biometric_email');
      const savedP = await SecureStore.getItemAsync('biometric_password');
      if (!savedE || !savedP) { toast('No saved credentials', 'error'); setLoading(false); return; }

      // Login with biometric flag — backend skips OTP for biometric-verified devices
      const loginResult = await loginBiometric(savedE, savedP);

      if (loginResult?.otp_required) {
        // Backend still requires OTP — auto-fill saved OTP or show OTP screen
        setEmail(savedE); setPassword(savedP);
        setStep(2); setCooldown(loginResult?.resend_available_in_seconds || COOL); setOtp('');
        toast('OTP verification needed', 'info');
      } else {
        await refreshUser();
        toast('Welcome back!', 'success');
        setTimeout(() => router.replace('/(tabs)/chats'), 100);
      }
    } catch (err) {
      toast(err?.response?.data?.message || 'Login failed', 'error');
    } finally { setLoading(false); }
  }, [refreshUser, toast]);

  // Save credentials after successful login for biometric next time
  const saveCredentialsForBiometric = useCallback(async (e, p) => {
    if (biometricAvailable) {
      try {
        await SecureStore.setItemAsync('biometric_email', e);
        await SecureStore.setItemAsync('biometric_password', p);
      } catch {}
    }
  }, [biometricAvailable]);

  if (cooldown > 0) setTimeout(() => setCooldown(c => c > 0 ? c - 1 : 0), 1000);

  const validate = useCallback(() => {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email.trim())) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Min 6 characters';
    setErrors(e);
    return !Object.keys(e).length;
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result?.otp_required) {
        setStep(2); setCooldown(result?.resend_available_in_seconds || COOL); setOtp('');
        toast('OTP sent to your email', 'success');
      } else {
        await saveCredentialsForBiometric(email.trim().toLowerCase(), password);
        await refreshUser();
        setTimeout(() => router.replace('/(tabs)/chats'), 100);
      }
    } catch (err) {
      toast(err?.response?.data?.message || 'Login failed', 'error');
    } finally { setLoading(false); }
  }, [email, password, validate, refreshUser, toast]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length < 6) return toast('Enter 6-digit code', 'warning');
    Keyboard.dismiss(); setLoading(true);
    try {
      await loginWithOtp(email.trim().toLowerCase(), password, otp);
      await saveCredentialsForBiometric(email.trim().toLowerCase(), password);
      await refreshUser();
      toast('Welcome back!', 'success');
      setTimeout(() => router.replace('/(tabs)/chats'), 300);
    } catch (err) { toast(err?.response?.data?.message || 'Invalid OTP', 'error'); }
    finally { setLoading(false); }
  }, [email, password, otp, refreshUser, toast]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    try {
      const r = await login(email.trim().toLowerCase(), password);
      setCooldown(r?.resend_available_in_seconds || COOL); setOtp('');
      toast('New code sent', 'success');
    } catch { toast('Failed to resend', 'error'); }
  }, [email, password, cooldown, toast]);

  return (
    <View style={z.root}>
      {/* Background decoration */}
      <View style={z.bgCircle1} />
      <View style={z.bgCircle2} />
      <View style={z.bgCircle3} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={z.scroll} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false} bounces={false}>

          {/* Logo — compact */}
          <Animated.View style={[z.logoSection, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
            <View style={z.logoRow}>
              <LinearGradient colors={[P, PD]} style={z.logoGrad}>
                <Ionicons name="chatbubbles" size={22} color="#fff" />
              </LinearGradient>
              <Text style={z.brand}>TeamChatX</Text>
            </View>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[z.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {step === 1 ? (
              <>
                <Text style={z.title}>Welcome back</Text>
                <Text style={z.sub}>Sign in to your workspace</Text>

                {/* Biometric — compact inline */}
                {biometricAvailable && hasSavedCreds && (
                  <View style={z.biometricSection}>
                    <TouchableOpacity style={z.bioBtn} onPress={handleBiometricLogin} activeOpacity={0.7} disabled={loading}>
                      <View style={[z.bioIconCircle, { backgroundColor: Platform.OS === 'ios' && hasFaceId ? '#dbeafe' : '#dcfce7' }]}>
                        <MaterialCommunityIcons
                          name={Platform.OS === 'ios' && hasFaceId ? 'face-recognition' : 'fingerprint'}
                          size={24}
                          color={Platform.OS === 'ios' && hasFaceId ? '#3b82f6' : '#22c55e'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={z.bioLabel}>
                          {Platform.OS === 'ios' && hasFaceId ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
                        </Text>
                        <Text style={z.bioEmail}>{savedEmail}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>

                    <View style={z.divider}>
                      <View style={z.divLineSolid} />
                      <Text style={z.divText}>or use password</Text>
                      <View style={z.divLineSolid} />
                    </View>
                  </View>
                )}

                {/* Email */}
                <View style={[z.field, errors.email && z.fieldErr]}>
                  <Ionicons name="mail-outline" size={16} color={errors.email ? '#ef4444' : '#94a3b8'} />
                  <TextInput style={z.input} placeholder="Email address" placeholderTextColor="#c2c9d6"
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                    value={email} onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: '' })); }} />
                  {email.length > 0 && /\S+@\S+\.\S+/.test(email) && (
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                  )}
                </View>
                {errors.email ? <Text style={z.errText}>{errors.email}</Text> : null}

                {/* Password */}
                <View style={[z.field, errors.password && z.fieldErr, { marginTop: 8 }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={errors.password ? '#ef4444' : '#94a3b8'} />
                  <TextInput style={z.input} placeholder="Password" placeholderTextColor="#c2c9d6"
                    secureTextEntry={!showPass} value={password}
                    onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: '' })); }} />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={10}>
                    <Ionicons name={showPass ? 'eye-off' : 'eye'} size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={z.errText}>{errors.password}</Text> : null}

                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8} style={z.forgotRow}>
                  <Text style={z.forgot}>Forgot password?</Text>
                </TouchableOpacity>

                {/* Sign In Button */}
                <TouchableOpacity activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
                  <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[z.btn, loading && z.btnOff]}>
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <Text style={z.btnText}>Sign In</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Register link */}
                <View style={z.regRow}>
                  <Text style={z.regText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                    <Text style={z.regLink}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* ─── OTP Step ─── */
              <>
                <View style={z.otpHeader}>
                  <View style={z.otpBadge}>
                    <LinearGradient colors={[`${P}20`, `${PD}10`]} style={z.otpBadgeGrad}>
                      <Ionicons name="shield-checkmark" size={30} color={P} />
                    </LinearGradient>
                  </View>
                  <Text style={z.title}>Verification Code</Text>
                  <Text style={[z.sub, { textAlign: 'center' }]}>
                    Code sent to{'\n'}<Text style={{ fontWeight: '800', color: '#0f172a' }}>{email}</Text>
                  </Text>
                </View>

                <View style={{ marginVertical: 24 }}><OtpInput value={otp} onChange={setOtp} /></View>

                <TouchableOpacity activeOpacity={0.85} onPress={handleVerifyOtp} disabled={loading || otp.length < 6}>
                  <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[z.btn, (loading || otp.length < 6) && z.btnOff]}>
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <View style={z.btnInner}>
                        <Text style={z.btnText}>Verify & Sign In</Text>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={z.resendRow}>
                  <Text style={z.subText}>Didn't receive? </Text>
                  {cooldown > 0 ? (
                    <View style={z.coolBadge}><Text style={z.coolText}>{cooldown}s</Text></View>
                  ) : (
                    <TouchableOpacity onPress={handleResend}><Text style={z.linkText}>Resend Code</Text></TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => { setStep(1); setOtp(''); }} style={z.backBtn}>
                  <Ionicons name="arrow-back-circle" size={20} color="#94a3b8" />
                  <Text style={z.backText}>Back to login</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          {/* Footer */}
          <View style={z.footer}>
            <Ionicons name="lock-closed" size={11} color="#cbd5e1" />
            <Text style={z.footerText}>Secured with end-to-end encryption</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const z = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fb' },

  bgCircle1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: `${P}06`, top: -40, right: -30 },
  bgCircle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: `${P}04`, bottom: 60, left: -40 },
  bgCircle3: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: `${P}05`, top: H * 0.4, right: -10 },

  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16, justifyContent: 'center' },

  // Logo — horizontal compact
  logoSection: { alignItems: 'center', marginBottom: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoGrad: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },

  // Card — tighter padding
  card: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20 },
      android: { elevation: 6 },
    }),
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 2 },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 12 },

  // Fields — compact
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e8ecf4', borderRadius: 14,
    paddingHorizontal: 14, height: 48, backgroundColor: '#fafbfe',
  },
  fieldErr: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  input: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },
  errText: { fontSize: 10, color: '#ef4444', marginTop: 3, marginLeft: 4, fontWeight: '500' },
  forgotRow: { alignSelf: 'flex-end', marginTop: 6, marginBottom: -4 },
  forgot: { fontSize: 12, color: P, fontWeight: '700' },

  // Button
  btn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Biometric — single button
  biometricSection: { marginBottom: 10 },
  bioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e8ecf4', backgroundColor: '#fafbfe',
  },
  bioIconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bioLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  bioEmail: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 10 },
  divLineSolid: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },
  divText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  // Register link
  qrBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0' },
  qrText: { fontSize: 14, fontWeight: '700' },
  regRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  regText: { fontSize: 13, color: '#64748b' },
  regLink: { fontSize: 13, color: P, fontWeight: '800' },

  // OTP
  otpHeader: { alignItems: 'center', marginBottom: 8 },
  otpBadge: { marginBottom: 12 },
  otpBadgeGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  subText: { fontSize: 13, color: '#64748b' },
  linkText: { fontSize: 13, color: P, fontWeight: '700' },
  coolBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  coolText: { fontSize: 12, color: '#94a3b8', fontWeight: '800' },
  backBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
  backText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 16 },
  footerText: { fontSize: 10, color: '#cbd5e1', fontWeight: '500' },
});
