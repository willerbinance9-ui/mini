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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Card } from '../components/Card';
import { FormModal } from '../components/FormModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { isTotpRequiredError, p2pService, type P2pTrade } from '../services/p2pService';
import { P2PStackParamList } from '../types';
import { palette } from '../theme/colors';
import { navigateToSettings, navigateToSupport } from '../utils/navigationHelpers';
import { sanitizeUserFacingError } from '../utils/userFacingError';
import { MIN_MOMO_USDT } from '../utils/walletDisplay';

type Nav = NativeStackNavigationProp<P2PStackParamList, 'P2PTrade'>;
type P2pTradeRoute = RouteProp<P2PStackParamList, 'P2PTrade'>;

export function P2PTradeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<P2pTradeRoute>();
  const { user } = useAuth();
  const { offer, tradeId: existingTradeId } = route.params;

  const [trade, setTrade] = useState<P2pTrade | null>(null);
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payeeName, setPayeeName] = useState('');
  const [payeePhone, setPayeePhone] = useState('');
  const [payeeBank, setPayeeBank] = useState('');
  const [payeeAccount, setPayeeAccount] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');

  const loadTrade = useCallback(async (id: string) => {
    const res = await p2pService.getTrade(id);
    setTrade(res.trade);
  }, []);

  useEffect(() => {
    void authService.getTotpStatus().then((s) => setTotpEnabled(Boolean(s.enabled)));
  }, []);

  useEffect(() => {
    if (existingTradeId) void loadTrade(existingTradeId);
  }, [existingTradeId, loadTrade]);

  const price = offer?.pricePerUsdt ?? trade?.pricePerUsdt ?? 0;
  const fiatCurrency = offer?.fiatCurrency ?? trade?.fiatCurrency ?? '';

  const syncFromCrypto = (v: string) => {
    setCryptoAmount(v);
    const n = Number(v);
    if (Number.isFinite(n) && n > 0 && price > 0) {
      setFiatAmount(String(Math.round(n * price)));
    } else {
      setFiatAmount('');
    }
  };

  const syncFromFiat = (v: string) => {
    setFiatAmount(v);
    const n = Number(v);
    if (Number.isFinite(n) && n > 0 && price > 0) {
      setCryptoAmount(String(Math.round((n / price) * 100) / 100));
    } else {
      setCryptoAmount('');
    }
  };

  const estimatedFiat =
    cryptoAmount.trim() && Number.isFinite(Number(cryptoAmount))
      ? Math.round(Number(cryptoAmount) * price)
      : null;

  const startTrade = async () => {
    if (!offer) return;
    if (!totpEnabled) {
      Alert.alert('Two-factor required', 'Enable 2FA in Settings.', [
        { text: 'Settings', onPress: () => navigateToSettings(navigation) },
      ]);
      return;
    }
    const crypto = Number(cryptoAmount);
    if (!Number.isFinite(crypto) || crypto < MIN_MOMO_USDT) {
      Alert.alert('Amount too low', `Minimum ${MIN_MOMO_USDT} USDT.`);
      return;
    }
    setBusy(true);
    try {
      const res = await p2pService.createTrade({
        merchantUserId: offer.userId,
        cryptoAmount: crypto,
        fiatAmount: Number(fiatAmount) || undefined,
        totpCode: totpCode.replace(/\s/g, ''),
        counterpartyPaymentName: offer.counterpartyAction === 'sell' ? payeeName.trim() : undefined,
        counterpartyPaymentPhone: offer.counterpartyAction === 'sell' ? payeePhone.trim() : undefined,
        counterpartyBankName: offer.counterpartyAction === 'sell' ? payeeBank.trim() : undefined,
        counterpartyBankAccount: offer.counterpartyAction === 'sell' ? payeeAccount.trim() : undefined,
      });
      setConfirmOpen(false);
      setTrade(res.trade);
      Alert.alert('Trade started', res.message);
      navigation.replace('P2PTrade', { tradeId: res.trade.id, offer });
    } catch (e: any) {
      if (isTotpRequiredError(e)) {
        Alert.alert('Two-factor required', 'Enable 2FA in Settings.');
      } else {
        Alert.alert('Could not start trade', sanitizeUserFacingError(e?.message));
      }
    } finally {
      setBusy(false);
    }
  };

  const onMarkFiatSent = async () => {
    if (!trade) return;
    setBusy(true);
    try {
      const res = await p2pService.markFiatSent(trade.id);
      setTrade(res.trade);
      Alert.alert('Updated', res.message);
    } catch (e: any) {
      Alert.alert('Error', sanitizeUserFacingError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmFiat = async () => {
    if (!trade) return;
    setBusy(true);
    try {
      const res = await p2pService.confirmFiat(trade.id, totpCode.replace(/\s/g, ''));
      setTrade(res.trade);
      setTotpCode('');
      Alert.alert('Completed', res.message);
    } catch (e: any) {
      Alert.alert('Error', sanitizeUserFacingError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const onDispute = async () => {
    if (!trade) return;
    setBusy(true);
    try {
      const res = await p2pService.disputeTrade(trade.id, disputeNote);
      setTrade(res.trade);
      setDisputeOpen(false);
      setDisputeNote('');
      Alert.alert('Report submitted', res.message);
    } catch (e: any) {
      Alert.alert('Error', sanitizeUserFacingError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!trade) return;
    Alert.alert('Cancel trade?', 'USDT will return to the seller if still in escrow.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel trade',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const res = await p2pService.cancelTrade(trade.id);
              setTrade(res.trade);
              Alert.alert('Cancelled', res.message);
            } catch (e: any) {
              Alert.alert('Error', sanitizeUserFacingError(e?.message));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const copyField = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${label} copied.`);
  };

  const renderPayee = () => {
    const p = trade?.fiatPayee;
    if (!p) return null;
    return (
      <Card style={styles.payeeCard}>
        <Text style={styles.section}>Send fiat to</Text>
        <Pressable onPress={() => void copyField('Name', p.name)}>
          <Text style={styles.payeeLine}>Name: {p.name}</Text>
        </Pressable>
        <Pressable onPress={() => void copyField('Phone', p.phone)}>
          <Text style={styles.payeeLine}>Phone: {p.phone}</Text>
        </Pressable>
        {p.bankName ? <Text style={styles.payeeLine}>Bank: {p.bankName}</Text> : null}
        {p.bankAccount ? <Text style={styles.payeeLine}>Account: {p.bankAccount}</Text> : null}
        {p.notes ? <Text style={styles.meta}>{p.notes}</Text> : null}
      </Card>
    );
  };

  if (trade) {
    const myId = user?.id;
    const canMarkSent = trade.status === 'pay_fiat' && myId === trade.fiatPayerId;
    const canConfirm = trade.status === 'confirming' && myId === trade.fiatPayeeId;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadTrade(trade.id).finally(() => setRefreshing(false));
            }}
            tintColor={palette.primary}
          />
        }
      >
        <Card>
          <Text style={styles.status}>Status: {trade.status.replace('_', ' ')}</Text>
          <Text style={styles.amount}>
            {trade.cryptoAmount} USDT · {trade.fiatAmount.toLocaleString()} {trade.fiatCurrency}
          </Text>
        </Card>

        {trade.status === 'pay_fiat' ? renderPayee() : null}

        {canMarkSent ? (
          <PrimaryButton label={busy ? '…' : 'I sent fiat'} onPress={() => void onMarkFiatSent()} disabled={busy} />
        ) : null}

        {canConfirm ? (
          <>
            <Text style={styles.fieldLabel}>Authenticator code</Text>
            <TextInput
              style={styles.input}
              value={totpCode}
              onChangeText={setTotpCode}
              keyboardType='number-pad'
              maxLength={8}
              placeholder='6-digit code'
              placeholderTextColor={palette.textSecondary}
            />
            <PrimaryButton
              label={busy ? '…' : 'I received fiat — release USDT'}
              onPress={() => void onConfirmFiat()}
              disabled={busy || totpCode.replace(/\s/g, '').length < 6}
              style={{ marginTop: 10 }}
            />
          </>
        ) : null}

        {trade.status === 'pay_fiat' ? (
          <PrimaryButton
            label='Cancel trade'
            onPress={() => void onCancel()}
            variant='danger'
            style={{ marginTop: 12 }}
            disabled={busy}
          />
        ) : null}

        {trade.status === 'pay_fiat' || trade.status === 'confirming' ? (
          <Pressable
            onPress={() => setDisputeOpen(true)}
            disabled={busy}
            style={[styles.disputeLink, busy && { opacity: 0.5 }]}
          >
            <Text style={styles.disputeLinkText}>Report a problem</Text>
          </Pressable>
        ) : null}

        {trade.status === 'disputed' ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={styles.section}>Under review</Text>
            <Text style={styles.meta}>
              USDT remains in escrow while we review this trade. Reference ID: {trade.id.slice(0, 8)}…
            </Text>
            {trade.disputeNote ? (
              <Text style={[styles.meta, { marginTop: 8 }]}>Your note: {trade.disputeNote}</Text>
            ) : null}
            <PrimaryButton
              label='Contact support'
              onPress={() => navigateToSupport(navigation, { category: 'transfer' })}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : null}

        {trade.status === 'completed' ? (
          <Text style={styles.meta}>Trade completed.</Text>
        ) : null}

        <FormModal
          visible={disputeOpen}
          title='Report a problem'
          onClose={() => setDisputeOpen(false)}
          footer={
            <PrimaryButton
              label={busy ? '…' : 'Submit report'}
              onPress={() => void onDispute()}
              disabled={busy}
            />
          }
        >
          <Text style={styles.meta}>
            Describe what went wrong. USDT stays locked until the trade is resolved.
          </Text>
          <TextInput
            style={[styles.input, { marginTop: 12, minHeight: 88 }]}
            value={disputeNote}
            onChangeText={setDisputeNote}
            placeholder='Optional details'
            placeholderTextColor={palette.textSecondary}
            multiline
            maxLength={500}
          />
        </FormModal>
      </ScrollView>
    );
  }

  if (!offer) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Offer not found.</Text>
      </View>
    );
  }

  const ctaLabel = offer.counterpartyAction === 'buy' ? 'Buy USDT' : 'Sell USDT';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card>
        <Text style={styles.trader}>{offer.displayName}</Text>
        <Text style={styles.price}>
          {offer.pricePerUsdt.toLocaleString()} {offer.fiatCurrency} / USDT
        </Text>
        <Text style={styles.meta}>
          Limits {offer.limitMinFiat.toLocaleString()} – {offer.limitMaxFiat.toLocaleString()} {offer.fiatCurrency}
        </Text>
      </Card>

      {offer.counterpartyAction === 'sell' ? (
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.section}>Your fiat receive details</Text>
          <TextInput style={styles.input} value={payeeName} onChangeText={setPayeeName} placeholder='Your name' placeholderTextColor={palette.textSecondary} />
          <TextInput style={styles.input} value={payeePhone} onChangeText={setPayeePhone} placeholder='Mobile number' placeholderTextColor={palette.textSecondary} keyboardType='phone-pad' />
          <TextInput style={styles.input} value={payeeBank} onChangeText={setPayeeBank} placeholder='Bank (optional)' placeholderTextColor={palette.textSecondary} />
          <TextInput style={styles.input} value={payeeAccount} onChangeText={setPayeeAccount} placeholder='Account (optional)' placeholderTextColor={palette.textSecondary} />
        </Card>
      ) : null}

      <Text style={styles.fieldLabel}>Amount (USDT)</Text>
      <TextInput
        style={styles.input}
        value={cryptoAmount}
        onChangeText={syncFromCrypto}
        keyboardType='decimal-pad'
        placeholder={`Min ${MIN_MOMO_USDT}`}
        placeholderTextColor={palette.textSecondary}
      />
      <Text style={styles.fieldLabel}>Amount ({fiatCurrency})</Text>
      <TextInput
        style={styles.input}
        value={fiatAmount}
        onChangeText={syncFromFiat}
        keyboardType='decimal-pad'
        placeholder='Local currency'
        placeholderTextColor={palette.textSecondary}
      />
      {estimatedFiat != null ? (
        <Text style={styles.estimate}>≈ {estimatedFiat.toLocaleString()} {fiatCurrency}</Text>
      ) : null}

      <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Authenticator code</Text>
      <TextInput
        style={styles.input}
        value={totpCode}
        onChangeText={setTotpCode}
        keyboardType='number-pad'
        maxLength={8}
        placeholder='6-digit code'
        placeholderTextColor={palette.textSecondary}
      />

      <PrimaryButton
        label={busy ? 'Starting…' : ctaLabel}
        onPress={() => setConfirmOpen(true)}
        disabled={busy || !cryptoAmount.trim() || totpCode.replace(/\s/g, '').length < 6}
        style={{ marginTop: 16 }}
      />

      <FormModal
        visible={confirmOpen}
        title={`Confirm ${ctaLabel.toLowerCase()}`}
        onClose={() => setConfirmOpen(false)}
        footer={
          <PrimaryButton label={busy ? '…' : 'Start trade'} onPress={() => void startTrade()} disabled={busy} />
        }
      >
        <Text style={styles.confirmText}>
          {cryptoAmount} USDT for about {fiatAmount || estimatedFiat} {fiatCurrency} with {offer.displayName}?
          USDT will be held in escrow until fiat is confirmed.
        </Text>
      </FormModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  trader: { color: palette.textPrimary, fontSize: 18, fontWeight: '700' },
  price: { color: palette.primary, fontSize: 22, fontWeight: '800', marginTop: 6 },
  meta: { color: palette.textSecondary, fontSize: 12, marginTop: 4 },
  section: { color: palette.textSecondary, fontWeight: '700', marginBottom: 8 },
  fieldLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  estimate: { color: palette.primary, fontWeight: '700', marginTop: 6 },
  confirmText: { color: palette.textPrimary, lineHeight: 20 },
  status: { color: palette.textSecondary, fontSize: 13, textTransform: 'capitalize' },
  amount: { color: palette.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 6 },
  payeeCard: { marginVertical: 12, borderColor: palette.primary, borderLeftWidth: 3 },
  payeeLine: { color: palette.textPrimary, fontSize: 15, marginBottom: 8 },
  disputeLink: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  disputeLinkText: { color: palette.primary, fontSize: 14, fontWeight: '600' },
});
