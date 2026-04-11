import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Platform, Keyboard, Dimensions, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api/config';
import { useTheme } from '../../src/store/ThemeContext';

const { width: W } = Dimensions.get('window');

const SYSTEM_PROMPT = `You are TeamChatX AI Assistant — a friendly, concise helper for the TeamChatX business chat app (like Troop Messenger/Slack).

Features: DM, group chat, announcement groups, text formatting, code blocks, emoji, @mentions, reply (swipe right), edit/unsend (5 min), forward, pin (server), star (local bookmark), reactions, voice messages (1x/1.5x/2x speed), file/image/video/audio/location/contact sharing, GIF picker, polls, link previews, disappearing messages, broadcast, draft auto-save, typing indicator, online/away/busy/offline status, swipe-to-reply, image viewer (double-tap zoom), chat wallpaper, chat filters (All/Groups/Unread), pin/archive chats, storage manager, app lock (PIN+biometric), QR login, department contacts filter, global member orange badge, group admin controls, group timeline.

RULES: Answer in user's language (English/Hindi/Hinglish). Be concise (2-4 sentences). Use bullet points for steps. Don't invent features.`;

const SUGGESTIONS = [
  'How to create a group?',
  'Message kaise edit karein?',
  'What is App Lock?',
  'How to search messages?',
  'Voice message speed kaise change karein?',
  'How to set wallpaper?',
];

export default function AssistantScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const ACCENT = t.accent;

  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I\'m your TeamChatX AI assistant.\nAsk me anything about the app.' },
  ]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  // Keyboard handled by react-native-keyboard-controller globally

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);

  const askAI = async (q) => {
    const text = (q || question).trim();
    if (!text || loading) return;
    Keyboard.dismiss();
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    scrollToEnd();
    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.text }));
      history.push({ role: 'user', content: text });
      const { data } = await api.post('/live-assistant/chat', { messages: history, systemPrompt: SYSTEM_PROMPT });
      const answer = data?.data?.reply || data?.reply || data?.data?.answer || 'Sorry, I could not process that.';
      setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, ${e?.response?.data?.message || 'something went wrong'}. Try again.` }]);
    }
    finally { setLoading(false); scrollToEnd(); }
  };

  const showSuggestions = messages.length <= 1;

  // Theme colors
  const bg = isDark ? '#0f172a' : '#f8fafc';
  const headerBg = isDark ? '#1e293b' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const botBubbleBg = isDark ? '#1e293b' : '#f1f5f9';
  const botBubbleBorder = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#e2e8f0' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const inputBg = isDark ? '#0f172a' : '#fff';
  const inputBorder = isDark ? '#334155' : '#e2e8f0';

  return (
    <KeyboardAvoidingView style={[z.root, { backgroundColor: bg }]} behavior="padding">
      {/* Header */}
      <View style={[z.header, { backgroundColor: headerBg, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={z.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={[z.logoRing, { borderColor: 'rgba(255,255,255,0.3)' }]}>
          <View style={[z.logoBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={z.headerTitle}>AI Assistant</Text>
          <View style={z.statusRow}>
            <View style={[z.statusDot, { backgroundColor: '#4ade80' }]} />
            <Text style={z.statusText}>Online</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => { setMessages([{ role: 'assistant', text: 'Hello! I\'m your TeamChatX AI assistant.\nAsk me anything about the app.' }]); }}
          style={[z.clearBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Ionicons name="refresh" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={z.msgArea}
        contentContainerStyle={{ paddingVertical: 20, paddingBottom: 10 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {messages.map((msg, i) => (
          <View key={i} style={msg.role === 'user' ? z.userRow : z.botRow}>
            {msg.role === 'assistant' && (
              <View style={[z.botAvatar, { backgroundColor: `${ACCENT}15`, borderColor: `${ACCENT}30` }]}>
                <Ionicons name="sparkles" size={14} color={ACCENT} />
              </View>
            )}
            <View style={[z.bubble,
              msg.role === 'user'
                ? [z.userBubble, { backgroundColor: ACCENT }]
                : [z.botBubble, { backgroundColor: botBubbleBg, borderColor: botBubbleBorder }]
            ]}>
              <Text style={[z.bubbleText, { color: msg.role === 'user' ? '#fff' : textColor }]}>{msg.text}</Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={z.botRow}>
            <View style={[z.botAvatar, { backgroundColor: `${ACCENT}15`, borderColor: `${ACCENT}30` }]}>
              <Ionicons name="sparkles" size={14} color={ACCENT} />
            </View>
            <View style={[z.botBubble, { backgroundColor: botBubbleBg, borderColor: botBubbleBorder }]}>
              <View style={z.typingRow}>
                <View style={[z.typeDot, { backgroundColor: ACCENT, opacity: 0.3 }]} />
                <View style={[z.typeDot, { backgroundColor: ACCENT, opacity: 0.6 }]} />
                <View style={[z.typeDot, { backgroundColor: ACCENT, opacity: 1 }]} />
              </View>
            </View>
          </View>
        )}

        {showSuggestions && (
          <View style={z.sugWrap}>
            <Text style={[z.sugLabel, { color: subColor }]}>Try asking:</Text>
            <View style={z.sugGrid}>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity key={i} style={[z.sugChip, { borderColor: `${ACCENT}30`, backgroundColor: `${ACCENT}08` }]}
                  onPress={() => askAI(s)} activeOpacity={0.7}>
                  <Ionicons name="flash" size={12} color={ACCENT} />
                  <Text style={[z.sugText, { color: ACCENT }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={[z.inputArea, {
        backgroundColor: isDark ? '#1e293b' : '#fff',
        borderTopColor: isDark ? '#334155' : '#e2e8f0',
        paddingBottom: Math.max(insets.bottom, 10),
      }]}>
        <View style={[z.inputBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
          <TextInput ref={inputRef} style={[z.input, { color: textColor }]}
            placeholder="Ask me anything..."
            placeholderTextColor={subColor}
            value={question} onChangeText={setQuestion}
            multiline maxLength={500}
            onSubmitEditing={() => askAI()} returnKeyType="send" />
          <TouchableOpacity style={[z.sendBtn, { backgroundColor: question.trim() ? ACCENT : (isDark ? '#334155' : '#e2e8f0') }]}
            onPress={() => askAI()} disabled={!question.trim() || loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> :
              <Ionicons name="send" size={18} color={question.trim() ? '#fff' : subColor} />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const z = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  backBtn: { padding: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  logoRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  logoBg: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  clearBtn: { padding: 8, borderRadius: 12, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },

  // Messages
  msgArea: { flex: 1, paddingHorizontal: 16 },
  botRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 },
  botAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },

  // Bubbles
  bubble: { maxWidth: W * 0.78, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble: { borderBottomRightRadius: 4 },
  botBubble: { borderWidth: 1, borderTopLeftRadius: 4, maxWidth: W * 0.78, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleText: { fontSize: 14.5, lineHeight: 22 },

  // Typing
  typingRow: { flexDirection: 'row', gap: 5, paddingVertical: 6, paddingHorizontal: 4 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },

  // Suggestions
  sugWrap: { marginTop: 8, paddingLeft: 42 },
  sugLabel: { fontSize: 12, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  sugGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sugChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  sugText: { fontSize: 12.5, fontWeight: '600' },

  // Input
  inputArea: { paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: 25, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 4 },
  input: { flex: 1, fontSize: 15, paddingVertical: 10, maxHeight: 100, minHeight: 42 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2, elevation: 2 },
});
