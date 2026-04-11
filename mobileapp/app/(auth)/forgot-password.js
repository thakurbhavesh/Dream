import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, ScrollView, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import OtpInput from '../../src/components/OtpInput';
import { useToast } from '../../src/components/Toast';
import { forgotPassword, forgotVerify, resetPassword } from '../../src/api/auth';

const P = '#ea4c89';
const PD = '#c13584';
const COOL = 30;

export default function ForgotPasswordScreen() {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cool, setCool] = useState(0);
  const [errors, setErrors] = useState({});

  if (cool > 0) setTimeout(() => setCool(c => c > 0 ? c - 1 : 0), 1000);

  const handleSendOtp = useCallback(async () => {
    if (!email.trim()) { setErrors({ email: 'Email required' }); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setErrors({ email: 'Invalid email' }); return; }
    Keyboard.dismiss(); setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setStep(2); setCool(COOL); setOtp('');
      toast('OTP sent', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  }, [email, toast]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length < 6) return toast('Enter 6-digit code', 'warning');
    Keyboard.dismiss(); setLoading(true);
    try {
      const r = await forgotVerify(email.trim().toLowerCase(), otp);
      setResetToken(r?.reset_token || r?.token || '');
      setStep(3); toast('OTP verified', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Invalid OTP', 'error'); }
    finally { setLoading(false); }
  }, [email, otp, toast]);

  const handleReset = useCallback(async () => {
    const e = {};
    if (newPass.length < 8) e.pass = 'Min 8 characters';
    if (newPass !== confirm) e.confirm = 'Don\'t match';
    if (Object.keys(e).length) { setErrors(e); return; }
    Keyboard.dismiss(); setLoading(true);
    try {
      await resetPassword(resetToken, newPass);
      toast('Password reset!', 'success');
      setTimeout(() => router.replace('/(auth)/login'), 800);
    } catch (e) { toast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  }, [newPass, confirm, resetToken, toast]);

  const handleResend = useCallback(async () => {
    if (cool > 0) return;
    try { await forgotPassword(email.trim().toLowerCase()); setCool(COOL); setOtp(''); toast('New code sent', 'success'); }
    catch { toast('Failed', 'error'); }
  }, [email, cool, toast]);

  const titles = ['Enter Email', 'Verify Code', 'New Password'];
  const subs = ['We\'ll send a verification code', `Code sent to ${email}`, 'Create a strong password'];

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={s.logoSection}>
          <LinearGradient colors={[P, PD]} style={s.logoGrad}><Ionicons name="chatbubbles" size={24} color="#fff" /></LinearGradient>
          <Text style={s.brandText}>TeamChatX</Text>
        </View>

        {/* Steps */}
        <View style={s.stepRow}>
          {[1, 2, 3].map(i => (
            <View key={i} style={s.stepItem}>
              <View style={[s.stepCircle, step >= i && s.stepActive]}>
                <Text style={[s.stepNum, step >= i && s.stepNumActive]}>{i}</Text>
              </View>
              {i < 3 && <View style={[s.stepLine, step > i && s.stepLineActive]} />}
            </View>
          ))}
        </View>

        {/* Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.title}>{titles[step - 1]}</Text>
            <Text style={s.sub}>{subs[step - 1]}</Text>
          </View>

          {step === 1 && (
            <>
              <Text style={s.label}>EMAIL ADDRESS</Text>
              <View style={[s.field, errors.email && s.fieldErr]}>
                <Ionicons name="mail-outline" size={17} color={errors.email ? '#ef4444' : '#94a3b8'} />
                <TextInput style={s.input} placeholder="you@company.com" placeholderTextColor="#c2c9d6"
                  keyboardType="email-address" autoCapitalize="none" value={email}
                  onChangeText={t => { setEmail(t); setErrors({}); }} />
              </View>
              {errors.email ? <Text style={s.errText}>{errors.email}</Text> : null}
              <TouchableOpacity activeOpacity={0.85} onPress={handleSendOtp} disabled={loading}>
                <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btn, loading && s.btnOff]}>
                  {loading ? <ActivityIndicator color="#fff" /> : <View style={s.btnInner}><Text style={s.btnText}>Send Code</Text><Ionicons name="paper-plane" size={16} color="#fff" /></View>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <View style={{ marginVertical: 20 }}><OtpInput value={otp} onChange={setOtp} /></View>
              <TouchableOpacity activeOpacity={0.85} onPress={handleVerifyOtp} disabled={loading || otp.length < 6}>
                <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btn, (loading || otp.length < 6) && s.btnOff]}>
                  {loading ? <ActivityIndicator color="#fff" /> : <View style={s.btnInner}><Text style={s.btnText}>Verify</Text><Ionicons name="checkmark-circle" size={16} color="#fff" /></View>}
                </LinearGradient>
              </TouchableOpacity>
              <View style={s.resendRow}>
                <Text style={s.muted}>Didn't receive? </Text>
                {cool > 0 ? <Text style={s.coolText}>{cool}s</Text> : <TouchableOpacity onPress={handleResend}><Text style={s.link}>Resend</Text></TouchableOpacity>}
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.label}>NEW PASSWORD</Text>
              <View style={[s.field, errors.pass && s.fieldErr]}>
                <Ionicons name="lock-closed-outline" size={17} color={errors.pass ? '#ef4444' : '#94a3b8'} />
                <TextInput style={s.input} placeholder="Min 8 characters" placeholderTextColor="#c2c9d6"
                  secureTextEntry={!show} value={newPass} onChangeText={t => { setNewPass(t); setErrors(e => ({ ...e, pass: '' })); }} />
                <TouchableOpacity onPress={() => setShow(!show)} hitSlop={10}><Ionicons name={show ? 'eye-off' : 'eye'} size={17} color="#94a3b8" /></TouchableOpacity>
              </View>
              {errors.pass ? <Text style={s.errText}>{errors.pass}</Text> : null}

              <Text style={[s.label, { marginTop: 14 }]}>CONFIRM PASSWORD</Text>
              <View style={[s.field, errors.confirm && s.fieldErr]}>
                <Ionicons name="shield-checkmark-outline" size={17} color={errors.confirm ? '#ef4444' : '#94a3b8'} />
                <TextInput style={s.input} placeholder="Re-enter password" placeholderTextColor="#c2c9d6"
                  secureTextEntry={!show} value={confirm} onChangeText={t => { setConfirm(t); setErrors(e => ({ ...e, confirm: '' })); }} />
              </View>
              {errors.confirm ? <Text style={s.errText}>{errors.confirm}</Text> : null}

              <TouchableOpacity activeOpacity={0.85} onPress={handleReset} disabled={loading}>
                <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.btn, loading && s.btnOff]}>
                  {loading ? <ActivityIndicator color="#fff" /> : <View style={s.btnInner}><Text style={s.btnText}>Reset Password</Text><Ionicons name="lock-open" size={16} color="#fff" /></View>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(step - 1)} style={s.backRow}>
          <Ionicons name="arrow-back-circle-outline" size={18} color="#94a3b8" />
          <Text style={{ fontSize: 13, color: '#94a3b8' }}> {step === 1 ? 'Back to Sign In' : 'Go Back'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fafbfe' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 40 },
  logoSection: { alignItems: 'center', marginBottom: 20 },
  logoGrad: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  brandText: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, paddingHorizontal: 40 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  stepActive: { borderColor: P, backgroundColor: '#fdf2f8' },
  stepNum: { fontSize: 12, fontWeight: '800', color: '#cbd5e1' },
  stepNumActive: { color: P },
  stepLine: { width: 36, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: P },
  card: { backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 24, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24 }, android: { elevation: 5 } }), borderWidth: 1, borderColor: '#f1f5f9' },
  cardHeader: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  sub: { fontSize: 13, color: '#64748b' },
  label: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.2, marginBottom: 7, marginTop: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5, borderColor: '#e8ecf4', borderRadius: 16, paddingHorizontal: 15, height: 52, backgroundColor: '#f8fafc' },
  fieldErr: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  input: { flex: 1, fontSize: 15, color: '#0f172a', fontWeight: '500' },
  errText: { fontSize: 11, color: '#ef4444', marginTop: 4, marginLeft: 4 },
  btn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  btnOff: { opacity: 0.45 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  muted: { fontSize: 14, color: '#64748b' },
  coolText: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  link: { fontSize: 14, color: P, fontWeight: '700' },
  backRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
});
