import { useCallback, useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { FormModal } from '../components/FormModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { useToast } from '../hooks/useToast';
import {
  liveTradingService,
  type LiveTradingAccount,
} from '../services/liveTradingService';
import type { RootStackParamList } from '../types';
import { palette } from '../theme/colors';
import { withTimeout } from '../utils/withTimeout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

export function LiveTradingScreen() {
  const navigation = useNavigation<Nav>();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<LiveTradingAccount[]>([]);
  const [serverHint, setServerHint] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [cashWallet, setCashWallet] = useState(0);

  const load = useCallback(async () => {
    const data = await withTimeout(liveTradingService.listAccounts(), 12000, 'Live accounts');
    setAccounts(data.accounts || []);
    setServerHint(data.server || '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => Alert.alert('Live Trading', (e as Error).message || 'Failed to load accounts'));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      Alert.alert('Live Trading', (e as Error).message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const copyText = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    showToast(`${label} copied`);
  };

  const openFund = async (accountId: string) => {
    setActiveAccountId(accountId);
    setAmount('');
    setFundModalOpen(true);
    try {
      const s = await liveTradingService.getSummary(accountId);
      setCashWallet(s.cashWallet);
    } catch {
      setCashWallet(0);
    }
  };

  const openReturn = (accountId: string) => {
    setActiveAccountId(accountId);
    setAmount('');
    setReturnModalOpen(true);
  };

  const submitFund = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      await liveTradingService.fund(activeAccountId, n);
      setFundModalOpen(false);
      showToast('Funds sent to live account');
      await load();
    } catch (e) {
      Alert.alert('Funding failed', (e as Error).message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const submitReturn = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      await liveTradingService.returnToCash(activeAccountId, n);
      setReturnModalOpen(false);
      showToast('Returned to cash wallet');
      await load();
    } catch (e) {
      Alert.alert('Withdraw failed', (e as Error).message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />}
      >
        <Text style={styles.hint}>
          Real accounts · Server {serverHint || '—'} · Fund from your cash wallet, then trade in-app.
        </Text>

        {accounts.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No live accounts yet</Text>
            <Text style={styles.meta}>Open an account, choose Synthetix EA or Quantix EA, and set your trading password.</Text>
          </Card>
        ) : null}

        {accounts.map((acc) => {
          const expanded = expandedId === acc.id;
          return (
            <Card key={acc.id} style={styles.accountCard}>
              <Pressable onPress={() => setExpandedId(expanded ? null : acc.id)}>
                <View style={styles.accountHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{acc.accountName || 'Live account'}</Text>
                    <Text style={styles.meta}>
                      {acc.botLabel} · 1:{acc.leverage} · #{acc.login}
                    </Text>
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSecondary} />
                </View>
                <View style={styles.balanceRow}>
                  <Text style={styles.statLabel}>Balance</Text>
                  <Text style={styles.statValue}>${Math.floor(acc.internalBalance).toLocaleString()}</Text>
                </View>
              </Pressable>

              {expanded ? (
                <View style={styles.expanded}>
                  <View style={styles.copyRow}>
                    <Text style={styles.copyLabel}>Login</Text>
                    <Pressable style={styles.copyBtn} onPress={() => void copyText('Login', acc.login)}>
                      <Text style={styles.copyValue}>{acc.login}</Text>
                      <Ionicons name='copy-outline' size={16} color={palette.primary} />
                    </Pressable>
                  </View>
                  <View style={styles.copyRow}>
                    <Text style={styles.copyLabel}>Server</Text>
                    <Pressable style={styles.copyBtn} onPress={() => void copyText('Server', acc.server)}>
                      <Text style={styles.copyValue}>{acc.server}</Text>
                      <Ionicons name='copy-outline' size={16} color={palette.primary} />
                    </Pressable>
                  </View>
                  <View style={styles.actionRow}>
                    <PrimaryButton label='Deposit' compact onPress={() => void openFund(acc.id)} style={styles.actionBtn} />
                    <PrimaryButton label='Withdraw' compact variant='danger' onPress={() => openReturn(acc.id)} style={styles.actionBtn} />
                    <PrimaryButton
                      label='Trade'
                      compact
                      onPress={() => navigation.navigate('LiveTradingAccount', { accountId: acc.id })}
                      style={styles.actionBtn}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => navigation.navigate('LiveTradingCreateBot')}>
        <Ionicons name='add' size={28} color='#fff' />
        <Text style={styles.fabText}>Open account</Text>
      </Pressable>

      <FormModal
        visible={fundModalOpen}
        title='Deposit to account'
        onClose={() => setFundModalOpen(false)}
        footer={
          <PrimaryButton label={busy ? 'Sending…' : 'Confirm deposit'} onPress={() => void submitFund()} disabled={busy} />
        }
      >
        <Text style={styles.meta}>
          {activeAccount?.accountName} · Cash available ${Math.floor(cashWallet).toLocaleString()}
        </Text>
        <TextInput
          style={inputStyle}
          value={amount}
          onChangeText={setAmount}
          placeholder='Amount USD'
          placeholderTextColor={palette.textSecondary}
          keyboardType='decimal-pad'
        />
      </FormModal>

      <FormModal
        visible={returnModalOpen}
        title='Withdraw to cash'
        onClose={() => setReturnModalOpen(false)}
        footer={
          <PrimaryButton label={busy ? 'Processing…' : 'Confirm withdraw'} onPress={() => void submitReturn()} disabled={busy} />
        }
      >
        <Text style={styles.meta}>
          {activeAccount?.accountName} · Balance ${Math.floor(activeAccount?.internalBalance || 0).toLocaleString()}
        </Text>
        <TextInput
          style={inputStyle}
          value={amount}
          onChangeText={setAmount}
          placeholder='Amount USD'
          placeholderTextColor={palette.textSecondary}
          keyboardType='decimal-pad'
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, paddingBottom: 100 },
  hint: { color: palette.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: palette.textPrimary, marginBottom: 6 },
  meta: { color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
  accountCard: { marginBottom: 12 },
  accountHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  accountName: { fontSize: 17, fontWeight: '800', color: palette.textPrimary },
  balanceRow: { marginTop: 4 },
  statLabel: { fontSize: 11, color: palette.textSecondary, marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: palette.textPrimary },
  expanded: { marginTop: 14, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, gap: 8 },
  copyRow: { gap: 4 },
  copyLabel: { fontSize: 11, color: palette.textSecondary },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  copyValue: { flex: 1, fontSize: 14, fontWeight: '600', color: palette.textPrimary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionBtn: { flexGrow: 1, minWidth: '30%' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
