import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, AppState,
  Platform, TextInput, ActivityIndicator, Keyboard, RefreshControl, Linking,
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
import Avatar from '../../src/components/Avatar';
import { useToast } from '../../src/components/Toast';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import { getMe, changePassword, getTrustedDevices, revokeDevice, logout, logoutAll } from '../../src/api/auth';

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
  const { user, refreshUser, logout: doLogout } = useAuth();
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
      const u = raw?.user || raw;
      const org = raw?.organization || {};
      setProfile({ ...u, company_name: org?.name || '', custom_domain: org?.custom_domain || '', department_name: u?.department_name || '', designation_name: u?.designation_name || '', location_name: u?.location_name || '' });
    } catch {}
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
  const role = p.role_key || p.role_name || 'member';

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
    <SafeAreaView style={[z.root, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={z.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.accent]} />}>

        {/* ─── Profile Header ─── */}
        <View style={[z.profileCard, { backgroundColor: t.card }]}>
          <View style={z.profileTop}>
            <Avatar uri={p.profile_url || p.avatar} name={p.name} size={62} />
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
        </View>

        {/* ─── Profile Info ─── */}
        <Section id="profile" icon="person-outline" label="Profile Info">
          <InfoRow icon="briefcase-outline" label="Department" value={p.department_name} t={t} />
          <InfoRow icon="ribbon-outline" label="Designation" value={p.designation_name} t={t} />
          <InfoRow icon="call-outline" label="Mobile" value={p.mobile || p.phone} t={t} />
          <InfoRow icon="business-outline" label="Company" value={p.company_name} t={t} />
          <InfoRow icon="globe-outline" label="Domain" value={p.custom_domain} t={t} />
          <InfoRow icon="location-outline" label="Location" value={p.location_name} t={t} />
          <InfoRow icon="time-outline" label="Last Login" value={p.last_login_at ? new Date(p.last_login_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null} t={t} />
          <InfoRow icon="earth-outline" label="Timezone" value={p.timezone} t={t} last />
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

        {/* ─── Devices ─── */}
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

        {/* ─── About ─── */}
        <View style={[z.section, { backgroundColor: t.card }]}>
          <View style={z.aboutRow}>
            <Ionicons name="information-circle-outline" size={17} color={t.textTer} />
            <Text style={[z.aboutLabel, { color: t.text }]}>Version</Text>
            <Text style={[z.aboutValue, { color: t.textTer }]}>1.0.0</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: { paddingBottom: 20 },

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
});
