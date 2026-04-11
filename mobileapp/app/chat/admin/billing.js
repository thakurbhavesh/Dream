import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import api from '../../../src/api/config';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
const fmtStorage = (mb) => {
  const n = Number(mb || 0);
  if (n >= 1024) return `${(n / 1024).toFixed(1)} GB`;
  return `${n} MB`;
};

export default function BillingScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');

  useEffect(() => {
    (async () => {
      try {
        const [meRes, payRes] = await Promise.all([
          api.get('/auth/me').catch(() => null),
          api.get('/billing/payment-history').catch(() => null),
        ]);
        const d = meRes?.data?.data || meRes?.data || {};
        setData({
          plan: d?.current_plan || {},
          usage: d?.usage || {},
          org: d?.organization || {},
          counts: d?.counts || {},
        });
        const payRows = payRes?.data?.data?.rows || payRes?.data?.data || [];
        setPayments(Array.isArray(payRows) ? payRows.slice(0, 10) : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const plan = data?.plan || {};
  const usage = data?.usage || {};
  const counts = data?.counts || {};
  const usedMB = Number(usage.storage_used_mb || 0);
  const limitMB = Number(usage.storage_limit_mb || 0);
  const pct = limitMB > 0 ? Math.min((usedMB / limitMB) * 100, 100) : 0;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Plan & Storage</Text>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 50 }} showsVerticalScrollIndicator={false}>

          {/* Plan Card */}
          <View style={[s.planCard, { backgroundColor: isDark ? '#0c2d48' : '#eff6ff', borderColor: isDark ? '#1e3a5f' : '#bfdbfe' }]}>
            <View style={s.planTop}>
              <Ionicons name="diamond" size={28} color="#3b82f6" />
              <View style={{ flex: 1 }}>
                <Text style={s.planName}>{plan.plan_name || 'Free'}</Text>
                <Text style={[s.planDesc, { color: subColor }]}>{data?.org?.name || 'Organization'}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: '#22c55e18' }]}>
                <View style={s.statusDot} />
                <Text style={s.statusText}>{plan.subscription_status || 'Active'}</Text>
              </View>
            </View>

            {/* Plan stats */}
            <View style={s.statsRow}>
              <View style={[s.stat, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                <Ionicons name="people" size={18} color="#3b82f6" />
                <Text style={[s.statValue, { color: textColor }]}>{plan.max_users || '∞'}</Text>
                <Text style={[s.statLabel, { color: subColor }]}>Max Users</Text>
              </View>
              <View style={[s.stat, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                <Ionicons name="calendar" size={18} color="#8b5cf6" />
                <Text style={[s.statValue, { color: textColor }]}>{plan.interval_days === 30 ? 'Monthly' : plan.interval_days === 365 ? 'Yearly' : plan.interval_days ? `${plan.interval_days}d` : '–'}</Text>
                <Text style={[s.statLabel, { color: subColor }]}>Cycle</Text>
              </View>
              <View style={[s.stat, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                <Ionicons name="time" size={18} color="#f59e0b" />
                <Text style={[s.statValue, { color: textColor }]}>{fmtDate(plan.end_date)}</Text>
                <Text style={[s.statLabel, { color: subColor }]}>Renewal</Text>
              </View>
            </View>
          </View>

          {/* Storage Card */}
          <Text style={[s.sectionTitle, { color: textColor }]}>Storage</Text>
          <View style={[s.storageCard, { backgroundColor: cardBg }]}>
            <View style={s.storageTop}>
              <View style={[s.storageIcon, { backgroundColor: '#06b6d412' }]}>
                <Ionicons name="cloud" size={24} color="#06b6d4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.storageUsed, { color: textColor }]}>{fmtStorage(usedMB)}</Text>
                <Text style={[s.storageLimit, { color: subColor }]}>of {limitMB > 0 ? fmtStorage(limitMB) : 'Unlimited'}</Text>
              </View>
              <Text style={[s.storagePct, { color: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e' }]}>{pct.toFixed(0)}%</Text>
            </View>
            <View style={[s.storageBar, { backgroundColor: isDark ? '#0f172a' : '#e2e8f0' }]}>
              <View style={[s.storageFill, { width: `${pct}%`, backgroundColor: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e' }]} />
            </View>
          </View>

          {/* Usage Breakdown */}
          <Text style={[s.sectionTitle, { color: textColor }]}>Usage</Text>
          {[
            { icon: 'people', label: 'Active Members', value: counts.active_members || 0, max: plan.max_users || '∞', color: '#3b82f6' },
            { icon: 'phone-portrait', label: 'Devices', value: counts.user_devices || 0, color: '#8b5cf6' },
            { icon: 'key', label: 'Sessions', value: counts.user_sessions || 0, color: '#f59e0b' },
            { icon: 'shield-checkmark', label: 'OTP Verifications', value: counts.otp_verifications || 0, color: '#22c55e' },
          ].map((item, i) => (
            <View key={i} style={[s.usageRow, { backgroundColor: cardBg }]}>
              <View style={[s.usageIcon, { backgroundColor: `${item.color}12` }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={[s.usageLabel, { color: textColor }]}>{item.label}</Text>
              <Text style={[s.usageValue, { color: textColor }]}>{item.value}</Text>
              {item.max && <Text style={[s.usageMax, { color: subColor }]}>/ {item.max}</Text>}
            </View>
          ))}

          {/* Org info */}
          <Text style={[s.sectionTitle, { color: textColor }]}>Organization</Text>
          <View style={[s.orgCard, { backgroundColor: cardBg }]}>
            {[
              { icon: 'business', label: 'Name', value: data?.org?.name },
              { icon: 'globe', label: 'Domain', value: data?.org?.subdomain || data?.org?.custom_domain },
              { icon: 'calendar', label: 'Created', value: fmtDate(data?.org?.created_at) },
            ].filter(r => r.value).map((r, i) => (
              <View key={i} style={[s.orgRow, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}>
                <Ionicons name={r.icon} size={16} color={subColor} />
                <Text style={[s.orgLabel, { color: subColor }]}>{r.label}</Text>
                <Text style={[s.orgValue, { color: textColor }]}>{r.value}</Text>
              </View>
            ))}
          </View>

          {/* Payment History */}
          {payments.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: textColor }]}>Recent Payments</Text>
              {payments.map((p, i) => {
                const isSuccess = (p.status || '').toLowerCase() === 'success' || (p.status || '').toLowerCase() === 'completed';
                const isFailed = (p.status || '').toLowerCase() === 'failed';
                const stColor = isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#f59e0b';
                return (
                  <View key={p.payment_id || i} style={[s.payCard, { backgroundColor: cardBg }]}>
                    <View style={[s.payIcon, { backgroundColor: `${stColor}12` }]}>
                      <Ionicons name={isSuccess ? 'checkmark-circle' : isFailed ? 'close-circle' : 'time'} size={20} color={stColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.payAmount, { color: textColor }]}>{fmtStorage(0).replace('0 MB', '')}₹{Number(p.amount || 0).toLocaleString('en-IN')}</Text>
                      <Text style={[s.payMeta, { color: subColor }]}>{p.plan_name || 'Plan'} · {(p.gateway || '').charAt(0).toUpperCase() + (p.gateway || '').slice(1)} · {fmtDate(p.created_at)}</Text>
                    </View>
                    <View style={[s.payBadge, { backgroundColor: `${stColor}12` }]}>
                      <Text style={[s.payBadgeText, { color: stColor }]}>{p.status}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff' },

  planCard: { margin: 14, padding: 20, borderRadius: 20, borderWidth: 1.5 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  planName: { fontSize: 24, fontWeight: '900', color: '#3b82f6', letterSpacing: -0.3 },
  planDesc: { fontSize: 12, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#22c55e', textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12, borderRadius: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginHorizontal: 18, marginTop: 16, marginBottom: 8 },

  storageCard: { marginHorizontal: 14, padding: 18, borderRadius: 18, elevation: 1 },
  storageTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  storageIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  storageUsed: { fontSize: 22, fontWeight: '900' },
  storageLimit: { fontSize: 12, marginTop: 2 },
  storagePct: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  storageBar: { height: 10, borderRadius: 5, overflow: 'hidden' },
  storageFill: { height: '100%', borderRadius: 5 },

  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 6, padding: 14, borderRadius: 14, elevation: 1 },
  usageIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  usageLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  usageValue: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  usageMax: { fontSize: 13 },

  payCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 6, padding: 14, borderRadius: 14, elevation: 1 },
  payIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payAmount: { fontSize: 15, fontWeight: '800' },
  payMeta: { fontSize: 11, marginTop: 2 },
  payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  payBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  orgCard: { marginHorizontal: 14, borderRadius: 16, overflow: 'hidden', elevation: 1 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  orgLabel: { fontSize: 12, fontWeight: '600', width: 60 },
  orgValue: { flex: 1, fontSize: 14, fontWeight: '700' },
});
