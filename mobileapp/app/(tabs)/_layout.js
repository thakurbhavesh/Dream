import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/store/ThemeContext';
import useSocket from '../../src/hooks/useSocket';

const TabIcon = ({ name, focused, color }) => (
  <View style={st.iconWrap}>
    <Ionicons name={focused ? name.replace('-outline', '') : name} size={23} color={color} />
    {focused && <View style={[st.dot, { backgroundColor: color }]} />}
  </View>
);

export default function TabsLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const { on } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  // Track unread from socket notifications
  useEffect(() => {
    const unsub = on('notification', () => setUnreadCount(c => c + 1));
    return () => unsub?.();
  }, [on]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.icon,
        tabBarStyle: {
          backgroundColor: theme.tabBg,
          borderTopWidth: 0,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: theme.mode === 'dark' ? 0.2 : 0.06,
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -2 },
      }}
    >
      <Tabs.Screen name="chats" options={{
        title: 'Chats',
        tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        tabBarBadgeStyle: { backgroundColor: theme.accent, fontSize: 10, fontWeight: '800', minWidth: 18, height: 18, lineHeight: 16 },
        tabBarIcon: ({ focused, color }) => <TabIcon name="chatbubbles-outline" focused={focused} color={color} />,
      }}
      listeners={{ tabPress: () => setUnreadCount(0) }} />
      <Tabs.Screen name="contacts" options={{
        title: 'Contacts',
        tabBarIcon: ({ focused, color }) => <TabIcon name="people-outline" focused={focused} color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Settings',
        tabBarIcon: ({ focused, color }) => <TabIcon name="settings-outline" focused={focused} color={color} />,
      }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  iconWrap: { alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 3 },
});
