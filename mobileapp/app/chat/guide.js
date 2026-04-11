import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/store/ThemeContext';

const GUIDE_SECTIONS = [
  {
    title: 'Getting Started',
    icon: 'rocket-outline',
    color: '#3b82f6',
    items: [
      { q: 'How do I send a message?', a: 'Open any chat from the Chats tab, type your message in the input box at the bottom, and tap the send button (arrow icon).' },
      { q: 'How do I start a new chat?', a: 'Go to the Contacts tab, find the person you want to chat with, and tap the chat bubble icon next to their name.' },
      { q: 'How do I create a group?', a: 'Tap the group icon (people) above the main chat FAB button, or go to Contacts → Groups tab → "New Group". Enter a name, add members, and create.' },
      { q: 'How do I search messages?', a: 'In any chat, tap the search icon in the header. You can search by text and filter by type (images, videos, files, links, audio, code).' },
    ],
  },
  {
    title: 'Messaging',
    icon: 'chatbubbles-outline',
    color: '#22c55e',
    items: [
      { q: 'How do I reply to a message?', a: 'Swipe right on any message to quick-reply, or long-press → Reply from the menu.' },
      { q: 'How do I edit a message?', a: 'Long-press your message → Edit. You have 5 minutes after sending to edit. The message will show an "edited" label.' },
      { q: 'How do I unsend a message?', a: 'Long-press your message → Unsend. Available for 5 minutes after sending. The message disappears for everyone.' },
      { q: 'How do I forward a message?', a: 'Long-press → Forward. Search and select the contact you want to forward to.' },
      { q: 'How do I react to a message?', a: 'Long-press any message. Quick-react emojis appear at the top of the menu. Tap one to react. Reactions are visible to everyone.' },
      { q: 'How do I star/bookmark a message?', a: 'Long-press → Star. Starred messages are saved locally. View all starred messages from Settings → Starred Messages.' },
      { q: 'How do I send a voice message?', a: 'Tap the microphone icon when the text input is empty. Record your message, then tap send. You can also cancel by tapping the trash icon.' },
      { q: 'How do I send files, photos, or videos?', a: 'Tap the attachment (paperclip) icon. Choose from Document, Camera, Gallery, Video, Audio, Location, Contact, GIF, or Poll.' },
      { q: 'How do I change voice message speed?', a: 'While playing a voice message, tap the speed button (1x/1.5x/2x) to cycle through playback speeds.' },
      { q: 'What are disappearing messages?', a: 'Open chat menu (⋮) → Disappearing Messages. Choose 24 hours or 7 days. Messages auto-delete after the set time.' },
    ],
  },
  {
    title: 'Groups',
    icon: 'people-outline',
    color: '#8b5cf6',
    items: [
      { q: 'What is an Announcement group?', a: 'An Announcement (Airtime) group only allows admins to send messages. Regular members can only read. Useful for company updates.' },
      { q: 'How do I manage group members?', a: 'Tap the group name in chat header → Group Info. Admins can add/remove members, promote to admin (shield icon), or kick members.' },
      { q: 'What can group admins do?', a: 'Admins can: edit group name/description, toggle announcement mode, add/remove members, promote/demote admins, delete any message, and pin messages.' },
      { q: 'How do I leave a group?', a: 'Tap group name → Group Info → scroll to bottom → "Leave Group". You\'ll keep old messages but won\'t receive new ones.' },
      { q: 'What is the Group Timeline?', a: 'Group Info → Timeline tab shows the history of all group actions: who was added, removed, settings changed, etc.' },
    ],
  },
  {
    title: 'Calls & Media',
    icon: 'call-outline',
    color: '#f59e0b',
    items: [
      { q: 'How do I make a call?', a: 'In a DM chat, tap the phone icon (audio) or camera icon (video) in the header. Calls use WebRTC and require a development build.' },
      { q: 'How do I view all shared media?', a: 'In chat menu (⋮) → Media & Files. Browse tabs for Media, Files, Links, and Pinned messages.' },
      { q: 'How do I view images full-screen?', a: 'Tap any image in chat to open the full-screen viewer. Double-tap to zoom in/out.' },
    ],
  },
  {
    title: 'Privacy & Security',
    icon: 'shield-outline',
    color: '#ef4444',
    items: [
      { q: 'How do I enable App Lock?', a: 'Settings → App Lock → Enable. Set a 4-digit PIN. The app locks after 30 seconds in background. Unlock with PIN or biometric (fingerprint/face).' },
      { q: 'How do I login via QR Code?', a: 'On the web browser, click "Login via QR Code". On your phone, go to Settings → Linked Devices and scan the QR code shown on the browser.' },
      { q: 'How do I manage my devices?', a: 'Settings → Active Devices shows all logged-in devices. You can revoke access to any device, or logout from all devices at once.' },
    ],
  },
  {
    title: 'Customization',
    icon: 'color-palette-outline',
    color: '#ec4899',
    items: [
      { q: 'How do I change the theme?', a: 'Settings → Appearance. Toggle Dark Mode, or choose Light/Dark/System theme.' },
      { q: 'How do I change the accent color?', a: 'Settings → Customize → Brand Color. Pick a preset color or enter a custom HEX code.' },
      { q: 'How do I set a chat wallpaper?', a: 'In chat menu (⋮) → Wallpaper. Choose a photo from your gallery. To remove, tap Wallpaper again → Remove.' },
      { q: 'How do I set my status?', a: 'In Settings, tap the status bar below your profile. Choose Available, Busy, Away, DND, or Offline. Add a custom status message.' },
    ],
  },
  {
    title: 'Productivity',
    icon: 'flash-outline',
    color: '#06b6d4',
    items: [
      { q: 'How do I pin a chat?', a: 'Long-press any chat in the list → "Pin to top". Pinned chats always appear first with a pin icon.' },
      { q: 'How do I archive a chat?', a: 'Long-press any chat → "Archive". The chat disappears from the list but messages are preserved.' },
      { q: 'How do I filter chats?', a: 'Use the filter chips below the search bar: All, Groups, or Unread. Each shows a count badge.' },
      { q: 'How do I broadcast a message?', a: 'Settings → Broadcast Message. Select multiple contacts, type your message, and send to all at once as individual DMs.' },
      { q: 'How do I manage storage?', a: 'Settings → Storage & Data. See usage breakdown and clear cache for messages, downloads, or drafts.' },
      { q: 'How do I export a chat?', a: 'In chat menu (⋮) → Export Chat. The chat history is saved as a text file and shared via your device\'s share sheet.' },
    ],
  },
];

