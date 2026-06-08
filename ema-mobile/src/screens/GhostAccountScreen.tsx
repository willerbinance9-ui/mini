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
        <Text style={styles.sub}>Loading…</Text>
      </View>
    );
  }

  if (!status.enrolled) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        <Text style={styles.sub}>
          Share one pool across member drops. Requires more than {fmtUsd(status.minEligibilityUsd)} total USDT.
        </Text>
        <Card>
          <Text style={styles.label}>Your total USDT</Text>
          <Text style={styles.big}>{fmtUsd(status.totalUsdt)}</Text>
          <Text style={[styles.hint, { marginTop: 8 }]}>
            {status.eligible
              ? `Eligible. First allocation must be at least ${fmtUsd(status.minAllocationUsd)}.`
              : `Need more than ${fmtUsd(status.minEligibilityUsd)} to enroll.`}
          </Text>
          {status.eligible ? (
            <PrimaryButton title="Enroll in Ghost Account" onPress={onEnroll} style={{ marginTop: 16 }} />
          ) : null}
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
      <Text style={styles.sub}>
        Pool funds member airfarming drops at T-24h; principal and net profit return after payout.
      </Text>

      {error ? (
        <Card>
          <Text style={styles.err}>{error}</Text>
        </Card>
      ) : null}

      <Card>
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

      <Card>
        <Text style={styles.sectionTitle}>Allocate to pool</Text>
        <TextInput
          style={styles.input}
          placeholder={status.minAllocationUsd.toString()}
          placeholderTextColor={palette.textMuted}
          keyboardType="decimal-pad"
          value={allocateAmount}
          onChangeText={setAllocateAmount}
        />
        <PrimaryButton title="Allocate from cash" onPress={onAllocate} />
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Withdraw uncommitted</Text>
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor={palette.textMuted}
          keyboardType="decimal-pad"
          value={deallocateAmount}
          onChangeText={setDeallocateAmount}
        />
        <PrimaryButton title="Return to cash" onPress={onDeallocate} />
      </Card>

      <Card>
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
        <PrimaryButton title="Look up" onPress={onLookup} />
        {lookupError ? <Text style={styles.err}>{lookupError}</Text> : null}
        {lookupResult ? (
          <View style={styles.lookupBox}>
            <Text style={styles.lookupEmail}>{lookupResult.displayEmail}</Text>
            <PrimaryButton title="Add to Ghost Account" onPress={onAddMember} style={{ marginTop: 8 }} />
          </View>
        ) : null}
      </Card>

      {(status.members?.length ?? 0) > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Members</Text>
          {status.members!.map((m) => (
            <View key={m.memberUserId} style={styles.memberRow}>
              <Text style={styles.memberEmail}>{m.emailMasked}</Text>
              <PrimaryButton
                title="Remove"
                onPress={() => onRemoveMember(m.memberUserId, m.emailMasked)}
                style={styles.removeBtn}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {(status.warnings?.length ?? 0) > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>Warnings</Text>
          {status.warnings!.map((w) => (
            <Text key={w.lendId} style={styles.warn}>
              {w.message}
            </Text>
          ))}
        </Card>
      ) : null}

      {(status.upcomingLends?.length ?? 0) > 0 ? (
        <Card>
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
        <Card>
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
  sub: { color: palette.textMuted, marginBottom: 12, lineHeight: 20 },
  label: { color: palette.textMuted, fontSize: 13 },
  big: { color: palette.textPrimary, fontSize: 28, fontWeight: '700', marginTop: 4 },
  hint: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  err: { color: palette.danger, marginTop: 8 },
  warn: { color: '#e8a838', marginBottom: 6 },
  sectionTitle: { color: palette.textPrimary, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    color: palette.textPrimary,
    marginBottom: 12,
    backgroundColor: palette.surface,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { color: palette.textMuted, fontSize: 12 },
  lookupBox: { marginTop: 12, padding: 12, backgroundColor: palette.surface, borderRadius: 12 },
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
});
