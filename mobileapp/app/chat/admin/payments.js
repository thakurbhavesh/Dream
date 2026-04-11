import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Modal, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/store/ThemeContext';
import api from '../../../src/api/config';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtCur = (amt, cur) => `₹${Number(amt || 0).toLocaleString('en-IN')}`;

const GATEWAY_ICON = { stripe: { icon: 'card', color: '#635bff' }, paypal: { icon: 'logo-paypal', color: '#003087' }, razorpay: { icon: 'card', color: '#2563eb' } };
const getGW = (g) => GATEWAY_ICON[(g || '').toLowerCase()] || { icon: 'cash', color: '#64748b' };
const STATUS_COLOR = { success: '#22c55e', completed: '#22c55e', failed: '#ef4444', pending: '#f59e0b', cancelled: '#64748b' };
const getSC = (s) => STATUS_COLOR[(s || '').toLowerCase()] || '#64748b';

export default function PaymentsScreen() {
  const { theme: t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null);

  const ACCENT = t.accent;
  const bg = t.bg || (isDark ? '#0b141a' : '#f5f5f5');
  const headerBg = isDark ? '#1f2c34' : ACCENT;
  const cardBg = t.card || (isDark ? '#1e293b' : '#ffffff');
  const textColor = t.text || (isDark ? '#f1f5f9' : '#0f172a');
  const subColor = t.textSec || (isDark ? '#8696a0' : '#667781');
  const divider = isDark ? '#334155' : '#f1f5f9';

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/billing/payment-history');
      const rows = data?.data?.rows || data?.data || [];
      setPayments(Array.isArray(rows) ? rows : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const totalPaid = payments.filter(p => getSC(p.payment_status || p.status) === '#22c55e').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <View style={[s.header, { backgroundColor: headerBg, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payment History</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} style={s.backBtn}>
          <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={[s.summary, { backgroundColor: cardBg }]}>
        <View style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: textColor }]}>{payments.length}</Text>
          <Text style={[s.summaryLabel, { color: subColor }]}>Payments</Text>
        </View>
        <View style={[s.summaryDivider, { backgroundColor: divider }]} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: '#22c55e' }]}>{fmtCur(totalPaid)}</Text>
          <Text style={[s.summaryLabel, { color: subColor }]}>Total Paid</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={ACCENT} /> : (
        <FlatList data={payments} keyExtractor={(p, i) => String(p.payment_id || i)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[ACCENT]} />}
          renderItem={({ item: p }) => {
            const status = p.payment_status || p.status || 'pending';
            const sc = getSC(status);
            const gw = getGW(p.payment_method || p.gateway);
            return (
              <TouchableOpacity style={[s.card, { backgroundColor: cardBg }]} onPress={() => setDetail(p)} activeOpacity={0.6}>
                <View style={[s.gwIcon, { backgroundColor: `${gw.color}12` }]}>
                  <Ionicons name={gw.icon} size={20} color={gw.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.cardTop}>
                    <Text style={[s.amount, { color: textColor }]}>{fmtCur(p.amount)}</Text>
                    <View style={[s.badge, { backgroundColor: `${sc}12` }]}>
                      <Text style={[s.badgeText, { color: sc }]}>{status}</Text>
                    </View>
                  </View>
                  <Text style={[s.plan, { color: subColor }]}>#{p.payment_id} · {p.plan_name || `Plan ${p.plan_id}`} · {(p.payment_method || p.gateway || '').toUpperCase()}</Text>
                  <Text style={[s.date, { color: subColor }]}>{fmtDate(p.payment_date || p.created_at)} {fmtTime(p.payment_date || p.created_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={subColor} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<View style={s.empty}><Ionicons name="receipt-outline" size={44} color={subColor} /><Text style={[s.emptyText, { color: subColor }]}>No payments</Text></View>}
        />
      )}

      {/* Detail Modal */}
      {detail && (() => {
        const status = detail.payment_status || detail.status || 'pending';
        const sc = getSC(status);
        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => setDetail(null)}>
            <View style={s.modalOverlay}>
              <View style={[s.modalSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 20 }]}>
                <View style={s.modalHeader}>
                  <Text style={[s.modalTitle, { color: textColor }]}>Payment Details</Text>
                  <TouchableOpacity onPress={() => setDetail(null)} style={s.modalClose}>
                    <Ionicons name="close" size={22} color={subColor} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Invoice preview */}
                  <View style={s.invoiceCard}>
                    <View style={s.invoiceTop}>
                      <Ionicons name="receipt" size={22} color="#fff" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.invoiceLabel}>INVOICE</Text>
                        <Text style={s.invoiceNum}>{detail.invoice_number || `INV-${detail.payment_id}`}</Text>
                      </View>
                      <Text style={s.invoiceAmount}>{fmtCur(detail.amount)}</Text>
                    </View>
                    <View style={s.invoiceTags}>
                      {[
                        detail.billing_type && `Type: ${detail.billing_type}`,
                        detail.user_count && `Users: ${detail.user_count}`,
                        detail.period_months && `${detail.period_months} month${detail.period_months > 1 ? 's' : ''}`,
                      ].filter(Boolean).map((tag, i) => (
                        <View key={i} style={s.invoiceTag}><Text style={s.invoiceTagText}>{tag}</Text></View>
                      ))}
                    </View>
                  </View>

                  {/* Details */}
                  <View style={[s.detailCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                    <Text style={[s.detailSec, { color: textColor }]}>Invoice & Subscription</Text>
                    {[
                      { l: 'Payment ID', v: `#${detail.payment_id}` },
                      { l: 'Invoice', v: detail.invoice_number || '–' },
                      { l: 'Plan', v: detail.plan_name || `Plan ${detail.plan_id}` },
                      { l: 'Status', v: status.toUpperCase(), color: sc },
                      { l: 'Gateway', v: (detail.payment_method || detail.gateway || '–').toUpperCase() },
                      { l: 'Transaction ID', v: detail.transaction_id || '–' },
                      { l: 'Date', v: `${fmtDate(detail.payment_date || detail.created_at)} ${fmtTime(detail.payment_date || detail.created_at)}` },
                      { l: 'Billing Type', v: detail.billing_type || '–' },
                      { l: 'Users', v: detail.user_count || '–' },
                      { l: 'Period', v: detail.period_months ? `${detail.period_months} month(s)` : '–' },
                    ].map((r, i) => (
                      <View key={i} style={[s.detailRow, { borderBottomColor: divider }]}>
                        <Text style={[s.detailLabel, { color: subColor }]}>{r.l}</Text>
                        <Text style={[s.detailValue, { color: r.color || textColor }]}>{r.v}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Amount */}
                  <View style={[s.detailCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                    <Text style={[s.detailSec, { color: textColor }]}>Amount Summary</Text>
                    <View style={[s.detailRow, { borderBottomColor: divider }]}>
                      <Text style={[s.detailLabel, { color: subColor }]}>Sub Total</Text>
                      <Text style={[s.detailValue, { color: textColor }]}>{fmtCur(detail.amount)}</Text>
                    </View>
                    {Number(detail.discount_amount) > 0 && (
                      <View style={[s.detailRow, { borderBottomColor: divider }]}>
                        <Text style={[s.detailLabel, { color: subColor }]}>Discount {detail.coupon_code ? `(${detail.coupon_code})` : ''}</Text>
                        <Text style={[s.detailValue, { color: '#22c55e' }]}>-{fmtCur(detail.discount_amount)}</Text>
                      </View>
                    )}
                    <View style={s.grandRow}>
                      <Text style={s.grandLabel}>Grand Total</Text>
                      <Text style={s.grandValue}>{fmtCur(Number(detail.amount || 0) - Number(detail.discount_amount || 0))}</Text>
                    </View>
                    <View style={[s.detailRow, { borderBottomColor: divider }]}>
                      <Text style={[s.detailLabel, { color: subColor }]}>Currency</Text>
                      <Text style={[s.detailValue, { color: textColor }]}>{detail.currency_code || 'INR'}</Text>
                    </View>
                  </View>

                  {/* Billing info */}
                  {(detail.billing_name || detail.billing_email) && (
                    <View style={[s.detailCard, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
                      <Text style={[s.detailSec, { color: textColor }]}>Billing Info</Text>
                      {[
                        { l: 'Name', v: detail.billing_name },
                        { l: 'Email', v: detail.billing_email },
                        { l: 'Company', v: detail.company_name },
                        { l: 'Address', v: detail.address_line1 },
                        { l: 'City', v: [detail.city, detail.state, detail.country].filter(Boolean).join(', ') },
                        { l: 'Postal', v: detail.postal_code },
                      ].filter(r => r.v).map((r, i) => (
                        <View key={i} style={[s.detailRow, { borderBottomColor: divider }]}>
                          <Text style={[s.detailLabel, { color: subColor }]}>{r.l}</Text>
                          <Text style={[s.detailValue, { color: textColor }]}>{r.v}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })()}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, elevation: 6 },
  backBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#fff' },

  summary: { flexDirection: 'row', paddingVertical: 16, elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1 },
  summaryNum: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 11, fontWeight: '700' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 14, marginTop: 8, padding: 16, borderRadius: 16, elevation: 1 },
  gwIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { fontSize: 16, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  plan: { fontSize: 11, marginTop: 3 },
  date: { fontSize: 10, marginTop: 1 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalClose: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },

  invoiceCard: { marginHorizontal: 20, marginBottom: 14, padding: 18, borderRadius: 18, backgroundColor: '#1e40af' },
  invoiceTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  invoiceLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  invoiceNum: { fontSize: 16, fontWeight: '800', color: '#fff' },
  invoiceAmount: { fontSize: 22, fontWeight: '900', color: '#fff' },
  invoiceTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  invoiceTag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  invoiceTagText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  detailCard: { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 16 },
  detailSec: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 12, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  grandLabel: { fontSize: 14, fontWeight: '800', color: '#3b82f6' },
  grandValue: { fontSize: 20, fontWeight: '900', color: '#3b82f6' },
});
