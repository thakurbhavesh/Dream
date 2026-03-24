import { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ToastContext = createContext(() => {});

const CFG = {
  success: { icon: 'checkmark-circle', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  error: { icon: 'close-circle', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  info: { icon: 'information-circle', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  warning: { icon: 'warning', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
};

function ToastBar({ data, onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const insets = useSafeAreaInsets();
  const c = CFG[data.type] || CFG.info;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start(() => onHide());
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[
      s.toast,
      { top: insets.top + 8, opacity, transform: [{ translateY }, { scale }], backgroundColor: c.bg, borderColor: c.border },
    ]}>
      <Ionicons name={c.icon} size={20} color={c.color} />
      <Text style={[s.text, { color: c.color }]} numberOfLines={2}>{data.message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'info') => setToast({ message, type, id: Date.now() }), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <ToastBar data={toast} onHide={() => setToast(null)} />}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const s = StyleSheet.create({
  toast: {
    position: 'absolute', left: 16, right: 16, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 16, borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  text: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
});
