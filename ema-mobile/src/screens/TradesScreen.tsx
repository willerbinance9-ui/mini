import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../components/Card';
import { FormModal } from '../components/FormModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../hooks/useToast';
import { tradingService, type TradingDeal, type TradingStatus } from '../services/tradingService';
import { palette } from '../theme/colors';
import { sanitizeUserFacingError } from '../utils/userFacingError';
import { withTimeout } from '../utils/withTimeout';

type Tab = 'trades' | 'history';

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return String(iso);
  return new Date(ms).toLocaleString();
}

function formatBalance(value: number) {
  const n = Math.round(value * 100) / 100;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function sideLabel(side: string) {
  const s = String(side || '').toLowerCase();
  if (s === 'buy') return 'Buy';
  if (s === 'sell') return 'Sell';
  return side || '—';
}

const inputStyle = {
  backgroundColor: palette.surfaceElevated,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: palette.border,
  color: palette.textPrimary,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 16,
  marginBottom: 12,
};

function DealCard({ deal, showTicket }: { deal: TradingDeal; showTicket?: boolean }) {
  const profit = Number(deal.profit || 0);
  return (
    <Card style={styles.tradeCard}>
      <View style={styles.tradeTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tradeSymbol}>{deal.symbol}</Text>
          <Text style={styles.tradeMeta}>
            {sideLabel(deal.side)} · {deal.volume} lots · Open {deal.openPrice}
          </Text>
          {deal.status === 'open' && deal.closePrice != null ? (
            <Text style={styles.tradeMeta}>Now {deal.closePrice}</Text>
          ) : null}
          {deal.status === 'closed' ? (
            <Text style={styles.tradeMeta}>
              Close {deal.closePrice ?? '—'} · {formatTime(deal.closedAt)}
            </Text>
          ) : (
            <Text style={styles.tradeMeta}>Opened {formatTime(deal.openedAt)}</Text>
          )}
          {showTicket ? <Text style={styles.ticketMeta}>#{deal.ticket}</Text> : null}
        </View>
        <Text style={[styles.pl, profit >= 0 ? styles.plUp : styles.plDown]}>
          {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
        </Text>
      </View>
    </Card>
  );
}

export function TradesScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('trades');
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await withTimeout(tradingService.getStatus(), 12000, 'Trades');
    setStatus(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((e) => Alert.alert('Trades', sanitizeUserFacingError((e as Error).message)))
        .finally(() => setLoading(false));
    }, [load])
  );

  usePolling(() => load().catch(() => {}), 5000, true);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      Alert.alert('Trades', sanitizeUserFacingError((e as Error).message));
    } finally {
      setRefreshing(false);
    }
  };

  const submitAllocate = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      const next = await tradingService.allocate(n);
      setStatus(next);
      setFundModalOpen(false);
      showToast('Funds allocated to trading');
    } catch (e) {
      Alert.alert('Allocation failed', sanitizeUserFacingError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const submitWithdraw = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      const next = await tradingService.withdraw(n);
      setStatus(next);
      setWithdrawModalOpen(false);
      showToast('Funds returned to cash wallet');
    } catch (e) {
      Alert.alert('Withdraw failed', sanitizeUserFacingError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const bottomPad = Math.max(insets.bottom, 12);
  const balance = status?.balance ?? 0;
  const equity = status?.equity ?? balance;
  const openProfit = status?.openProfit ?? 0;
  const openDeals = status?.openDeals ?? [];
  const history = status?.history ?? [];

  return (
    <View style={styles.root}>
      <Card style={styles.headerCard}>
        <Text style={styles.headerTitle}>Trading account</Text>
        <Text style={styles.headerMeta}>Balance · Equity</Text>
        <View style={styles.balanceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.headerBalance}>${formatBalance(balance)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.balanceLabel}>Equity</Text>
            <Text style={styles.headerBalance}>${formatBalance(equity)}</Text>
          </View>
        </View>
        {openProfit !== 0 ? (
          <Text style={[styles.headerPnl, openProfit >= 0 ? styles.plUp : styles.plDown]}>
            {openProfit >= 0 ? '+' : ''}
            {openProfit.toFixed(2)} floating P&L
          </Text>
        ) : null}
        <View style={styles.actionRow}>
          <PrimaryButton
            compact
            label='Allocate funds'
            onPress={() => {
              setAmount('');
              setFundModalOpen(true);
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            compact
            label='Withdraw'
            onPress={() => {
              setAmount('');
              setWithdrawModalOpen(true);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 72 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />
        }
      >
        {loading && !status ? <ActivityIndicator color={palette.primary} style={{ marginVertical: 24 }} /> : null}

        {tab === 'trades' ? (
          <>
            {openDeals.length ? null : (
              <Text style={styles.emptyMeta}>No open trades right now.</Text>
            )}
            {openDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} showTicket />
            ))}
          </>
        ) : null}

        {tab === 'history' ? (
          <>
            {history.length ? null : (
              <Text style={styles.emptyMeta}>Closed trades will appear here.</Text>
            )}
            {history.map((deal) => (
              <DealCard key={deal.id} deal={deal} showTicket />
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        {(['trades', 'history'] as Tab[]).map((t) => {
          const active = tab === t;
          const label = t === 'trades' ? 'Trades' : 'History';
          return (
            <Pressable
              key={t}
              style={[styles.bottomTab, active && styles.bottomTabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>{label}</Text>
              {active ? <View style={styles.bottomTabIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>

      <FormModal
        visible={fundModalOpen}
        title='Allocate to trading'
        onClose={() => setFundModalOpen(false)}
        footer={
          <PrimaryButton
            label={busy ? 'Processing…' : 'Confirm allocation'}
            disabled={busy}
            onPress={() => void submitAllocate()}
            style={{ marginTop: 12 }}
          />
        }
      >
        <Text style={styles.modalHint}>
          Move cash from your wallet into your trading balance. Cash available: $
          {formatBalance(status?.cashWallet ?? 0)}
        </Text>
        <TextInput
          style={inputStyle}
          value={amount}
          onChangeText={setAmount}
          keyboardType='decimal-pad'
          placeholder='Amount (USD)'
          placeholderTextColor={palette.textSecondary}
        />
      </FormModal>

      <FormModal
        visible={withdrawModalOpen}
        title='Withdraw from trading'
        onClose={() => setWithdrawModalOpen(false)}
        footer={
          <PrimaryButton
            label={busy ? 'Processing…' : 'Confirm withdraw'}
            disabled={busy}
            onPress={() => void submitWithdraw()}
            style={{ marginTop: 12 }}
          />
        }
      >
        <Text style={styles.modalHint}>
          Return funds to your cash wallet. Trading balance available: ${formatBalance(balance)}
        </Text>
        <TextInput
          style={inputStyle}
          value={amount}
          onChangeText={setAmount}
          keyboardType='decimal-pad'
          placeholder='Amount (USD)'
          placeholderTextColor={palette.textSecondary}
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  headerCard: { margin: 16, marginBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: palette.textPrimary },
  headerMeta: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
  balanceRow: { flexDirection: 'row', marginTop: 10, gap: 12 },
  balanceLabel: { fontSize: 12, color: palette.textSecondary, marginBottom: 4 },
  headerBalance: { fontSize: 26, fontWeight: '800', color: palette.textPrimary },
  headerPnl: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  content: { flex: 1 },
  scroll: { padding: 16, paddingTop: 8 },
  emptyMeta: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', padding: 16 },
  tradeCard: { marginBottom: 10 },
  tradeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tradeSymbol: { fontSize: 16, fontWeight: '800', color: palette.textPrimary },
  tradeMeta: { fontSize: 12, color: palette.textSecondary, marginTop: 2 },
  ticketMeta: { fontSize: 11, color: palette.textSecondary, marginTop: 4 },
  pl: { fontWeight: '800', fontSize: 16 },
  plUp: { color: palette.success },
  plDown: { color: palette.danger },
  modalHint: { color: palette.textSecondary, marginBottom: 12, lineHeight: 20 },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    paddingTop: 10,
    minHeight: 56,
  },
  bottomTab: { flex: 1, alignItems: 'center', paddingVertical: 14, minHeight: 56 },
  bottomTabActive: {},
  bottomTabText: { fontSize: 15, fontWeight: '600', color: palette.textSecondary },
  bottomTabTextActive: { color: '#5B9CF5', fontWeight: '800', fontSize: 16 },
  bottomTabIndicator: {
    marginTop: 6,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#5B9CF5',
  },
});
