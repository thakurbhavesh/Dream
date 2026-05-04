import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, AppState,
  Platform, TextInput, ActivityIndicator, Keyboard, RefreshControl, Linking, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { AudioModule } from 'expo-audio';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import Avatar from '../../src/components/Avatar';
import { useToast } from '../../src/components/Toast';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import { getMe, changePassword, getTrustedDevices, revokeDevice, logout, logoutAll } from '../../src/api/auth';
import api from '../../src/api/config';

const NOTIFICATION_TONES = [
  { key: 'default', label: 'Default' },
  { key: 'chime', label: 'Chime' },
  { key: 'ping', label: 'Ping' },
  { key: 'bubble', label: 'Bubble' },
  { key: 'bell', label: 'Bell' },
  { key: 'drop', label: 'Drop' },
  { key: 'pop', label: 'Pop' },
  { key: 'ding', label: 'Ding' },
  { key: 'chirp', label: 'Chirp' },
  { key: 'soft', label: 'Soft' },
  { key: 'bright', label: 'Bright' },
  { key: 'knock', label: 'Knock' },
  { key: 'swoosh', label: 'Swoosh' },
  { key: 'crystal', label: 'Crystal' },
  { key: 'ripple', label: 'Ripple' },
  { key: 'alert', label: 'Alert' },
];

const TONE_FILES = {
  chime: require('../../assets/tones/chime.wav'),
  ping: require('../../assets/tones/ping.wav'),
  bubble: require('../../assets/tones/bubble.wav'),
  bell: require('../../assets/tones/bell.wav'),
  drop: require('../../assets/tones/drop.wav'),
  pop: require('../../assets/tones/pop.wav'),
  ding: require('../../assets/tones/ding.wav'),
  chirp: require('../../assets/tones/chirp.wav'),
  soft: require('../../assets/tones/soft.wav'),
  bright: require('../../assets/tones/bright.wav'),
  knock: require('../../assets/tones/knock.wav'),
  swoosh: require('../../assets/tones/swoosh.wav'),
  crystal: require('../../assets/tones/crystal.wav'),
  ripple: require('../../assets/tones/ripple.wav'),
  alert: require('../../assets/tones/alert.wav'),
};

const getTimeAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const PRESET_COLORS = ['#ea4c89', '#2065D1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#0f172a'];
const FONTS_LIST = ['SF Display', 'Poppins', 'Noto Sans', 'Inter', 'Roboto'];
const FONT_SIZES_LIST = ['Small', 'Normal', 'Large'];

