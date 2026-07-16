import { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  vipFarmerService,
  type VipLoanStatus,
} from '../services/vipFarmerService';
import { whitelistWalletService } from '../services/whitelistWalletService';
import { palette } from '../theme/colors';
import type { RootStackParamList, WhitelistedWallet } from '../types';
import { navigateToSettings } from '../utils/navigationHelpers';

function fmtUsd(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortAddr(addr: string) {
  const a = String(addr || '');
  if (a.length <= 16) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

type Destination = 'platform' | 'direct_wallet';

export function VipLoanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<VipLoanStatus | null>(null);
  const [wallets, setWallets] = useState<WhitelistedWallet[]>([]);
  const [destination, setDestination] = useState<Destination>('platform');
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loan, wl] = await Promise.all([
        vipFarmerService.getLoanStatus(),
        whitelistWalletService.list().catch(() => ({ wallets: [] as WhitelistedWallet[] })),
      ]);
      setStatus(loan);
      const list = wl.wallets || [];
      setWallets(list);
      setSelectedWalletId((prev) => prev || (list[0]?.id ?? null));
    } catch (e: any) {
      setError(e?.message || 'Failed to load VIP loan');
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) || null;

  const onAccept = async () => {
    if (!status?.eligible) return;
    if (destination === 'direct_wallet' && !selectedWallet?.address) {
      return Alert.alert('Wallet', 'Select a whitelisted wallet, or add one in Settings.');
    }

    const tierNote =
      status.borrowerTier === 'new'
        ? `New VIP: month accrual ${fmtUsd(status.monthEarningsBaseUsd ?? 0)}, then −50%, then −30% commission.`
        : `Month accrual ${fmtUsd(status.monthEarningsBaseUsd ?? 0)} − 30% commission.`;

    Alert.alert(
      'Accept VIP loan',
      `${tierNote}\n\nYou receive ${fmtUsd(status.disbursedUsd ?? 0)} within ${status.approvalMaxBusinessDays || 3} business days to ${
        destination === 'platform' ? 'your cash wallet' : shortAddr(selectedWallet!.address)
      }.\n\nYou repay ${fmtUsd(status.amountUsd ?? 0)}. Cash/crypto withdrawals and VIP farming exits stay locked until repaid. Platform use and in-app transfers are allowed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept loan',
          onPress: async () => {
            setSubmitting(true);
            try {
              const r = await vipFarmerService.requestLoan({
                destination,
                walletAddress: destination === 'direct_wallet' ? selectedWallet!.address : undefined,
              });
              await load();
              Alert.alert('Loan submitted', r.message);
            } catch (e: any) {
              Alert.alert('Loan', e?.message || 'Request failed');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const onRepay = async () => {
    const outstanding = status?.openLoan?.outstandingUsd ?? 0;
    const n = repayAmount.trim() ? Number(repayAmount) : outstanding;
    if (!n || n <= 0) return Alert.alert('Repay', 'Enter a valid amount');
    try {
      const r = await vipFarmerService.repayLoan(n);
      setRepayAmount('');
      await load();
      Alert.alert('Loan repayment', r.message);
    } catch (e: any) {
      Alert.alert('Repay', e?.message || 'Repayment failed');
    }
  };

  const openLoan = status?.openLoan;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      <Text style={styles.sub}>
        Eligible with more than $2,500 in VIP farming. Funds arrive within 3 business days. Use on-platform or transfer
        in-app only — withdrawals and VIP exits stay locked until repaid.
      </Text>

      {error ? (
        <Card style={styles.card}>
          <Text style={styles.err}>{error}</Text>
        </Card>
      ) : null}

      {!status && !error ? (
        <Card style={styles.card}>
          <Text style={styles.meta}>Loading…</Text>
        </Card>
      ) : null}

      {openLoan ? (
        <Card style={styles.card}>
          <Text style={styles.title}>
            {openLoan.status === 'pending' ? 'Awaiting disbursement' : 'Active loan'}
          </Text>
          <Text style={styles.meta}>Loan amount: {fmtUsd(openLoan.amountUsd)}</Text>
          <Text style={styles.meta}>You receive: {fmtUsd(openLoan.disbursedUsd)}</Text>
          <Text style={styles.meta}>
            Payout:{' '}
            {openLoan.payoutDestination === 'direct_wallet'
              ? shortAddr(openLoan.payoutWalletAddress || '')
              : 'Platform cash wallet'}
          </Text>
          {openLoan.status === 'pending' ? (
            <Text style={[styles.disclaimer, { marginTop: 10 }]}>
              Disbursement within {status?.approvalMaxBusinessDays || 3} business days. Withdrawals are locked while
              this request is open.
            </Text>
          ) : (
            <>
              <Text style={styles.meta}>Outstanding: {fmtUsd(openLoan.outstandingUsd)}</Text>
              <Text style={styles.meta}>Repaid: {fmtUsd(openLoan.repaidUsd)}</Text>
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                value={repayAmount}
                onChangeText={setRepayAmount}
                placeholder={`Repay (max ${fmtUsd(openLoan.outstandingUsd)})`}
                placeholderTextColor={palette.textSecondary}
                keyboardType="numeric"
              />
              <PrimaryButton label="Repay loan" onPress={() => void onRepay()} style={{ marginTop: 8 }} />
            </>
          )}
        </Card>
      ) : null}

      {status && !openLoan ? (
        <>
          <Card style={styles.card}>
            <Text style={styles.label}>VIP principal</Text>
            <Text style={styles.big}>{fmtUsd(status.principalUsd || 0)}</Text>
            <Text style={styles.meta}>
              {status.eligible
                ? 'You qualify for a VIP loan'
                : status.ineligibleReason || 'Not eligible yet'}
            </Text>
          </Card>

          {status.eligible ? (
            <>
              <Card style={styles.card}>
                <Text style={styles.title}>Your offer</Text>
                <Text style={styles.meta}>
                  Month accrual base: {fmtUsd(status.monthEarningsBaseUsd || status.projectedMonthUsd || 0)}
                </Text>
                {status.borrowerTier === 'new' ? (
                  <Text style={styles.disclaimer}>
                    New on VIP (under one month): loan = month accrual − 50%, then − 30% commission.
                  </Text>
                ) : (
                  <Text style={styles.disclaimer}>
                    Completed VIP month: loan = month accrual − 30% commission.
                  </Text>
                )}
                {status.haircutRate ? (
                  <Text style={styles.meta}>After −{(status.haircutRate * 100).toFixed(0)}%: {fmtUsd(status.amountUsd ?? 0)}</Text>
                ) : (
                  <Text style={styles.meta}>Loan amount: {fmtUsd(status.amountUsd ?? 0)}</Text>
                )}
                <Text style={styles.meta}>
                  Commission ({(status.commissionRate * 100).toFixed(0)}%): {fmtUsd(status.commissionUsd ?? 0)}
                </Text>
                <Text style={styles.receiveLabel}>You receive</Text>
                <Text style={styles.receive}>{fmtUsd(status.disbursedUsd ?? 0)}</Text>
              </Card>

              <Card style={styles.card}>
                <Text style={styles.title}>Receive funds in</Text>
                <Pressable
                  style={[styles.option, destination === 'platform' && styles.optionOn]}
                  onPress={() => setDestination('platform')}
                >
                  <Text style={styles.optionTitle}>Platform cash wallet</Text>
                  <Text style={styles.optionMeta}>Credited in-app once disbursed</Text>
                </Pressable>
                <Pressable
                  style={[styles.option, destination === 'direct_wallet' && styles.optionOn]}
                  onPress={() => setDestination('direct_wallet')}
                >
                  <Text style={styles.optionTitle}>Whitelisted wallet</Text>
                  <Text style={styles.optionMeta}>External address you saved in Settings</Text>
                </Pressable>

                {destination === 'direct_wallet' ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {wallets.length === 0 ? (
                      <>
                        <Text style={styles.disclaimer}>No whitelisted wallets yet.</Text>
                        <PrimaryButton
                          label="Add wallet in Settings"
                          onPress={() => navigateToSettings(navigation, { openSecurity: true })}
                        />
                      </>
                    ) : (
                      wallets.map((w) => (
                        <Pressable
                          key={w.id}
                          style={[styles.walletRow, selectedWalletId === w.id && styles.optionOn]}
                          onPress={() => setSelectedWalletId(w.id)}
                        >
                          <Text style={styles.optionTitle}>{w.currency?.toUpperCase?.() || 'USDT'}</Text>
                          <Text style={styles.mono}>{shortAddr(w.address)}</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : null}

                <PrimaryButton
                  label={submitting ? 'Submitting…' : 'Accept loan'}
                  onPress={() => void onAccept()}
                  style={{ marginTop: 14 }}
                  disabled={submitting}
                />
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {(status?.loans?.length ?? 0) > 0 ? (
        <Card style={styles.card}>
          <Text style={styles.title}>Recent loans</Text>
          {status!.loans.slice(0, 5).map((l) => (
            <View key={l.id} style={styles.histRow}>
              <Text style={styles.optionTitle}>
                {fmtUsd(l.amountUsd)} · {l.status}
              </Text>
              <Text style={styles.meta}>
                Received {fmtUsd(l.disbursedUsd)} · {new Date(l.requestedAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  sub: { color: palette.textSecondary, marginBottom: 12, lineHeight: 20, fontSize: 14 },
  card: {
    marginBottom: 12,
    backgroundColor: palette.surfaceElevated,
    borderColor: palette.border,
    borderWidth: 1,
  },
  label: { color: palette.textSecondary, marginBottom: 4, fontWeight: '600' },
  title: { color: palette.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  big: { color: palette.primary, fontSize: 28, fontWeight: '800' },
  meta: { color: palette.textSecondary, marginTop: 4, fontSize: 13, lineHeight: 18 },
  disclaimer: { color: palette.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 8 },
  receiveLabel: { color: palette.textSecondary, marginTop: 12, fontWeight: '600' },
  receive: { color: palette.success, fontSize: 28, fontWeight: '800', marginTop: 2 },
  err: { color: palette.danger },
  input: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    borderRadius: 12,
    padding: 12,
  },
  option: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    backgroundColor: palette.background,
  },
  optionOn: { borderColor: palette.primary, backgroundColor: 'rgba(234,179,8,0.08)' },
  optionTitle: { color: palette.textPrimary, fontWeight: '700' },
  optionMeta: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  walletRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: palette.background,
  },
  mono: { color: palette.textSecondary, fontFamily: 'Courier', marginTop: 4, fontSize: 12 },
  histRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
});
