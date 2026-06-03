import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { Card } from '../components/Card';
import { usePolling } from '../hooks/usePolling';
import { liveTradingService, type LiveTradingAccount, type MarketPriceRow } from '../services/liveTradingService';
import { mt5Service } from '../services/mt5Service';
import type { Mt5HistoryDeal, Mt5Position, RootStackParamList } from '../types';
import { palette } from '../theme/colors';
import { withTimeout } from '../utils/withTimeout';

type Tab = 'prices' | 'trades' | 'history';
type Route = RouteProp<RootStackParamList, 'LiveTradingAccount'>;

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return String(iso);
  return new Date(ms).toLocaleString();
}

function sideLabel(type: string | undefined) {
  const t = String(type || '').toLowerCase();
  if (t.includes('buy') || t === '0') return 'Buy';
  if (t.includes('sell') || t === '1') return 'Sell';
  return type || '—';
}

export function LiveTradingAccountScreen() {
  const route = useRoute<Route>();
  const accountId = route.params.accountId;

  const [tab, setTab] = useState<Tab>('prices');
  const [account, setAccount] = useState<LiveTradingAccount | null>(null);
  const [prices, setPrices] = useState<MarketPriceRow[]>([]);
  const [priceSearch, setPriceSearch] = useState('');
  const [positions, setPositions] = useState<Mt5Position[]>([]);
  const [history, setHistory] = useState<Mt5HistoryDeal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingTab, setLoadingTab] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const s = await withTimeout(liveTradingService.getSummary(accountId), 10000, 'Account');
    setAccount(s.account);
  }, [accountId]);

  const loadPrices = useCallback(async () => {
    const data = await liveTradingService.listPrices(priceSearch.trim() || undefined);
    setPrices(data.prices || []);
    setLastPriceUpdate(data.lastUpdated);
  }, [priceSearch]);

  const loadTrades = useCallback(async () => {
    const data = await mt5Service.getPositions(accountId);
    setPositions(data.positions || []);
  }, [accountId]);

  const loadHistory = useCallback(async () => {
    const data = await mt5Service.getHistory(accountId, 30);
    setHistory(data.deals || []);
  }, [accountId]);

  const loadTab = useCallback(async () => {
    setLoadingTab(true);
    try {
      if (tab === 'prices') await loadPrices();
      else if (tab === 'trades') await loadTrades();
      else await loadHistory();
    } finally {
      setLoadingTab(false);
    }
  }, [tab, loadPrices, loadTrades, loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadSummary().catch(() => {});
      loadTab().catch(() => {});
    }, [loadSummary, loadTab])
  );

  usePolling(
    () => {
      loadPrices().catch(() => {});
    },
    3000,
    tab === 'prices'
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSummary();
      await loadTab();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.root}>
      {account ? (
        <Card style={styles.headerCard}>
          <Text style={styles.headerTitle}>{account.accountName || 'Live account'}</Text>
          <Text style={styles.headerMeta}>
            {account.botLabel} · #{account.login} · App ${Math.floor(account.internalBalance).toLocaleString()}
          </Text>
        </Card>
      ) : null}

      <View style={styles.tabs}>
        {(['prices', 'trades', 'history'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => {
              setTab(t);
              setTimeout(() => {
                if (t === 'prices') loadPrices().catch(() => {});
                else if (t === 'trades') loadTrades().catch(() => {});
                else loadHistory().catch(() => {});
              }, 0);
            }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'prices' ? 'Prices' : t === 'trades' ? 'Trades' : 'History'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />}
      >
        {tab === 'prices' ? (
          <>
            <TextInput
              style={styles.search}
              value={priceSearch}
              onChangeText={setPriceSearch}
              onSubmitEditing={() => void loadPrices()}
              placeholder='Search symbol'
              placeholderTextColor={palette.textSecondary}
            />
            {lastPriceUpdate ? (
              <Text style={styles.meta}>Last feed update {formatTime(lastPriceUpdate)}</Text>
            ) : (
              <Text style={styles.meta}>Waiting for price feed from server EA…</Text>
            )}
            {prices.map((p) => (
              <Card key={p.symbol} style={styles.rowCard}>
                <View style={styles.priceRow}>
                  <Text style={styles.symbol}>{p.symbol}</Text>
                  <View style={styles.quoteCol}>
                    <Text style={styles.bid}>{p.bid.toFixed(p.digits)}</Text>
                    <Text style={styles.ask}>{p.ask.toFixed(p.digits)}</Text>
                  </View>
                  <Text style={styles.spread}>{p.spread.toFixed(Math.min(p.digits, 5))}</Text>
                </View>
              </Card>
            ))}
            {!prices.length && !loadingTab ? (
              <Text style={styles.meta}>No prices yet. Attach EmaPriceFeedEa.mq5 on your MT5 server.</Text>
            ) : null}
          </>
        ) : null}

        {tab === 'trades' ? (
          <>
            {loadingTab ? <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} /> : null}
            {positions.map((p) => (
              <Card key={p.id} style={styles.rowCard}>
                <Text style={styles.symbol}>{p.symbol}</Text>
                <Text style={styles.meta}>
                  {sideLabel(p.type)} · {p.volume} lots · Open {p.openPrice ?? '—'} · Now {p.currentPrice ?? '—'}
                </Text>
                <Text style={[styles.pl, (p.profit ?? 0) >= 0 ? styles.plUp : styles.plDown]}>
                  P/L ${Number(p.profit ?? 0).toFixed(2)}
                </Text>
              </Card>
            ))}
            {!positions.length && !loadingTab ? (
              <Text style={styles.meta}>No open trades. Connect MetaApi for live positions.</Text>
            ) : null}
          </>
        ) : null}

        {tab === 'history' ? (
          <>
            {loadingTab ? <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} /> : null}
            {history.map((d) => (
              <Card key={d.id} style={styles.rowCard}>
                <Text style={styles.symbol}>{d.symbol || '—'}</Text>
                <Text style={styles.meta}>
                  {sideLabel(d.type)} · {formatTime(d.time)} · Vol {d.volume ?? '—'}
                </Text>
                <Text style={[styles.pl, (d.profit ?? 0) >= 0 ? styles.plUp : styles.plDown]}>
                  ${Number(d.profit ?? 0).toFixed(2)}
                </Text>
              </Card>
            ))}
            {!history.length && !loadingTab ? <Text style={styles.meta}>No closed trades in the last 30 days.</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  headerCard: { margin: 16, marginBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: palette.textPrimary },
  headerMeta: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: palette.surface,
  },
  tabActive: { borderColor: palette.primary, backgroundColor: palette.surfaceElevated },
  tabText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: palette.primary },
  scroll: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  search: {
    backgroundColor: palette.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  meta: { color: palette.textSecondary, fontSize: 12, marginBottom: 10 },
  rowCard: { marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  symbol: { flex: 1, fontSize: 16, fontWeight: '800', color: palette.textPrimary },
  quoteCol: { alignItems: 'flex-end' },
  bid: { color: palette.success, fontWeight: '700', fontSize: 14 },
  ask: { color: palette.danger, fontWeight: '700', fontSize: 14 },
  spread: { width: 56, textAlign: 'right', color: palette.textSecondary, fontSize: 12 },
  pl: { marginTop: 6, fontWeight: '800', fontSize: 15 },
  plUp: { color: palette.success },
  plDown: { color: palette.danger },
});
