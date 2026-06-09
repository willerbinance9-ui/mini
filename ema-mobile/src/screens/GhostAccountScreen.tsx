import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  ghostAccountService,
  type GhostAccountStatus,
  type GhostMemberLookup,
} from '../services/ghostAccountService';
import { palette } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

function fmtUsd(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GhostAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<GhostAccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allocateAmount, setAllocateAmount] = useState('');
  const [deallocateAmount, setDeallocateAmount] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<GhostMemberLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await ghostAccountService.getStatus());
    } catch (e: any) {
      setError(e?.message || 'Failed to load Ghost Account');
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const sec = status?.pollIntervalSec ?? 45;
    pollRef.current = setInterval(() => void load(), sec * 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, status?.pollIntervalSec]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onEnroll = async () => {
    try {
      setStatus(await ghostAccountService.enroll());
    } catch (e: any) {
      Alert.alert('Ghost Account', e?.message || 'Enrollment failed');
    }
  };

  const onAllocate = async () => {
    const n = Number(allocateAmount);
    if (!n || n <= 0) return Alert.alert('Amount', 'Enter a valid amount');
    try {
      setStatus(await ghostAccountService.allocate(n));
      setAllocateAmount('');
    } catch (e: any) {
      Alert.alert('Allocate', e?.message || 'Allocation failed');
    }
  };

  const onDeallocate = async () => {
    const n = Number(deallocateAmount);
    if (!n || n <= 0) return Alert.alert('Amount', 'Enter a valid amount');
    try {
      setStatus(await ghostAccountService.deallocate(n));
      setDeallocateAmount('');
    } catch (e: any) {
      Alert.alert('Withdraw', e?.message || 'Withdraw failed');
    }
  };

  const onLookup = async () => {
    setLookupError(null);
    setLookupResult(null);
    const email = memberEmail.trim();
    if (!email) return Alert.alert('Email', 'Enter the member email exactly');
    try {
      const result = await ghostAccountService.lookupMember(email);
      setLookupResult(result);
    } catch (e: any) {
      setLookupError(e?.message || 'No user found');
    }
  };

  const onAddMember = async () => {
    if (!lookupResult?.memberUserId) return;
    try {
      setStatus(await ghostAccountService.addMember(lookupResult.memberUserId));
      setMemberEmail('');
      setLookupResult(null);
      setLookupError(null);
    } catch (e: any) {
      Alert.alert('Add member', e?.message || 'Failed to add member');
    }
  };

  const onRemoveMember = (memberUserId: string, emailMasked: string) => {
    Alert.alert('Remove member', `Remove ${emailMasked} from your Ghost Account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setStatus(await ghostAccountService.removeMember(memberUserId));
          } catch (e: any) {
            Alert.alert('Remove member', e?.message || 'Failed to remove');
          }
        },
      },
    ]);
  };

  const onTogglePause = async (paused: boolean) => {
    try {
      setStatus(await ghostAccountService.setPaused(paused));
    } catch (e: any) {
      Alert.alert('Ghost Account', e?.message || 'Failed to update');
    }
  };

  if (!status && error) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Text style={styles.err}>{error}</Text>
        </Card>
      </ScrollView>
    );
  }

  if (!status) {
    return (
      <View style={[styles.container, { padding: 16, justifyContent: 'center' }]}>
        <Text style={styles.intro}>Loading…</Text>
      </View>
    );
  }

  if (!status.enrolled) {
    const needed =
      status.amountNeeded && status.amountNeeded > 0
        ? status.amountNeeded
        : Math.max(0, status.minEligibilityUsd + 0.01 - status.totalUsdt);
    const progress = Math.min(1, status.totalUsdt / (status.minEligibilityUsd + 0.01));
    const breakdown = status.balanceBreakdown;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        <Text style={styles.intro}>
          Share one pool across member drops. Requires more than {fmtUsd(status.minEligibilityUsd)} across cash,
          crypto, and airfarming balances.
        </Text>
        <Card style={styles.heroCard}>
          <Text style={styles.label}>Eligible balance</Text>
          <Text style={styles.big}>{fmtUsd(status.totalUsdt)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.statusLine}>
            {status.eligible
              ? `You qualify. First pool allocation must be at least ${fmtUsd(status.minAllocationUsd)} from cash.`
              : `Deposit or move ${fmtUsd(needed)} more to enroll.`}
          </Text>

          {breakdown ? (
            <View style={styles.breakdownBox}>
              <Text style={styles.breakdownTitle}>Balance breakdown</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Cash wallet</Text>
                <Text style={styles.breakdownVal}>{fmtUsd(breakdown.cashUsd)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Crypto USDT</Text>
                <Text style={styles.breakdownVal}>{fmtUsd(breakdown.cryptoUsd)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Airfarming</Text>
                <Text style={styles.breakdownVal}>{fmtUsd(breakdown.airfarmingUsd)}</Text>
              </View>
            </View>
          ) : null}

          {status.eligible ? (
            <PrimaryButton label="Enroll in Ghost Account" onPress={onEnroll} style={{ marginTop: 16 }} />
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>
              <PrimaryButton label="Deposit funds" onPress={() => navigation.navigate('Wallet')} />
              {breakdown && breakdown.airfarmingUsd > 0 ? (
                <PrimaryButton
                  label="Return airfarming to cash"
                  onPress={() => navigation.navigate('AirfarmingTrade')}
                  style={styles.secondaryBtn}
                />
              ) : null}
            </View>
          )}
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>How Ghost Account works</Text>
          <View style={styles.stepsList}>
            {[
              `Enroll when your combined balance exceeds ${fmtUsd(status.minEligibilityUsd)}.`,
              `Allocate at least ${fmtUsd(status.minAllocationUsd)} from cash into the pool.`,
              'Add members by email — the pool tops up their airfarming balance before drops.',
              'Principal and net profit return to your pool after each drop.',
            ].map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    );
  }

  const acct = status.account!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
    >
      <Text style={styles.intro}>
        Pool funds member airfarming drops at T-24h; principal and net profit return after payout.
      </Text>

      {error ? (
        <Card style={styles.infoCard}>
          <Text style={styles.err}>{error}</Text>
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Pool balance</Text>
          <View style={styles.row}>
            <Text style={styles.small}>Auto-lend</Text>
            <Switch
              value={acct.status === 'active'}
              onValueChange={(v) => void onTogglePause(!v)}
              trackColor={{ true: palette.primary }}
            />
          </View>
        </View>
        <Text style={styles.big}>{fmtUsd(acct.poolBalance)}</Text>
        <Text style={styles.hint}>
          Available {fmtUsd(acct.poolAvailable)} · Committed {fmtUsd(acct.poolCommitted)}
        </Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Allocate to pool</Text>
        <TextInput
          style={styles.input}
          placeholder={status.minAllocationUsd.toString()}
          placeholderTextColor={palette.textMuted}
          keyboardType="decimal-pad"
          value={allocateAmount}
          onChangeText={setAllocateAmount}
        />
        <PrimaryButton label="Allocate from cash" onPress={onAllocate} />
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Withdraw uncommitted</Text>
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor={palette.textMuted}
          keyboardType="decimal-pad"
          value={deallocateAmount}
          onChangeText={setDeallocateAmount}
        />
        <PrimaryButton label="Return to cash" onPress={onDeallocate} />
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Add member</Text>
        <Text style={styles.hint}>Enter the exact registered email. No results until it matches.</Text>
        <TextInput
          style={styles.input}
          placeholder="member@example.com"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={memberEmail}
          onChangeText={setMemberEmail}
        />
        <PrimaryButton label="Look up" onPress={onLookup} />
        {lookupError ? <Text style={styles.err}>{lookupError}</Text> : null}
        {lookupResult ? (
          <View style={styles.lookupBox}>
            <Text style={styles.lookupEmail}>{lookupResult.displayEmail}</Text>
            <PrimaryButton label="Add to Ghost Account" onPress={onAddMember} style={{ marginTop: 8 }} />
          </View>
        ) : null}
      </Card>

      {(status.members?.length ?? 0) > 0 ? (
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Members</Text>
          {status.members!.map((m) => (
            <View key={m.memberUserId} style={styles.memberRow}>
              <Text style={styles.memberEmail}>{m.emailMasked}</Text>
              <PrimaryButton
                label="Remove"
                onPress={() => onRemoveMember(m.memberUserId, m.emailMasked)}
                style={styles.removeBtn}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {(status.warnings?.length ?? 0) > 0 ? (
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Warnings</Text>
          {status.warnings!.map((w) => (
            <Text key={w.lendId} style={styles.warn}>
              {w.message}
            </Text>
          ))}
        </Card>
      ) : null}

      {(status.upcomingLends?.length ?? 0) > 0 ? (
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Scheduled auto-transfers</Text>
          {status.upcomingLends!.map((l) => (
            <View key={l.lendId} style={styles.lendRow}>
              <Text style={styles.lendTitle}>{l.memberEmailMasked}</Text>
              <Text style={styles.hint}>
                Drop {fmtDate(l.dueAt)} · lend {fmtUsd(l.lendAmount)} · est. net {fmtUsd(l.projectedProfitNet)}
              </Text>
              <Text style={styles.hint}>
                Range {fmtUsd(l.minBalance ?? 0)}–{fmtUsd(l.maxBalance ?? 0)} · {l.percent ?? '—'}% · {l.lendStatus}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {(status.recallHistory?.length ?? 0) > 0 ? (
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Recent recalls</Text>
          {status.recallHistory!.map((l) => (
            <View key={`recall-${l.lendId}`} style={styles.lendRow}>
              <Text style={styles.lendTitle}>{l.memberEmailMasked}</Text>
              <Text style={styles.hint}>
                Returned {fmtUsd(l.recalledPrincipal + l.recalledProfitNet)} (principal{' '}
                {fmtUsd(l.recalledPrincipal)} + net {fmtUsd(l.recalledProfitNet)})
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
  intro: {
    color: palette.textSecondary,
    marginBottom: 14,
    lineHeight: 21,
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: palette.surfaceElevated,
    borderColor: palette.border,
    borderWidth: 1,
  },
  infoCard: {
    backgroundColor: palette.surfaceElevated,
    borderColor: palette.border,
    borderWidth: 1,
  },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  big: { color: palette.textPrimary, fontSize: 32, fontWeight: '800', marginTop: 6 },
  statusLine: { color: palette.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  hint: { color: palette.textSecondary, fontSize: 13, lineHeight: 20 },
  err: { color: palette.danger, marginTop: 8, fontSize: 14 },
  warn: { color: palette.warning, marginBottom: 6, fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: palette.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    color: palette.textPrimary,
    marginBottom: 12,
    backgroundColor: palette.background,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { color: palette.textSecondary, fontSize: 12 },
  lookupBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  lookupEmail: { color: palette.textPrimary, fontWeight: '600' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  memberEmail: { color: palette.textPrimary, flex: 1 },
  removeBtn: { paddingHorizontal: 12, minWidth: 90 },
  lendRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.border },
  lendTitle: { color: palette.textPrimary, fontWeight: '600' },
  progressTrack: {
    marginTop: 14,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  breakdownBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  breakdownTitle: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: { color: palette.textSecondary, fontSize: 14 },
  breakdownVal: { color: palette.textPrimary, fontWeight: '700', fontSize: 14 },
  stepsList: { gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: { color: palette.primaryContrast, fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, color: palette.textSecondary, fontSize: 14, lineHeight: 21 },
  secondaryBtn: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
});
