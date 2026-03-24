import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const COLS = 8;
const EMOJI_SIZE = Math.floor((width - 32) / COLS);

const CATEGORIES = [
  { key: 'recent', icon: 'time-outline' },
  { key: 'smileys', icon: 'happy-outline' },
  { key: 'people', icon: 'hand-left-outline' },
  { key: 'nature', icon: 'leaf-outline' },
  { key: 'food', icon: 'fast-food-outline' },
  { key: 'travel', icon: 'car-outline' },
  { key: 'objects', icon: 'bulb-outline' },
  { key: 'symbols', icon: 'heart-outline' },
];

const EMOJI_DATA = {
  recent: ['👍','❤️','😂','🔥','😍','👏','😊','🎉','💯','✅'],
  smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😤','😠','😡','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  people: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','👀','👁️','👅','👄','💋','🫂','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵'],
  nature: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🕷️','🐢','🐍','🦎','🦖','🐙','🐠','🐟','🐬','🐳','🐋','🦈','🌸','🌺','🌻','🌹','🌷','🌱','🌿','☘️','🍀','🌵','🌴','🌳','🌲','🍂','🍁','🍄','🌾'],
  food: ['🍕','🍔','🍟','🌭','🍿','🧂','🥚','🍳','🥞','🍞','🥐','🥖','🥙','🌮','🌯','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥠','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍩','🍪','☕','🍵','🧃','🥤','🧋','🍺','🍻','🥂','🍷','🍸','🍹','🧊'],
  travel: ['✈️','🚗','🚕','🚙','🚌','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🛵','🏍️','🚲','🛴','🚏','🏠','🏡','🏢','🏣','🏥','🏦','🏨','🏪','🏫','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🏔️','⛰️','🌋','🏖️','🏝️','🌅','🌄','🌠','🎆','🎇','🌈'],
  objects: ['💡','🔦','🕯️','📱','💻','⌨️','🖥️','🖨️','📷','📹','🎥','📞','📺','📻','🎙️','⏰','🕰️','📡','🔋','🔌','💰','💴','💵','💶','💷','💸','💳','✉️','📧','📦','📫','🔑','🗝️','🔨','🪓','⛏️','🔧','🔩','⚙️','🧲','💎','🧸','🎮','🕹️','🎯','🎲','🧩','🎨'],
  symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','☯️','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','✅','❌','❓','❗','‼️','⭐','🌟','💫','⚡','🔥','💥','✨','🎵','🎶','🔔','🔕','📢','📣','💬','💭','🏳️','🏴','🚩'],
};

export default function EmojiPicker({ onSelect, onClose }) {
  const [category, setCategory] = useState('recent');
  const [search, setSearch] = useState('');

  const emojis = useMemo(() => {
    if (search) return Object.values(EMOJI_DATA).flat();
    return EMOJI_DATA[category] || [];
  }, [category, search]);

  return (
    <View style={s.container}>
      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={15} color="#94a3b8" />
          <TextInput style={s.searchInput} placeholder="Search emoji" placeholderTextColor="#94a3b8"
            value={search} onChangeText={setSearch} />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
          <Ionicons name="chevron-down" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Category tabs */}
      {!search && (
        <View style={s.tabs}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat.key} onPress={() => setCategory(cat.key)}
              style={[s.tab, category === cat.key && s.tabActive]}>
              <Ionicons name={cat.icon} size={18} color={category === cat.key ? '#2563eb' : '#94a3b8'} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Grid */}
      <FlatList
        data={emojis}
        numColumns={COLS}
        keyExtractor={(item, i) => `${item}-${i}`}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.emojiBtn} onPress={() => onSelect(item)} activeOpacity={0.5}>
            <Text style={s.emoji}>{item}</Text>
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.grid}
        getItemLayout={(_, index) => ({ length: EMOJI_SIZE, offset: EMOJI_SIZE * Math.floor(index / COLS), index })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { height: 320, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, backgroundColor: '#f1f5f9', borderRadius: 18, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a', paddingVertical: 0 },
  closeBtn: { padding: 4 },
  tabs: { flexDirection: 'row', paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  grid: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 16 },
  emojiBtn: { width: EMOJI_SIZE, height: EMOJI_SIZE, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: Platform.OS === 'ios' ? 28 : 24 },
});
