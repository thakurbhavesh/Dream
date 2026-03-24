import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../theme/colors';

export default function AuthHeader({ title, subtitle }) {
  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Ionicons name="chatbubbles" size={32} color={colors.white} />
      </View>
      <Text style={styles.appName}>TeamChatX</Text>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  appName: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, marginBottom: 4 },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginTop: spacing.lg },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
});
