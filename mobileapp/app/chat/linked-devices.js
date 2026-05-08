import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api/config';
import { useToast } from '../../src/components/Toast';
import { useTheme } from '../../src/store/ThemeContext';

// expo-camera is a native module — load lazily so the screen never crashes
// in Expo Go when the binary isn't present, and so we can show a clear
// fallback UI instead of a black scanner.
let CameraView, useCameraPermissions;
let cameraLoadError = null;
try {
  const c = require('expo-camera');
  CameraView = c.CameraView;
  useCameraPermissions = c.useCameraPermissions;
} catch (err) {
  cameraLoadError = err?.message || 'expo-camera not available';
}

const timeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export default function LinkedDevicesScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [mode, setMode] = useState('list');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Camera permission hook — only call when expo-camera loaded successfully.
  // Calling it conditionally is safe here because the lifetime of the hook
  // is fixed: either the native module exists and we call it once, or it
  // doesn't and we never call it.
  const [permission, requestPermission] = (typeof useCameraPermissions === 'function')
    ? useCameraPermissions()
    : [null, null];

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#fff';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  // Load only QR-linked web sessions
  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/qr/devices');
      const list = data?.data?.devices || data?.devices || [];
      setDevices(Array.isArray(list) ? list : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDevices(); }, []);

  // Logout = delete QR session → web token invalidated
  const logoutDevice = useCallback((qrId, browser) => {
    Alert.alert('Log out', `Log out from ${browser || 'Web Browser'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/auth/qr/devices/${qrId}`);
          setDevices(prev => prev.filter(d => d.qr_id !== qrId));
          toast('Logged out', 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  }, [toast]);

  // Logout all
  const logoutAll = useCallback(() => {
    if (!devices.length) return;
    Alert.alert('Log out all devices', `Log out from ${devices.length} web browser${devices.length > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out All', style: 'destructive', onPress: async () => {
        try {
          for (const d of devices) { await api.delete(`/auth/qr/devices/${d.qr_id}`).catch(() => {}); }
          setDevices([]);
          toast('All devices logged out', 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  }, [devices, toast]);

  // QR scan
  const handleScan = async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    try {
      let qrToken = data;
      try { const p = JSON.parse(data); qrToken = p.qrToken || p.token || data; } catch {}
      const { data: res } = await api.post('/auth/qr/confirm', { qrToken });
      if (res?.status === 'success' || res?.data?.ok) {
        toast('Web browser linked!', 'success');
        setMode('list');
        loadDevices();
      } else {
        toast(res?.message || 'QR expired or invalid', 'error');
        setScanned(false);
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'QR login failed', 'error');
      setScanned(false);
    }
    finally { setProcessing(false); }
  };

  const openLinker = useCallback(async () => {
    setScanned(false);
    if (!CameraView || typeof useCameraPermissions !== 'function') {
      Alert.alert(
        'Scanner unavailable',
        'The QR scanner requires the full app build. If you are using Expo Go, open the EAS development or production build instead.'
      );
      return;
    }
    // Resolve current permission first; ask only if not already granted.
    let granted = permission?.granted;
    if (!granted && requestPermission) {
      const res = await requestPermission();
      granted = res?.granted;
    }
    if (!granted) {
      // Permission denied — bounce user to scan screen anyway so they see
      // the explicit "Open Settings" CTA there.
      setMode('scan');
      return;
    }
    setMode('scan');
  }, [permission?.granted, requestPermission]);

  const openSystemSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => Linking.openSettings?.());
    } else {
      Linking.openSettings?.();
    }
  };

  // ─── Scanner ───
  if (mode === 'scan') {
    const cameraMissing = !CameraView;
    const permissionLoading = !cameraMissing && permission == null;
    const permissionDenied = !cameraMissing && permission && !permission.granted;

    return (
      <View style={[z.root, { backgroundColor: '#000' }]}>
        {cameraMissing ? (
          <View style={[z.camera, z.fallbackBox]}>
            <Ionicons name="alert-circle-outline" size={48} color="#fff" />
            <Text style={z.fallbackTitle}>Scanner unavailable</Text>
            <Text style={z.fallbackBody}>
              {cameraLoadError
                ? 'The camera module failed to load. This screen needs the full EAS build of the app — Expo Go cannot run native camera code.'
                : 'Camera module is missing from this build.'}
            </Text>
          </View>
        ) : permissionLoading ? (
          <View style={[z.camera, z.fallbackBox]}>
            <ActivityIndicator color="#fff" />
            <Text style={[z.fallbackBody, { marginTop: 12 }]}>Requesting camera permission…</Text>
          </View>
        ) : permissionDenied ? (
          <View style={[z.camera, z.fallbackBox]}>
            <Ionicons name="camera-reverse-outline" size={48} color="#fff" />
            <Text style={z.fallbackTitle}>Camera access needed</Text>
            <Text style={z.fallbackBody}>
              We need camera permission to scan the QR code on the web login page.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              {permission?.canAskAgain ? (
                <TouchableOpacity style={z.fallbackBtn} onPress={requestPermission} activeOpacity={0.8}>
                  <Text style={z.fallbackBtnTxt}>Allow camera</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={z.fallbackBtn} onPress={openSystemSettings} activeOpacity={0.8}>
                  <Text style={z.fallbackBtnTxt}>Open Settings</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <CameraView
            style={z.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />
        )}

        <View style={[z.scanHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => { setMode('list'); setScanned(false); }} style={z.scanClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={z.scanTitle}>Scan QR Code</Text>
          <View style={{ width: 44 }} />
        </View>

        {!cameraMissing && permission?.granted && (
          <>
            <View style={z.scanCenter}>
              <View style={z.scanFrame}>
                <View style={[z.c, z.tl]} /><View style={[z.c, z.tr]} />
                <View style={[z.c, z.bl]} /><View style={[z.c, z.br]} />
              </View>
              <Text style={z.scanHint}>Point camera at QR code{'\n'}on web login page</Text>
              {processing && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
            </View>

            {scanned && !processing && (
              <TouchableOpacity style={z.rescanBtn} onPress={() => setScanned(false)}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={z.rescanText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  }

  // ─── List ───
  return (
    <View style={[z.root, { backgroundColor: bg }]}>
      <View style={[z.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={z.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={z.headerTitle}>Linked Devices</Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(d) => d.qr_id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        refreshing={loading}
        onRefresh={loadDevices}
        ListHeaderComponent={
          <>
            {/* Link button */}
            <TouchableOpacity style={[z.linkBtn, { borderColor: ACCENT }]}
              onPress={openLinker} activeOpacity={0.7}>
              <View style={[z.linkIcon, { backgroundColor: ACCENT }]}>
                <Ionicons name="qr-code" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[z.linkTitle, { color: textColor }]}>Link a Device</Text>
                <Text style={[z.linkSub, { color: subColor }]}>Scan QR from web browser</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subColor} />
            </TouchableOpacity>

            {/* How it works */}
            <View style={[z.howCard, { backgroundColor: cardBg }]}>
              <Text style={[z.howTitle, { color: textColor }]}>How it works</Text>
              {['Open TeamChatX on web browser', 'Click "Login via QR Code"', 'Tap "Link a Device" and scan QR'].map((t, i) => (
                <View key={i} style={z.howRow}>
                  <View style={[z.howDot, { backgroundColor: `${ACCENT}15` }]}>
                    <Text style={[z.howNum, { color: ACCENT }]}>{i + 1}</Text>
                  </View>
                  <Text style={[z.howText, { color: subColor }]}>{t}</Text>
                </View>
              ))}
            </View>

            {/* Linked sessions header + logout all */}
            {devices.length > 0 && (
              <View style={z.secHeader}>
                <Text style={[z.secTitle, { color: textColor }]}>Logged in browsers</Text>
                {devices.length > 1 && (
                  <TouchableOpacity onPress={logoutAll} activeOpacity={0.7}>
                    <Text style={z.logoutAll}>Log out all</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        }
        renderItem={({ item: d }) => (
          <View style={[z.devCard, { backgroundColor: cardBg }]}>
            <View style={[z.devIcon, { backgroundColor: isDark ? '#0f172a' : '#eff6ff' }]}>
              <Ionicons name="desktop-outline" size={22} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[z.devName, { color: textColor }]}>{d.browser} — {d.os}</Text>
              <Text style={[z.devMeta, { color: subColor }]}>
                {d.ip_address ? `${d.ip_address} · ` : ''}{timeAgo(d.linked_at)}
              </Text>
            </View>
            <TouchableOpacity style={z.logoutBtn} onPress={() => logoutDevice(d.qr_id, d.browser)} activeOpacity={0.7}>
              <Text style={z.logoutBtnText}>Log out</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={z.empty}>
              <Ionicons name="desktop-outline" size={48} color={subColor} />
              <Text style={[z.emptyTitle, { color: textColor }]}>No linked devices</Text>
              <Text style={[z.emptySub, { color: subColor }]}>Tap "Link a Device" to login on web browser</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const F = 240;
const z = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed' },
  linkIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  linkTitle: { fontSize: 16, fontWeight: '800' },
  linkSub: { fontSize: 12, marginTop: 2 },

  howCard: { marginHorizontal: 14, marginTop: 14, padding: 16, borderRadius: 16, elevation: 1 },
  howTitle: { fontSize: 14, fontWeight: '800', marginBottom: 12 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  howDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  howNum: { fontSize: 12, fontWeight: '900' },
  howText: { flex: 1, fontSize: 13, lineHeight: 18 },

  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginTop: 20, marginBottom: 10 },
  secTitle: { fontSize: 14, fontWeight: '800' },
  logoutAll: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  devCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginBottom: 8, padding: 14, borderRadius: 16, elevation: 1 },
  devIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  devName: { fontSize: 14, fontWeight: '700' },
  devMeta: { fontSize: 12, marginTop: 2 },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#ef444412' },
  logoutBtnText: { fontSize: 12, fontWeight: '800', color: '#ef4444' },

  empty: { alignItems: 'center', paddingTop: 50, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  camera: { flex: 1 },
  scanHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
  scanClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scanCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: F, height: F, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  c: { position: 'absolute', width: 28, height: 28, borderColor: '#3b82f6', borderWidth: 3 },
  tl: { top: -1, left: -1, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 20 },
  tr: { top: -1, right: -1, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 20 },
  bl: { bottom: -1, left: -1, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 20 },
  br: { bottom: -1, right: -1, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 20 },
  scanHint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginTop: 24, textAlign: 'center', lineHeight: 20 },
  rescanBtn: { position: 'absolute', bottom: 60, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  rescanText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  fallbackBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  fallbackTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 6 },
  fallbackBody: { color: 'rgba(255,255,255,0.78)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  fallbackBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24 },
  fallbackBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