export default function ProfileScreen() {
  const { user, refreshUser, logout: doLogout, organizations, orgsLoading, loadOrganizations, switchOrganization } = useAuth();
  const { theme: t, mode, setTheme, isDark, setBrand, setFont, setFontSize, brandColor: currentBrand, fontFamily: currentFont, fontSizeKey: currentFontSize } = useTheme();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null); // which section is expanded

  // Password
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  // Devices
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Customize
  const [hexInput, setHexInput] = useState(currentBrand || '#ea4c89');
  useEffect(() => { setHexInput(currentBrand); }, [currentBrand]);

  // Notification tone
  const [selectedTone, setSelectedTone] = useState('default');
  const [showTonePicker, setShowTonePicker] = useState(false);
  const [playingTone, setPlayingTone] = useState(null);

  // Load saved tone on mount
  useEffect(() => {
    AsyncStorage.getItem('notificationTone').then(v => { if (v) setSelectedTone(v); });
  }, []);

  const previewTone = async (key) => {
    // Stop previous
    if (playingTone) { try { await playingTone.unloadAsync(); } catch {} }
    if (key === 'default') { setPlayingTone(null); return; }
    try {
      const { sound } = await Audio.Sound.createAsync(TONE_FILES[key], { shouldPlay: true, volume: 1.0 });
      setPlayingTone(sound);
      sound.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) { sound.unloadAsync(); setPlayingTone(null); } });
    } catch {}
  };

  const selectTone = async (key) => {
    setSelectedTone(key);
    await AsyncStorage.setItem('notificationTone', key);
    previewTone(key);
    setShowTonePicker(false);
    toast(`Tone set to ${NOTIFICATION_TONES.find(t => t.key === key)?.label}`, 'success');
  };

  // App Lock state
  const [appLockEnabled, setAppLockState] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const { isAppLockEnabled } = require('../../src/components/AppLock');
        setAppLockState(await isAppLockEnabled());
      } catch {}
    })();
  }, []);

  // Custom status
  const STATUS_OPTIONS = [
    { key: 'Available', icon: 'ellipse', color: '#22c55e', label: 'Available' },
    { key: 'Busy', icon: 'ellipse', color: '#ef4444', label: 'Busy' },
    { key: 'Away', icon: 'ellipse', color: '#f59e0b', label: 'Away' },
    { key: 'DND', icon: 'remove-circle', color: '#ef4444', label: 'Do Not Disturb' },
    { key: 'Offline', icon: 'ellipse-outline', color: '#94a3b8', label: 'Appear Offline' },
  ];
  const [myStatus, setMyStatus] = useState('Available');
  const [statusText, setStatusText] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Permissions
  const [perms, setPerms] = useState({});
  const loadPerms = useCallback(async () => {
    const [cam, gal, loc, contact, notif, mic, bioAvail] = await Promise.all([
      ImagePicker.getCameraPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      ImagePicker.getMediaLibraryPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      Location.getForegroundPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      Contacts.getPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' })),
      AudioModule.getRecordingPermissionsAsync().catch(() => ({ granted: false })),
      LocalAuthentication.hasHardwareAsync().catch(() => false),
    ]);
    // Check biometric enrollment
    let bioStatus = 'unavailable';
    if (bioAvail) {
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      bioStatus = enrolled ? 'granted' : 'undetermined';
    }
    setPerms({
      camera: cam.status,
      gallery: gal.status,
      location: loc.status,
      contacts: contact.status,
      notifications: notif.status,
      microphone: mic.granted ? 'granted' : (mic.status || 'undetermined'),
      biometric: bioStatus,
    });
  }, []);
  useEffect(() => { loadPerms(); }, []);
  // Refresh perms when user returns from system settings
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') loadPerms(); });
    return () => sub.remove();
  }, [loadPerms]);

  // Load organizations once user is available so switcher is ready
  useEffect(() => {
    if (user && loadOrganizations) loadOrganizations();
  }, [user, loadOrganizations]);

  const handleSwitchOrg = useCallback(async (orgId) => {
    if (Number(orgId) === Number(user?.orgId)) return;
    await switchOrganization(orgId);
    if (refreshUser) await refreshUser();
    toast?.success?.('Organization switched');
  }, [user?.orgId, switchOrganization, refreshUser, toast]);

  const requestPerm = useCallback(async (type) => {
    try {
      if (type === 'camera') await ImagePicker.requestCameraPermissionsAsync();
      else if (type === 'gallery') await ImagePicker.requestMediaLibraryPermissionsAsync();
      else if (type === 'location') await Location.requestForegroundPermissionsAsync();
      else if (type === 'contacts') await Contacts.requestPermissionsAsync();
      else if (type === 'notifications') await Notifications.requestPermissionsAsync();
      else if (type === 'microphone') await AudioModule.requestRecordingPermissionsAsync();
      else if (type === 'biometric') { Linking.openSettings(); return; }
      else { Linking.openSettings(); return; }
    } catch { Linking.openSettings(); return; }
    loadPerms();
  }, [loadPerms]);

  // Toggle permission — allowed → open settings to revoke, denied → request or open settings
  const togglePerm = useCallback(async (key, currentlyGranted) => {
    if (currentlyGranted) {
      // Can't revoke from app — open system settings
      Linking.openSettings();
    } else {
      // Try requesting, if denied before it'll need settings
      const denied = perms[key] === 'denied';
      if (denied) {
        Linking.openSettings();
      } else {
        await requestPerm(key);
      }
    }
  }, [perms, requestPerm]);

  // Load profile
  const loadProfile = useCallback(async () => {
    try {
      const raw = await getMe();
      // raw = { user, organization, user_role, organization_member, ... }
      const u = raw?.user || raw;
      const org = raw?.organization || {};
      const userRole = raw?.user_role || {};
      const mem = raw?.organization_member || {};
      console.log('[profile] user_role:', JSON.stringify(userRole));
      setProfile({
        ...u,
        company_name: org?.name || '',
        custom_domain: org?.custom_domain || '',
        department_name: mem?.department_name || u?.department_name || '',
        designation_name: mem?.designation_name || u?.designation_name || '',
        location_name: mem?.location_name || u?.location_name || '',
        role_id: userRole.role_id || mem?.role_id || u?.role_id,
        role_key: userRole.role_key || mem?.role_key || u?.role_key,
        role_name: userRole.role_name || mem?.role_name || u?.role_name,
      });
    } catch (e) { console.log('[profile] error:', e?.message); }
  }, []);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const data = await getTrustedDevices();
      const list = data?.trusted_devices || data?.devices || (Array.isArray(data) ? data : []);
      setDevices(Array.isArray(list) ? list : []);
    } catch {} finally { setLoadingDevices(false); }
  }, []);

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => { if (expanded === 'devices') loadDevices(); }, [expanded]);

  const onRefresh = async () => { setRefreshing(true); await loadProfile(); setRefreshing(false); };

  const handleChangePassword = useCallback(async () => {
    if (!oldPass) return toast('Enter old password', 'warning');
    if (newPass.length < 8) return toast('Min 8 characters', 'warning');
    if (newPass !== confirmPass) return toast('Passwords don\'t match', 'error');
    Keyboard.dismiss(); setSaving(true);
    try {
      await changePassword(oldPass, newPass, confirmPass);
      toast('Password changed!', 'success');
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (e) { toast(e?.response?.data?.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  }, [oldPass, newPass, confirmPass]);

  const handleLogout = useCallback(async () => {
    await doLogout(); toast('Logged out', 'info');
    setTimeout(() => router.replace('/(auth)/login'), 300);
  }, [doLogout]);

  const handleLogoutAll = useCallback(async () => {
    await logoutAll(); toast('All devices logged out', 'info');
    setTimeout(() => router.replace('/(auth)/login'), 300);
  }, []);

  const handleRevokeDevice = useCallback(async (id) => {
    try { await revokeDevice(id); toast('Revoked', 'success'); loadDevices(); }
    catch { toast('Failed', 'error'); }
  }, []);

  const toggle = (key) => setExpanded(expanded === key ? null : key);
  const p = profile || user || {};
  // Role — try every possible source
  const ROLE_LABELS = { 1: 'Owner', 2: 'Admin', 3: 'Super Admin', 4: 'User', owner: 'Owner', admin: 'Admin', super_admin: 'Super Admin', users: 'User' };
  const rawRole = p.role_name || p.role_key || profile?.role_name || profile?.role_key || user?.role_name || user?.role_key;
  const role = rawRole || ROLE_LABELS[p.role_id || user?.role_id] || 'Member';

  // Section component
  const Section = ({ id, icon, label, badge, children }) => {
    const isOpen = expanded === id;
    return (
      <View style={[z.section, { backgroundColor: t.card }]}>
        <TouchableOpacity style={z.sectionHeader} onPress={() => toggle(id)} activeOpacity={0.6}>
          <View style={[z.sectionIcon, { backgroundColor: `${t.accent}10` }]}>
            <Ionicons name={icon} size={17} color={t.accent} />
          </View>
          <Text style={[z.sectionLabel, { color: t.text }]}>{label}</Text>
          {badge ? <View style={[z.sectionBadge, { backgroundColor: t.accentBg }]}><Text style={[z.sectionBadgeText, { color: t.accent }]}>{badge}</Text></View> : null}
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={t.textTer} />
        </TouchableOpacity>
        {isOpen && <View style={[z.sectionBody, { borderTopColor: t.divider }]}>{children}</View>}
      </View>
    );
  };

  return (
    <SafeAreaView style={[z.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      {/* ─── Fixed Profile Header ─── */}
      <View style={[z.profileCard, { backgroundColor: t.card }]}>
        <View style={z.profileTop}>
          <TouchableOpacity activeOpacity={0.7} onPress={async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
              if (result.canceled || !result.assets?.[0]) return;
              const asset = result.assets[0];
              const formData = new FormData();
              formData.append('avatar', { uri: asset.uri, name: 'avatar.jpg', type: asset.mimeType || 'image/jpeg' });
              toast('Uploading...', 'info');
              const { data } = await api.post('/upload/profile-picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
              const newUrl = data?.data?.profile_url || data?.data?.url || data?.profile_url;
              if (newUrl) {
                setProfile(prev => ({ ...prev, profile_url: newUrl }));
                toast('Photo updated!', 'success');
                refreshUser();
              } else { toast('Updated', 'success'); }
            } catch (e) { toast(e?.response?.data?.message || 'Upload failed', 'error'); }
          }}>
            <Avatar uri={p.profile_url || p.avatar} name={p.name} size={62} />
            <View style={z.cameraBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={z.profileInfo}>
            <Text style={[z.profileName, { color: t.text }]}>{p.name || 'User'}</Text>
            <Text style={[z.profileEmail, { color: t.textSec }]}>{p.email}</Text>
            <View style={[z.rolePill, { backgroundColor: `${t.accent}12` }]}>
              <Text style={[z.roleText, { color: t.accent }]}>{role}</Text>
            </View>
          </View>
          <TouchableOpacity style={[z.logoutBtn, { backgroundColor: `${t.red}10` }]} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={t.red} />
          </TouchableOpacity>
        </View>
        {/* Status bar */}
        <TouchableOpacity style={[z.statusBar, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: t.divider }]}
          onPress={() => setShowStatusPicker(true)} activeOpacity={0.7}>
          <View style={[z.statusDot, { backgroundColor: STATUS_OPTIONS.find(s => s.key === myStatus)?.color || '#22c55e' }]} />
          <Text style={[z.statusLabel, { color: t.text }]}>{myStatus}</Text>
          {statusText ? <Text style={[z.statusCustom, { color: t.textSec }]} numberOfLines={1}> — {statusText}</Text> : null}
          <Ionicons name="chevron-forward" size={14} color={t.textTer} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={z.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.accent]} />}>

        {/* ═══════════ ADMIN (only for admins) ═══════════ */}
        {(Number(user?.role_id) <= 3 && Number(user?.role_id) >= 1) && (
          <>
            <View style={[z.section, { backgroundColor: t.card, marginTop: 8 }]}>
              <TouchableOpacity style={z.sectionHeader} onPress={() => router.push('/chat/admin')} activeOpacity={0.6}>
                <View style={[z.sectionIcon, { backgroundColor: '#ef444412' }]}>
                  <Ionicons name="shield-checkmark" size={17} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[z.sectionLabel, { color: t.text }]}>Admin Panel</Text>
                  <Text style={{ fontSize: 11, color: t.textTer, marginTop: 1 }}>Users, groups, controls, billing</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.textTer} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ═══════════ ORGANIZATIONS ═══════════ */}
        {organizations.length > 1 && (
          <>
            <Text style={[z.groupLabel, { color: t.textTer }]}>ORGANIZATIONS</Text>
            <View style={[z.section, { backgroundColor: t.card }]}>
              {organizations.map((org, idx) => {
                const active = Number(org.organization_id) === Number(user?.orgId);
                return (
                  <TouchableOpacity
                    key={org.organization_id}
                    style={[z.sectionHeader, idx > 0 && { borderTopWidth: 1, borderTopColor: t.borderLight }]}
                    onPress={() => handleSwitchOrg(org.organization_id)}
                    activeOpacity={0.6}
                    disabled={active}
                  >
                    <View style={[z.sectionIcon, { backgroundColor: active ? t.accentBg : '#94a3b815' }]}>
                      <Ionicons name={active ? 'checkmark-circle' : 'business-outline'} size={17} color={active ? t.accent : t.textTer} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[z.sectionLabel, { color: t.text }]} numberOfLines={1}>{org.org_name || `Org #${org.organization_id}`}</Text>
                      <Text style={{ fontSize: 11, color: t.textTer, marginTop: 1 }} numberOfLines={1}>
                        {org.role_name || org.role_key || 'Member'}{active ? ' · Current' : ''}
                      </Text>
                    </View>
                    {!active && <Ionicons name="swap-horizontal" size={16} color={t.textTer} />}
                  </TouchableOpacity>
                );
              })}
              {orgsLoading && (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={t.accent} />
                </View>
              )}
            </View>
          </>
        )}

        {/* ═══════════ ACCOUNT ═══════════ */}
        <Text style={[z.groupLabel, { color: t.textTer }]}>ACCOUNT</Text>

        <Section id="profile" icon="person-outline" label="Profile Info">
          <InfoRow icon="briefcase-outline" label="Department" value={p.department_name} t={t} />
          <InfoRow icon="ribbon-outline" label="Designation" value={p.designation_name} t={t} />
          <InfoRow icon="call-outline" label="Mobile" value={p.mobile || p.phone} t={t} />
          <InfoRow icon="business-outline" label="Company" value={p.company_name} t={t} />
          <InfoRow icon="location-outline" label="Location" value={p.location_name} t={t} />
          <InfoRow icon="time-outline" label="Last Login" value={p.last_login_at ? new Date(p.last_login_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} t={t} last />
        </Section>

        {/* ─── Change Password ─── */}
        <Section id="password" icon="key-outline" label="Change Password">
          <View style={z.formGroup}>
            <Text style={[z.fieldLabel, { color: t.textTer }]}>OLD PASSWORD</Text>
            <View style={[z.field, { borderColor: t.border, backgroundColor: t.inputBg }]}>
              <Ionicons name="lock-closed-outline" size={16} color={t.icon} />
              <TextInput style={[z.input, { color: t.text }]} placeholder="Current password" placeholderTextColor={t.textTer}
                secureTextEntry={!showPass} value={oldPass} onChangeText={setOldPass} />
            </View>
            <Text style={[z.fieldLabel, { color: t.textTer, marginTop: 12 }]}>NEW PASSWORD</Text>
            <View style={[z.field, { borderColor: t.border, backgroundColor: t.inputBg }]}>
              <Ionicons name="key-outline" size={16} color={t.icon} />
              <TextInput style={[z.input, { color: t.text }]} placeholder="Min 8 characters" placeholderTextColor={t.textTer}
                secureTextEntry={!showPass} value={newPass} onChangeText={setNewPass} />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={10}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={16} color={t.icon} />
              </TouchableOpacity>
            </View>
            <Text style={[z.fieldLabel, { color: t.textTer, marginTop: 12 }]}>CONFIRM PASSWORD</Text>
            <View style={[z.field, { borderColor: t.border, backgroundColor: t.inputBg }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={t.icon} />
              <TextInput style={[z.input, { color: t.text }]} placeholder="Re-enter" placeholderTextColor={t.textTer}
                secureTextEntry={!showPass} value={confirmPass} onChangeText={setConfirmPass} />
            </View>
            <TouchableOpacity style={[z.saveBtn, { backgroundColor: t.accent }]} onPress={handleChangePassword} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={z.saveBtnText}>Save Password</Text>}
            </TouchableOpacity>
          </View>
        </Section>

        {/* ─── Linked Devices ─── */}
        <View style={[z.section, { backgroundColor: t.card }]}>
          <TouchableOpacity style={z.sectionHeader} onPress={() => router.push('/chat/linked-devices')} activeOpacity={0.6}>
            <View style={[z.sectionIcon, { backgroundColor: '#3b82f610' }]}>
              <Ionicons name="qr-code-outline" size={17} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[z.sectionLabel, { color: t.text }]}>Linked Devices</Text>
              <Text style={{ fontSize: 11, color: t.textTer, marginTop: 1 }}>Scan QR to login on web</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textTer} />
          </TouchableOpacity>
        </View>

        {/* ─── Active Devices ─── */}
        <Section id="devices" icon="phone-portrait-outline" label="Active Devices" badge={devices.length > 0 ? String(devices.length) : null}>
          {loadingDevices ? <ActivityIndicator color={t.accent} style={{ marginVertical: 20 }} /> : (
            <>
              {devices.length > 0 && (
                <TouchableOpacity style={[z.logoutAllRow, { backgroundColor: `${t.red}08` }]} onPress={handleLogoutAll} activeOpacity={0.7}>
                  <Ionicons name="log-out-outline" size={14} color={t.red} />
                  <Text style={[z.logoutAllText, { color: t.red }]}>Logout from all devices</Text>
                </TouchableOpacity>
              )}
              {devices.slice(0, 5).map((d, i) => {
                const isCurrent = i === 0;
                const os = (d.os_name || '').toLowerCase();
                const isAndroid = os.includes('android');
                const isIOS = os.includes('ios') || os.includes('mac');
                const isWindows = os.includes('windows');
                let devIcon = 'monitor', devColor = t.blue;
                if (isAndroid) { devIcon = 'android'; devColor = '#3DDC84'; }
                else if (isIOS) { devIcon = 'apple'; devColor = '#999'; }
                else if (isWindows) { devIcon = 'microsoft-windows'; devColor = '#00A4EF'; }
                return (
                  <View key={d.device_id || i} style={[z.deviceRow, { borderBottomColor: t.divider }]}>
                    <View style={[z.deviceIcon, { backgroundColor: `${isCurrent ? t.green : devColor}12` }]}>
                      <MaterialCommunityIcons name={devIcon} size={20} color={isCurrent ? t.green : devColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[z.deviceName, { color: t.text }]}>{d.device_name || 'Unknown'}</Text>
                        {isCurrent && <View style={[z.currentDot, { backgroundColor: t.green }]} />}
                      </View>
                      <Text style={[z.deviceMeta, { color: t.textTer }]}>
                        {[d.os_name, d.city, d.country].filter(Boolean).join(' · ')} · {isCurrent ? 'Active now' : getTimeAgo(d.last_active_at)}
                      </Text>
                    </View>
                    {!isCurrent && (
                      <TouchableOpacity onPress={() => handleRevokeDevice(d.device_id)} style={[z.revokeBtn, { backgroundColor: `${t.red}08` }]}>
                        <Text style={[z.revokeText, { color: t.red }]}>Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {devices.length === 0 && <Text style={[z.emptyText, { color: t.textTer }]}>No active devices</Text>}
            </>
          )}
        </Section>

        {/* ═══════════ APPEARANCE ═══════════ */}
        <Text style={[z.groupLabel, { color: t.textTer }]}>APPEARANCE</Text>

        {/* ─── Appearance ─── */}
        <View style={[z.section, { backgroundColor: t.card }]}>
          <View style={z.sectionHeader}>
            <View style={[z.sectionIcon, { backgroundColor: `${t.accent}10` }]}>
              <Ionicons name="moon-outline" size={17} color={t.accent} />
            </View>
            <Text style={[z.sectionLabel, { color: t.text }]}>Appearance</Text>
          </View>
          <View style={[z.sectionBody, { borderTopColor: t.divider }]}>
            <View style={z.appearRow}>
              <Text style={[z.appearLabel, { color: t.text }]}>Dark Mode</Text>
              <Switch value={isDark} onValueChange={v => setTheme(v ? 'dark' : 'light')}
                trackColor={{ false: '#e2e8f0', true: `${t.accent}50` }} thumbColor={isDark ? t.accent : '#fff'} />
            </View>
            <View style={[z.appearRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.divider }]}>
              <Text style={[z.appearLabel, { color: t.text }]}>Theme</Text>
              <View style={z.themeChips}>
                {['light', 'dark', 'system'].map(m => (
                  <TouchableOpacity key={m} style={[z.themeChip, mode === m && { backgroundColor: `${t.accent}12`, borderColor: t.accent }]}
                    onPress={() => setTheme(m)} activeOpacity={0.7}>
                    <Text style={[z.themeChipText, { color: mode === m ? t.accent : t.textTer }]}>{m[0].toUpperCase() + m.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ─── Customize ─── */}
        <Section id="customize" icon="color-palette-outline" label="Customize">
          {/* Brand Color */}
          <Text style={[z.customLabel, { color: t.textSec }]}>Brand Color</Text>
          <View style={z.colorRow}>
            {PRESET_COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => { setBrand(c); setHexInput(c); }} activeOpacity={0.7}
                style={[z.colorCircle, { backgroundColor: c }, currentBrand === c && z.colorActive]}>
                {currentBrand === c && <Ionicons name="checkmark" size={13} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
          <View style={z.hexRow}>
            <View style={[z.hexPreview, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput) ? hexInput : currentBrand }]} />
            <View style={[z.hexWrap, { borderColor: t.border, backgroundColor: t.inputBg }]}>
              <Text style={[z.hexLabel, { color: t.textTer }]}>HEX</Text>
              <TextInput style={[z.hexInput, { color: t.text }]} value={hexInput} onChangeText={setHexInput}
                placeholder="#ea4c89" placeholderTextColor={t.textTer} maxLength={7} autoCapitalize="characters" />
            </View>
            <TouchableOpacity style={[z.hexApply, { backgroundColor: currentBrand }]}
              onPress={() => { setBrand(hexInput); toast('Applied!', 'success'); }} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Font */}
          <Text style={[z.customLabel, { color: t.textSec, marginTop: 18 }]}>Font</Text>
          <View style={z.fontChips}>
            {FONTS_LIST.map(f => (
              <TouchableOpacity key={f} style={[z.fontChip, currentFont === f && { backgroundColor: `${t.accent}12`, borderColor: t.accent }]}
                onPress={() => setFont(f)} activeOpacity={0.7}>
                <Text style={[z.fontChipText, { color: currentFont === f ? t.accent : t.textSec }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Font Size */}
          <Text style={[z.customLabel, { color: t.textSec, marginTop: 18 }]}>Font Size</Text>
          <View style={z.fontSizeRow}>
            {FONT_SIZES_LIST.map(fs => (
              <TouchableOpacity key={fs} style={[z.fontSizeBtn, currentFontSize === fs && { backgroundColor: `${t.accent}12`, borderColor: t.accent }]}
                onPress={() => setFontSize(fs)} activeOpacity={0.7}>
                <Text style={[z.fontSizeBtnText, { color: currentFontSize === fs ? t.accent : t.textSec, fontSize: fs === 'Small' ? 12 : fs === 'Large' ? 16 : 14 }]}>{fs}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* ═══════════ PRIVACY & SECURITY ═══════════ */}
        <Text style={[z.groupLabel, { color: t.textTer }]}>PRIVACY & SECURITY</Text>

        {/* ─── Notifications ─── */}
        <Section id="notifications" icon="notifications-outline" label="Notifications">
          <View style={z.appearRow}>
            <Text style={[z.appearLabel, { color: t.text }]}>Do Not Disturb</Text>
            <Switch value={false} onValueChange={() => toast('DND scheduling coming soon', 'info')}
              trackColor={{ false: '#e2e8f0', true: `${t.accent}50` }} />
          </View>
          <View style={[z.appearRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.divider }]}>
            <Text style={[z.appearLabel, { color: t.text }]}>Notification Tone</Text>
            <TouchableOpacity onPress={() => setShowTonePicker(true)}>
              <Text style={{ color: t.accent, fontWeight: '700', fontSize: 14 }}>
                {NOTIFICATION_TONES.find(tn => tn.key === selectedTone)?.label || 'Default'}
              </Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ─── Privacy ─── */}
        <Section id="privacy" icon="eye-off-outline" label="Privacy">
          <Text style={[z.permHint, { color: t.textTer }]}>Control who can see your information</Text>
        </Section>

        {/* ─── Permissions ─── */}
        <Section id="permissions" icon="shield-outline" label="Permissions">
          <Text style={[z.permHint, { color: t.textTer }]}>Toggle to allow/disallow. Opens system settings when needed.</Text>
          {[
            { key: 'camera', icon: 'camera-outline', label: 'Camera', desc: 'Take photos & videos' },
            { key: 'gallery', icon: 'images-outline', label: 'Photo Library', desc: 'Share images & videos' },
            { key: 'microphone', icon: 'mic-outline', label: 'Microphone', desc: 'Voice messages' },
            { key: 'location', icon: 'location-outline', label: 'Location', desc: 'Share your location' },
            { key: 'contacts', icon: 'people-outline', label: 'Contacts', desc: 'Share contact info' },
            { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', desc: 'Message alerts' },
            { key: 'biometric', icon: 'finger-print-outline', label: 'Biometric Login', desc: 'Fingerprint / Face unlock' },
          ].map(pm => {
            const ok = perms[pm.key] === 'granted';
            const denied = perms[pm.key] === 'denied';
            const unavail = perms[pm.key] === 'unavailable';
            return (
              <View key={pm.key} style={[z.permRow, { borderBottomColor: t.divider }]}>
                <View style={[z.permIconWrap, { backgroundColor: ok ? `${t.green}15` : unavail ? `${t.textTer}10` : `${t.yellow}15` }]}>
                  <Ionicons name={pm.icon} size={16} color={ok ? t.green : unavail ? t.textTer : t.yellow} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[z.permLabel, { color: unavail ? t.textTer : t.text }]}>{pm.label}</Text>
                  <Text style={[z.permDesc, { color: t.textTer }]}>
                    {unavail ? 'Not available on this device' : pm.desc}
                  </Text>
                </View>
                {!unavail && (
                  <Switch
                    value={ok}
                    onValueChange={() => togglePerm(pm.key, ok)}
                    trackColor={{ false: isDark ? '#334155' : '#e2e8f0', true: `${t.green}60` }}
                    thumbColor={ok ? t.green : (isDark ? '#64748b' : '#cbd5e1')}
                    ios_backgroundColor={isDark ? '#334155' : '#e2e8f0'}
                  />
                )}
              </View>
            );
          })}
        </Section>

        {/* ═══════════ CHAT ═══════════ */}
        <Text style={[z.groupLabel, { color: t.textTer }]}>CHAT</Text>

        {/* ─── Storage & Data ─── */}
        <View style={[z.section, { backgroundColor: t.card }]}>
          <TouchableOpacity style={z.sectionHeader} onPress={() => router.push('/chat/storage')} activeOpacity={0.6}>
            <View style={[z.sectionIcon, { backgroundColor: `${t.accent}10` }]}>
              <Ionicons name="server-outline" size={17} color={t.accent} />
            </View>
            <Text style={[z.sectionLabel, { color: t.text }]}>Storage & Data</Text>
            <Ionicons name="chevron-forward" size={18} color={t.textTer} />
          </TouchableOpacity>
        </View>

        {/* ─── Starred Messages ─── */}
        <View style={[z.section, { backgroundColor: t.card }]}>
          <TouchableOpacity style={z.sectionHeader} onPress={() => router.push('/chat/starred')} activeOpacity={0.6}>
            <View style={[z.sectionIcon, { backgroundColor: '#eab30810' }]}>
              <Ionicons name="star-outline" size={17} color="#eab308" />
            </View>
            <Text style={[z.sectionLabel, { color: t.text }]}>Starred Messages</Text>
            <Ionicons name="chevron-forward" size={18} color={t.textTer} />
          </TouchableOpacity>
        </View>

        {/* ─── Broadcast ─── */}
        <View style={[z.section, { backgroundColor: t.card }]}>
          <TouchableOpacity style={z.sectionHeader} onPress={() => router.push('/chat/broadcast')} activeOpacity={0.6}>
            <View style={[z.sectionIcon, { backgroundColor: '#3b82f610' }]}>
              <Ionicons name="megaphone-outline" size={17} color="#3b82f6" />
            </View>
            <Text style={[z.sectionLabel, { color: t.text }]}>Broadcast Message</Text>
            <Ionicons name="chevron-forward" size={18} color={t.textTer} />
          </TouchableOpacity>
        </View>

        {/* ═══════════ HELP ═══════════ */}
        <Text style={[z.groupLabel, { color: t.textTer }]}>HELP</Text>

        {/* ─── App Guide + AI ─── */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginTop: 8 }}>
          <TouchableOpacity style={[z.quickLink, { backgroundColor: t.card }]}
            onPress={() => router.push('/chat/guide')} activeOpacity={0.6}>
            <View style={[z.quickLinkIcon, { backgroundColor: '#06b6d412' }]}>
              <Ionicons name="book" size={20} color="#06b6d4" />
            </View>
            <Text style={[z.quickLinkTitle, { color: t.text }]}>App Guide</Text>
            <Text style={[z.quickLinkSub, { color: t.textTer }]}>Help & FAQ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[z.quickLink, { backgroundColor: t.card }]}
            onPress={() => router.push('/chat/assistant')} activeOpacity={0.6}>
            <View style={[z.quickLinkIcon, { backgroundColor: `${t.accent}12` }]}>
              <Ionicons name="sparkles" size={20} color={t.accent} />
            </View>
            <Text style={[z.quickLinkTitle, { color: t.text }]}>AI Assistant</Text>
            <Text style={[z.quickLinkSub, { color: t.textTer }]}>Ask anything</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Legal & About ─── */}
        <View style={[z.section, { backgroundColor: t.card }]}>
          <View style={z.aboutRow}>
            <Ionicons name="information-circle-outline" size={17} color={t.textTer} />
            <Text style={[z.aboutLabel, { color: t.text }]}>Version</Text>
            <Text style={[z.aboutValue, { color: t.textTer }]}>1.0.0</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginTop: 8 }}>
          <TouchableOpacity style={[z.legalBtn, { backgroundColor: t.card }]}
            onPress={() => router.push('/chat/legal?type=privacy')} activeOpacity={0.6}>
            <Ionicons name="shield-checkmark" size={20} color="#3b82f6" />
            <Text style={[z.legalBtnText, { color: t.text }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={14} color={t.textTer} />
          </TouchableOpacity>
          <TouchableOpacity style={[z.legalBtn, { backgroundColor: t.card }]}
            onPress={() => router.push('/chat/legal?type=terms')} activeOpacity={0.6}>
            <Ionicons name="document-text" size={20} color="#8b5cf6" />
            <Text style={[z.legalBtnText, { color: t.text }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={14} color={t.textTer} />
          </TouchableOpacity>
        </View>

        {/* ─── Danger Zone ─── */}
        <View style={[z.section, { backgroundColor: t.card, marginTop: 16 }]}>
          <TouchableOpacity style={z.sectionHeader} onPress={() => {
            const { Alert } = require('react-native');
            Alert.alert('Delete Account', 'This will permanently delete your account, all messages, and data. This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete My Account', style: 'destructive', onPress: async () => {
                try {
                  await api.delete('/auth/me');
                  await doLogout();
                  toast('Account deleted', 'info');
                  setTimeout(() => router.replace('/(auth)/login'), 300);
                } catch { toast('Contact support to delete account', 'info'); }
              }},
            ]);
          }} activeOpacity={0.6}>
            <View style={[z.sectionIcon, { backgroundColor: '#ef444412' }]}>
              <Ionicons name="trash-outline" size={17} color="#ef4444" />
            </View>
            <Text style={[z.sectionLabel, { color: '#ef4444' }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Status Picker Modal */}
      {showStatusPicker && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowStatusPicker(false)}>
          <Pressable style={z.statusOverlay} onPress={() => setShowStatusPicker(false)}>
            <View style={[z.statusSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
              <Text style={[z.statusSheetTitle, { color: t.text }]}>Set Your Status</Text>
              {STATUS_OPTIONS.map(s => (
                <TouchableOpacity key={s.key}
                  style={[z.statusOption, myStatus === s.key && { backgroundColor: `${s.color}12` }, { borderBottomColor: t.divider }]}
                  onPress={() => { setMyStatus(s.key); try { const emit = require('../../src/hooks/useSocket').default; } catch {} }}
                  activeOpacity={0.6}>
                  <Ionicons name={s.icon} size={14} color={s.color} />
                  <Text style={[z.statusOptLabel, { color: t.text }]}>{s.label}</Text>
                  {myStatus === s.key && <Ionicons name="checkmark" size={18} color={s.color} />}
                </TouchableOpacity>
              ))}
              <View style={[z.statusTextRow, { borderTopColor: t.divider }]}>
                <TextInput style={[z.statusTextInput, { color: t.text, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}
                  placeholder="What's your status?" placeholderTextColor={t.textTer}
                  value={statusText} onChangeText={setStatusText} maxLength={100} />
              </View>
              <TouchableOpacity style={[z.statusSaveBtn, { backgroundColor: t.accent }]}
                onPress={() => { setShowStatusPicker(false); toast(`Status: ${myStatus}`, 'success'); }} activeOpacity={0.8}>
                <Text style={z.statusSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Tone Picker Modal */}
      {showTonePicker && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowTonePicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowTonePicker(false)}>
            <View style={{ backgroundColor: t.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 16 }} onStartShouldSetResponder={() => true}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.divider }}>
                <Ionicons name="musical-notes" size={20} color={t.accent} />
                <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: t.text, marginLeft: 10 }}>Notification Tone</Text>
                <TouchableOpacity onPress={() => setShowTonePicker(false)}>
                  <Ionicons name="close" size={22} color={t.textSec} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                {NOTIFICATION_TONES.map((tn) => (
                  <TouchableOpacity
                    key={tn.key}
                    onPress={() => selectTone(tn.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
                      borderRadius: 12, marginBottom: 4,
                      backgroundColor: selectedTone === tn.key ? `${t.accent}15` : 'transparent',
                    }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: selectedTone === tn.key ? `${t.accent}20` : `${t.textTer}10`,
                    }}>
                      <Ionicons name={selectedTone === tn.key ? 'volume-high' : 'musical-note'} size={18} color={selectedTone === tn.key ? t.accent : t.textSec} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: selectedTone === tn.key ? '700' : '500', color: selectedTone === tn.key ? t.accent : t.text, marginLeft: 12 }}>
                      {tn.label}
                    </Text>
                    {/* Preview button */}
                    {tn.key !== 'default' && (
                      <TouchableOpacity onPress={() => previewTone(tn.key)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="play-circle" size={24} color={t.textSec} />
                      </TouchableOpacity>
                    )}
                    {selectedTone === tn.key && (
                      <Ionicons name="checkmark-circle" size={22} color={t.accent} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                ))}
                <View style={{ height: 30 }} />
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ─── Sub components ─────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, t, last }) {
  if (!value) return null;
  return (
    <View style={[z.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.divider }]}>
      <Ionicons name={icon} size={15} color={t.textTer} />
      <View style={{ flex: 1 }}>
        <Text style={[z.infoLabel, { color: t.textTer }]}>{label}</Text>
        <Text style={[z.infoValue, { color: t.text }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const z = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 60 },

  // Profile header
  profileCard: {
    paddingHorizontal: 18, paddingVertical: 18, marginBottom: 6,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 19, fontWeight: '800' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 4 },
  roleText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cameraBadge: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Section — expandable
  section: {
    marginHorizontal: 12, marginTop: 8, borderRadius: 16, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6 }, android: { elevation: 1 } }),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800' },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '500', marginTop: 1 },

  // Password form
  formGroup: { paddingTop: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontSize: 14, fontWeight: '500' },
  saveBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Devices
  logoutAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginBottom: 10 },
  logoutAllText: { fontSize: 12, fontWeight: '700' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  deviceIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deviceName: { fontSize: 14, fontWeight: '600' },
  currentDot: { width: 7, height: 7, borderRadius: 3.5 },
  deviceMeta: { fontSize: 11, marginTop: 2 },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  revokeText: { fontSize: 11, fontWeight: '700' },
  emptyText: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },

  // Appearance
  appearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  appearLabel: { fontSize: 14, fontWeight: '500' },
  themeChips: { flexDirection: 'row', gap: 6 },
  themeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  themeChipText: { fontSize: 12, fontWeight: '700' },

  // Customize
  customLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  colorCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  colorActive: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hexPreview: { width: 36, height: 36, borderRadius: 10 },
  hexWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, height: 40, gap: 6 },
  hexLabel: { fontSize: 10, fontWeight: '700' },
  hexInput: { flex: 1, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  hexApply: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fontChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fontChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  fontChipText: { fontSize: 13, fontWeight: '600' },
  fontSizeRow: { flexDirection: 'row', gap: 8 },
  fontSizeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  fontSizeBtnText: { fontWeight: '700' },

  // Permissions
  permHint: { fontSize: 11, marginBottom: 10, lineHeight: 16 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  permIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  permLabel: { fontSize: 14, fontWeight: '600' },
  permDesc: { fontSize: 11, marginTop: 1 },
  permBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  permStatus: { fontSize: 11, fontWeight: '700' },

  // About
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  aboutLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  aboutValue: { fontSize: 13 },

  // Group label
  groupLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginHorizontal: 18, marginTop: 20, marginBottom: 4 },

  // Quick links (Guide + Features)
  quickLink: { flex: 1, alignItems: 'center', padding: 18, borderRadius: 18, elevation: 1, gap: 6 },
  quickLinkIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  quickLinkTitle: { fontSize: 14, fontWeight: '800' },
  quickLinkSub: { fontSize: 11 },

  // Legal buttons
  legalBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, elevation: 1 },
  legalBtnText: { flex: 1, fontSize: 12, fontWeight: '700' },

  // PIN setup
  pinSetupRow: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },

  // Status bar under profile
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 14, fontWeight: '700' },
  statusCustom: { fontSize: 13, flex: 1 },

  // Status picker modal
  statusOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  statusSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 30 },
  statusSheetTitle: { fontSize: 18, fontWeight: '800', paddingHorizontal: 20, marginBottom: 12 },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  statusOptLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  statusTextRow: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  statusTextInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  statusSaveBtn: { marginHorizontal: 20, marginTop: 10, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  statusSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
