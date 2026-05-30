import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components/Card';
import { ComplianceProfileNotice } from '../components/ComplianceProfileNotice';
import { FormModal } from '../components/FormModal';
import { NetworkGridCompact } from '../components/NetworkGridCompact';
import { OptionGrid } from '../components/OptionGrid';
import { OptionHighlightList } from '../components/OptionHighlightList';
import { PrimaryButton } from '../components/PrimaryButton';
import { WithdrawalProgressSteps } from '../components/WithdrawalProgressSteps';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../hooks/useToast';
import { authService } from '../services/authService';
import { complianceService, isComplianceRequiredError } from '../services/complianceService';
import { nowpaymentsService } from '../services/nowpaymentsService';
import { whitelistWalletService } from '../services/whitelistWalletService';
import { walletService } from '../services/walletService';
import {
  NowpaymentsSummary,
  WalletTransaction,
  WhitelistedWallet,
} from '../types';
import { palette } from '../theme/colors';
import { formatNetworkLabel, sanitizeUserFacingError } from '../utils/userFacingError';
import { ActivityListSkeleton, BalanceSkeleton } from '../components/Skeleton';
import { WalletActivityList } from '../components/WalletActivityList';
import {
  aggregateBalancesForDisplay,
  combinedWithdrawableForNetwork,
  maxWithdrawableAmount,
  sumUsdtFamilyAvailable,
} from '../utils/walletDisplay';
import {
  navigateToAirfarmingTrade,
  navigateToCryptoDepositPayment,
  navigateToSendById,
  navigateToLocalMoney,
  navigateToSettings,
  navigateToSupport,
  navigateToTransactionDetail,
  navigateToTransactionHistory,
  navigateToVipFarmersTrade,
} from '../utils/navigationHelpers';
import { mergeAllWalletActivity } from '../utils/walletActivity';

