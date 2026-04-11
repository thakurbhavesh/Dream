import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import api from '../../src/api/config';
import { useToast } from '../../src/components/Toast';

export default function QRLoginScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    try {
      // QR contains: { qrToken: '...' } or just the token string
      let qrToken = data;
      try { const parsed = JSON.parse(data); qrToken = parsed.qrToken || parsed.token || data; } catch {}

      // Get current user's access token
      const accessToken = await SecureStore.getItemAsync('accessToken');
      if (!accessToken) { toast('Please login first', 'error'); router.back(); return; }

      // Confirm QR login on backend
      const { data: res } = await api.post('/auth/qr/confirm', { qrToken, accessToken });
      if (res?.status === 'success' || res?.ok) {
        toast('Web login authorized!', 'success');
        setTimeout(() => router.back(), 1000);
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

  if (!permission) return <View style={s.root}><ActivityIndicator color="#fff" /></View>;

  if (!permission.granted) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.permWrap}>
          <Ionicons name="camera-outline" size={60} color="#94a3b8" />
          <Text style={s.permTitle}>Camera Permission Required</Text>
          <Text style={s.permSub}>To scan QR code for web login</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={s.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={s.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <CameraView
        style={s.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Header overlay */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Scan QR Code</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Scanner frame overlay */}
      <View style={s.overlay}>
        <View style={s.frameWrap}>
          <View style={s.frame}>
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
          </View>
        </View>
        <Text style={s.hint}>Point camera at QR code on web browser</Text>
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

const FRAME = 240;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frameWrap: { width: FRAME, height: FRAME },
  frame: { width: FRAME, height: FRAME, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#3b82f6', borderWidth: 3 },
  tl: { top: -1, left: -1, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 20 },
  tr: { top: -1, right: -1, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 20 },
  bl: { bottom: -1, left: -1, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 20 },
  br: { bottom: -1, right: -1, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 20 },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginTop: 24, textAlign: 'center' },

  rescanBtn: { position: 'absolute', bottom: 60, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  rescanText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 16 },
  permSub: { fontSize: 14, color: '#94a3b8', marginTop: 6 },
  permBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});
