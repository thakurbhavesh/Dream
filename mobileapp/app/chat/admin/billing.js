import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import { useToast } from '../../../src/components/Toast';
import api from '../../../src/api/config';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtCurrency = (amt, cur) => {
  const symbol = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₹';
  return `${symbol}${Number(amt || 0).toLocaleString('en-IN')}`;
};

export default function BillingScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [plan, setPlan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewPayment, setViewPayment] = useState(null);

  const ACCENT = t.accent;
  const bg = isDark ? '#0b141a' : '#f8fafc';
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = isDark ? '#1e293b' : '#fff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';

  useEffect(() => {
    (async () => {
      try {
        const [meRes, payRes, planRes] = await Promise.all([
          api.get('/auth/me').catch(() => null),
          api.get('/billing/payment-history').catch(() => null),
          api.get('/billing/plan-comparison').catch(() => null),
        ]);
        const d = meRes?.data?.data || meRes?.data || {};
        setPlan(d?.current_plan || null);
        const payRows = payRes?.data?.data?.rows || payRes?.data?.data || [];
        setPayments(Array.isArray(payRows) ? payRows : []);
        const planRows = planRes?.data?.data?.rows || planRes?.data?.data || [];
        setPlans(Array.isArray(planRows) ? planRows : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const handleUpgrade = async (planId) => {
    try {
      toast('Creating checkout...', 'info');
      const { data } = await api.post('/billing/checkout-session', { plan_id: planId });
      const url = data?.data?.checkout_url || data?.data?.url || data?.data?.session_url;
      if (url) { Linking.openURL(url); toast('Opening payment...', 'success'); }
      else toast('Checkout not available', 'info');
    } catch (e) { toast(e?.response?.data?.message || 'Payment gateway not configured', 'info'); }
  };

  const STATUS_COLORS = { success: '#22c55e', completed: '#22c55e', active: '#22c55e', failed: '#ef4444', pending: '#f59e0b', cancelled: '#64748b' };
  const getStatusColor = (s) => STATUS_COLORS[(s || '').toLowerCase()] || '#64748b';

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Billing & Plan</Text>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={ACCENT} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 50 }} showsVerticalScrollIndicator={false}>

          {/* ─── Current Plan Card ─── */}
          {plan && (
            <View style={[s.planCard, { backgroundColor: isDark ? '#0c2d48' : '#eff6ff', borderColor: isDark ? '#1e3a5f' : '#bfdbfe' }]}>
              <View style={s.planHeader}>
                <View style={s.planNameRow}>
                  <Ionicons name="diamond" size={22} color="#3b82f6" />
                  <Text style={s.planName}>{plan.plan_name || 'Free'}</Text>
                  <View style={[s.planBadge, { backgroundColor: '#22c55e18' }]}>
                    <Text style={s.planBadgeText}>{plan.subscription_status || 'Active'}</Text>
                  </View>
                </View>
              </View>

              <View style={s.planStatsRow}>
                <View style={[s.planStat, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                  <Text style={[s.planStatLabel, { color: subColor }]}>AMOUNT</Text>
                  <Text style={[s.planStatValue, { color: textColor }]}>{fmtCurrency(plan.price, plan.default_currency)}</Text>
                </View>
                <View style={[s.planStat, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                  <Text style={[s.planStatLabel, { color: subColor }]}>CYCLE</Text>
                  <Text style={[s.planStatValue, { color: textColor }]}>{plan.interval_days === 30 ? 'Monthly' : plan.interval_days === 365 ? 'Yearly' : `${plan.interval_days || '–'}d`}</Text>
                </View>
                <View style={[s.planStat, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                  <Text style={[s.planStatLabel, { color: subColor }]}>RENEWAL</Text>
                  <Text style={[s.planStatValue, { color: textColor }]}>{fmtDate(plan.end_date) || '–'}</Text>
                </View>
              </View>

              <View style={s.planMetaRow}>
                <Text style={[s.planMeta, { color: subColor }]}>👥 {plan.max_users || '∞'} users</Text>
                <Text style={[s.planMeta, { color: subColor }]}>💾 {plan.max_storage_mb || '∞'} MB</Text>
              </View>
            </View>
          )}

          {/* ─── Available Plans ─── */}
          {plans.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: textColor }]}>Plans</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.plansScroll}>
                {plans.map((p, i) => {
                  const isCurrent = plan && (p.plan_id === plan.plan_id || p.plan_key === plan.plan_key);
                  return (
                    <View key={p.plan_id || i} style={[s.planItem, { backgroundColor: cardBg, borderColor: isCurrent ? '#3b82f6' : (isDark ? '#334155' : '#e2e8f0') }]}>
                      {isCurrent && <View style={s.currentTag}><Text style={s.currentTagText}>Current</Text></View>}
                      <Text style={[s.planItemName, { color: textColor }]}>{p.plan_name}</Text>
                      <Text style={[s.planItemPrice, { color: ACCENT }]}>{fmtCurrency(p.price, p.default_currency)}</Text>
                      <Text style={[s.planItemCycle, { color: subColor }]}>/{p.interval_days === 30 ? 'month' : p.interval_days === 365 ? 'year' : `${p.interval_days}d`}</Text>
                      <View style={s.planItemFeatures}>
                        <Text style={[s.planItemFeat, { color: subColor }]}>👥 {p.max_users || '∞'} users</Text>
                        <Text style={[s.planItemFeat, { color: subColor }]}>💾 {p.max_storage_mb || '∞'} MB</Text>
                      </View>
                      {!isCurrent && (
                        <TouchableOpacity style={[s.upgradeBtn, { backgroundColor: '#3b82f6' }]}
                          onPress={() => handleUpgrade(p.plan_id)} activeOpacity={0.8}>
                          <Text style={s.upgradeBtnText}>{plan && p.price > (plan.price || 0) ? 'Upgrade' : 'Switch'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* ─── Payment History ─── */}
          <Text style={[s.sectionTitle, { color: textColor }]}>Payment History</Text>
          {payments.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="receipt-outline" size={40} color={subColor} />
              <Text style={[s.emptyText, { color: subColor }]}>No payments yet</Text>
            </View>
          ) : payments.slice(0, 20).map((p, i) => {
            const statusColor = getStatusColor(p.status);
            return (
              <TouchableOpacity key={p.payment_id || i} style={[s.payCard, { backgroundColor: cardBg }]}
                onPress={() => setViewPayment(p)} activeOpacity={0.6}>
                <View style={[s.payGateway, { backgroundColor: p.gateway === 'stripe' ? '#635bff15' : p.gateway === 'paypal' ? '#003087' + '15' : '#64748b15' }]}>
                  <Ionicons name={p.gateway === 'stripe' ? 'card' : p.gateway === 'paypal' ? 'logo-paypal' : 'cash'} size={18}
                    color={p.gateway === 'stripe' ? '#635bff' : p.gateway === 'paypal' ? '#003087' : '#64748b'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.payTopRow}>
                    <Text style={[s.payAmount, { color: textColor }]}>{fmtCurrency(p.amount, p.currency)}</Text>
                    <View style={[s.payStatus, { backgroundColor: statusColor + '15' }]}>
                      <Text style={[s.payStatusText, { color: statusColor }]}>{p.status}</Text>
                    </View>
                  </View>
                  <Text style={[s.payPlan, { color: subColor }]}>{p.plan_name || 'Plan'} · {p.gateway || 'Gateway'}</Text>
                  <Text style={[s.payDate, { color: subColor }]}>{fmtDate(p.created_at)} {fmtTime(p.created_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={subColor} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Payment Detail Modal ─── */}
      {viewPayment && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setViewPayment(null)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 20 }]}>
              {/* Header */}
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: textColor }]}>Payment Details</Text>
                <TouchableOpacity onPress={() => setViewPayment(null)} style={s.modalClose}>
                  <Ionicons name="close" size={22} color={subColor} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Amount */}
                <View style={s.modalAmountWrap}>
                  <Text style={[s.modalAmountLabel, { color: subColor }]}>{viewPayment.plan_name || 'Plan'}</Text>
                  <Text style={[s.modalAmount, { color: textColor }]}>{fmtCurrency(viewPayment.amount, viewPayment.currency)}</Text>
                  <View style={[s.modalStatusBig, { backgroundColor: getStatusColor(viewPayment.status) + '15' }]}>
                    <Text style={[s.modalStatusText, { color: getStatusColor(viewPayment.status) }]}>{viewPayment.status}</Text>
                  </View>
                </View>

                {/* Details grid */}
                <View style={[s.detailCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                  <Text style={[s.detailTitle, { color: textColor }]}>Invoice & Subscription</Text>
                  {[
                    { label: 'Payment ID', value: `#${viewPayment.payment_id}` },
                    { label: 'Plan', value: viewPayment.plan_name },
                    { label: 'Gateway', value: (viewPayment.gateway || '').toUpperCase() },
                    { label: 'Date', value: `${fmtDate(viewPayment.created_at)} ${fmtTime(viewPayment.created_at)}` },
                    { label: 'Currency', value: viewPayment.currency || 'INR' },
                    { label: 'Transaction ID', value: viewPayment.transaction_id || viewPayment.gateway_payment_id || '–' },
                    { label: 'Billing Type', value: viewPayment.billing_type || 'Subscription' },
                  ].map((row, i) => (
                    <View key={i} style={[s.detailRow, { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                      <Text style={[s.detailLabel, { color: subColor }]}>{row.label}</Text>
                      <Text style={[s.detailValue, { color: textColor }]} numberOfLines={1}>{row.value || '–'}</Text>
                    </View>
                  ))}
                </View>

                {/* Amount summary */}
                <View style={[s.detailCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                  <Text style={[s.detailTitle, { color: textColor }]}>Amount Summary</Text>
                  <View style={[s.detailRow, { borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                    <Text style={[s.detailLabel, { color: subColor }]}>Sub Total</Text>
                    <Text style={[s.detailValue, { color: textColor }]}>{fmtCurrency(viewPayment.amount, viewPayment.currency)}</Text>
                  </View>
                  <View style={s.grandTotalRow}>
                    <Text style={s.grandTotalLabel}>Grand Total</Text>
                    <Text style={s.grandTotalValue}>{fmtCurrency(viewPayment.amount, viewPayment.currency)}</Text>
                  </View>
                </View>

                {/* Actions */}
                {viewPayment.status?.toLowerCase() === 'failed' && (
                  <TouchableOpacity style={[s.retryBtn, { backgroundColor: '#ef4444' }]}
                    onPress={() => { setViewPayment(null); handleUpgrade(viewPayment.plan_id); }} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={s.retryBtnText}>Retry Payment</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff' },

  // Plan card
  planCard: { margin: 14, padding: 18, borderRadius: 20, borderWidth: 1.5 },
  planHeader: { marginBottom: 14 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 22, fontWeight: '900', color: '#3b82f6', flex: 1 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  planBadgeText: { fontSize: 10, fontWeight: '800', color: '#22c55e', textTransform: 'uppercase' },
  planStatsRow: { flexDirection: 'row', gap: 8 },
  planStat: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  planStatLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  planStatValue: { fontSize: 14, fontWeight: '800' },
  planMetaRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
  planMeta: { fontSize: 13, fontWeight: '600' },

  // Plans horizontal
  sectionTitle: { fontSize: 16, fontWeight: '800', marginHorizontal: 18, marginTop: 16, marginBottom: 10 },
  plansScroll: { paddingHorizontal: 14, gap: 10, paddingBottom: 4 },
  planItem: { width: 180, padding: 18, borderRadius: 18, borderWidth: 1.5, alignItems: 'center' },
  currentTag: { position: 'absolute', top: 10, right: 10, backgroundColor: '#3b82f615', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  currentTagText: { fontSize: 9, fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase' },
  planItemName: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  planItemPrice: { fontSize: 24, fontWeight: '900' },
  planItemCycle: { fontSize: 12, marginBottom: 10 },
  planItemFeatures: { gap: 4, marginBottom: 12, alignItems: 'center' },
  planItemFeat: { fontSize: 12 },
  upgradeBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, width: '100%', alignItems: 'center' },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Payment history
  payCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginBottom: 8, padding: 16, borderRadius: 16, elevation: 1 },
  payGateway: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  payTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payAmount: { fontSize: 16, fontWeight: '800' },
  payStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  payStatusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  payPlan: { fontSize: 12, marginTop: 3 },
  payDate: { fontSize: 11, marginTop: 1 },

  emptyCard: { margin: 14, padding: 40, borderRadius: 18, alignItems: 'center', gap: 10, elevation: 1 },
  emptyText: { fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalClose: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  modalAmountWrap: { alignItems: 'center', paddingVertical: 20 },
  modalAmountLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  modalAmount: { fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'] },
  modalStatusBig: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 },
  modalStatusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },

  detailCard: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 16 },
  detailTitle: { fontSize: 14, fontWeight: '800', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },

  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, marginTop: 4 },
  grandTotalLabel: { fontSize: 14, fontWeight: '800', color: '#3b82f6' },
  grandTotalValue: { fontSize: 18, fontWeight: '900', color: '#3b82f6' },

  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 14 },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