export default function GuideScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(null); // section index
  const [openQ, setOpenQ] = useState(null); // "section-item" key

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#f8fafc';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#334155' : '#f1f5f9';

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Ionicons name="book-outline" size={20} color="#fff" />
        <Text style={s.headerTitle}>App Guide</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: `${ACCENT}15` }]}>
            <Ionicons name="help-buoy" size={36} color={ACCENT} />
          </View>
          <Text style={[s.heroTitle, { color: textColor }]}>How can we help?</Text>
          <Text style={[s.heroSub, { color: subColor }]}>Browse topics below or contact support</Text>
        </View>

        {/* Sections */}
        {GUIDE_SECTIONS.map((section, si) => (
          <View key={si} style={[s.section, { backgroundColor: cardBg }]}>
            <TouchableOpacity style={s.sectionHeader}
              onPress={() => setExpanded(expanded === si ? null : si)} activeOpacity={0.6}>
              <View style={[s.sectionIcon, { backgroundColor: `${section.color}12` }]}>
                <Ionicons name={section.icon} size={18} color={section.color} />
              </View>
              <Text style={[s.sectionTitle, { color: textColor }]}>{section.title}</Text>
              <Text style={[s.sectionCount, { color: subColor }]}>{section.items.length}</Text>
              <Ionicons name={expanded === si ? 'chevron-up' : 'chevron-down'} size={18} color={subColor} />
            </TouchableOpacity>

            {expanded === si && section.items.map((item, ii) => {
              const key = `${si}-${ii}`;
              const isOpen = openQ === key;
              return (
                <View key={ii}>
                  <TouchableOpacity style={[s.question, { borderTopColor: borderColor }]}
                    onPress={() => setOpenQ(isOpen ? null : key)} activeOpacity={0.6}>
                    <Text style={[s.qText, { color: textColor }]}>{item.q}</Text>
                    <Ionicons name={isOpen ? 'remove' : 'add'} size={18} color={ACCENT} />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={[s.answer, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                      <Text style={[s.aText, { color: subColor }]}>{item.a}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Contact Support */}
        <View style={[s.supportCard, { backgroundColor: cardBg }]}>
          <Text style={[s.supportTitle, { color: textColor }]}>Need more help?</Text>
          <View style={s.supportActions}>
            <TouchableOpacity style={[s.supportBtn, { backgroundColor: '#22c55e12' }]}
              onPress={() => Linking.openURL('mailto:support@teamchatx.com')} activeOpacity={0.7}>
              <Ionicons name="mail" size={20} color="#22c55e" />
              <Text style={[s.supportBtnText, { color: '#22c55e' }]}>Email Support</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.supportBtn, { backgroundColor: '#3b82f612' }]}
              onPress={() => router.push('/chat/legal?type=privacy')} activeOpacity={0.7}>
              <Ionicons name="shield-checkmark" size={18} color="#3b82f6" />
              <Text style={[s.supportBtnText, { color: '#3b82f6' }]}>Privacy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.supportBtn, { backgroundColor: '#8b5cf612' }]}
              onPress={() => router.push('/chat/legal?type=terms')} activeOpacity={0.7}>
              <Ionicons name="document-text" size={18} color="#8b5cf6" />
              <Text style={[s.supportBtnText, { color: '#8b5cf6' }]}>Terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ─── Floating AI Assistant FAB ─── */}
      <TouchableOpacity style={s.aiFab}
        onPress={() => router.push('/chat/assistant')} activeOpacity={0.85}>
        <Ionicons name="hardware-chip" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  hero: { alignItems: 'center', paddingVertical: 28 },
  heroIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  heroSub: { fontSize: 14, marginTop: 4 },

  section: { marginHorizontal: 14, marginBottom: 10, borderRadius: 18, overflow: 'hidden', elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  sectionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.1 },
  sectionCount: { fontSize: 12, fontWeight: '700' },

  question: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 50 },
  qText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  answer: { paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 10, marginBottom: 8, borderRadius: 12 },
  aText: { fontSize: 13.5, lineHeight: 20 },

  supportCard: { marginHorizontal: 14, marginTop: 10, borderRadius: 18, padding: 20, alignItems: 'center', elevation: 1 },
  supportTitle: { fontSize: 17, fontWeight: '800' },
  supportSub: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  supportActions: { flexDirection: 'row', gap: 10, width: '100%' },
  supportBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  supportBtnText: { fontSize: 11, fontWeight: '700' },

  // Floating AI FAB — cyan glow
  aiFab: {
    position: 'absolute', bottom: 24, right: 18,
    width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00e5ff',
    elevation: 10,
    shadowColor: '#00e5ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
});
