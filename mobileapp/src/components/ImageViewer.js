import { useState } from 'react';
import { View, Text, Modal, Image, TouchableOpacity, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

export default function ImageViewer({ visible, uri, onClose, caption }) {
  const insets = useSafeAreaInsets();
  const [scale, setScale] = useState(1);
  const [lastTap, setLastTap] = useState(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      setScale(prev => prev === 1 ? 2.5 : 1);
    }
    setLastTap(now);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setScale(prev => prev === 1 ? 2.5 : 1)} style={s.closeBtn} activeOpacity={0.7}>
            <Ionicons name={scale > 1 ? 'contract' : 'expand'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Image */}
        <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap} style={s.imageWrap}>
          <Image
            source={{ uri }}
            style={[s.image, { transform: [{ scale }] }]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Caption */}
        {caption ? (
          <View style={[s.captionBar, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.captionText}>{caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, zIndex: 10 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: W, height: H * 0.7 },
  captionBar: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.7)' },
  captionText: { color: '#fff', fontSize: 14, lineHeight: 20 },
});
