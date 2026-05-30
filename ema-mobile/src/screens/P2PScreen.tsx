import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LocationGateCard } from '../components/LocationGateCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocalMoneyRegion } from '../hooks/useLocalMoneyRegion';
import { p2pService, type P2pOffer } from '../services/p2pService';
import { P2PStackParamList } from '../types';
import { palette } from '../theme/colors';
import { sanitizeUserFacingError } from '../utils/userFacingError';

type SideFilter = 'all' | 'buy' | 'sell';
type Nav = NativeStackNavigationProp<P2PStackParamList, 'P2P'>;

export function P2PScreen() {
  const navigation = useNavigation<Nav>();
  const {
    supported,
    region,
    usdtPairLabel,
    loading: regionLoading,
    locationStatus,
    locationReady,
    bootstrapComplete,
    detectLocation,
    countryCode,
    detectedCountryName,
    error,
  } = useLocalMoneyRegion();

  const [offers, setOffers] = useState<P2pOffer[]>([]);
  const [activeTrades, setActiveTrades] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const cc = countryCode || region?.countryCode;
      const [offersRes, tradesRes] = await Promise.all([
        p2pService.listOffers(cc || undefined),
        p2pService.listTrades(),
      ]);
      setOffers(offersRes.offers || []);
      setActiveTrades(tradesRes.active?.length ?? 0);
    } catch (e: any) {
      setLoadError(sanitizeUserFacingError(e?.message));
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [countryCode, region?.countryCode]);

  useFocusEffect(
    useCallback(() => {
      if (locationReady && supported) {
        setLoading(true);
        void load();
      }
    }, [locationReady, supported, load])
  );

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (sideFilter === 'all') return true;
      return o.counterpartyAction === sideFilter;
    });
  }, [offers, sideFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openOffer = (offer: P2pOffer) => {
    navigation.navigate('P2PTrade', { offer });
  };

  const openActiveTrade = async () => {
    try {
      const res = await p2pService.listTrades();
      const first = res.active?.[0];
      if (first) navigation.navigate('P2PTrade', { tradeId: first.id });
    } catch {
      /* ignore */
    }
  };

  if (!bootstrapComplete) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />
          <Text style={styles.meta}>Loading…</Text>
        </Card>
      </ScrollView>
    );
  }

  if (!locationReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.sub}>Turn on location to see P2P offers where you are.</Text>
        <LocationGateCard locationStatus={locationStatus} error={error} onEnableLocation={detectLocation} />
      </ScrollView>
    );
  }

  if (!supported || !region) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <Text style={styles.emptyTitle}>Not available in your region</Text>
          <Text style={styles.meta}>
            {detectedCountryName
              ? `P2P is not available in ${detectedCountryName} yet.`
              : 'P2P is not available in your country yet.'}
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />}
    >
      <Text style={styles.sub}>
        Trade USDT with other members in {region.countryName}. {usdtPairLabel} — local reference rate.
      </Text>

      {region?.usdtToFiatRate ? (
        <Card style={styles.rateCard}>
          <Text style={styles.rateValue}>
            1 USDT ≈ {region.usdtToFiatRate.toLocaleString()} {region.fiatLabel}
          </Text>
        </Card>
      ) : null}

      <PrimaryButton
        label='Start P2P — list your offer'
        onPress={() => navigation.navigate('P2PSetup')}
        style={{ marginBottom: 12 }}
      />

      {activeTrades > 0 ? (
        <Pressable onPress={() => void openActiveTrade()}>
          <Card style={styles.activeBanner}>
            <Text style={styles.activeText}>
              {activeTrades} active trade{activeTrades > 1 ? 's' : ''} — tap to continue
            </Text>
          </Card>
        </Pressable>
      ) : null}

      <View style={styles.filterRow}>
        {(['all', 'buy', 'sell'] as SideFilter[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.filterChip, sideFilter === key && styles.filterChipActive]}
            onPress={() => setSideFilter(key)}
          >
            <Text style={[styles.filterChipText, sideFilter === key && styles.filterChipTextActive]}>
              {key === 'all' ? 'All' : key === 'buy' ? 'Buy USDT' : 'Sell USDT'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading || regionLoading ? <Text style={styles.meta}>Loading offers…</Text> : null}
      {loadError ? <Text style={styles.warn}>{loadError}</Text> : null}

      {!loading && !filtered.length ? (
        <Card>
          <Text style={styles.emptyTitle}>No offers yet</Text>
          <Text style={styles.meta}>Be the first — tap Start P2P above to list your price.</Text>
        </Card>
      ) : null}

      {filtered.map((offer) => (
        <Card key={offer.userId} style={styles.offerCard}>
          <View style={styles.offerHeader}>
            <View>
              <Text style={styles.offerSide}>
                {offer.counterpartyAction === 'buy' ? 'Buy USDT' : 'Sell USDT'}
              </Text>
              <Text style={styles.trader}>{offer.displayName}</Text>
            </View>
            <Text style={styles.meta}>{offer.completedTrades} trades</Text>
          </View>

          <Text style={styles.price}>
            {offer.pricePerUsdt.toLocaleString()} {offer.fiatCurrency} / USDT
          </Text>
          <Text style={styles.meta}>
            {offer.limitMinFiat.toLocaleString()} – {offer.limitMaxFiat.toLocaleString()} {offer.fiatCurrency}
          </Text>

          <PrimaryButton
            compact
            label={offer.counterpartyAction === 'buy' ? 'Buy USDT' : 'Sell USDT'}
            onPress={() => openOffer(offer)}
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          />
        </Card>
      ))}

      <Text style={styles.footerNote}>
        USDT is held in escrow until the fiat recipient confirms payment. Use only payment details shown in the trade.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  sub: { color: palette.textSecondary, lineHeight: 20, marginBottom: 14, fontSize: 13 },
  rateCard: { marginBottom: 12 },
  rateValue: { color: palette.primary, fontSize: 18, fontWeight: '800' },
  activeBanner: { marginBottom: 12, borderColor: palette.primary, borderLeftWidth: 3 },
  activeText: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: palette.surfaceElevated,
  },
  filterChipActive: { borderColor: palette.primary },
  filterChipText: { color: palette.textSecondary, fontWeight: '600', fontSize: 12 },
  filterChipTextActive: { color: palette.primary },
  offerCard: { marginBottom: 10 },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  offerSide: { color: palette.textPrimary, fontSize: 17, fontWeight: '700' },
  trader: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  price: { color: palette.primary, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  meta: { color: palette.textSecondary, fontSize: 12, marginBottom: 2 },
  warn: { color: palette.danger, fontSize: 12, marginBottom: 8 },
  emptyTitle: { color: palette.textPrimary, fontWeight: '700', marginBottom: 4 },
  footerNote: { color: palette.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
