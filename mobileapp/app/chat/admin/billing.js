import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import api from '../../../src/api/config';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fmtCurrency = (amt, cur) => `${cur || '₹'}${Number(amt || 0).toLocaleString()}`;

export default function BillingScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#f8fafc';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  useEffect(() => {
    (async () => {
      try {
        const [meRes, payRes] = await Promise.all([
          api.get('/auth/me').catch(() => null),
          api.get('/billing/payment-history').catch(() => null),
        ]);
        const d = meRes?.data?.data || meRes?.data || {};
        setPlan(d?.current_plan || null);
        setPayments(payRes?.data?.data?.rows || payRes?.data?.data || []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Billing & Plan</Text>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}>
          {/* Current Plan */}
          {plan && (
            <View style={[s.planCard, { backgroundColor: cardBg }]}>
              <View style={[s.planBadge, { backgroundColor: `${ACCENT}12` }]}>
                <Ionicons name="diamond" size={18} color={ACCENT} />
                <Text style={[s.planName, { color: ACCENT }]}>{plan.plan_name || 'Free'}</Text>
              </View>
              <View style={s.planGrid}>
                <View style={s.planItem}>
                  <Text style={[s.planValue, { color: textColor }]}>{plan.max_users || '∞'}</Text>
                  <Text style={[s.planLabel, { color: subColor }]}>Max Users</Text>
                </View>
                <View style={s.planItem}>
                  <Text style={[s.planValue, { color: textColor }]}>{plan.max_storage_mb ? `${plan.max_storage_mb}MB` : '∞'}</Text>
                  <Text style={[s.planLabel, { color: subColor }]}>Storage</Text>
                </View>
                <View style={s.planItem}>
                  <Text style={[s.planValue, { color: textColor }]}>{plan.subscription_status || 'Active'}</Text>
                  <Text style={[s.planLabel, { color: subColor }]}>Status</Text>
                </View>
              </View>
              {plan.end_date && (
                <Text style={[s.planExpiry, { color: subColor }]}>Expires: {fmtDate(plan.end_date)}</Text>
              )}
            </View>
          )}

          {/* Payment History */}
          <Text style={[s.sectionTitle, { color: textColor }]}>Payment History</Text>
          {payments.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="receipt-outline" size={36} color={subColor} />
              <Text style={[s.emptyText, { color: subColor }]}>No payment history</Text>
            </View>
          ) : payments.map((p, i) => (
            <View key={p.payment_id || i} style={[s.payCard, { backgroundColor: cardBg }]}>
              <View style={[s.payIcon, { backgroundColor: p.status === 'completed' ? '#22c55e12' : '#f59e0b12' }]}>
                <Ionicons name={p.status === 'completed' ? 'checkmark-circle' : 'time'} size={20}
                  color={p.status === 'completed' ? '#22c55e' : '#f59e0b'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.payAmount, { color: textColor }]}>{fmtCurrency(p.amount, p.currency)}</Text>
                <Text style={[s.payMeta, { color: subColor }]}>{p.plan_name || 'Plan'} · {fmtDate(p.created_at)}</Text>
              </View>
              <View style={[s.payStatus, { backgroundColor: p.status === 'completed' ? '#22c55e12' : '#f59e0b12' }]}>
                <Text style={[s.payStatusText, { color: p.status === 'completed' ? '#22c55e' : '#f59e0b' }]}>{p.status}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },

  planCard: { margin: 14, padding: 20, borderRadius: 18, elevation: 2, alignItems: 'center' },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, marginBottom: 16 },
  planName: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  planGrid: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
  planItem: { alignItems: 'center', gap: 4 },
  planValue: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  planLabel: { fontSize: 11, fontWeight: '600' },
  planExpiry: { fontSize: 12, marginTop: 14 },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginHorizontal: 18, marginTop: 12, marginBottom: 8 },

  emptyCard: { margin: 14, padding: 30, borderRadius: 16, alignItems: 'center', gap: 8, elevation: 1 },
  emptyText: { fontSize: 14 },

  payCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 8, padding: 14, borderRadius: 14, elevation: 1 },
  payIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payAmount: { fontSize: 16, fontWeight: '800' },
  payMeta: { fontSize: 12, marginTop: 2 },
  payStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  payStatusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