const PAY_CURRENCY_OPTIONS = ['usdttrc20', 'btc', 'eth', 'ltc', 'trx'];
const WITHDRAW_CURRENCY_OPTIONS = ['usdttrc20', 'eth'] as const;
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function WalletScreen() {
  const navigation = useNavigation();
  const { showToast } = useToast();

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [cashTransactions, setCashTransactions] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [npSummary, setNpSummary] = useState<NowpaymentsSummary | null>(null);
  const [npLoading, setNpLoading] = useState(true);
  const [npError, setNpError] = useState<string | null>(null);
  const [whitelistedWallets, setWhitelistedWallets] = useState<WhitelistedWallet[]>([]);
  const [selectedWhitelistId, setSelectedWhitelistId] = useState<string | null>(null);
  const [depositUsdAmount, setDepositUsdAmount] = useState('');
  const [depositPayCurrency, setDepositPayCurrency] = useState('usdttrc20');
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCurrency, setWithdrawCurrency] = useState('usdttrc20');
  const [withdrawTotpCode, setWithdrawTotpCode] = useState('');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawShowProgress, setWithdrawShowProgress] = useState(false);
  const [withdrawProgressStep, setWithdrawProgressStep] = useState(0);
  const [withdrawProgressError, setWithdrawProgressError] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [withdrawModalMax, setWithdrawModalMax] = useState(0);
  const [withdrawModalCurrencyLabel, setWithdrawModalCurrencyLabel] = useState('USDT (TRC20)');
  const [complianceComplete, setComplianceComplete] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [withdrawMethodModalOpen, setWithdrawMethodModalOpen] = useState(false);
  const clientIpLoaded = useRef(false);

  const alertComplianceRequired = () => {
    Alert.alert(
      'One more step',
      'Finish your profile in Settings before you can cash out.',
      [{ text: 'OK' }]
    );
  };

  const loadCompliance = useCallback(async () => {
    try {
      const data = await complianceService.getProfile();
      setComplianceComplete(Boolean(data.complete));
    } catch {
      setComplianceComplete(false);
    }
  }, []);

  const loadWhitelistedWallets = useCallback(async () => {
    try {
      const data = await whitelistWalletService.list();
      setWhitelistedWallets(data.wallets || []);
    } catch {
      setWhitelistedWallets([]);
    }
  }, []);

  const refreshNowpayments = useCallback(async () => {
    setNpError(null);
    try {
      const summary = await nowpaymentsService.getSummary();
      setNpSummary(summary);
    } catch (e: any) {
      setNpError(sanitizeError(e?.message || 'Failed to load wallet'));
      setNpSummary(null);
    } finally {
      setNpLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const cash = await walletService.getWallet();
      setCashTransactions(cash.transactions ?? []);
    } catch {
      setCashTransactions([]);
    }
    try {
      const totp = await authService.getTotpStatus();
      setTotpEnabled(Boolean(totp.enabled));
    } catch {
      setTotpEnabled(false);
    }
    await Promise.all([loadCompliance(), loadWhitelistedWallets(), refreshNowpayments()]);
  }, [loadCompliance, loadWhitelistedWallets, refreshNowpayments]);

  usePolling(refresh, 60000, !withdrawModalOpen && !depositModalOpen && !transferModalOpen);

  useEffect(() => {
    if (clientIpLoaded.current) return;
    clientIpLoaded.current = true;
    void nowpaymentsService
      .getClientIp()
      .then((r) => setClientIp(r.ip && r.ip !== 'unknown' ? r.ip : null))
      .catch(() => setClientIp(null));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onCreateDeposit = async () => {
    const priceAmount = Number(depositUsdAmount);
    if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
      Alert.alert('Enter an amount', 'Type how much you want to add in USD.');
      return;
    }
    try {
      setDepositSubmitting(true);
      setNpError(null);
      const created = await nowpaymentsService.createDeposit(priceAmount, depositPayCurrency, 'usd');
      setDepositModalOpen(false);
      setDepositUsdAmount('');
      navigateToCryptoDepositPayment(navigation, created);
    } catch (e: any) {
      Alert.alert('Could not start payment', sanitizeError(e?.message || 'Try again in a moment.'));
    } finally {
      setDepositSubmitting(false);
    }
  };

  const availableForWithdraw = combinedWithdrawableForNetwork(npSummary, withdrawCurrency);
  const maxWithdraw = maxWithdrawableAmount(availableForWithdraw);

  const ensureClientIp = useCallback(async () => {
    if (clientIp) return clientIp;
    try {
      const r = await nowpaymentsService.getClientIp();
      const ip = r.ip && r.ip !== 'unknown' ? r.ip : null;
      setClientIp(ip);
      return ip;
    } catch {
      return null;
    }
  }, [clientIp]);

  const closeWithdrawModal = () => {
    if (withdrawSubmitting && withdrawShowProgress && withdrawProgressStep < 2 && !withdrawProgressError) {
      return;
    }
    setWithdrawModalOpen(false);
    setWithdrawShowProgress(false);
    setWithdrawProgressStep(0);
    setWithdrawProgressError(null);
    setWithdrawSubmitting(false);
  };

  const onWithdraw = async () => {
    if (!complianceComplete) {
      alertComplianceRequired();
      return;
    }
    const selected = whitelistedWallets.find((w) => w.id === selectedWhitelistId);
    if (!selected) {
      Alert.alert('Pick a destination', 'Add a saved wallet address in Settings first.');
      return;
    }
    const n = Number(withdrawAmount);
    if (!Number.isFinite(n) || n <= 0) return;
    if (maxWithdraw > 0 && n > maxWithdraw) {
      Alert.alert(
        'Amount too high',
        `You can cash out up to ${Math.floor(maxWithdraw)} ${withdrawModalCurrencyLabel || formatNetworkLabel(withdrawCurrency)} right now.`
      );
      return;
    }
    const totpOk = !totpEnabled || withdrawTotpCode.replace(/\s/g, '').length >= 6;
    if (!totpOk) return;

    setWithdrawSubmitting(true);
    setWithdrawShowProgress(true);
    setWithdrawProgressStep(0);
    setWithdrawProgressError(null);
    setNpError(null);

    try {
      setWithdrawProgressStep(0);
      await delay(650);

      setWithdrawProgressStep(1);
      await ensureClientIp();
      await delay(900);

      await nowpaymentsService.createWithdrawal(
        selected.currency,
        selected.address,
        n,
        totpEnabled ? withdrawTotpCode.replace(/\s/g, '') : undefined
      );

      setWithdrawProgressStep(2);
      await delay(1200);

      setWithdrawAmount('');
      setSelectedWhitelistId(null);
      setWithdrawTotpCode('');
      setWithdrawModalOpen(false);
      setWithdrawShowProgress(false);
      setWithdrawProgressStep(0);
      await refreshNowpayments();
      showToast('Cash-out submitted');
    } catch (e: any) {
      if (isComplianceRequiredError(e)) {
        closeWithdrawModal();
        alertComplianceRequired();
      } else {
        setWithdrawProgressError(sanitizeError(e?.message || 'Cash-out could not be completed'));
      }
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const openWithdrawModal = () => {
    if (!complianceComplete) {
      alertComplianceRequired();
      return;
    }
    const forCurrency = whitelistedWallets.filter((w) => w.currency === withdrawCurrency);
    if (forCurrency.length === 0) {
      Alert.alert('No saved wallet', `Add a ${formatNetworkLabel(withdrawCurrency)} address in Settings first.`);
      return;
    }
    const nextId =
      selectedWhitelistId && forCurrency.some((w) => w.id === selectedWhitelistId)
        ? selectedWhitelistId
        : forCurrency[0].id;
    const snapMax = maxWithdrawableAmount(combinedWithdrawableForNetwork(npSummary, withdrawCurrency));
    setSelectedWhitelistId(nextId ?? null);
    setWithdrawModalMax(snapMax);
    setWithdrawModalCurrencyLabel(formatNetworkLabel(withdrawCurrency));
    setWithdrawSubmitting(false);
    setWithdrawShowProgress(false);
    setWithdrawProgressStep(0);
    setWithdrawProgressError(null);
    setWithdrawModalOpen(true);
  };

  function sanitizeError(raw: string) {
    return sanitizeUserFacingError(raw, 'Service temporarily unavailable. Please try again.');
  }

  const walletsForWithdrawCurrency = whitelistedWallets.filter((w) => w.currency === withdrawCurrency);
  const withdrawTotpOk = !totpEnabled || withdrawTotpCode.replace(/\s/g, '').length >= 6;
  const withdrawNum = Number(withdrawAmount);
  const gasMax = withdrawModalOpen ? withdrawModalMax : maxWithdraw;
  const withinGasReserve = gasMax <= 0 || !Number.isFinite(withdrawNum) || withdrawNum <= gasMax;
  const withdrawReady =
    withdrawAmount.trim().length > 0 &&
    Number.isFinite(withdrawNum) &&
    withdrawNum > 0 &&
    withinGasReserve &&
    Boolean(selectedWhitelistId) &&
    walletsForWithdrawCurrency.some((w) => w.id === selectedWhitelistId) &&
    withdrawTotpOk;

  const allActivity = useMemo(
    () => mergeAllWalletActivity(npSummary, cashTransactions),
    [npSummary, cashTransactions]
  );
  const recentActivity = useMemo(() => allActivity.slice(0, 5), [allActivity]);
  const walletLoading = npLoading && !npSummary && !npError;
  const totalUsd = useMemo(
    () => sumUsdtFamilyAvailable(npSummary?.balances, npSummary?.cashWalletUsd),
    [npSummary]
  );
  const balanceRows = useMemo(
    () => aggregateBalancesForDisplay(npSummary?.balances, npSummary?.cashWalletUsd),
    [npSummary]
  );

  const openTransferChooser = () => setTransferModalOpen(true);

  const openWithdrawChooser = () => setWithdrawMethodModalOpen(true);

  const chooseCryptoWithdraw = () => {
    setWithdrawMethodModalOpen(false);
    openWithdrawModal();
  };

  const chooseMobileMoneyWithdraw = () => {
    setWithdrawMethodModalOpen(false);
    navigateToLocalMoney(navigation, 'withdraw');
  };

  const inputStyle = {
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  } as const;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {!complianceComplete ? (
          <ComplianceProfileNotice
            noticeId='wallet_withdraw'
            message='Finish your profile in Settings before you can add or cash out funds.'
            onOpenSettings={() => navigateToSettings(navigation)}
          />
        ) : null}

        {npError ? (
          <Card style={styles.blockCard}>
            <Text style={styles.errorText}>{npError}</Text>
            <PrimaryButton label='Retry' onPress={() => void refreshNowpayments()} />
          </Card>
        ) : null}

        {walletLoading ? (
          <BalanceSkeleton />
        ) : (
          <>
            <Card style={styles.totalCard}>
              <Text style={styles.sectionLabel}>Your balance</Text>
              <Text style={styles.totalBalance}>
                {totalUsd > 0
                  ? `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '$0.00'}
              </Text>
              <Text style={styles.totalHint}>Shown in USD · includes USDT balance</Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.actionItem}
                  onPress={openWithdrawChooser}
                  accessibilityLabel='Cash out'
                >
                  <View style={styles.actionCircle}>
                    <Ionicons name='arrow-up' size={22} color={palette.textPrimary} />
                  </View>
                  <Text style={styles.actionLabel}>Cash out</Text>
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => setDepositModalOpen(true)} accessibilityLabel='Add funds'>
                  <View style={[styles.actionCircle, styles.actionCirclePrimary]}>
                    <Ionicons name='arrow-down' size={22} color={palette.primaryContrast} />
                  </View>
                  <Text style={styles.actionLabel}>Add funds</Text>
                </Pressable>
                <Pressable style={styles.actionItem} onPress={openTransferChooser} accessibilityLabel='Transfer'>
                  <View style={styles.actionCircle}>
                    <Ionicons name='swap-horizontal' size={22} color={palette.textPrimary} />
                  </View>
                  <Text style={styles.actionLabel}>Transfer</Text>
                </Pressable>
              </View>
            </Card>

            <Card style={styles.holdingsCard}>
              <Text style={styles.sectionLabel}>In your wallet</Text>
              {balanceRows.length > 0 ? (
                balanceRows.map((b) => (
                  <View key={b.asset} style={styles.balanceRow}>
                    <Text style={styles.assetCode}>{b.asset.toUpperCase()}</Text>
                    <Text style={styles.assetAmount}>{b.available}</Text>
                    {b.reserved && Number(b.reserved) > 0 ? (
                      <Text style={styles.reserved}>Reserved: {b.reserved}</Text>
                    ) : null}
                  </View>
                ))
              ) : npSummary && !npError ? (
                <Text style={styles.emptyHint}>Nothing here yet — tap Add funds to get started.</Text>
              ) : null}
              {npSummary && !npSummary.configured ? (
                <Text style={styles.emptyHint}>Adding funds is paused for now. Check back soon.</Text>
              ) : null}
            </Card>
          </>
        )}

        {walletLoading && !allActivity.length ? (
          <ActivityListSkeleton rows={5} />
        ) : (
          <Card style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <Text style={styles.sectionTitle}>Recent activity</Text>
              {allActivity.length > 5 ? (
                <Pressable onPress={() => navigateToTransactionHistory(navigation)}>
                  <Text style={styles.moreLink}>More</Text>
                </Pressable>
              ) : null}
            </View>
            <WalletActivityList
              rows={recentActivity}
              variant='compact'
              emptyMessage='No activity yet.'
              onPressRow={(row) => navigateToTransactionDetail(navigation, row)}
            />
            {allActivity.length > 0 && allActivity.length <= 5 ? (
              <PrimaryButton
                label='View all transactions'
                onPress={() => navigateToTransactionHistory(navigation)}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </Card>
        )}
      </ScrollView>

      <FormModal visible={depositModalOpen} title='Add funds' onClose={() => setDepositModalOpen(false)}>
        <Text style={styles.hint}>Choose a coin network and how much you want to add (USD).</Text>
        <TextInput
          style={inputStyle}
          value={depositUsdAmount}
          onChangeText={setDepositUsdAmount}
          placeholder='USD amount'
          placeholderTextColor={palette.textSecondary}
          keyboardType='numeric'
        />
        <Text style={styles.fieldLabel}>Coin network</Text>
        <NetworkGridCompact
          options={PAY_CURRENCY_OPTIONS}
          value={depositPayCurrency}
          onChange={setDepositPayCurrency}
          formatLabel={formatNetworkLabel}
          featuredOptions={['usdttrc20', 'eth']}
        />
        <PrimaryButton
          label={depositSubmitting ? 'Setting up…' : 'Continue to payment'}
          onPress={() => void onCreateDeposit()}
          disabled={depositSubmitting}
        />
      </FormModal>

      <FormModal
        visible={withdrawModalOpen}
        title={withdrawShowProgress ? 'Sending…' : 'Cash out to crypto'}
        avoidKeyboard={false}
        onClose={closeWithdrawModal}
        footer={
          withdrawShowProgress ? (
            withdrawProgressError ? (
              <PrimaryButton
                label='Back to form'
                onPress={() => {
                  setWithdrawShowProgress(false);
                  setWithdrawProgressStep(0);
                  setWithdrawProgressError(null);
                }}
                style={{ marginTop: 12 }}
              />
            ) : (
              <View style={{ height: 0 }} />
            )
          ) : undefined
        }
      >
        {withdrawShowProgress ? (
          <>
            <Text style={styles.hint}>Hang tight — we are sending your cash-out.</Text>
            <WithdrawalProgressSteps
              activeIndex={withdrawProgressStep}
              clientIp={clientIp}
              errorMessage={withdrawProgressError}
            />
          </>
        ) : (
          <>
            <Text style={styles.hint}>Send to one of your saved wallet addresses from Settings.</Text>
            {withdrawModalMax > 0 ? (
              <Text style={styles.withdrawMaxHint}>
                You can send up to {Math.floor(withdrawModalMax)} {withdrawModalCurrencyLabel}
              </Text>
            ) : null}
            <Pressable onPress={() => navigateToSupport(navigation, { category: 'withdraw' })} style={styles.supportLinkWrap}>
              <Text style={styles.supportLinkText}>
                Stuck? <Text style={styles.supportLinkAccent}>Message support</Text>
              </Text>
            </Pressable>
            <TextInput
              style={inputStyle}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder='Amount'
              placeholderTextColor={palette.textSecondary}
              keyboardType='numeric'
            />
            <Text style={styles.fieldLabel}>Network</Text>
            <OptionGrid
              options={WITHDRAW_CURRENCY_OPTIONS}
              value={withdrawCurrency as (typeof WITHDRAW_CURRENCY_OPTIONS)[number]}
              onChange={(c) => {
                setWithdrawCurrency(c);
                setWithdrawModalCurrencyLabel(formatNetworkLabel(c));
                setWithdrawModalMax(maxWithdrawableAmount(combinedWithdrawableForNetwork(npSummary, c)));
                const first = whitelistedWallets.find((w) => w.currency === c);
                setSelectedWhitelistId(first?.id ?? null);
              }}
              formatLabel={formatNetworkLabel}
            />
            <Text style={styles.fieldLabel}>Saved wallet</Text>
            {walletsForWithdrawCurrency.length ? (
              <OptionHighlightList
                options={walletsForWithdrawCurrency.map((w) => w.id!)}
                value={selectedWhitelistId || walletsForWithdrawCurrency[0].id!}
                onChange={setSelectedWhitelistId}
                formatLabel={(id) => {
                  const w = whitelistedWallets.find((x) => x.id === id);
                  return w?.label || formatNetworkLabel(w?.currency || withdrawCurrency);
                }}
              />
            ) : (
              <Text style={styles.hint}>Save a {formatNetworkLabel(withdrawCurrency)} address in Settings first.</Text>
            )}
            {selectedWhitelistId ? (
              <Text style={styles.mono}>{whitelistedWallets.find((w) => w.id === selectedWhitelistId)?.address}</Text>
            ) : null}
            {totpEnabled ? (
              <TextInput
                style={inputStyle}
                value={withdrawTotpCode}
                onChangeText={setWithdrawTotpCode}
                placeholder='Authenticator code'
                placeholderTextColor={palette.textSecondary}
                keyboardType='number-pad'
                maxLength={10}
              />
            ) : null}
            <PrimaryButton
              label='Send cash-out'
              onPress={() => void onWithdraw()}
              disabled={!withdrawReady || withdrawSubmitting}
            />
          </>
        )}
      </FormModal>

      <FormModal
        visible={withdrawMethodModalOpen}
        title='How do you want to cash out?'
        onClose={() => setWithdrawMethodModalOpen(false)}
      >
        <Text style={styles.hint}>Pick where the money should go.</Text>
        <Pressable style={styles.transferOption} onPress={chooseMobileMoneyWithdraw}>
          <Ionicons name='phone-portrait-outline' size={22} color={palette.primary} />
          <View style={styles.transferOptionText}>
            <Text style={styles.transferOptionTitle}>Phone money</Text>
            <Text style={styles.transferOptionSub}>Local currency to your mobile number</Text>
          </View>
          <Ionicons name='chevron-forward' size={20} color={palette.textSecondary} />
        </Pressable>
        <Pressable style={styles.transferOption} onPress={chooseCryptoWithdraw}>
          <Ionicons name='wallet-outline' size={22} color={palette.primary} />
          <View style={styles.transferOptionText}>
            <Text style={styles.transferOptionTitle}>Crypto wallet</Text>
            <Text style={styles.transferOptionSub}>USDT or ETH to your own address</Text>
          </View>
          <Ionicons name='chevron-forward' size={20} color={palette.textSecondary} />
        </Pressable>
      </FormModal>

      <FormModal visible={transferModalOpen} title='Transfer' onClose={() => setTransferModalOpen(false)}>
        <Text style={styles.hint}>Move funds between products or send to another member.</Text>
        <Pressable
          style={styles.transferOption}
          onPress={() => {
            setTransferModalOpen(false);
            navigateToSendById(navigation);
          }}
        >
          <Ionicons name='person-outline' size={22} color={palette.primary} />
          <View style={styles.transferOptionText}>
            <Text style={styles.transferOptionTitle}>Send to member</Text>
            <Text style={styles.transferOptionSub}>Transfer ID · trading USD balance</Text>
          </View>
          <Ionicons name='chevron-forward' size={20} color={palette.textSecondary} />
        </Pressable>
        <Pressable
          style={styles.transferOption}
          onPress={() => {
            setTransferModalOpen(false);
            navigateToAirfarmingTrade(navigation);
          }}
        >
          <Ionicons name='leaf-outline' size={22} color={palette.primary} />
          <View style={styles.transferOptionText}>
            <Text style={styles.transferOptionTitle}>Airfarmers</Text>
            <Text style={styles.transferOptionSub}>Move cash to or from airfarming</Text>
          </View>
          <Ionicons name='chevron-forward' size={20} color={palette.textSecondary} />
        </Pressable>
        <Pressable
          style={styles.transferOption}
          onPress={() => {
            setTransferModalOpen(false);
            navigateToVipFarmersTrade(navigation);
          }}
        >
          <Ionicons name='diamond-outline' size={22} color={palette.primary} />
          <View style={styles.transferOptionText}>
            <Text style={styles.transferOptionTitle}>Live VIP Farmers</Text>
            <Text style={styles.transferOptionSub}>Invest from your cash wallet</Text>
          </View>
          <Ionicons name='chevron-forward' size={20} color={palette.textSecondary} />
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  label: { color: palette.textSecondary, marginBottom: 8 },
  fieldLabel: { color: palette.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 6, fontWeight: '600' },
  sectionLabel: { color: palette.textSecondary, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  sectionTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: '700' },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  moreLink: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  activityCard: { paddingTop: 16, paddingBottom: 8, marginBottom: 12 },
  blockCard: { marginBottom: 12 },
  hint: { color: palette.textSecondary, marginTop: 4, marginBottom: 8, fontSize: 12 },
  errorText: { color: palette.danger, marginBottom: 8 },
  totalCard: { marginBottom: 12, paddingTop: 18, paddingBottom: 18 },
  holdingsCard: { marginBottom: 12, paddingTop: 16, paddingBottom: 8 },
  totalBalance: { color: palette.textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  totalHint: { color: palette.textSecondary, fontSize: 12, marginBottom: 4 },
  balanceRow: { marginBottom: 14 },
  assetCode: { color: palette.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  assetAmount: { color: palette.textPrimary, fontSize: 28, fontWeight: '800' },
  reserved: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  emptyHint: { color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 18, paddingHorizontal: 4 },
  actionItem: { alignItems: 'center', minWidth: 72 },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCirclePrimary: { backgroundColor: palette.primary, borderColor: palette.primary },
  actionCircleDisabled: { opacity: 0.45 },
  actionLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  transferOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: 12,
  },
  transferOptionText: { flex: 1 },
  transferOptionTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  transferOptionSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  mono: { color: palette.textPrimary, fontFamily: 'Menlo', fontSize: 12, marginBottom: 8 },
  withdrawMaxHint: { color: palette.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  supportLinkWrap: { marginBottom: 8 },
  supportLinkText: { color: palette.textSecondary, fontSize: 11, lineHeight: 16 },
  supportLinkAccent: { color: palette.primary, fontWeight: '600' },
  ipSlot: { minHeight: 52, marginBottom: 10, justifyContent: 'center' },
  ipText: { color: palette.textSecondary, fontSize: 11, lineHeight: 16 },
});
