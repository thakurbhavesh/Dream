import { useState } from 'react';
import { View, Text, StyleSheet, Image as RNImage, TouchableOpacity } from 'react-native';

const COLORS = [
  '#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
  '#6366f1', '#f97316', '#0ea5e9', '#a855f7',
];

// Extract S3 key from presigned URL for stable cache key
const getStableKey = (url) => {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.pathname; // /bucket/files/2/xxx.jpg — stable across presigned URLs
  } catch { return url; }
};

// Status → dot color mapping
const STATUS_COLORS = {
  online: '#22c55e',   // green
  Online: '#22c55e',
  away: '#f59e0b',     // amber
  Away: '#f59e0b',
  idle: '#f59e0b',     // amber (same as away)
  Idle: '#f59e0b',
  busy: '#ef4444',     // red
  Busy: '#ef4444',
  dnd: '#ef4444',      // red
  DND: '#ef4444',
  offline: '#94a3b8',  // grey
  Offline: '#94a3b8',
};

const getStatusColor = (status) => {
  if (typeof status === 'boolean') return status ? '#22c55e' : '#94a3b8';
  if (typeof status === 'string') return STATUS_COLORS[status] || '#94a3b8';
  return '#94a3b8';
};

export default function Avatar({ uri: rawUri, name, size = 44, online, status, isGlobal, style, border = true, onPress }) {
  const uri = rawUri && rawUri !== 'undefined' && rawUri !== 'null' && rawUri !== '' && rawUri.length > 5 ? rawUri : null;
  const [failed, setFailed] = useState(false);
  const label = (name || '?').trim();
  const initials = label.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const ci = label.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length;
  const bg = COLORS[ci];
  const r = size / 2;
  const badgeSize = Math.max(size * 0.26, 11);

  const showImage = uri && !failed;
  // Global member → always orange dot, overrides status
  const showBadge = isGlobal || status !== undefined || online !== undefined;
  const dotColor = isGlobal ? '#FFB020' : (status ? getStatusColor(status) : (online !== undefined ? getStatusColor(online) : null));

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { activeOpacity: 0.8, onPress } : {};

  return (
    <Wrapper style={[z.wrap, { width: size, height: size }, style]} {...wrapperProps}>
      {showImage ? (
        <RNImage source={{ uri }} onError={() => setFailed(true)}
          style={[z.img, { width: size, height: size, borderRadius: r }, border && z.imgBorder]} />
      ) : (
        <View style={[z.fallback, { width: size, height: size, borderRadius: r, backgroundColor: bg }, border && z.fallbackBorder]}>
          <Text style={[z.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
        </View>
      )}
      {showBadge && dotColor && (
        <View style={[z.badgeOuter, { width: badgeSize + 3, height: badgeSize + 3, borderRadius: (badgeSize + 3) / 2, bottom: -1, right: -1 }]}>
          <View style={[z.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2, backgroundColor: dotColor }]} />
        </View>
      )}
    </Wrapper>
  );
}

const z = StyleSheet.create({
  wrap: { position: 'relative' },
  img: { backgroundColor: '#e8ecf4' },
  imgBorder: { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackBorder: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  initials: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
  badgeOuter: { position: 'absolute', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  badge: {},
});
