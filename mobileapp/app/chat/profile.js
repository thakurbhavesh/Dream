import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal, Pressable,
  ActivityIndicator, Image, Linking, Dimensions, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import Avatar from '../../src/components/Avatar';
import { useTheme } from '../../src/store/ThemeContext';
import { useToast } from '../../src/components/Toast';
import { getCachedProfile, cacheProfile } from '../../src/services/cache';
import { useAuth } from '../../src/store/AuthContext';
import api from '../../src/api/config';

const { width: W } = Dimensions.get('window');
// BRAND resolved from theme in component
const BRAND_L = '#fdf2f8';
const IMG_COL = (W - 48 - 4) / 3;

const MEDIA_TABS = [
  { key: 'images', label: 'Images', icon: 'images' },
  { key: 'links', label: 'Links', icon: 'link' },
  { key: 'docs', label: 'Docs', icon: 'document-text' },
];

const EXT_COLORS = { PDF: '#ef4444', DOCX: '#2563eb', DOC: '#2563eb', XLSX: '#22c55e', XLS: '#22c55e', CSV: '#14b8a6', PPTX: '#f59e0b', ZIP: '#8b5cf6', RAR: '#8b5cf6', SQL: '#f97316', CSS: '#06b6d4', JS: '#eab308', JSON: '#64748b', PNG: '#14b8a6', JPG: '#3b82f6', MP4: '#f59e0b', MP3: '#8b5cf6' };

