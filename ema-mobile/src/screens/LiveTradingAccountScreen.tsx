import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { QuoteRow } from '../components/QuoteRow';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../hooks/useToast';
import { liveTradingService, type LiveTradingAccount, type MarketPriceRow } from '../services/liveTradingService';
import type { Mt5HistoryDeal, Mt5Position, RootStackParamList } from '../types';
import { palette } from '../theme/colors';
import { withTimeout } from '../utils/withTimeout';

type Tab = 'quotes' | 'trades' | 'history';
type Route = RouteProp<RootStackParamList, 'LiveTradingAccount'>;
type TickDir = 'up' | 'down' | 'flat';

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

function tickDir(prev: number | undefined, next: number): TickDir {
  if (prev == null || !Number.isFinite(prev)) return 'flat';
  if (next > prev) return 'up';
  if (next < prev) return 'down';
  return 'flat';
}

export function LiveTradingAccountScreen() {
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const accountId = route.params.accountId;

  const [tab, setTab] = useState<Tab>('quotes');
  const [account, setAccount] = useState<LiveTradingAccount | null>(null);
  const [prices, setPrices] = useState<MarketPriceRow[]>([]);
  const [priceSearch, setPriceSearch] = useState('');
  const [positions, setPositions] = useState<Mt5Position[]>([]);
  const [positionsNote, setPositionsNote] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const [history, setHistory] = useState<Mt5HistoryDeal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingTab, setLoadingTab] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null);
  const [tickDirs, setTickDirs] = useState<Record<string, { bid: TickDir; ask: TickDir }>>({});

  const prevQuotesRef = useRef<Record<string, { bid: number; ask: number }>>({});

  const loadSummary = useCallback(async () => {
    const s = await withTimeout(liveTradingService.getSummary(accountId), 10000, 'Account');
    setAccount(s.account);
  }, [accountId]);

  const loadPrices = useCallback(async () => {
    const data = await liveTradingService.listPrices(priceSearch.trim() || undefined);
    const rows = data.prices || [];
    const dirs: Record<string, { bid: TickDir; ask: TickDir }> = {};
    for (const row of rows) {
      const prev = prevQuotesRef.current[row.symbol];
      dirs[row.symbol] = {
        bid: tickDir(prev?.bid, row.bid),
        ask: tickDir(prev?.ask, row.ask),
      };
      prevQuotesRef.current[row.symbol] = { bid: row.bid, ask: row.ask };
    }
    setTickDirs(dirs);
    setPrices(rows);
    setLastPriceUpdate(data.lastUpdated);
  }, [priceSearch]);

  const loadTrades = useCallback(async () => {
    try {
      const data = await liveTradingService.getPositions(accountId);
      setPositions(data.positions || []);
      setPositionsNote(
        data.source === 'mt5_bridge'
          ? data.snapshotAt
            ? `MT5 bridge · ${formatTime(data.snapshotAt)}`
            : 'MT5 bridge'
          : null
      );
    } catch (e) {
      setPositions([]);
      setPositionsNote((e as Error).message || 'Attach EmaWebhookEa on your MT5 account');
    }
  }, [accountId]);

  const loadHistory = useCallback(async () => {
    setHistory([]);
    setHistoryNote('Trade history via MT5 bridge coming soon');
  }, []);

  const loadTab = useCallback(async () => {
    setLoadingTab(true);
    try {
      if (tab === 'quotes') await loadPrices();
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
      if (tab === 'quotes') loadPrices().catch(() => {});
      else if (tab === 'trades') loadTrades().catch(() => {});
    },
    1000,
    tab === 'quotes' || tab === 'trades'
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

  const closePosition = async (positionId: string) => {
    setClosingId(positionId);
    try {
      await liveTradingService.closePosition(accountId, positionId);
      showToast('Close sent to MT5');
      await loadTrades();
    } catch (e) {
      Alert.alert('Close failed', (e as Error).message || 'Try again');
    } finally {
      setClosingId(null);
    }
  };

  const confirmClose = (p: Mt5Position) => {
    const id = String(p.id || '');
    if (!id) return;
    Alert.alert('Close position', `Close ${p.symbol} ${sideLabel(p.type)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => void closePosition(id) },
    ]);
  };

  const renderQuoteItem = useCallback(
    ({ item }: { item: MarketPriceRow }) => {
      const dir = tickDirs[item.symbol];
      return <QuoteRow row={item} bidDir={dir?.bid} askDir={dir?.ask} />;
    },
    [tickDirs]
  );

  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <View style={styles.root}>
      {account ? (
        <Card style={styles.headerCard}>
          <Text style={styles.headerTitle}>{account.accountName || 'Live account'}</Text>
          <Text style={styles.headerMeta}>
            {account.botLabel} · #{account.login} · ${Math.floor(account.internalBalance).toLocaleString()}
          </Text>
        </Card>
      ) : null}

      <View style={styles.content}>
        {tab === 'quotes' ? (
          <>
            <View style={styles.quotesHeader}>
              <Text style={styles.quotesTitle}>Quotes</Text>
              <Text style={styles.quotesMeta}>
                {lastPriceUpdate ? formatTime(lastPriceUpdate) : 'Waiting for feed…'}
              </Text>
            </View>
            <TextInput
              style={styles.search}
              value={priceSearch}
              onChangeText={setPriceSearch}
              onSubmitEditing={() => void loadPrices()}
              placeholder='Search symbol'
              placeholderTextColor={palette.textSecondary}
            />
            <FlatList
              data={prices}
              keyExtractor={(item) => item.symbol}
              renderItem={renderQuoteItem}
              style={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />
              }
              ListEmptyComponent={
                loadingTab ? (
                  <ActivityIndicator color={palette.primary} style={{ marginVertical: 24 }} />
                ) : (
                  <Text style={styles.emptyMeta}>No prices. Run EmaPriceFeedEa (1s) on your server.</Text>
                )
              }
              contentContainerStyle={prices.length === 0 ? styles.emptyList : { paddingBottom: bottomPad + 56 }}
              initialNumToRender={24}
              windowSize={10}
              removeClippedSubviews
            />
          </>
        ) : null}

        {tab === 'trades' ? (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 56 }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />
            }
          >
            {positionsNote ? <Text style={styles.bridgeNote}>{positionsNote}</Text> : null}
            {loadingTab ? <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} /> : null}
            {positions.map((p) => (
              <Card key={p.id} style={styles.tradeCard}>
                <View style={styles.tradeTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tradeSymbol}>{p.symbol}</Text>
                    <Text style={styles.tradeMeta}>
                      {sideLabel(p.type)} · {p.volume} lots · Open {p.openPrice ?? '—'}
                    </Text>
                    <Text style={styles.tradeMeta}>Now {p.currentPrice ?? '—'}</Text>
                  </View>
                  <Text style={[styles.pl, (p.profit ?? 0) >= 0 ? styles.plUp : styles.plDown]}>
                    ${Number(p.profit ?? 0).toFixed(2)}
                  </Text>
                </View>
                <PrimaryButton
                  label={closingId === p.id ? 'Closing…' : 'Close'}
                  variant='danger'
                  compact
                  disabled={closingId === p.id}
                  onPress={() => confirmClose(p)}
                  style={{ marginTop: 10, alignSelf: 'flex-start' }}
                />
              </Card>
            ))}
            {!positions.length && !loadingTab ? (
              <Text style={styles.emptyMeta}>
                No open trades. Attach EmaWebhookEa on the MT5 account with the same login.
              </Text>
            ) : null}
          </ScrollView>
        ) : null}

        {tab === 'history' ? (
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 56 }]}>
            {history.map((d) => (
              <Card key={d.id} style={styles.tradeCard}>
                <Text style={styles.tradeSymbol}>{d.symbol || '—'}</Text>
                <Text style={styles.tradeMeta}>
                  {sideLabel(d.type)} · {formatTime(d.time)} · Vol {d.volume ?? '—'}
                </Text>
                <Text style={[styles.pl, (d.profit ?? 0) >= 0 ? styles.plUp : styles.plDown]}>
                  ${Number(d.profit ?? 0).toFixed(2)}
                </Text>
              </Card>
            ))}
            <Text style={styles.emptyMeta}>{historyNote || 'No history yet'}</Text>
          </ScrollView>
        ) : null}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
        {(['quotes', 'trades', 'history'] as Tab[]).map((t) => {
          const active = tab === t;
          const label = t === 'quotes' ? 'Quotes' : t === 'trades' ? 'Trades' : 'History';
          return (
            <Pressable
              key={t}
              style={styles.bottomTab}
              onPress={() => {
                setTab(t);
                setTimeout(() => {
                  if (t === 'quotes') loadPrices().catch(() => {});
                  else if (t === 'trades') loadTrades().catch(() => {});
                  else loadHistory().catch(() => {});
                }, 0);
              }}
            >
              <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  headerCard: { margin: 16, marginBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: palette.textPrimary },
  headerMeta: { fontSize: 13, color: palette.textSecondary, marginTop: 4 },
  content: { flex: 1 },
  quotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quotesTitle: { fontSize: 18, fontWeight: '700', color: palette.textPrimary },
  quotesMeta: { fontSize: 11, color: palette.textSecondary },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: palette.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  list: { flex: 1 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  emptyMeta: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', padding: 16 },
  scroll: { padding: 16, paddingTop: 8 },
  bridgeNote: { color: palette.textSecondary, fontSize: 12, marginBottom: 12 },
  tradeCard: { marginBottom: 10 },
  tradeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tradeSymbol: { fontSize: 16, fontWeight: '800', color: palette.textPrimary },
  tradeMeta: { fontSize: 12, color: palette.textSecondary, marginTop: 2 },
  pl: { fontWeight: '800', fontSize: 16 },
  plUp: { color: palette.success },
  plDown: { color: palette.danger },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    paddingTop: 8,
  },
  bottomTab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  bottomTabText: { fontSize: 13, fontWeight: '600', color: palette.textSecondary },
  bottomTabTextActive: { color: '#5B9CF5', fontWeight: '800' },
});
