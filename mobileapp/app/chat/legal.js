import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/store/ThemeContext';

const PRIVACY_POLICY = `Last Updated: April 2026

TeamChatX ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.

1. INFORMATION WE COLLECT

Personal Information: Name, email address, phone number, profile picture that you provide during registration.

Usage Data: Messages, files, media shared within the app. Message metadata (timestamps, read receipts, delivery status).

Device Information: Device type, OS version, IP address, push notification tokens.

Location Data: Only when you explicitly choose to share your location in a chat.

2. HOW WE USE YOUR INFORMATION

- To provide and maintain the chat service
- To send and receive messages in real-time
- To deliver push notifications for new messages
- To authenticate your identity and secure your account
- To improve app performance and user experience

3. DATA STORAGE & SECURITY

- Messages are encrypted in transit using TLS/SSL
- Passwords are hashed using bcrypt
- Authentication tokens are stored securely using device secure storage
- We use PostgreSQL database with encrypted connections
- Files are stored on secure cloud storage (AWS S3)

4. DATA SHARING

We do not sell, trade, or share your personal information with third parties except:
- With your organization administrator (as a business communication tool)
- When required by law or legal process
- To protect our rights, privacy, safety, or property

5. DATA RETENTION

- Messages are retained as long as your organization account is active
- Disappearing messages are deleted per your configured timer
- You can request data deletion by contacting support

6. YOUR RIGHTS

- Access your personal data via Settings > Profile Info
- Export your chat history via chat menu > Export
- Delete your messages via long-press > Delete/Unsend
- Manage app permissions via Settings > Permissions
- Request account deletion by emailing support@teamchatx.com

7. COOKIES & TRACKING

The mobile app does not use cookies. We do not use third-party analytics or advertising trackers.

8. CHILDREN'S PRIVACY

TeamChatX is designed for business use and is not intended for children under 13.

9. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify you of changes via in-app notification.

10. CONTACT US

Email: support@teamchatx.com
Website: https://teamchatx.com`;

const TERMS_OF_SERVICE = `Last Updated: April 2026

By using TeamChatX, you agree to these Terms of Service.

1. ACCEPTANCE OF TERMS

By creating an account or using the app, you agree to be bound by these terms. If you do not agree, do not use the app.

2. ACCOUNT REGISTRATION

- You must provide accurate and complete information
- You are responsible for maintaining your account security
- You must be at least 13 years old to use the app
- One person per account — no shared accounts

3. ACCEPTABLE USE

You agree NOT to:
- Send spam, harassment, or threatening messages
- Share illegal, obscene, or harmful content
- Attempt to hack, reverse-engineer, or disrupt the service
- Impersonate other users or organizations
- Use automated tools to send messages
- Violate any applicable laws or regulations

4. CONTENT OWNERSHIP

- You retain ownership of content you create and share
- You grant us a license to store and transmit your content for service delivery
- We do not claim ownership of your messages, files, or media

5. ORGANIZATION ADMINISTRATORS

- Organization admins may have access to message logs and user activity
- Admins can manage members, roles, and group settings
- Admin actions are logged in the group timeline

6. SERVICE AVAILABILITY

- We strive for 99.9% uptime but do not guarantee uninterrupted service
- We may perform maintenance with reasonable notice
- We reserve the right to suspend accounts that violate these terms

7. TERMINATION

- You may delete your account at any time
- We may terminate accounts that violate these terms
- Upon termination, your data will be retained per our privacy policy

8. LIMITATION OF LIABILITY

TeamChatX is provided "as is" without warranties. We are not liable for any damages arising from use of the app.

9. CHANGES TO TERMS

We may update these terms. Continued use after changes constitutes acceptance.

10. CONTACT

Email: support@teamchatx.com`;

export default function LegalScreen() {
  const { type } = useLocalSearchParams(); // 'privacy' or 'terms'
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isPrivacy = type === 'privacy';
  const content = isPrivacy ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';

  const bg = isDark ? '#0b141a' : '#fff';
  const headerBg = isDark ? '#1f2c34' : t.accent;

  // Parse content into sections
  const sections = content.split(/\n(?=\d+\. )/).map(sec => {
    const lines = sec.trim().split('\n');
    const heading = lines[0] || '';
    const body = lines.slice(1).join('\n').trim();
    return { heading, body };
  });

  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Ionicons name={isPrivacy ? 'shield-checkmark' : 'document-text'} size={18} color="#fff" />
        <Text style={s.headerTitle}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 50 }]} showsVerticalScrollIndicator={false}>
        {/* Icon hero */}
        <View style={s.legalHero}>
          <View style={[s.legalIcon, { backgroundColor: `${t.accent}15` }]}>
            <Ionicons name={isPrivacy ? 'shield-checkmark' : 'document-text'} size={32} color={t.accent} />
          </View>
          <Text style={[s.legalTitle, { color: textColor }]}>{title}</Text>
          <Text style={[s.legalDate, { color: subColor }]}>Last Updated: April 2026</Text>
        </View>

        {/* Sections as cards */}
        {sections.map((sec, i) => (
          <View key={i} style={[s.legalCard, { backgroundColor: cardBg }]}>
            <Text style={[s.legalHeading, { color: textColor }]}>{sec.heading}</Text>
            <Text style={[s.legalBody, { color: subColor }]}>{sec.body}</Text>
          </View>
        ))}

        {/* Contact footer */}
        <View style={[s.legalFooter, { borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <Ionicons name="mail-outline" size={16} color={t.accent} />
          <Text style={[s.legalFooterText, { color: subColor }]}>Questions? Email support@teamchatx.com</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },
  body: { padding: 14 },

  legalHero: { alignItems: 'center', paddingVertical: 24 },
  legalIcon: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  legalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  legalDate: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  legalCard: { borderRadius: 16, padding: 18, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  legalHeading: { fontSize: 15, fontWeight: '800', marginBottom: 8, letterSpacing: -0.1 },
  legalBody: { fontSize: 13.5, lineHeight: 21 },

  legalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  legalFooterText: { fontSize: 13, fontWeight: '600' },
});
