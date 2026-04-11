import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/store/ThemeContext';
import api from '../../src/api/config';

const CATEGORY_ICONS = {
  messaging: { icon: 'chatbubbles', color: '#3b82f6' },
  group: { icon: 'people', color: '#8b5cf6' },
  audio_video: { icon: 'videocam', color: '#f59e0b' },
  collaboration: { icon: 'git-merge', color: '#22c55e' },
  productivity: { icon: 'flash', color: '#06b6d4' },
  filters: { icon: 'funnel', color: '#ec4899' },
  security: { icon: 'shield-checkmark', color: '#ef4444' },
  admin: { icon: 'settings', color: '#64748b' },
  ai_features: { icon: 'sparkles', color: '#a855f7' },
  integrations_cs: { icon: 'extension-puzzle', color: '#14b8a6' },
  automation_cs: { icon: 'cog', color: '#f97316' },
};

const getIcon = (key) => CATEGORY_ICONS[key] || { icon: 'star', color: '#64748b' };

export default function FeaturesScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(null);
  const [search, setSearch] = useState('');

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#f8fafc';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/product-features/catalog?status=active');
        const rows = data?.data || data || [];
        const cats = rows
          .filter(c => c.status !== 'inactive')
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          .map(c => ({
            id: c.feature_category_id,
            key: c.category_key,
            label: (c.category_label || '').replace(/\s*\(coming soon\)\s*/i, ''),
            comingSoon: (c.category_key || '').endsWith('_cs') || (c.category_label || '').toLowerCase().includes('coming soon'),
            items: (c.items || [])
              .filter(i => i.status !== 'inactive')
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
          }));
        setCategories(cats);
        if (cats.length) setActiveTab(cats[0].id);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const activeCategory = categories.find(c => c.id === activeTab);
  const totalFeatures = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Features</Text>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeText}>{totalFeatures}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
        <>
          {/* Category tabs — horizontal scroll */}
          <View style={[s.tabWrap, { backgroundColor: isDark ? '#1f2c34' : '#fff' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScroll}>
              {categories.map(cat => {
                const { icon, color } = getIcon(cat.key);
                const active = activeTab === cat.id;
                return (
                  <TouchableOpacity key={cat.id}
                    style={[s.tabChip, active && { backgroundColor: `${color}15`, borderColor: color }]}
                    onPress={() => setActiveTab(cat.id)} activeOpacity={0.7}>
                    <Ionicons name={icon} size={14} color={active ? color : subColor} />
                    <Text style={[s.tabText, { color: active ? color : subColor }]}>{cat.label}</Text>
                    <View style={[s.tabCount, { backgroundColor: active ? color : (isDark ? '#334155' : '#e2e8f0') }]}>
                      <Text style={[s.tabCountText, { color: active ? '#fff' : subColor }]}>{cat.items.length}</Text>
                    </View>
                    {cat.comingSoon && <View style={s.tabSoon}><Text style={s.tabSoonText}>Soon</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Category header */}
          {activeCategory && (() => {
            const { icon, color } = getIcon(activeCategory.key);
            return (
              <View style={[s.catHeader, { backgroundColor: cardBg }]}>
                <View style={[s.catIcon, { backgroundColor: `${color}15` }]}>
                  <Ionicons name={icon} size={24} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.catTitle, { color: textColor }]}>{activeCategory.label}</Text>
                  <Text style={[s.catCount, { color: subColor }]}>{activeCategory.items.length} features available</Text>
                </View>
                {activeCategory.comingSoon && (
                  <View style={[s.soonBadge, { backgroundColor: '#fef3c7' }]}>
                    <Text style={s.soonBadgeText}>Coming Soon</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Features list */}
          <FlatList
            data={activeCategory?.items || []}
            keyExtractor={(item, i) => String(item.feature_item_id || i)}
            contentContainerStyle={{ paddingBottom: insets.bottom + 50, paddingHorizontal: 14 }}
            renderItem={({ item, index }) => {
              const { color } = getIcon(activeCategory?.key);
              return (
                <View style={[s.featureCard, { backgroundColor: cardBg }]}>
                  <View style={s.featureTop}>
                    <View style={[s.featureNum, { backgroundColor: `${color}15` }]}>
                      <Text style={[s.featureNumText, { color }]}>{index + 1}</Text>
                    </View>
                    <Text style={[s.featureTitle, { color: textColor }]}>{item.title}</Text>
                  </View>
                  {item.description ? (
                    <Text style={[s.featureDesc, { color: subColor }]}>{item.description}</Text>
                  ) : null}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="cube-outline" size={40} color={subColor} />
                <Text style={[s.emptyText, { color: subColor }]}>No features in this category</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  headerBadgeText: { fontSize: 13, fontWeight: '900', color: '#fff' },

  // Tab chips
  tabWrap: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  tabScroll: { gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountText: { fontSize: 10, fontWeight: '800' },
  tabSoon: { backgroundColor: '#fef3c7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  tabSoonText: { fontSize: 8, fontWeight: '800', color: '#92400e' },

  // Category header
  catHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginTop: 12, padding: 16,
    borderRadius: 18, elevation: 1,
  },
  catIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  catCount: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  soonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  soonBadgeText: { fontSize: 10, fontWeight: '800', color: '#92400e' },

  // Feature cards
  featureCard: {
    borderRadius: 16, padding: 16, marginTop: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
  },
  featureTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureNum: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureNumText: { fontSize: 14, fontWeight: '900' },
  featureTitle: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  featureDesc: { fontSize: 13, lineHeight: 20, marginTop: 10, marginLeft: 46 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
