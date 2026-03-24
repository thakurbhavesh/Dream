import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useColorScheme, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ThemeContext = createContext({});

const DEFAULT_ACCENT = '#ea4c89';
const FONT_SIZES = { Small: 13, Normal: 15, Large: 17 };
const FONTS = {
  'SF Display': Platform.OS === 'ios' ? 'System' : 'sans-serif',
  'Poppins': 'sans-serif',
  'Noto Sans': 'sans-serif',
  'Inter': 'sans-serif',
  'Roboto': 'sans-serif',
};

const buildTheme = (isDark, accent, fontFamily, fontSizeKey) => {
  const accentDark = darkenColor(accent, 20);
  const fs = FONT_SIZES[fontSizeKey] || 15;
  const ff = FONTS[fontFamily] || 'sans-serif';
  const base = {
    accent, accentDark,
    accentBg: isDark ? `${accent}18` : `${accent}10`,
    accentSoft: `${accent}08`,
    fontFamily: ff,
    fontSizeKey,
    fontSize: fs,
    fontSizeSmall: fs - 2,
    fontSizeLarge: fs + 2,
    fontSizeTitle: fs + 9,
    fontSizeHeader: fs + 5,
  };

  if (isDark) {
    return {
      ...base, mode: 'dark',
      bg: '#0b1120', surface: '#1e293b', surfaceAlt: '#1e293b', surfaceHover: '#253346',
      card: '#1e293b', cardAlt: '#162032',
      text: '#f1f5f9', textSec: '#94a3b8', textTer: '#64748b', textQuad: '#475569',
      border: '#334155', borderLight: '#1e293b', borderMed: '#475569',
      icon: '#64748b', iconActive: '#94a3b8',
      blue: '#3b82f6', blueBg: 'rgba(59,130,246,0.15)', blueSoft: 'rgba(59,130,246,0.08)',
      green: '#22c55e', greenBg: 'rgba(34,197,94,0.15)', greenSoft: 'rgba(34,197,94,0.08)',
      red: '#ef4444', redBg: 'rgba(239,68,68,0.15)', redSoft: 'rgba(239,68,68,0.08)',
      yellow: '#f59e0b', yellowBg: 'rgba(245,158,11,0.15)',
      purple: '#8b5cf6', purpleBg: 'rgba(139,92,246,0.15)',
      shadow: 'rgba(0,0,0,0.3)', shadowMed: 'rgba(0,0,0,0.4)', overlay: 'rgba(0,0,0,0.6)',
      tabBg: '#0f172a', inputBg: '#0f172a', inputBorder: '#334155', inputFocusBorder: accent,
      chatBg: '#0b141a', divider: '#1e293b', skeleton: '#334155',
      bubbleOwn: '#1a3a2a', bubbleOther: '#1e293b', bubbleOwnText: '#e2e8f0', bubbleOtherText: '#f1f5f9',
    };
  }
  return {
    ...base, mode: 'light',
    bg: '#f8f9fb', surface: '#ffffff', surfaceAlt: '#f1f5f9', surfaceHover: '#f8fafc',
    card: '#ffffff', cardAlt: '#fafbfe',
    text: '#0f172a', textSec: '#475569', textTer: '#94a3b8', textQuad: '#cbd5e1',
    border: '#e2e8f0', borderLight: '#f1f5f9', borderMed: '#cbd5e1',
    icon: '#94a3b8', iconActive: '#64748b',
    blue: '#2563eb', blueBg: '#dbeafe', blueSoft: 'rgba(37,99,235,0.08)',
    green: '#22c55e', greenBg: '#dcfce7', greenSoft: 'rgba(34,197,94,0.08)',
    red: '#ef4444', redBg: '#fee2e2', redSoft: 'rgba(239,68,68,0.08)',
    yellow: '#f59e0b', yellowBg: '#fef3c7',
    purple: '#8b5cf6', purpleBg: '#ede9fe',
    shadow: 'rgba(0,0,0,0.06)', shadowMed: 'rgba(0,0,0,0.10)', overlay: 'rgba(0,0,0,0.4)',
    tabBg: '#ffffff', inputBg: '#f8fafc', inputBorder: '#e2e8f0', inputFocusBorder: accent,
    chatBg: '#efeae2', divider: '#f1f5f9', skeleton: '#e2e8f0',
    bubbleOwn: '#dcf8c6', bubbleOther: '#ffffff', bubbleOwnText: '#303030', bubbleOtherText: '#0f172a',
  };
};

// Darken hex color by percentage
function darkenColor(hex, percent) {
  try {
    const h = hex.replace('#', '');
    const r = Math.max(0, parseInt(h.substring(0, 2), 16) - Math.round(255 * percent / 100));
    const g = Math.max(0, parseInt(h.substring(2, 4), 16) - Math.round(255 * percent / 100));
    const b = Math.max(0, parseInt(h.substring(4, 6), 16) - Math.round(255 * percent / 100));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch { return hex; }
}

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setMode] = useState('system');
  const [brandColor, setBrandColor] = useState(DEFAULT_ACCENT);
  const [fontFamily, setFontFamily] = useState('SF Display');
  const [fontSizeKey, setFontSizeKey] = useState('Normal');

  // Load saved preferences
  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('themeMode'),
      SecureStore.getItemAsync('brandColor'),
      SecureStore.getItemAsync('fontFamily'),
      SecureStore.getItemAsync('fontSizeKey'),
    ]).then(([m, bc, ff, fs]) => {
      if (m) setMode(m);
      if (bc && /^#[0-9A-Fa-f]{6}$/.test(bc)) setBrandColor(bc);
      if (ff) setFontFamily(ff);
      if (fs && FONT_SIZES[fs]) setFontSizeKey(fs);
    }).catch(() => {});
  }, []);

  const setTheme = useCallback(async (m) => {
    setMode(m);
    await SecureStore.setItemAsync('themeMode', m);
  }, []);

  const setBrand = useCallback(async (color) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      setBrandColor(color);
      await SecureStore.setItemAsync('brandColor', color);
    }
  }, []);

  const setFont = useCallback(async (ff) => {
    setFontFamily(ff);
    await SecureStore.setItemAsync('fontFamily', ff);
  }, []);

  const setFontSize = useCallback(async (fs) => {
    if (FONT_SIZES[fs]) {
      setFontSizeKey(fs);
      await SecureStore.setItemAsync('fontSizeKey', fs);
    }
  }, []);

  const resolved = mode === 'system' ? (system || 'light') : mode;
  const isDark = resolved === 'dark';
  const theme = useMemo(() => buildTheme(isDark, brandColor, fontFamily, fontSizeKey), [isDark, brandColor, fontFamily, fontSizeKey]);

  return (
    <ThemeContext.Provider value={{
      theme, mode, isDark,
      setTheme, setBrand, setFont, setFontSize,
      brandColor, fontFamily, fontSizeKey,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
