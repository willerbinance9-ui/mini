import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { VipExitWizard } from '../components/VipExitWizard';
import {
  vipFarmerService,
  reinvestNetUsd,
  reinvestCommissionUsd,
  type VipLoanStatus,
  type VipSummary,
} from '../services/vipFarmerService';
import { palette } from '../theme/colors';

function fmtUsd(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function VipFarmersTradeScreen() {
  const [summary, setSummary] = useState<VipSummary | null>(null);
  const [loanStatus, setLoanStatus] = useState<VipLoanStatus | null>(null);
  const [amount, setAmount] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exitWizardOpen, setExitWizardOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, loan] = await Promise.all([
        vipFarmerService.getSummary(),
        vipFarmerService.getLoanStatus().catch(() => null),
      ]);
      setSummary(s);
      setLoanStatus(loan);
    } catch (e: any) {
      setError(e?.message || 'Failed to load VIP Farmers');
      setSummary(null);
      setLoanStatus(null);
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

  const onInvest = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return Alert.alert('Amount', 'Enter a valid amount');
    try {
      await vipFarmerService.invest(n);
      setAmount('');
      await load();
      Alert.alert('Invested', 'Your VIP Farmers lock has started.');
    } catch (e: any) {
      Alert.alert('VIP Farmers', e?.message || 'Invest failed');
    }
  };

  const onAddCapital = async () => {
    const n = Number(addAmount);
    if (!n || n <= 0) return Alert.alert('Amount', 'Enter a valid amount');
    const lockDays = summary?.lockDaysCalendar ?? summary?.lockDays ?? 38;
    Alert.alert(
      'Add capital',
      `Adding funds increases your principal and restarts the ${lockDays}-day lock from today. Daily accrual resets to day 0.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add capital',
          onPress: async () => {
            try {
              const r = await vipFarmerService.addCapital(n);
              setAddAmount('');
              await load();
              Alert.alert(
                'Capital added',
                `Added ${fmtUsd(r.addedUsd)}. New principal ${fmtUsd(r.investment.principalUsd)}. Lock restarted.`
              );
            } catch (e: any) {
              Alert.alert('VIP Farmers', e?.message || 'Add capital failed');
            }
          },
        },
      ]
    );
  };

  const onReinvest = async () => {
    const inv = summary?.investment;
    const available = inv?.availableRevenueUsd ?? 0;
    if (available <= 0) {
      return Alert.alert('Reinvest', 'No earnings available to reinvest.');
    }
    const net = reinvestNetUsd(available);
    const commission = reinvestCommissionUsd(available);
    Alert.alert(
      'Reinvest earnings',
      `Reinvest ${fmtUsd(net)} into your VIP principal? A 30% commission (${fmtUsd(commission)}) is deducted from your ${fmtUsd(available)} available revenue. Your lock restarts from today.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reinvest',
          onPress: async () => {
            try {
              const r = await vipFarmerService.reinvest();
              await load();
              Alert.alert('Reinvested', r.message || `Reinvested ${fmtUsd(r.reinvestedUsd)}.`);
            } catch (e: any) {
              Alert.alert('Reinvest', e?.message || 'Reinvest failed');
            }
          },
        },
      ]
    );
  };

  const onRequestLoan = async () => {
    const n = Number(loanAmount);
    if (!n || n <= 0) return Alert.alert('Loan', 'Enter a valid amount');
    const max = loanStatus?.maxLoanUsd ?? 0;
    const disbursed = n * (1 - (loanStatus?.commissionRate ?? 0.3));
    Alert.alert(
      'Request VIP loan',
      `Request ${fmtUsd(n)} loan? After 30% commission you receive ${fmtUsd(disbursed)} for platform use (farming, trading, VIP). Approval can take up to ${loanStatus?.approvalMaxDays ?? 2} days. Withdrawals stay locked until repaid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit request',
          onPress: async () => {
            try {
              const r = await vipFarmerService.requestLoan(Math.min(n, max));
              setLoanAmount('');
              await load();
              Alert.alert('Loan requested', r.message);
            } catch (e: any) {
              Alert.alert('Loan', e?.message || 'Request failed');
            }
          },
        },
      ]
    );
  };

  const onRepayLoan = async () => {
    const outstanding = loanStatus?.openLoan?.outstandingUsd ?? 0;
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

  const openExitWizard = () => {
    if (summary?.pendingExitRequest) {
      Alert.alert(
        'Request in progress',
        'You already have a withdrawal request being processed. Please wait for it to complete.'
      );
      return;
    }
    setExitWizardOpen(true);
  };

  const inv = summary?.investment;
  const lockCal = summary?.lockDaysCalendar ?? summary?.lockDays ?? 38;
  const lockWork = summary?.lockDaysWorking ?? 22;
  const availableRevenue = inv?.availableRevenueUsd ?? 0;
  const openLoan = loanStatus?.openLoan;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        <Text style={styles.sub}>
          {lockCal}-day calendar lock · {lockWork} working days · {(summary?.dailyRate ?? 0.06) * 100}% daily on
          principal paid to cash · Min {fmtUsd(summary?.minInvestUsd ?? 100)}
        </Text>

        {error ? (
          <Card>
            <Text style={styles.err}>{error}</Text>
          </Card>
        ) : null}

        {summary ? (
          <>
            <Card>
              <Text style={styles.label}>Cash wallet</Text>
              <Text style={styles.big}>{fmtUsd(summary.cashWalletUsd)}</Text>
            </Card>

            {summary.pendingExitRequest ? (
              <Card>
                <Text style={styles.pendingTitle}>Withdrawal in progress</Text>
                <Text style={styles.meta}>Your withdrawal request is being processed.</Text>
              </Card>
            ) : null}

            {openLoan ? (
              <Card>
                <Text style={styles.pendingTitle}>
                  VIP loan · {openLoan.status === 'pending' ? 'Awaiting approval' : 'Active'}
                </Text>
                <Text style={styles.meta}>Amount: {fmtUsd(openLoan.amountUsd)}</Text>
                {openLoan.status === 'active' ? (
                  <>
                    <Text style={styles.meta}>Outstanding: {fmtUsd(openLoan.outstandingUsd)}</Text>
                    <Text style={styles.meta}>Repaid: {fmtUsd(openLoan.repaidUsd)}</Text>
                    <Text style={[styles.disclaimer, { marginTop: 8 }]}>
                      Withdrawals are locked until this loan is fully repaid. Loan funds are for platform use only.
                    </Text>
                    <TextInput
                      style={[styles.input, { marginTop: 8 }]}
                      value={repayAmount}
                      onChangeText={setRepayAmount}
                      placeholder={`Repay (max ${fmtUsd(openLoan.outstandingUsd)})`}
                      placeholderTextColor={palette.textSecondary}
                      keyboardType='numeric'
                    />
                    <PrimaryButton label='Repay loan' onPress={() => void onRepayLoan()} style={{ marginTop: 8 }} />
                  </>
                ) : (
                  <Text style={styles.meta}>
                    Approval can take up to {loanStatus?.approvalMaxDays ?? 2} days. You will be notified when reviewed.
                  </Text>
                )}
              </Card>
            ) : loanStatus?.eligible ? (
              <Card>
                <Text style={styles.label}>VIP loan</Text>
                <Text style={styles.meta}>
                  Last month earnings: {fmtUsd(loanStatus.lastMonthEarningsUsd)} · Max loan:{' '}
                  {fmtUsd(loanStatus.maxLoanUsd)}
                </Text>
                <Text style={styles.disclaimer}>
                  30% commission deducted upfront. For platform use (farming, trading, VIP). Approval up to{' '}
                  {loanStatus.approvalMaxDays} days.
                </Text>
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={loanAmount}
                  onChangeText={setLoanAmount}
                  placeholder={`Max ${fmtUsd(loanStatus.maxLoanUsd)}`}
                  placeholderTextColor={palette.textSecondary}
                  keyboardType='numeric'
                />
                <PrimaryButton label='Request loan' onPress={() => void onRequestLoan()} style={{ marginTop: 8 }} />
              </Card>
            ) : loanStatus && !loanStatus.eligible && loanStatus.ineligibleReason ? (
              <Card>
                <Text style={styles.label}>VIP loan</Text>
                <Text style={styles.meta}>{loanStatus.ineligibleReason}</Text>
              </Card>
            ) : null}

            {inv ? (
              <Card>
                <Text style={styles.label}>Active investment</Text>
                <Text style={styles.big}>{fmtUsd(inv.principalUsd)}</Text>
                <Text style={styles.meta}>Earned so far: {fmtUsd(inv.totalAccruedUsd)}</Text>
                <Text style={styles.meta}>Available revenue: {fmtUsd(availableRevenue)}</Text>
                <Text style={styles.meta}>
                  Working days {inv.workingDays ?? inv.daysAccrued}/{lockWork} · Calendar day{' '}
                  {inv.calendarDays ?? 0}/{lockCal}
                </Text>
                <Text style={styles.meta}>
                  {inv.penaltyFreeToday
                    ? 'Penalty-free exit day'
                    : `Exit penalty applies unless day ${lockWork} (working) or day ${lockCal} (calendar)`}
                </Text>
                <Text style={styles.meta}>Matures {new Date(inv.maturesAt).toLocaleString()}</Text>
                <Text style={[styles.disclaimer, { marginTop: 10 }]}>
                  Add capital from cash to grow principal. This restarts the {lockCal}-day lock from today.
                </Text>
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={addAmount}
                  onChangeText={setAddAmount}
                  placeholder={`Min ${fmtUsd(summary.minInvestUsd)}`}
                  placeholderTextColor={palette.textSecondary}
                  keyboardType='numeric'
                />
                <PrimaryButton label='Add capital' onPress={() => void onAddCapital()} style={{ marginTop: 8 }} />
                {availableRevenue > 0 && !summary.pendingExitRequest ? (
                  <PrimaryButton
                    label={`Reinvest earnings (${fmtUsd(reinvestNetUsd(availableRevenue))} net)`}
                    onPress={() => void onReinvest()}
                    style={{ marginTop: 8 }}
                  />
                ) : null}
                <PrimaryButton
                  label='Withdraw / end investment'
                  onPress={openExitWizard}
                  variant='danger'
                  style={{ marginTop: 12 }}
                  disabled={Boolean(summary.pendingExitRequest)}
                />
              </Card>
            ) : (
              <Card>
                <Text style={styles.label}>Invest from cash</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder='Amount USD'
                  placeholderTextColor={palette.textSecondary}
                  keyboardType='numeric'
                />
                <Text style={styles.disclaimer}>
                  Funds are locked for {lockCal} calendar days ({lockWork} working payout days). Use the exit wizard to
                  withdraw revenue or end your investment.
                </Text>
                <PrimaryButton label='Start VIP lock' onPress={() => void onInvest()} style={{ marginTop: 8 }} />
              </Card>
            )}
          </>
        ) : !error ? (
          <Card>
            <Text style={styles.meta}>Loading…</Text>
          </Card>
        ) : null}
      </ScrollView>

      {summary && inv ? (
        <VipExitWizard
          visible={exitWizardOpen}
          summary={summary}
          onClose={() => setExitWizardOpen(false)}
          onComplete={() => {
            setExitWizardOpen(false);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  sub: { color: palette.textSecondary, marginBottom: 12, lineHeight: 18 },
  label: { color: palette.textSecondary, marginBottom: 6 },
  big: { color: palette.primary, fontSize: 28, fontWeight: '800' },
  meta: { color: palette.textSecondary, marginTop: 4, fontSize: 13 },
  pendingTitle: { color: palette.primary, fontWeight: '700', marginBottom: 4 },
  input: {
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  disclaimer: { color: palette.textSecondary, fontSize: 12, lineHeight: 17 },
  err: { color: palette.warning },
});
