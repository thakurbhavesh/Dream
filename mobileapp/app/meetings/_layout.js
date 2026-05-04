import { Stack } from 'expo-router';
import { useTheme } from '../../src/store/ThemeContext';

export default function MeetingsLayout() {
  const { theme: t } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text, fontWeight: '700' },
        headerTintColor: t.text,
        contentStyle: { backgroundColor: t.bg },
      }}
    />
  );
}
