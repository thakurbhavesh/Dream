import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Vibration, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCK_KEY = 'app_lock_enabled';
const PIN_KEY = 'app_lock_pin';

export const isAppLockEnabled = async () => {
  const val = await AsyncStorage.getItem(LOCK_KEY);
  return val === 'true';
};

export const setAppLockEnabled = async (enabled, pin) => {
  await AsyncStorage.setItem(LOCK_KEY, enabled ? 'true' : 'false');
  if (pin) await AsyncStorage.setItem(PIN_KEY, pin);
  if (!enabled) await AsyncStorage.removeItem(PIN_KEY);
};

export default function AppLock({ children }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  const unlock = useCallback(async () => {
    // Try biometric first
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHw && enrolled) {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock TeamChatX', cancelLabel: 'Use PIN' });
        if (result.success) { setLocked(false); return; }
      }
    } catch {}
  }, []);

  const checkLock = useCallback(async () => {
    const enabled = await isAppLockEnabled();
    if (enabled) {
      setLocked(true);
      setChecking(false);
      unlock();
    } else {
      setLocked(false);
      setChecking(false);
    }
  }, [unlock]);

  useEffect(() => { checkLock(); }, []);

  // Re-lock when app goes to background and comes back
  useEffect(() => {
    let lastBg = 0;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') lastBg = Date.now();
      if (state === 'active' && lastBg > 0 && Date.now() - lastBg > 30000) { // 30s threshold
        const enabled = await isAppLockEnabled();
        if (enabled) { setLocked(true); setPin(''); unlock(); }
      }
    });
    return () => sub.remove();
  }, [unlock]);

  const handlePinSubmit = useCallback(async () => {
    const savedPin = await AsyncStorage.getItem(PIN_KEY);
    if (pin === savedPin) {
      setLocked(false);
      setPin('');
      setError('');
    } else {
      Vibration.vibrate(100);
      setError('Wrong PIN');
      setPin('');
    }
  }, [pin]);

  if (checking) return null;
  if (!locked) return children;

  return (
    <Modal visible transparent animationType="fade">
      <View style={s.root}>
        <View style={s.iconWrap}>
          <Ionicons name="lock-closed" size={40} color="#fff" />
        </View>
        <Text style={s.title}>TeamChatX Locked</Text>
        <Text style={s.sub}>Enter PIN or use biometric to unlock</Text>

        <View style={s.pinRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[s.pinDot, pin.length > i && s.pinDotFilled]} />
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Number pad */}
        <View style={s.pad}>
          {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ['bio', 0, 'del']].map((row, ri) => (
            <View key={ri} style={s.padRow}>
              {row.map(k => (
                <TouchableOpacity key={k} style={s.padBtn} activeOpacity={0.6}
                  onPress={() => {
                    if (k === 'del') { setPin(p => p.slice(0, -1)); setError(''); }
                    else if (k === 'bio') unlock();
                    else {
                      const next = pin + String(k);
                      setPin(next);
                      if (next.length === 4) { setPin(next); setTimeout(() => { const p = next; AsyncStorage.getItem(PIN_KEY).then(saved => { if (p === saved) { setLocked(false); setPin(''); setError(''); } else { Vibration.vibrate(100); setError('Wrong PIN'); setPin(''); } }); }, 100); }
                    }
                  }}>
                  {k === 'bio' ? <Ionicons name="finger-print" size={28} color="#fff" /> :
                   k === 'del' ? <Ionicons name="backspace-outline" size={24} color="#fff" /> :
                   <Text style={s.padNum}>{k}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 20 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  sub: { fontSize: 14, color: '#94a3b8', marginBottom: 30 },
  pinRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#475569' },
  pinDotFilled: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  error: { color: '#ef4444', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  pad: { marginTop: 20, gap: 12 },
  padRow: { flexDirection: 'row', gap: 24 },
  padBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  padNum: { fontSize: 28, fontWeight: '600', color: '#fff' },
});
