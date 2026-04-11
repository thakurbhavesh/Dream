import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../../src/api/config';
import { useToast } from '../../src/components/Toast';
import { useTheme } from '../../src/store/ThemeContext';

let CameraView, useCameraPermissions;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch { CameraView = null; useCameraPermissions = null; }

const getTimeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LinkedDevicesScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [mode, setMode] = useState('list'); // 'list' | 'scan'
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#fff';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  // Load linked devices
  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const { data } = await api.get('/auth/trusted-devices');
      const list = data?.data?.trusted_devices || data?.data?.devices || data?.data || [];
      setDevices(Array.isArray(list) ? list : []);
    } catch {}
    finally { setLoadingDevices(false); }
  }, []);

  useEffect(() => { loadDevices(); }, []);

  // Revoke device
  const revokeDevice = useCallback((deviceId, name) => {
    Alert.alert('Remove Device', `Remove "${name || 'Unknown'}" from linked devices?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/auth/trusted-devices/${deviceId}/revoke`);
          setDevices(prev => prev.filter(d => d.device_id !== deviceId));
          toast('Device removed', 'success');
        } catch { toast('Failed', 'error'); }
      }},
    ]);
  }, [toast]);

  // QR scan handler
  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    try {
      let qrToken = data;
      try { const parsed = JSON.parse(data); qrToken = parsed.qrToken || parsed.token || data; } catch {}

      // api interceptor auto-attaches Bearer token from SecureStore
      const { data: res } = await api.post('/auth/qr/confirm', { qrToken });
      if (res?.status === 'success' || res?.data?.ok) {
        toast('Web browser linked!', 'success');
        setMode('list');
        loadDevices(); // refresh list
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

  // Scanner mode
  if (mode === 'scan') {
    return (
      <View style={[s.root, { backgroundColor: '#000' }]}>
        {CameraView ? (
          <CameraView style={s.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
        ) : (
          <View style={s.noCam}><Text style={s.noCamText}>Camera not available</Text></View>
        )}

        {/* Header overlay */}
        <View style={[s.scanHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => { setMode('list'); setScanned(false); }} style={s.scanBackBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={s.scanTitle}>Scan QR Code</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Scanner frame */}
        <View style={s.scanOverlay}>
          <View style={s.scanFrame}>
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
          </View>
          <Text style={s.scanHint}>Point camera at QR code on{'\n'}TeamChatX web login page</Text>
          {processing && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
        </View>

        {scanned && !processing && (
          <TouchableOpacity style={s.rescanBtn} onPress={() => setScanned(false)} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={s.rescanText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // List mode
  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Linked Devices</Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(d, i) => String(d.device_id || i)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        refreshing={loadingDevices}
        onRefresh={loadDevices}
        ListHeaderComponent={
          <>
            {/* Link new device button */}
            <TouchableOpacity style={[s.linkBtn, { backgroundColor: `${ACCENT}10`, borderColor: ACCENT }]}
              onPress={() => { setScanned(false); setMode('scan'); }} activeOpacity={0.7}>
              <View style={[s.linkIcon, { backgroundColor: ACCENT }]}>
                <Ionicons name="qr-code" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.linkTitle, { color: textColor }]}>Link a Device</Text>
                <Text style={[s.linkSub, { color: subColor }]}>Scan QR code from web browser to login</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subColor} />
            </TouchableOpacity>

            {/* How it works */}
            <View style={[s.howCard, { backgroundColor: cardBg }]}>
              <Text style={[s.howTitle, { color: textColor }]}>How it works</Text>
              {[
                { step: '1', text: 'Open TeamChatX on your web browser' },
                { step: '2', text: 'Click "Login via QR Code" on the login page' },
                { step: '3', text: 'Tap "Link a Device" above and scan the QR code' },
              ].map((item, i) => (
                <View key={i} style={s.howRow}>
                  <View style={[s.howStep, { backgroundColor: `${ACCENT}15` }]}>
                    <Text style={[s.howStepText, { color: ACCENT }]}>{item.step}</Text>
                  </View>
                  <Text style={[s.howText, { color: subColor }]}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* Devices header */}
            <Text style={[s.sectionTitle, { color: textColor }]}>Active Devices</Text>
          </>
        }
        renderItem={({ item: d, index }) => {
          const isCurrent = index === 0;
          const os = (d.os_name || '').toLowerCase();
          const isAndroid = os.includes('android');
          const isIOS = os.includes('ios') || os.includes('mac');
          const isWindows = os.includes('windows');
          let devIcon = 'monitor', devColor = '#3b82f6';
          if (isAndroid) { devIcon = 'android'; devColor = '#3DDC84'; }
          else if (isIOS) { devIcon = 'apple'; devColor = '#999'; }
          else if (isWindows) { devIcon = 'microsoft-windows'; devColor = '#00A4EF'; }

          return (
            <View style={[s.deviceRow, { backgroundColor: cardBg }]}>
              <View style={[s.deviceIcon, { backgroundColor: `${isCurrent ? '#22c55e' : devColor}12` }]}>
                <MaterialCommunityIcons name={devIcon} size={22} color={isCurrent ? '#22c55e' : devColor} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.deviceNameRow}>
                  <Text style={[s.deviceName, { color: textColor }]}>{d.device_name || 'Unknown Device'}</Text>
                  {isCurrent && <View style={[s.currentBadge, { backgroundColor: '#22c55e15' }]}><Text style={s.currentText}>This device</Text></View>}
                </View>
                <Text style={[s.deviceMeta, { color: subColor }]}>
                  {[d.os_name, d.city, d.country].filter(Boolean).join(' · ')}
                </Text>
                <Text style={[s.deviceTime, { color: subColor }]}>
                  {isCurrent ? 'Active now' : `Last active ${getTimeAgo(d.last_active_at)}`}
                </Text>
              </View>
              {!isCurrent && (
                <TouchableOpacity style={[s.revokeBtn, { backgroundColor: '#ef444412' }]}
                  onPress={() => revokeDevice(d.device_id, d.device_name)} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          loadingDevices ? null : (
            <View style={s.empty}>
              <Ionicons name="phone-portrait-outline" size={44} color={subColor} />
              <Text style={[s.emptyText, { color: subColor }]}>No devices found</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const FRAME = 240;
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  // Link button
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed' },
  linkIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  linkTitle: { fontSize: 16, fontWeight: '800' },
  linkSub: { fontSize: 12, marginTop: 2 },

  // How it works
  howCard: { marginHorizontal: 14, marginTop: 16, padding: 18, borderRadius: 18, elevation: 1 },
  howTitle: { fontSize: 15, fontWeight: '800', marginBottom: 14 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  howStep: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  howStepText: { fontSize: 13, fontWeight: '900' },
  howText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: '800', marginHorizontal: 18, marginTop: 20, marginBottom: 10 },

  // Device row
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginBottom: 8, padding: 16, borderRadius: 16, elevation: 1 },
  deviceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceName: { fontSize: 15, fontWeight: '700' },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  currentText: { fontSize: 9, fontWeight: '800', color: '#22c55e', textTransform: 'uppercase' },
  deviceMeta: { fontSize: 12, marginTop: 3 },
  deviceTime: { fontSize: 11, marginTop: 2 },
  revokeBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 14 },

  // Scanner
  camera: { flex: 1 },
  noCam: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  noCamText: { color: '#fff', fontSize: 16 },
  scanHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
  scanBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: FRAME, height: FRAME, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#3b82f6', borderWidth: 3 },
  tl: { top: -1, left: -1, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 20 },
  tr: { top: -1, right: -1, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 20 },
  bl: { bottom: -1, left: -1, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 20 },
  br: { bottom: -1, right: -1, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 20 },
  scanHint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginTop: 24, textAlign: 'center', lineHeight: 20 },
  rescanBtn: { position: 'absolute', bottom: 60, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  rescanText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
