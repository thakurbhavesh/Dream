import { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Platform, ActivityIndicator, Vibration, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../src/components/Avatar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageViewer from '../../src/components/ImageViewer';
import { getThreads, hideGroupThread } from '../../src/api/chat';
import api from '../../src/api/config';
import { getCachedThreads, cacheThreads, updateCachedThread } from '../../src/services/cache';
import { useAuth } from '../../src/store/AuthContext';
import { useTheme } from '../../src/store/ThemeContext';
import useSocket from '../../src/hooks/useSocket';

const formatTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  const diff = (now - d) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

const msgPreview = (msg, type) => {
  if (!msg && !type) return '';
  if (type === 'image') return '📷 Photo';
  if (type === 'video') return '🎬 Video';
  if (type === 'file') return '📄 Document';
  if (type === 'audio') return '🎵 Voice message';
  if (type === 'link') return '🔗 Link';
  if (type === 'emoji') return '😊 Emoji';
  if (!msg) return '';
  return msg.length > 40 ? msg.slice(0, 40) + '…' : msg;
};

export default function ChatsScreen() {
  const { user } = useAuth();
  const { theme: t, isDark } = useTheme();
  const { on, connected } = useSocket();
  const [threads, setThreads] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userStatuses, setUserStatuses] = useState({}); // { odne: 'Online' | 'Away' | 'Idle' | 'offline' }

  // Global search
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [chatFilter, setChatFilter] = useState('all'); // 'all' | 'groups' | 'unread'
  const globalTimer = useRef(null);
  const searchInputRef = useRef(null);

  // Load cached threads immediately on mount
  useEffect(() => {
    (async () => {
      const cached = await getCachedThreads();
      if (cached && cached.length) { setThreads(cached); setLoading(false); }
    })();
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const data = await getThreads();
      // DMs — backend returns normalized format
      // Backend returns { threads: [...] } — all DMs + groups mixed in one array
      // Split by type: isGroup/threadType === 'group' → group, else DM
      const allThreads = data?.threads || data?.dmThreads || [];
      const separateGroups = data?.groupThreads || [];

      const dm = allThreads
        .filter(th => !th.isGroup && th.threadType !== 'group' && th.type !== 'group')
        .filter(th => th.lastMessageAt || th.lastActivityAt || th.send_time)
        .map(th => ({
          id: th.id || `dm-${th.user_id || th.other_user_id}`,
          name: th.username || th.label || th.other_name || th.email || th.other_email,
          email: th.email || th.other_email,
          avatar: th.profilePicture || th.other_avatar,
          lastMsg: msgPreview(th.preview || th.message, th.messageType || th.message_type),
          lastMsgType: th.messageType || th.message_type,
          lastTime: th.lastMessageAt || th.lastActivityAt || th.send_time,
          unread: Number(th.unreadCount ?? th.unread_count ?? 0),
          online: th.status === 'Online',
          senderId: th.lastMessageDirection === 'outgoing' ? user?.id : null,
          lastStatus: th.lastMessageStatus || null,
          lastDirection: th.lastMessageDirection || null,
          isGlobal: !!(th.isGlobalMember || th.isGlobal || th.is_global || th.global_user),
          type: 'dm',
        }));

      // Groups — from mixed threads array OR separate groupThreads key
      const groupRaw = [
        ...allThreads.filter(th => th.isGroup || th.threadType === 'group' || th.type === 'group'),
        ...separateGroups,
      ];
      const groups = groupRaw.map(th => ({
          id: th.id || `group-${th.group_id || th.groupId}`,
          name: th.label || th.username || th.group_name || th.groupName,
          avatar: th.profilePicture || th.group_image || th.groupImage,
          description: th.description || th.group_description,
          lastMsg: msgPreview(th.preview || th.last_message || th.message, th.messageType || th.last_message_type || th.message_type),
          lastMsgType: th.messageType || th.last_message_type || th.message_type,
          lastTime: th.lastMessageAt || th.lastActivityAt || th.last_message_time,
          lastSender: th.lastSenderName || th.last_sender_name,
          unread: Number(th.unreadCount ?? th.unread_count ?? 0),
          lastStatus: th.lastMessageStatus || null,
          lastDirection: th.lastMessageDirection || null,
          memberCount: th.memberCount || th.member_count,
          isAirtime: th.is_airtime,
          isAdmin: th.isAdmin || th.current_user_is_admin,
          hasLeft: th.hasLeft || th.membershipStatus === 'left',
          canChat: th.canChat !== false,
          type: 'group',
        }));

      // Combine and sort by latest message time (newest first)
      const all = [
        ...dm,
        ...groups,
      ].sort((a, b) => {
        // Strictly by latest message time — newest first
        const ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
        const tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
        return tb - ta;
      });

      setThreads(all);
      cacheThreads(all);
      // Update app icon badge with total unread
      const totalUnread = all.reduce((sum, th) => sum + (th.unread || 0), 0);
      try { const { setBadgeCount } = require('../../src/services/notifications'); setBadgeCount(totalUnread); } catch {}
    } catch (err) {
      console.warn('[chats]', err?.message);
    } finally { setLoading(false); }
  }, [user?.id, user?.email, user?.avatar]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Reload threads when screen is focused (coming back from chat)
  useFocusEffect(useCallback(() => { loadThreads(); }, [loadThreads]));

  // Reload threads when socket reconnects
  useEffect(() => { if (connected) loadThreads(); }, [connected]);

  // ─── Realtime socket listeners ───
  useEffect(() => {
    // New message → update thread preview + reorder
    const unsub1 = on('message:new', (data) => {
      if (!data?.threadId || !data?.message) return;
      const msg = data.message;
      const preview = msgPreview(msg?.content?.text || msg?.message || '', msg?.type);
      setThreads(prev => {
        const idx = prev.findIndex(th => th.id === data.threadId);
        if (idx === -1) {
          // New thread — reload full list
          loadThreads();
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMsg: preview,
          lastMsgType: msg?.type,
          lastTime: new Date().toISOString(),
          senderId: msg?.direction === 'outgoing' ? user?.id : null,
          lastStatus: msg?.status || (msg?.direction === 'outgoing' ? 'sent' : null),
          lastDirection: msg?.direction || null,
          unread: msg?.direction === 'incoming' ? (updated[idx].unread || 0) + 1 : updated[idx].unread,
        };
        // Re-sort by time
        updated.sort((a, b) => {
          const ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
          const tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
          return tb - ta;
        });
        return updated;
      });
    });

    // Thread update (unread count, read status)
    const unsub2 = on('thread:update', (data) => {
      if (!data?.threadId) return;
      setThreads(prev => prev.map(th =>
        th.id === data.threadId
          ? { ...th, unread: Number(data.unreadCount ?? th.unread) }
          : th
      ));
    });

    // Message edited
    const unsub3 = on('message:edited', (data) => {
      if (!data?.threadId) return;
      const newText = data?.message?.content?.text || data?.text || '';
      setThreads(prev => prev.map(th =>
        th.id === data.threadId ? { ...th, lastMsg: msgPreview(newText, th.lastMsgType) } : th
      ));
    });

    // Message deleted/recalled
    const unsub4 = on('message:deleted', (data) => {
      if (!data?.threadId) return;
      setThreads(prev => prev.map(th =>
        th.id === data.threadId ? { ...th, lastMsg: 'Message deleted' } : th
      ));
    });

    // Message recalled
    const unsub9 = on('message:recalled', (data) => {
      if (!data?.threadId) return;
      loadThreads(); // Reload to get correct last message
    });

    // Sent message ack — update our own sent messages in thread list
    const unsub8 = on('message:ack', (data) => {
      if (!data?.threadId || !data?.message) return;
      const msg = data.message;
      const preview = msgPreview(msg?.content?.text || msg?.message || '', msg?.type || msg?.message_type);
      setThreads(prev => {
        const idx = prev.findIndex(th => th.id === data.threadId);
        if (idx === -1) {
          loadThreads();
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMsg: preview,
          lastMsgType: msg?.type || msg?.message_type,
          lastTime: new Date().toISOString(),
          senderId: user?.id,
          lastStatus: msg?.status || 'sent',
          lastDirection: 'outgoing',
        };
        updated.sort((a, b) => {
          const ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
          const tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
          return tb - ta;
        });
        return updated;
      });
    });

    // Online/Offline/Status — real-time status tracking
    const unsub5 = on('user:online', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid) setUserStatuses(prev => ({ ...prev, [uid]: data?.status || 'Online' }));
    });
    const unsub6 = on('user:offline', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid) setUserStatuses(prev => ({ ...prev, [uid]: 'offline' }));
    });
    const unsubStatus = on('user:status', (data) => {
      const uid = String(data?.userId || data?.user_id || data);
      if (uid && data?.status) setUserStatuses(prev => ({ ...prev, [uid]: data.status }));
    });
    const unsubList = on('users:online_list', (data) => {
      const list = data?.users || data || [];
      const map = {};
      list.forEach(u => { const uid = String(u.userId || u.user_id || u.id || u); map[uid] = u.status || u.activity_status || 'Online'; });
      setUserStatuses(prev => ({ ...prev, ...map }));
    });

    // Read ack — mark our messages as read + update tick
    const unsub7 = on('message:read_ack', (data) => {
      if (!data?.threadId) return;
      setThreads(prev => prev.map(th =>
        th.id === data.threadId ? { ...th, unread: 0, lastStatus: th.lastDirection === 'outgoing' ? 'read' : th.lastStatus } : th
      ));
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsubStatus(); unsubList(); unsub7(); unsub8(); unsub9(); };
  }, [on, user?.id, loadThreads]);

  const onRefresh = async () => { setRefreshing(true); await loadThreads(); setRefreshing(false); };

  // Global search — searches all messages across all chats
  const handleGlobalSearch = useCallback((q) => {
    setGlobalSearch(q);
    if (globalTimer.current) clearTimeout(globalTimer.current);
    if (!q || q.trim().length < 2) { setGlobalResults(null); return; }
    globalTimer.current = setTimeout(async () => {
      setGlobalLoading(true);
      try {
        const { data } = await api.get('/chat/search', { params: { q: q.trim(), limit: 30 } });
        const r = data?.data || data;
        setGlobalResults(r?.results || r?.messages || r || []);
      } catch { setGlobalResults([]); }
      finally { setGlobalLoading(false); }
    }, 400);
  }, []);

  // Apply filter + search + pin sort + archive hide
  const filtered = threads.filter(th => {
    if (archivedChats?.has?.(th.id)) return false; // hide archived
    if (chatFilter === 'groups' && th.type !== 'group') return false;
    if (chatFilter === 'unread' && !th.unread) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (th.name || '').toLowerCase().includes(q) || (th.email || '').toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    // Pinned chats first
    const ap = pinnedChats?.has?.(a.id) ? 1 : 0;
    const bp = pinnedChats?.has?.(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return 0; // keep existing time sort
  });

  const [pinnedChats, setPinnedChats] = useState(() => new Set());
  const [archivedChats, setArchivedChats] = useState(() => new Set());
  const [longPressItem, setLongPressItem] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null); // { uri, name }

  // Load pinned/archived from storage
  useEffect(() => {
    (async () => {
      try {

        const p = await AsyncStorage.getItem('pinned_chats');
        const a = await AsyncStorage.getItem('archived_chats');
        if (p) setPinnedChats(new Set(JSON.parse(p)));
        if (a) setArchivedChats(new Set(JSON.parse(a)));
      } catch {}
    })();
  }, []);

  const togglePin = async (id) => {
    const next = new Set(pinnedChats);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPinnedChats(next);
    setLongPressItem(null);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('pinned_chats', JSON.stringify([...next]));
    } catch {}
  };

  const toggleArchive = async (id) => {
    const next = new Set(archivedChats);
    if (next.has(id)) next.delete(id); else next.add(id);
    setArchivedChats(next);
    setLongPressItem(null);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('archived_chats', JSON.stringify([...next]));
    } catch {}
  };

  const openChat = (thread) => {
    router.push(`/chat/${thread.id}?name=${encodeURIComponent(thread.name || '')}&avatar=${encodeURIComponent(thread.avatar || '')}`);
  };

  const renderThread = useCallback(({ item }) => {
    const isGroup = item.type === 'group';
    const isSelf = item.type === 'self';
    const isOwn = item.senderId && String(item.senderId) === String(user?.id);

    // Build last message preview
    let preview = '';
    if (isSelf && !item.lastMsg) {
      preview = item.email || 'Message yourself';
    } else if (isGroup && item.lastMsg && item.lastSender) {
      preview = `${item.lastSender}: ${item.lastMsg}`;
    } else if (isOwn && item.lastMsg) {
      preview = `You: ${item.lastMsg}`;
    } else {
      preview = item.lastMsg || (isGroup ? item.description || '' : item.email || '');
    }

    return (
      <TouchableOpacity
        style={[s.thread, { borderBottomColor: isDark ? '#1e293b' : (t.divider || '#f1f5f9') }, item.unread > 0 && { backgroundColor: isDark ? 'rgba(234,76,137,0.08)' : 'rgba(234,76,137,0.04)' }]}
        onPress={() => openChat(item)}
        onLongPress={() => { Vibration.vibrate(30); setLongPressItem(item); }}
        delayLongPress={400}
        activeOpacity={0.55}
      >
        {item.unread > 0 && <View style={[s.unreadStripe, { backgroundColor: t.accent }]} />}
        <View style={s.avatarWrap}>
          <Avatar uri={item.avatar} name={isSelf ? '📌' : item.name} size={52}
            status={!isGroup && !isSelf ? (userStatuses[item.id?.replace('dm-', '')] || (item.online ? 'Online' : undefined)) : undefined}
            isGlobal={!isGroup && !isSelf && item.isGlobal}
            onPress={item.avatar ? () => setViewPhoto({ uri: item.avatar, name: item.name }) : undefined} />
          {isGroup && (
            <View style={[s.groupBadge, { backgroundColor: t.accent }]}>
              <Ionicons name="people" size={9} color="#fff" />
            </View>
          )}
        </View>

        <View style={s.threadBody}>
          <View style={s.threadTop}>
            <Text style={[s.threadName, { color: t.text }, item.unread > 0 && s.bold]} numberOfLines={1}>
              {isSelf ? '📌 Myself' : item.name}
            </Text>
            {pinnedChats?.has?.(item.id) && <Ionicons name="pin" size={12} color={t.accent} style={{ marginRight: 2 }} />}
            {item.lastTime && (
              <Text style={[s.threadTime, { color: item.unread > 0 ? t.accent : t.textTer }]}>
                {formatTime(item.lastTime)}
              </Text>
            )}
          </View>

          <View style={s.threadBottom}>
            {/* Tick — only for outgoing messages with correct status */}
            {item.lastDirection === 'outgoing' && item.lastMsg && (
              item.lastStatus === 'read' ? <Ionicons name="checkmark-done" size={14} color="#53bdeb" style={{ marginRight: 4 }} /> :
              item.lastStatus === 'delivered' ? <Ionicons name="checkmark-done" size={14} color={t.textTer} style={{ marginRight: 4 }} /> :
              item.lastStatus === 'sent' ? <Ionicons name="checkmark" size={14} color={t.textTer} style={{ marginRight: 4 }} /> :
              <Ionicons name="time-outline" size={12} color={t.textTer} style={{ marginRight: 4 }} />
            )}
            <Text style={[s.threadPreview, { color: item.unread > 0 ? t.text : t.textSec }, item.unread > 0 && { fontWeight: '600' }]} numberOfLines={1}>
              {preview}
            </Text>
            {item.unread > 0 && (
              <View style={[s.unreadBadge, { backgroundColor: t.accent }]}>
                <Text style={s.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [t, user?.id, pinnedChats, userStatuses, isDark]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      {!showGlobalSearch ? (
        <View style={[s.header, { backgroundColor: isDark ? '#111b21' : '#fff', borderBottomWidth: isDark ? 1 : 0, borderBottomColor: '#1e293b', ...Platform.select({ ios: { shadowColor: t.shadow }, android: { elevation: isDark ? 0 : 2 } }) }]}>
          <Text style={[s.headerTitle, { color: t.text }]}>Chats</Text>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.headerBtn} onPress={() => { setShowGlobalSearch(true); setTimeout(() => searchInputRef.current?.focus(), 200); }}>
              <Ionicons name="search-outline" size={22} color={t.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerBtn} onPress={() => setShowHeaderMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color={t.icon} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Global Search Header */
        <View style={[s.header, { backgroundColor: t.card, ...Platform.select({ ios: { shadowColor: t.shadow }, android: { elevation: 2 } }) }]}>
          <TouchableOpacity onPress={() => { setShowGlobalSearch(false); setGlobalSearch(''); setGlobalResults(null); }} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={t.text} />
          </TouchableOpacity>
          <View style={[s.globalSearchBox, { backgroundColor: t.surfaceAlt }]}>
            <Ionicons name="search" size={16} color={t.textTer} />
            <TextInput ref={searchInputRef} style={[s.globalSearchInput, { color: t.text }]}
              placeholder="Search all messages..." placeholderTextColor={t.textTer}
              value={globalSearch} onChangeText={handleGlobalSearch} autoFocus />
            {globalLoading && <ActivityIndicator size="small" color={t.accent} />}
            {globalSearch.length > 0 && !globalLoading && (
              <TouchableOpacity onPress={() => { setGlobalSearch(''); setGlobalResults(null); }} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={t.textTer} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Thread filter search + chips (when not in global search) */}
      {!showGlobalSearch && (
        <View style={[s.searchWrap, { backgroundColor: isDark ? '#0b141a' : '#fff', borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
          <View style={[s.searchBox, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <Ionicons name="search" size={16} color={t.textTer} />
            <TextInput style={[s.searchInput, { color: t.text }]} placeholder="Search..."
              placeholderTextColor={t.textTer} value={search} onChangeText={setSearch} />
            {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={t.textTer} /></TouchableOpacity> : null}
          </View>
          {/* Filter chips */}
          <View style={s.filterRow}>
            {[
              { key: 'all', label: 'All', icon: 'chatbubbles-outline' },
              { key: 'groups', label: 'Groups', icon: 'people-outline' },
              { key: 'unread', label: 'Unread', icon: 'mail-unread-outline' },
            ].map(f => {
              const active = chatFilter === f.key;
              const count = f.key === 'unread' ? threads.filter(th => th.unread > 0).length
                : f.key === 'groups' ? threads.filter(th => th.type === 'group').length : 0;
              return (
                <TouchableOpacity key={f.key}
                  style={[s.filterChip, {
                    backgroundColor: active ? `${t.accent}15` : (isDark ? '#1e293b' : '#f1f5f9'),
                    borderColor: active ? t.accent : (isDark ? '#334155' : '#e2e8f0'),
                  }]}
                  onPress={() => setChatFilter(chatFilter === f.key ? 'all' : f.key)}
                  activeOpacity={0.7}>
                  <Ionicons name={active ? f.icon.replace('-outline', '') : f.icon} size={14}
                    color={active ? t.accent : t.textTer} />
                  <Text style={[s.filterChipText, { color: active ? t.accent : t.textTer }]}>{f.label}</Text>
                  {count > 0 && f.key !== 'all' && (
                    <View style={[s.filterCount, { backgroundColor: active ? t.accent : t.textTer }]}>
                      <Text style={s.filterCountText}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ─── Global Search Results ─── */}
      {showGlobalSearch ? (
        globalResults === null ? (
          <View style={s.empty}>
            <Ionicons name="search" size={44} color={t.border} />
            <Text style={[s.emptyTitle, { color: t.textSec }]}>Search messages</Text>
            <Text style={[s.emptySub, { color: t.textTer }]}>Find messages across all your chats</Text>
          </View>
        ) : globalResults.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={44} color={t.border} />
            <Text style={[s.emptyTitle, { color: t.textSec }]}>No results</Text>
            <Text style={[s.emptySub, { color: t.textTer }]}>Try different keywords</Text>
          </View>
        ) : (
          <FlatList
            data={globalResults}
            keyExtractor={(item, i) => item.id || String(i)}
            contentContainerStyle={{ paddingBottom: 80 }}
            ListHeaderComponent={
              <Text style={[s.resultCount, { color: t.textTer }]}>{globalResults.length} result{globalResults.length !== 1 ? 's' : ''}</Text>
            }
            renderItem={({ item }) => {
              const c = item?.content || {};
              const m = item?.metadata || {};
              const isOwn = String(item?.author?.id) === String(user?.id);
              const msgText = c?.text || c?.url || c?.code || c?.fileName || '';
              const msgType = item?.type || 'text';
              const time = m?.sentAt || item?.createdAt || '';
              const tid = item?.threadId || '';
              const chatName = item?.groupName || (isOwn ? item?.author?.name : item?.author?.name) || '';
              const isGroup = tid.startsWith('group-');

              let typeIcon = null;
              if (msgType === 'image') typeIcon = '📷';
              else if (msgType === 'video') typeIcon = '🎬';
              else if (msgType === 'file') typeIcon = '📄';
              else if (msgType === 'audio') typeIcon = '🎵';
              else if (msgType === 'link') typeIcon = '🔗';

              return (
                <TouchableOpacity style={[s.resultRow, { borderBottomColor: t.divider }]}
                  onPress={() => {
                    setShowGlobalSearch(false); setGlobalSearch(''); setGlobalResults(null);
                    router.push(`/chat/${tid}?name=${encodeURIComponent(chatName)}&avatar=${encodeURIComponent(item?.author?.avatar || '')}`);
                  }} activeOpacity={0.6}>
                  <Avatar uri={item?.author?.avatar} name={item?.author?.name} size={46} />
                  <View style={{ flex: 1 }}>
                    <View style={s.resultTop}>
                      <Text style={[s.resultName, { color: t.text }]}>{isOwn ? 'You' : item?.author?.name}</Text>
                      {isGroup && item?.groupName && (
                        <Text style={[s.resultGroup, { color: t.accent }]} numberOfLines={1}> in {item.groupName}</Text>
                      )}
                      <Text style={[s.resultTime, { color: t.textTer }]}>{formatTime(time)}</Text>
                    </View>
                    <Text style={[s.resultMsg, { color: t.textSec }]} numberOfLines={2}>
                      {typeIcon ? `${typeIcon} ` : ''}{msgText}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )
      ) : (
        /* ─── Normal Thread List ─── */
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderThread}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.accent]} />}
          contentContainerStyle={filtered.length === 0 ? s.emptyWrap : { paddingBottom: 80 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={15}
          getItemLayout={(_, index) => ({ length: 78, offset: 78 * index, index })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name={loading ? 'chatbubbles' : 'chatbubbles-outline'} size={52} color={t.border} />
              <Text style={[s.emptyTitle, { color: t.textSec }]}>{loading ? 'Loading...' : 'No conversations'}</Text>
              <Text style={[s.emptySub, { color: t.textTer }]}>Start chatting from Contacts</Text>
            </View>
          }
        />
      )}

      {/* Long-press action sheet */}
      {longPressItem && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLongPressItem(null)}>
          <Pressable style={s.actionOverlay} onPress={() => setLongPressItem(null)}>
            <View style={[s.actionSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
              <Text style={[s.actionTitle, { color: t.text }]} numberOfLines={1}>{longPressItem.name}</Text>
              {[
                { icon: pinnedChats?.has?.(longPressItem.id) ? 'pin' : 'pin-outline', label: pinnedChats?.has?.(longPressItem.id) ? 'Unpin' : 'Pin to top', onPress: () => togglePin(longPressItem.id), color: t.accent },
                { icon: 'archive-outline', label: 'Archive', onPress: () => toggleArchive(longPressItem.id), color: '#f59e0b' },
                ...(String(longPressItem.id || '').startsWith('group-') ? [{
                  icon: 'eye-off-outline',
                  label: 'Hide from list',
                  color: '#64748b',
                  onPress: async () => {
                    const groupId = String(longPressItem.id).replace('group-', '');
                    setLongPressItem(null);
                    try {
                      await hideGroupThread(groupId);
                      setThreads((prev) => prev.filter((th) => th.id !== `group-${groupId}`));
                    } catch (e) {
                      console.warn('[hide-thread] failed:', e?.message);
                    }
                  },
                }] : []),
                { icon: 'notifications-off-outline', label: 'Mute', onPress: () => setLongPressItem(null), color: '#64748b' },
              ].map((a, i) => (
                <TouchableOpacity key={i} style={[s.actionRow, { borderTopColor: isDark ? '#334155' : '#f1f5f9' }]} onPress={a.onPress} activeOpacity={0.6}>
                  <Ionicons name={a.icon} size={20} color={a.color} />
                  <Text style={[s.actionLabel, { color: t.text }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Header 3-dot menu */}
      {showHeaderMenu && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowHeaderMenu(false)}>
          <Pressable style={s.menuOverlay} onPress={() => setShowHeaderMenu(false)}>
            <View style={[s.menuSheet, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
              {[
                { icon: 'chatbubble-ellipses', label: 'New Chat', onPress: () => { setShowHeaderMenu(false); router.push('/(tabs)/contacts'); } },
                { icon: 'people-outline', label: 'New Group', onPress: () => { setShowHeaderMenu(false); router.push('/chat/create-group'); } },
                { icon: 'megaphone-outline', label: 'Broadcast', onPress: () => { setShowHeaderMenu(false); router.push('/chat/broadcast'); } },
                { icon: 'videocam-outline', label: 'Meetings', onPress: () => { setShowHeaderMenu(false); router.push('/meetings'); } },
                { icon: 'time-outline', label: 'Scheduled', onPress: () => { setShowHeaderMenu(false); router.push('/chat/scheduled'); } },
                { icon: 'star-outline', label: 'Starred Messages', onPress: () => { setShowHeaderMenu(false); router.push('/chat/starred'); } },
                { icon: 'qr-code-outline', label: 'Linked Devices', onPress: () => { setShowHeaderMenu(false); router.push('/chat/linked-devices'); } },
                { icon: 'settings-outline', label: 'Settings', onPress: () => { setShowHeaderMenu(false); router.push('/(tabs)/profile'); } },
                ...(Number(user?.role_id) >= 1 && Number(user?.role_id) <= 3 ? [{ icon: 'shield-checkmark-outline', label: 'Admin Panel', onPress: () => { setShowHeaderMenu(false); router.push('/chat/admin'); } }] : []),
              ].map((item, i) => (
                <TouchableOpacity key={i} style={[s.menuRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}
                  onPress={item.onPress} activeOpacity={0.6}>
                  <Ionicons name={item.icon} size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                  <Text style={[s.menuRowText, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Photo Viewer */}
      <ImageViewer visible={!!viewPhoto} uri={viewPhoto?.uri} caption={viewPhoto?.name} onClose={() => setViewPhoto(null)} />

      {/* AI Assistant FAB */}
      <TouchableOpacity style={[s.fab, { backgroundColor: t.accent }]} activeOpacity={0.85}
        onPress={() => router.push('/chat/assistant')}>
        <Ionicons name="sparkles" size={22} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 3 } }),
  },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', gap: 2 },
  headerBtn: { padding: 8, borderRadius: 20 },

  // Global search header
  globalSearchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 40, marginLeft: 10 },
  globalSearchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Filter search + chips
  searchWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '400' },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  filterCount: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // Global search results
  resultCount: { fontSize: 12, fontWeight: '600', paddingHorizontal: 18, paddingVertical: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  resultName: { fontSize: 14, fontWeight: '700' },
  resultGroup: { fontSize: 12, fontWeight: '600', flex: 1 },
  resultTime: { fontSize: 11, marginLeft: 'auto' },
  resultMsg: { fontSize: 13, lineHeight: 18 },

  thread: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 14, position: 'relative', overflow: 'hidden' },
  unreadStripe: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  avatarWrap: { position: 'relative' },
  groupBadge: { position: 'absolute', bottom: -1, right: -1, width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff' },
  threadBody: { flex: 1 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  threadName: { fontSize: 16, fontWeight: '500', flex: 1, marginRight: 10 },
  bold: { fontWeight: '800' },
  threadTime: { fontSize: 11, fontWeight: '500' },
  threadBottom: { flexDirection: 'row', alignItems: 'center' },
  threadPreview: { fontSize: 13.5, flex: 1, marginRight: 8, lineHeight: 18 },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  emptyWrap: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, lineHeight: 18 },
  fab: {
    position: 'absolute', bottom: 22, right: 18,
    width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 }, android: { elevation: 10 } }),
  },
  // Header 3-dot menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  menuSheet: { position: 'absolute', top: 80, right: 14, borderRadius: 16, paddingVertical: 6, minWidth: 200, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  menuRowText: { fontSize: 15, fontWeight: '600' },

  // Long-press action sheet
  actionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  actionSheet: { borderRadius: 20, width: 260, paddingVertical: 12, paddingHorizontal: 4, elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
  actionTitle: { fontSize: 16, fontWeight: '800', paddingHorizontal: 16, paddingBottom: 10, textAlign: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  actionLabel: { fontSize: 15, fontWeight: '600' },
});
