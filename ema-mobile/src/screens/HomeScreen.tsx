import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ActivityListSkeleton, BalanceSkeleton } from '../components/Skeleton';
import { WalletActivityList } from '../components/WalletActivityList';
import { TwoFactorReminderCard } from '../components/TwoFactorReminderCard';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { useAuth } from '../context/AuthContext';
import { usePolling } from '../hooks/usePolling';
import { useTransactionFeed } from '../hooks/useTransactionFeed';
import { palette } from '../theme/colors';
import {
  navigateToMT5,
  navigateToP2P,
  navigateToSupport,
  navigateToTransactionDetail,
  navigateToTransactionHistory,
} from '../utils/navigationHelpers';
import { aggregateBalancesForDisplay, sumUsdtFamilyAvailable } from '../utils/walletDisplay';
import { filterActivityToday } from '../utils/walletActivity';
import type { RootTabParamList } from '../types';

const HOME_NOTICE_DISMISS_KEY = 'ema_home_notice_dismissed_v2';

type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList, 'Home'>>();
  const { user } = useAuth();
  const { npSummary, rows, loading: feedLoading, error: cryptoError, refresh: refreshFeed } = useTransactionFeed();
  const [refreshing, setRefreshing] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem(HOME_NOTICE_DISMISS_KEY).then((v) => {
      setNoticeVisible(v !== '1');
    });
  }, []);

  const dismissNotice = () => {
    setNoticeVisible(false);
    void AsyncStorage.setItem(HOME_NOTICE_DISMISS_KEY, '1');
  };

  const refresh = useCallback(async () => {
    await refreshFeed();
  }, [refreshFeed]);

  usePolling(refresh, 60000, true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const recentActivity = useMemo(() => filterActivityToday(rows, 5), [rows]);
  const balancesLoading = feedLoading && !npSummary && !cryptoError;

  const displayBalances = useMemo(
    () => aggregateBalancesForDisplay(npSummary?.balances, npSummary?.cashWalletUsd),
    [npSummary]
  );

  const totalUsdt = useMemo(
    () => Math.floor(sumUsdtFamilyAvailable(npSummary?.balances, npSummary?.cashWalletUsd)),
    [npSummary]
  );

  const quickActions: QuickAction[] = useMemo(
    () => [
      { key: 'asset', label: 'Asset', icon: 'briefcase-outline', onPress: () => navigation.navigate('Wallet') },
      { key: 'earn', label: 'Earn', icon: 'trending-up-outline', onPress: () => navigation.navigate('Trades') },
      { key: 'journal', label: 'journal', icon: 'book-outline', onPress: () => navigation.navigate('Journal') },
      { key: 'support', label: 'Support', icon: 'chatbubbles-outline', onPress: () => navigateToSupport(navigation) },
      { key: 'p2p', label: 'P2P', icon: 'swap-horizontal-outline', onPress: () => navigateToP2P(navigation) },
      { key: 'mt5', label: 'MT5', icon: 'analytics-outline', onPress: () => navigateToMT5(navigation) },
      {
        key: 'history',
        label: 'History',
        icon: 'time-outline',
        onPress: () => navigateToTransactionHistory(navigation),
      },
    ],
    [navigation]
  );

  const displayName = user?.email?.split('@')[0] || 'there';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.greeting}>Hello, {displayName}</Text>
        <Text style={styles.sub}>Your Min overview</Text>
      </View>

      <AnnouncementBanner />
      <TwoFactorReminderCard />

      {balancesLoading ? (
        <BalanceSkeleton />
      ) : (
        <Pressable onPress={() => navigation.navigate('Wallet')}>
          <Card style={styles.balanceHero}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            {cryptoError ? <Text style={styles.warn}>{cryptoError}</Text> : null}
            <Text style={styles.balanceTotal}>{totalUsdt > 0 ? totalUsdt : '0'}</Text>
            <Text style={styles.balanceUnit}>USDT</Text>
            {npSummary && !npSummary.configured ? (
              <Text style={styles.meta}>Deposits temporarily unavailable.</Text>
            ) : totalUsdt <= 0 && !cryptoError ? (
              <Text style={styles.meta}>Deposit from the Asset tab to get started.</Text>
            ) : (
              <Text style={styles.meta}>Tap to manage deposits & withdrawals</Text>
            )}
          </Card>
        </Pressable>
      )}

      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <View key={action.key} style={styles.quickTileCol}>
            <Pressable
              style={styles.quickTile}
              onPress={action.onPress}
              accessibilityLabel={action.key === 'history' ? 'Asset history' : action.label}
            >
              <View style={styles.quickIconWrap}>
                <Ionicons name={action.icon} size={18} color={palette.primary} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      {!balancesLoading && displayBalances.length > 1 ? (
        <Card style={styles.holdingsCard}>
          <Text style={styles.section}>Holdings</Text>
          {displayBalances.map((b) => (
            <View key={b.asset} style={styles.holdingRow}>
              <Text style={styles.holdingAsset}>{b.asset.toUpperCase()}</Text>
              <Text style={styles.holdingValue}>{b.available}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {feedLoading && !rows.length ? (
        <ActivityListSkeleton rows={5} />
      ) : (
        <Card style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <Text style={styles.section}>Today&apos;s activity</Text>
            {rows.length > 5 ? (
              <Pressable onPress={() => navigateToTransactionHistory(navigation)}>
                <Text style={styles.moreLink}>All</Text>
              </Pressable>
            ) : null}
          </View>
          <WalletActivityList
            rows={recentActivity}
            variant='compact'
            emptyMessage='No transactions today.'
            onPressRow={(row) => navigateToTransactionDetail(navigation, row)}
          />
          {rows.length > 0 && recentActivity.length === 0 ? (
            <PrimaryButton
              label='View history'
              onPress={() => navigateToTransactionHistory(navigation)}
              style={{ marginTop: 12 }}
            />
          ) : null}
        </Card>
      )}

      {noticeVisible ? (
        <Card style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeader}>
            <Text style={styles.disclaimerTitle}>Important notice</Text>
            <Pressable onPress={dismissNotice} hitSlop={12} accessibilityLabel='Dismiss notice'>
              <Ionicons name='close-circle' size={22} color={palette.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.disclaimerText}>
            Withdrawals may be denied if AML concerns are detected, if the address is not whitelisted, or if your account is
            flagged by legal authority.
          </Text>
          <Text style={styles.disclaimerText}>
            Deposits below $100 may not be credited. Enable two-factor authentication in Settings.
          </Text>
          <Text style={[styles.disclaimerText, { marginBottom: 0 }]}>
            Min will never call or text you asking you to move funds or share passwords. Do not follow off-app instructions.
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 28 },
  headerRow: { marginBottom: 12 },
  greeting: { color: palette.textPrimary, fontSize: 24, fontWeight: '800' },
  sub: { color: palette.textSecondary, fontSize: 13, marginTop: 4 },
  balanceHero: {
    marginBottom: 14,
    borderColor: palette.primary,
    borderWidth: 1,
    backgroundColor: palette.surface,
    paddingVertical: 20,
  },
  balanceLabel: { color: palette.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  balanceTotal: { color: palette.textPrimary, fontSize: 42, fontWeight: '800', lineHeight: 48 },
  balanceUnit: { color: palette.primary, fontSize: 16, fontWeight: '700', marginTop: 2, marginBottom: 8 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 14 },
  quickTileCol: { width: '33.333%', padding: 4 },
  quickTile: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: { color: palette.textPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  holdingsCard: { marginBottom: 12 },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  holdingAsset: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  holdingValue: { color: palette.textPrimary, fontSize: 16, fontWeight: '700' },
  disclaimerCard: {
    borderColor: palette.noticeBorder,
    borderLeftWidth: 3,
    backgroundColor: palette.noticeBackground,
    marginTop: 4,
  },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  disclaimerTitle: { color: palette.noticeBorder, fontSize: 15, fontWeight: '700', flex: 1 },
  disclaimerText: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  section: { color: palette.textSecondary, fontWeight: '700', marginBottom: 10, fontSize: 15 },
  meta: { color: palette.textSecondary, fontSize: 12 },
  warn: { color: palette.danger, marginBottom: 6, fontSize: 12 },
  activityCard: { marginBottom: 12 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  moreLink: { color: palette.primary, fontSize: 14, fontWeight: '700' },
});
