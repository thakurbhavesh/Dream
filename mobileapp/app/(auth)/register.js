import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, ScrollView, Keyboard, Dimensions, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import OtpInput from '../../src/components/OtpInput';
import { useToast } from '../../src/components/Toast';
import { register, verifyOtp, resendOtp } from '../../src/api/auth';

const { height: H } = Dimensions.get('window');
const P = '#ea4c89';
const PD = '#c13584';
const COOL = 30;

export default function RegisterScreen() {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Password strength
  const getPasswordStrength = (p) => {
    if (!p) return { level: 0, label: '', color: '#e2e8f0' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', color: '#ef4444' };
    if (score <= 2) return { level: 2, label: 'Fair', color: '#f59e0b' };
    if (score <= 3) return { level: 3, label: 'Good', color: '#22c55e' };
    return { level: 4, label: 'Strong', color: '#3b82f6' };
  };
  const passStrength = getPasswordStrength(pass);
  const [show, setShow] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [cool, setCool] = useState(0);
  const [err, setErr] = useState({});

  if (cool > 0) setTimeout(() => setCool(c => c > 0 ? c - 1 : 0), 1000);

  const validate = useCallback(() => {
    const e = {};
    if (!company.trim()) e.company = 'Required';
    if (!name.trim()) e.name = 'Required';
    if (!phone.trim()) e.phone = 'Required';
    else if (phone.replace(/\D/g, '').length < 10) e.phone = 'Min 10 digits';
    if (!email.trim()) e.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!pass) e.pass = 'Required';
    else if (pass.length < 8) e.pass = 'Min 8 chars';
    if (!confirm) e.confirm = 'Required';
    else if (pass !== confirm) e.confirm = 'Don\'t match';
    setErr(e);
    return !Object.keys(e).length;
  }, [company, name, email, phone, pass, confirm]);

  const handleRegister = useCallback(async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!termsAccepted) { toast('Please accept Terms & Privacy Policy', 'error'); return; }
    setLoading(true);
    try {
      await register({ companyName: company.trim(), ownerName: name.trim(), email: email.trim().toLowerCase(), phone: phone.replace(/\D/g, ''), password: pass });
      setStep(2); setCool(COOL); setOtp('');
      toast('OTP sent to your email', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setLoading(false); }
  }, [company, name, email, phone, pass, validate, toast]);

  const handleVerify = useCallback(async () => {
    if (otp.length < 6) return toast('Enter 6-digit code', 'warning');
    Keyboard.dismiss(); setLoading(true);
    try {
      await verifyOtp(email.trim().toLowerCase(), otp);
      toast('Account created! Please sign in.', 'success');
      setTimeout(() => router.replace('/(auth)/login'), 800);
    } catch (e) { toast(e?.response?.data?.message || 'Invalid OTP', 'error'); }
    finally { setLoading(false); }
  }, [email, otp, toast]);

  const handleResend = useCallback(async () => {
    if (cool > 0) return;
    try { await resendOtp(email.trim().toLowerCase()); setCool(COOL); setOtp(''); toast('New code sent', 'success'); }
    catch { toast('Resend failed', 'error'); }
  }, [email, cool, toast]);

  return (
    <SafeAreaView style={z.root} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={z.scroll} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false} bounces={false}>

        {/* Header */}
        <View style={z.headerRow}>
          <LinearGradient colors={[P, PD]} style={z.logoGrad}>
            <Ionicons name="people" size={16} color="#fff" />
          </LinearGradient>
          <Text style={z.brand}>TeamChatX</Text>
        </View>

        {/* Card */}
        <View style={z.card}>
          {step === 1 ? (
            <>
              <Text style={z.title}>Create Account</Text>
              <Text style={z.sub}>Set up your team workspace in seconds</Text>

              {/* Company */}
              <View style={[z.field, err.company && z.fieldErr]}>
                <Ionicons name="business-outline" size={16} color={err.company ? '#ef4444' : '#94a3b8'} />
                <TextInput style={z.input} placeholder="Company Name *" placeholderTextColor="#c2c9d6"
                  autoCapitalize="words" value={company} onChangeText={setCompany} />
              </View>
              {err.company ? <Text style={z.errText}>{err.company}</Text> : null}

              {/* Name */}
              <View style={[z.field, err.name && z.fieldErr]}>
                <Ionicons name="person-outline" size={16} color={err.name ? '#ef4444' : '#94a3b8'} />
                <TextInput style={z.input} placeholder="Your Full Name *" placeholderTextColor="#c2c9d6"
                  autoCapitalize="words" value={name} onChangeText={setName} />
              </View>
              {err.name ? <Text style={z.errText}>{err.name}</Text> : null}

              {/* Phone + Email row */}
              <View style={z.row}>
                <View style={{ flex: 1 }}>
                  <View style={[z.field, err.phone && z.fieldErr]}>
                    <Ionicons name="call-outline" size={16} color={err.phone ? '#ef4444' : '#94a3b8'} />
                    <TextInput style={z.input} placeholder="Phone *" placeholderTextColor="#c2c9d6"
                      keyboardType="phone-pad" maxLength={10} value={phone} onChangeText={setPhone} />
                  </View>
                  {err.phone ? <Text style={z.errText}>{err.phone}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[z.field, err.email && z.fieldErr]}>
                    <Ionicons name="mail-outline" size={16} color={err.email ? '#ef4444' : '#94a3b8'} />
                    <TextInput style={z.input} placeholder="Email *" placeholderTextColor="#c2c9d6"
                      keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                  </View>
                  {err.email ? <Text style={z.errText}>{err.email}</Text> : null}
                </View>
              </View>

              {/* Password */}
              <View style={[z.field, err.pass && z.fieldErr]}>
                <Ionicons name="lock-closed-outline" size={16} color={err.pass ? '#ef4444' : '#94a3b8'} />
                <TextInput style={z.input} placeholder="Password (min 8 chars) *" placeholderTextColor="#c2c9d6"
                  secureTextEntry={!show} value={pass} onChangeText={setPass} />
                <TouchableOpacity onPress={() => setShow(!show)} hitSlop={10}>
                  <Ionicons name={show ? 'eye-off' : 'eye'} size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {err.pass ? <Text style={z.errText}>{err.pass}</Text> : null}
              {/* Password strength */}
              {pass.length > 0 && (
                <View style={z.strengthWrap}>
                  <View style={z.strengthBar}>
                    {[1,2,3,4].map(i => (
                      <View key={i} style={[z.strengthSeg, { backgroundColor: i <= passStrength.level ? passStrength.color : '#e2e8f0' }]} />
                    ))}
                  </View>
                  <Text style={[z.strengthLabel, { color: passStrength.color }]}>{passStrength.label}</Text>
                </View>
              )}

              {/* Confirm */}
              <View style={[z.field, err.confirm && z.fieldErr]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={err.confirm ? '#ef4444' : '#94a3b8'} />
                <TextInput style={z.input} placeholder="Confirm Password *" placeholderTextColor="#c2c9d6"
                  secureTextEntry={!show} value={confirm} onChangeText={setConfirm} />
              </View>
              {err.confirm ? <Text style={z.errText}>{err.confirm}</Text> : null}

              {/* Terms */}
              <TouchableOpacity style={z.termsRow} onPress={() => setTermsAccepted(!termsAccepted)} activeOpacity={0.7}>
                <Ionicons name={termsAccepted ? 'checkbox' : 'square-outline'} size={22} color={termsAccepted ? P : '#94a3b8'} />
                <Text style={z.termsText}>I agree to the <Text style={{ color: P, fontWeight: '700' }} onPress={() => router.push('/chat/legal?type=terms')}>Terms</Text> and <Text style={{ color: P, fontWeight: '700' }} onPress={() => router.push('/chat/legal?type=privacy')}>Privacy Policy</Text></Text>
              </TouchableOpacity>

              {/* Button */}
              <TouchableOpacity activeOpacity={0.85} onPress={handleRegister} disabled={loading || !termsAccepted}>
                <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[z.btn, loading && z.btnOff]}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.btnText}>Create Account</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={z.footerRow}>
                <Text style={z.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.back()}><Text style={z.footerLink}>Sign In</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            /* ─── OTP Step ─── */
            <>
              <View style={z.otpHeader}>
                <View style={z.otpBadge}><Ionicons name="mail-open" size={26} color={P} /></View>
                <Text style={z.title}>Verify Email</Text>
                <Text style={z.otpSub}>Code sent to <Text style={{ fontWeight: '700', color: '#0f172a' }}>{email}</Text></Text>
              </View>
              <View style={{ marginVertical: 20 }}><OtpInput value={otp} onChange={setOtp} /></View>
              <TouchableOpacity activeOpacity={0.85} onPress={handleVerify} disabled={loading || otp.length < 6}>
                <LinearGradient colors={[P, PD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[z.btn, (loading || otp.length < 6) && z.btnOff]}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.btnText}>Verify & Continue</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <View style={z.resendRow}>
                <Text style={z.footerText}>Didn't receive? </Text>
                {cool > 0 ? <Text style={z.coolText}>{cool}s</Text> : <TouchableOpacity onPress={handleResend}><Text style={z.footerLink}>Resend</Text></TouchableOpacity>}
              </View>
              <TouchableOpacity onPress={() => setStep(1)} style={z.backRow}>
                <Ionicons name="arrow-back-circle-outline" size={16} color="#94a3b8" />
                <Text style={z.backText}> Edit details</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Secure footer */}
        <View style={z.secureRow}>
          <Ionicons name="lock-closed" size={10} color="#cbd5e1" />
          <Text style={z.secureText}>Secured with end-to-end encryption</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const z = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fb' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20, justifyContent: 'center' },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 },
  logoGrad: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: P, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  brand: { fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: -0.3 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 20, paddingVertical: 22,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.07, shadowRadius: 24 },
      android: { elevation: 6 },
    }),
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 2 },
  sub: { fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 18 },

  // Fields
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e8ecf4', borderRadius: 14,
    paddingHorizontal: 12, height: 48, backgroundColor: '#fafbfe',
    marginTop: 8,
  },
  fieldErr: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  input: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },
  errText: { fontSize: 10, color: '#ef4444', marginTop: 2, marginLeft: 4 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 3 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', width: 50 },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 },
  termsText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 18 },

  // Two-column row
  row: { flexDirection: 'row', gap: 8 },

  // Button
  btn: {
    height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 18,
    ...Platform.select({
      ios: { shadowColor: P, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Footer
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  footerText: { fontSize: 13, color: '#64748b' },
  footerLink: { fontSize: 13, color: P, fontWeight: '800' },

  // OTP
  otpHeader: { alignItems: 'center', marginBottom: 4 },
  otpBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fdf2f8', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  otpSub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  coolText: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
  backRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  backText: { fontSize: 12, color: '#94a3b8' },

  // Secure
  secureRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 18 },
  secureText: { fontSize: 10, color: '#cbd5e1', fontWeight: '500' },
});
