import { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/config';
import { useTheme } from '../store/ThemeContext';

const { width: W } = Dimensions.get('window');
const COL = 2;
const GAP = 4;
const THUMB_W = (W - GAP * (COL + 1)) / COL;

export default function GifPicker({ onSelect, onClose }) {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const searchTimer = useRef(null);

  const fetchGifs = useCallback(async (q) => {
    setLoading(true);
    try {
      const endpoint = q?.trim() ? `/gifs/search?q=${encodeURIComponent(q)}&limit=30` : '/gifs/trending?limit=30';
      const { data } = await api.get(endpoint);
      const items = data?.data?.gifs || data?.gifs || data?.data || [];
      setGifs(items);
    } catch { setGifs([]); }
    finally { setLoading(false); setLoaded(true); }
  }, []);

  // Load trending on mount
  useState(() => { fetchGifs(''); }, []);

  const handleSearch = useCallback((txt) => {
    setQuery(txt);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchGifs(txt), 400);
  }, [fetchGifs]);

  const bg = isDark ? '#1e293b' : '#fff';
  const inputBg = isDark ? '#0f172a' : '#f1f5f9';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: textColor }]}>GIFs</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color={subColor} />
        </TouchableOpacity>
      </View>
      <View style={[s.searchWrap, { backgroundColor: inputBg }]}>
        <Ionicons name="search" size={16} color={subColor} />
        <TextInput
          style={[s.searchInput, { color: textColor }]}
          placeholder="Search GIFs..."
          placeholderTextColor={subColor}
          value={query}
          onChangeText={handleSearch}
          autoFocus
        />
      </View>
      {loading && !loaded ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={gifs}
          numColumns={COL}
          keyExtractor={(item, i) => item.id || String(i)}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: GAP }}
          renderItem={({ item }) => {
            const url = item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || item.url || item.media?.[0]?.tinygif?.url || '';
            const fullUrl = item.media_formats?.gif?.url || item.url || url;
            return (
              <TouchableOpacity activeOpacity={0.8} onPress={() => onSelect?.({ url: fullUrl, previewUrl: url, source: 'tenor' })}>
                <Image source={{ uri: url }} style={s.gif} resizeMode="cover" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={loaded && !loading ? <Text style={[s.empty, { color: subColor }]}>No GIFs found</Text> : null}
          showsVerticalScrollIndicator={false}
        />
      )}
      <Text style={[s.powered, { color: subColor }]}>Powered by Tenor</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { height: 340, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, borderRadius: 12, paddingHorizontal: 12, height: 38, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  grid: { paddingHorizontal: GAP },
  gif: { width: THUMB_W, height: 120, borderRadius: 8, marginBottom: GAP, backgroundColor: '#e2e8f0' },
  empty: { textAlign: 'center', paddingVertical: 30, fontSize: 14 },
  powered: { textAlign: 'center', fontSize: 10, paddingVertical: 4 },
});