export default function ChatProfileScreen() {
  const { threadId, userId, name, avatar } = useLocalSearchParams();
  const { theme: t, isDark } = useTheme();
  const BRAND = t.accent;
  const BRAND2 = t.accentDark;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [media, setMedia] = useState({ images: [], links: [], docs: [] });
  const [counts, setCounts] = useState({ images: 0, links: 0, docs: 0 });
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // { uri, name, size, date }

  // Global search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);
  const searchInputRef = useRef(null);

  // Load profile — cache first, then API
  useEffect(() => {
    (async () => {
      // 1. Load cached instantly
      const cached = await getCachedProfile(userId);
      if (cached) { setProfile(cached); setLoading(false); }

      // 2. Fetch fresh
      try {
        const { data } = await api.get(`/organization/members/${userId}`);
        const p = data?.data || data;
        setProfile(p);
        cacheProfile(userId, p);
      } catch {
        try {
          const { data } = await api.get(`/users/${userId}`);
          const p = data?.data || data;
          setProfile(p);
          cacheProfile(userId, p);
        } catch {
          if (!cached) setProfile({ name, profile_url: avatar });
        }
      } finally { setLoading(false); }
    })();
  }, [userId]);

  // Load media
  const loadMedia = useCallback(async (i) => {
    setLoadingMedia(true);
    try {
      const { data } = await api.get(`/chat/threads/${threadId}/media`, { params: { type: MEDIA_TABS[i].key, limit: 100 } });
      const r = data?.data || data;
      setMedia(prev => ({ ...prev, [MEDIA_TABS[i].key]: r?.messages || r || [] }));
      const c = r?.counts || {};
      setCounts({ images: c.images || 0, links: c.links || 0, docs: c.docs || 0 });
    } catch {} finally { setLoadingMedia(false); }
  }, [threadId]);

  useEffect(() => { loadMedia(tab); }, [tab, loadMedia]);

  // Global search with debounce
  const handleSearch = useCallback((q) => {
    setSearchQ(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q || q.trim().length < 2) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/chat/search', { params: { q: q.trim(), limit: 50 } });
        const r = data?.data || data;
        setSearchResults(r?.results || r?.messages || r || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  const p = profile || {};
  const cardBg = isDark ? '#1e293b' : '#fff';
  const subBg = isDark ? '#0f172a' : '#f8fafc';
  const curItems = media[MEDIA_TABS[tab].key] || [];

  return (
    <View style={[z.root, { backgroundColor: subBg }]}>
      <StatusBar style="light" />
      {/* ─── Header ─── */}
      <LinearGradient colors={isDark ? ['#1f2c34', '#0f172a'] : [BRAND, BRAND2]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[z.headerGrad, { paddingTop: insets.top + 8 }]}>
        <View style={z.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={z.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={z.headerTitle}>Contact Info</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => { setShowSearch(!showSearch); setSearchQ(''); setSearchResults(null); setTimeout(() => searchInputRef.current?.focus(), 200); }} style={z.backBtn}>
            <Ionicons name={showSearch ? 'close' : 'search'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        {loading ? <ActivityIndicator color="#fff" style={{ marginVertical: 40 }} /> : (
          <View style={z.hero}>
            <View style={z.ring}><Avatar uri={p.profile_url || p.profilePicture || p.avatar || (avatar && avatar !== 'undefined' && avatar !== 'null' && avatar !== '' ? decodeURIComponent(avatar) : null)} name={p.name || name} size={86} /></View>
            <Text style={z.heroName}>{p.name || name}</Text>
            {p.designation_name && <Text style={z.heroSub}>{p.designation_name}</Text>}
          </View>
        )}
      </LinearGradient>

      {/* ─── Search bar ─── */}
      {showSearch && (
        <View style={[z.searchBar, { backgroundColor: cardBg }]}>
          <Ionicons name="search" size={16} color={t.textTer} />
          <TextInput ref={searchInputRef} style={[z.searchInput, { color: t.text }]}
            placeholder="Search across all chats..." placeholderTextColor={t.textTer}
            value={searchQ} onChangeText={handleSearch} autoFocus />
          {searching && <ActivityIndicator size="small" color={BRAND} />}
          {searchQ.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setSearchQ(''); setSearchResults(null); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.textTer} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        style={{ marginTop: showSearch ? 0 : -20 }} keyboardShouldPersistTaps="handled">

        {/* ─── Search Results ─── */}
        {searchResults !== null ? (
          <View style={[z.card, { backgroundColor: cardBg, marginTop: showSearch ? 8 : 0, borderTopLeftRadius: showSearch ? 18 : 24, borderTopRightRadius: showSearch ? 18 : 24 }]}>
            <Text style={[z.secTitle, { color: t.text }]}>
              {searchResults.length > 0 ? `${searchResults.length} result${searchResults.length > 1 ? 's' : ''}` : 'No results found'}
            </Text>
            {searchResults.map((item, i) => {
              const c = item?.content || {};
              const msgText = c?.text || c?.url || c?.code || c?.fileName || '';
              const time = item?.metadata?.sentAt || item?.createdAt || '';
              const isOwn = String(item?.author?.id) === String(user?.id);
              const threadLabel = item?.groupName || item?.author?.name || '';
              return (
                <TouchableOpacity key={item.id || i} style={[z.searchRow, { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                  onPress={() => { const tid = item.threadId || threadId; router.push(`/chat/${tid}?name=${encodeURIComponent(threadLabel)}&avatar=`); }} activeOpacity={0.7}>
                  <Avatar uri={item.author?.avatar} name={item.author?.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <View style={z.searchTop}>
                      <Text style={[z.searchName, { color: t.text }]}>{isOwn ? 'You' : item.author?.name}</Text>
                      {threadLabel && item.groupName && <Text style={[z.searchGroup, { color: BRAND }]}>in {threadLabel}</Text>}
                      <Text style={[z.searchTime, { color: t.textTer }]}>
                        {time ? new Date(time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                      </Text>
                    </View>
                    <Text style={[z.searchMsg, { color: t.textSec }]} numberOfLines={2}>{msgText}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <>
            {/* ─── Quick Actions ─── */}
            {!loading && (
              <View style={[z.card, { backgroundColor: cardBg, marginTop: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                <View style={z.actionsRow}>
                  {[
                    { icon: 'chatbubble', label: 'Message', color: BRAND, onPress: () => router.back() },
                    { icon: 'search', label: 'Search', color: '#f59e0b', onPress: () => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 200); } },
                    { icon: 'notifications-off', label: 'Mute', color: '#8b5cf6', onPress: () => toast('Coming soon', 'info') },
                    { icon: 'flag', label: 'Report', color: '#ef4444', onPress: () => toast('Coming soon', 'info') },
                  ].map(a => (
                    <TouchableOpacity key={a.label} style={z.actionItem} onPress={a.onPress} activeOpacity={0.7}>
                      <View style={[z.actionCircle, { backgroundColor: `${a.color}12` }]}>
                        <Ionicons name={a.icon} size={20} color={a.color} />
                      </View>
                      <Text style={[z.actionLabel, { color: t.textSec }]}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ─── About / Details ─── */}
            {!loading && (p.email || p.mobile || p.department_name) && (
              <View style={[z.card, { backgroundColor: cardBg }]}>
                <Text style={[z.secTitle, { color: t.text }]}>About</Text>
                <InfoItem icon="mail-outline" label="Email" value={p.email} t={t} isDark={isDark} accent={BRAND} />
                <InfoItem icon="call-outline" label="Phone" value={p.mobile} t={t} isDark={isDark} accent={BRAND} />
                <InfoItem icon="briefcase-outline" label="Department" value={p.department_name} t={t} isDark={isDark} accent={BRAND} />
                <InfoItem icon="ribbon-outline" label="Designation" value={p.designation_name} t={t} isDark={isDark} accent={BRAND} />
                <InfoItem icon="location-outline" label="Location" value={p.location_name} t={t} isDark={isDark} accent={BRAND} />
                <InfoItem icon="calendar-outline" label="Joined"
                  value={p.joined_at ? new Date(p.joined_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null}
                  t={t} isDark={isDark} accent={BRAND} last />
              </View>
            )}

            {/* ─── Stats ─── */}
            {!loading && (p.messages_sent || p.groups_count) ? (
              <View style={[z.card, { backgroundColor: cardBg }]}>
                <View style={z.statsGrid}>
                  <StatCard icon="chatbubbles" label="Messages" value={p.messages_sent || 0} color="#3b82f6" isDark={isDark} />
                  <StatCard icon="people" label="Groups" value={p.groups_count || 0} color="#8b5cf6" isDark={isDark} />
                </View>
              </View>
            ) : null}

            {/* ─── Media / Links / Docs ─── */}
            <View style={[z.card, { backgroundColor: cardBg }]}>
              <Text style={[z.secTitle, { color: t.text }]}>Media, Links & Docs</Text>

              {/* Tabs */}
              <View style={[z.tabBar, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}>
                {MEDIA_TABS.map((mt, i) => {
                  const c = counts[mt.key] || 0;
                  const active = tab === i;
                  return (
                    <TouchableOpacity key={mt.key}
                      style={[z.tab, active && [z.tabActive, { backgroundColor: cardBg }]]}
                      onPress={() => setTab(i)} activeOpacity={0.7}>
                      <Ionicons name={active ? mt.icon : `${mt.icon}-outline`} size={15}
                        color={active ? BRAND : t.textTer} />
                      <Text style={[z.tabLabel, { color: active ? BRAND : t.textTer }]}>
                        {mt.label}{c > 0 ? ` · ${c}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Content */}
              {loadingMedia ? (
                <ActivityIndicator color={BRAND} style={{ marginVertical: 30 }} />
              ) : curItems.length === 0 ? (
                <View style={z.emptyMedia}>
                  <View style={[z.emptyCircle, { backgroundColor: isDark ? '#1e293b' : BRAND_L }]}>
                    <Ionicons name={`${MEDIA_TABS[tab].icon}-outline`} size={26} color={isDark ? '#475569' : BRAND} />
                  </View>
                  <Text style={[z.emptyTitle, { color: t.textSec }]}>No {MEDIA_TABS[tab].label.toLowerCase()}</Text>
                  <Text style={[z.emptySub, { color: t.textTer }]}>Shared {MEDIA_TABS[tab].label.toLowerCase()} will appear here</Text>
                </View>
              ) : tab === 0 ? (
                <View style={z.imgGrid}>
                  {curItems.map((item, i) => {
                    const c = item?.content || {};
                    const u = c?.fileUrl || c?.file_url || item?.metadata?.fileUrl || '';
                    const fn = c?.fileName || c?.file_name || 'Image';
                    const fs = c?.fileSize || c?.file_size || '';
                    const date = item?.metadata?.sentAt ? new Date(item.metadata.sentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                    return (
                      <TouchableOpacity key={item.id || i} activeOpacity={0.85}
                        onPress={() => setPreviewImage({ uri: u, name: fn, size: fs, date })}>
                        <Image source={{ uri: u }} style={z.gridImg} resizeMode="cover" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : tab === 1 ? (
                <View>
                  {curItems.map((item, i) => {
                    const lc = item?.content || {};
                    const href = lc?.url || lc?.fileUrl || '';
                    let host = lc?.displayHost || '';
                    if (!host && href) try { host = new URL(href).hostname.replace('www.', ''); } catch {}
                    return (
                      <TouchableOpacity key={item.id || i} style={[z.linkRow, { backgroundColor: isDark ? '#0f172a' : '#fafbfe' }]}
                        onPress={() => href && Linking.openURL(href)} activeOpacity={0.7}>
                        {lc?.thumbnail ? (
                          <Image source={{ uri: lc.thumbnail }} style={z.linkThumb} resizeMode="cover" />
                        ) : (
                          <View style={[z.linkIcon, { backgroundColor: isDark ? '#1e293b' : BRAND_L }]}>
                            <Ionicons name="globe-outline" size={20} color={BRAND} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[z.linkTitle, { color: t.text }]} numberOfLines={2}>{lc?.title || href}</Text>
                          {host ? <Text style={[z.linkHost, { color: BRAND }]}>{host}</Text> : null}
                          <Text style={[z.linkTime, { color: t.textTer }]}>
                            {item?.metadata?.sentAt ? new Date(item.metadata.sentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                          </Text>
                        </View>
                        <Ionicons name="open-outline" size={15} color={t.textTer} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View>
                  {curItems.map((item, i) => {
                    const dc = item?.content || {};
                    const fn = dc?.fileName || dc?.file_name || 'Document';
                    const fs = dc?.fileSize || dc?.file_size || '';
                    const du = dc?.fileUrl || dc?.file_url || '';
                    const ext = (fn.split('.').pop() || '').toUpperCase();
                    const clr = EXT_COLORS[ext] || '#64748b';
                    return (
                      <TouchableOpacity key={item.id || i} style={[z.docRow, { backgroundColor: isDark ? '#0f172a' : '#fafbfe' }]}
                        onPress={() => du && WebBrowser.openBrowserAsync(du)} activeOpacity={0.7}>
                        <View style={[z.docBadge, { backgroundColor: `${clr}12` }]}>
                          <Ionicons name="document-text" size={20} color={clr} />
                          <Text style={[z.docExt, { color: clr }]}>{ext}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[z.docName, { color: t.text }]} numberOfLines={2}>{fn}</Text>
                          <Text style={[z.docMeta, { color: t.textTer }]}>
                            {[fs, item?.metadata?.sentAt ? new Date(item.metadata.sentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <TouchableOpacity style={[z.dlBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                          onPress={() => du && WebBrowser.openBrowserAsync(du)}>
                          <Ionicons name="download-outline" size={16} color={t.textSec} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── Image Preview Modal ─── */}
      {previewImage && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View style={z.pvOverlay}>
            {/* Header */}
            <View style={[z.pvHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setPreviewImage(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={z.pvName} numberOfLines={1}>{previewImage.name}</Text>
                <Text style={z.pvMeta}>{[previewImage.size, previewImage.date].filter(Boolean).join(' · ')}</Text>
              </View>
              <TouchableOpacity onPress={() => previewImage.uri && WebBrowser.openBrowserAsync(previewImage.uri)} hitSlop={10}>
                <Ionicons name="download-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => previewImage.uri && Linking.openURL(previewImage.uri)} hitSlop={10} style={{ marginLeft: 16 }}>
                <Ionicons name="open-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Image */}
            <Pressable style={z.pvBody} onPress={() => setPreviewImage(null)}>
              <Image source={{ uri: previewImage.uri }} style={z.pvImage} resizeMode="contain" />
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Sub components ─────────────────────────────────────────────────────────
function InfoItem({ icon, label, value, t, isDark, accent, last }) {
  if (!value) return null;
  return (
    <View style={[z.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
      <View style={[z.infoIcon, { backgroundColor: isDark ? '#0f172a' : BRAND_L }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[z.infoLabel, { color: t.textTer }]}>{label}</Text>
        <Text style={[z.infoVal, { color: t.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function StatCard({ icon, label, value, color, isDark }) {
  return (
    <View style={[z.statBox, { backgroundColor: isDark ? '#0f172a' : `${color}06` }]}>
      <View style={[z.statIconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[z.statNum, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>{value}</Text>
      <Text style={[z.statLabel, { color: isDark ? '#8696a0' : '#64748b' }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const z = StyleSheet.create({
  root: { flex: 1 },

  // Header — gradient with depth
  headerGrad: { paddingBottom: 44 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, marginBottom: 20 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  // Hero — prominent profile
  hero: { alignItems: 'center', paddingBottom: 12 },
  ring: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10,
  },
  heroName: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 12, letterSpacing: -0.3 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 3, fontWeight: '500' },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 10 },
  roleLabel: { fontSize: 10, fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Search bar — floating pill
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: -10, marginBottom: 4,
    paddingHorizontal: 16, height: 46, borderRadius: 23,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: '500' },

  // Search results
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  searchTop: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  searchName: { fontSize: 13, fontWeight: '800' },
  searchGroup: { fontSize: 11, fontWeight: '600' },
  searchTime: { fontSize: 10, marginLeft: 'auto' },
  searchMsg: { fontSize: 13, lineHeight: 19 },

  // Card — premium elevated
  card: {
    marginHorizontal: 14, marginTop: 12, borderRadius: 20, padding: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },

  // Quick Actions — premium circles
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6 },
  actionItem: { alignItems: 'center', gap: 8 },
  actionCircle: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  actionLabel: { fontSize: 11, fontWeight: '700' },

  // Section
  secTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12, letterSpacing: -0.2 },

  // Info rows — refined spacing
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, minHeight: 52 },
  infoIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  infoVal: { fontSize: 14.5, fontWeight: '500', marginTop: 2 },

  // Stats — premium cards
  statsGrid: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 16, gap: 5 },
  statIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, fontWeight: '600' },

  // Tabs — premium segmented
  tabBar: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 16 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 11 },
  tabActive: { elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  tabLabel: { fontSize: 12.5, fontWeight: '800' },

  // Image grid — clean gaps
  imgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  gridImg: { width: IMG_COL, height: IMG_COL, borderRadius: 8 },

  // Links — premium rows
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, marginBottom: 8 },
  linkThumb: { width: 52, height: 52, borderRadius: 12 },
  linkIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  linkHost: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  linkTime: { fontSize: 10, marginTop: 3, fontWeight: '500' },

  // Docs — premium rows
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, marginBottom: 8 },
  docBadge: { width: 48, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2 },
  docExt: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.4 },
  docName: { fontSize: 14, fontWeight: '700' },
  docMeta: { fontSize: 11, marginTop: 3, fontWeight: '500' },
  dlBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Image preview — full-screen
  pvOverlay: { flex: 1, backgroundColor: '#000' },
  pvHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14, backgroundColor: 'rgba(0,0,0,0.75)' },
  pvName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pvMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  pvBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pvImage: { width: W, height: W * 1.2 },

  // Empty
  emptyMedia: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptySub: { fontSize: 12.5, textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },
});
