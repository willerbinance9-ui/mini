import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ComplianceProfileNotice } from '../components/ComplianceProfileNotice';
import { Card } from '../components/Card';
import { FormModal } from '../components/FormModal';
import { LocationGateCard } from '../components/LocationGateCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocalMoneyRegion } from '../hooks/useLocalMoneyRegion';
import { useToast } from '../hooks/useToast';
import { authService } from '../services/authService';
import { complianceService } from '../services/complianceService';
import { isTotpRequiredError, localMoneyService } from '../services/localMoneyService';
import { nowpaymentsService } from '../services/nowpaymentsService';
import { SettingsStackParamList } from '../types';
import { navigateToSettings } from '../utils/navigationHelpers';
import { palette } from '../theme/colors';
import { sanitizeUserFacingError } from '../utils/userFacingError';
import {
  MIN_MOMO_USDT,
  maxWithdrawableAmount,
  minFiatForMomo,
  sumUsdtFamilyAvailable,
} from '../utils/walletDisplay';

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'LocalMoney'>;
type LocalMoneyRoute = RouteProp<SettingsStackParamList, 'LocalMoney'>;

type Tab = 'deposit' | 'withdraw';

export function LocalMoneyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<LocalMoneyRoute>();
  const { showToast } = useToast();
  const {
    countryCode,
    region,
    supported,
    loading: regionLoading,
    locationStatus,
    locationReady,
    bootstrapComplete,
    detectLocation,
    usdtPairLabel,
    error,
  } = useLocalMoneyRegion();

  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? 'deposit');
  const [phone, setPhone] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [complianceComplete, setComplianceComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [maxUsdt, setMaxUsdt] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const [profileRes, totpRes, np] = await Promise.all([
        complianceService.getProfile(),
        authService.getTotpStatus(),
        nowpaymentsService.getSummary().catch(() => null),
      ]);
      setComplianceComplete(profileRes.complete);
      setPhone(profileRes.profile?.phone || '');
      setTotpEnabled(Boolean(totpRes.enabled));
      const usdt = sumUsdtFamilyAvailable(np?.balances, np?.cashWalletUsd);
      setMaxUsdt(maxWithdrawableAmount(usdt));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (route.params?.initialTab) setTab(route.params.initialTab);
  }, [route.params?.initialTab]);

  const inputStyle = {
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  };

  const minFiat = region ? minFiatForMomo(region.usdtToFiatRate) : 0;

  const onDeposit = async () => {
    if (!countryCode || !supported) return;
    const amount = Number(fiatAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (amount < minFiat) {
      Alert.alert(
        'Amount too low',
        `Minimum pay-in is ${MIN_MOMO_USDT} USDT (~${minFiat.toLocaleString()} ${region?.fiatLabel}).`
      );
      return;
    }
    setBusy(true);
    try {
      const res = await localMoneyService.deposit({
        countryCode,
        phone: phone.trim(),
        fiatAmount: amount,
      });
      setFiatAmount('');
      setConfirmOpen(false);
      showToast(res.message || 'Pay-in started');
    } catch (e: any) {
      Alert.alert('Could not start pay-in', sanitizeUserFacingError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const onWithdraw = async () => {
    if (!countryCode || !supported) return;
    if (!totpEnabled) {
      Alert.alert(
        'Two-factor required',
        'Turn on two-factor authentication in Settings before cashing out to phone money.',
        [{ text: 'Open Settings', onPress: () => navigation.navigate('Settings') }]
      );
      return;
    }
    const amount = Number(cryptoAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (amount < MIN_MOMO_USDT) {
      Alert.alert('Amount too low', `Minimum cash-out is ${MIN_MOMO_USDT} USDT.`);
      return;
    }
    if (maxUsdt > 0 && amount > maxUsdt) {
      Alert.alert(
        'Insufficient balance',
        `You can cash out up to ${Math.floor(maxUsdt)} USDT right now.`
      );
      return;
    }
    const code = totpCode.replace(/\s/g, '');
    if (code.length < 6) return;
    setBusy(true);
    try {
      const res = await localMoneyService.withdraw({
        countryCode,
        phone: phone.trim(),
        cryptoAmount: amount,
        totpCode: code,
      });
      setCryptoAmount('');
      setTotpCode('');
      setConfirmOpen(false);
      Alert.alert('On its way', res.message || 'Your cash-out request is in.');
      await loadProfile();
    } catch (e: any) {
      if (isTotpRequiredError(e)) {
        Alert.alert('Two-factor required', 'Turn on 2FA in Settings to cash out to phone money.', [
          { text: 'Settings', onPress: () => navigation.navigate('Settings') },
        ]);
      } else {
        Alert.alert('Cash-out failed', sanitizeUserFacingError(e?.message));
      }
    } finally {
      setBusy(false);
    }
  };

  const cryptoNum = Number(cryptoAmount);
  const estimatedFiat =
    region && cryptoAmount.trim() && Number.isFinite(cryptoNum) && cryptoNum > 0
      ? Math.round(cryptoNum * region.usdtToFiatRate)
      : null;

  if (!bootstrapComplete) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />
          <Text style={styles.meta}>Loading region…</Text>
        </Card>
      </ScrollView>
    );
  }

  if (!locationReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.sub}>
          Pay in or cash out with phone money. Turn on location to see rates where you are.
        </Text>
        <LocationGateCard locationStatus={locationStatus} error={error} onEnableLocation={detectLocation} />
      </ScrollView>
    );
  }

  if (!supported || !region) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          <Text style={styles.emptyTitle}>Not available in your region</Text>
          <Text style={styles.meta}>Phone money is not offered in your country yet.</Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.sub}>
        Rates in {region.countryName} ({usdtPairLabel}). Pay in from your phone or cash out to your number.
      </Text>

      {regionLoading ? (
        <Text style={styles.meta}>Loading rates…</Text>
      ) : (
        <Card style={styles.rateCard}>
          <Text style={styles.rateLabel}>{usdtPairLabel}</Text>
          <Text style={styles.rateValue}>
            1 USDT ≈ {region.usdtToFiatRate.toLocaleString()} {region.fiatLabel}
          </Text>
        </Card>
      )}

      {supported ? (
        <>
          <View style={styles.tabRow}>
            {(['deposit', 'withdraw'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.tabChip, tab === t && styles.tabChipActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'deposit' ? 'Pay in' : 'Cash out'}
                </Text>
              </Pressable>
            ))}
          </View>

          {!complianceComplete ? (
            <ComplianceProfileNotice
              noticeId='mobile_money'
              message='Finish your profile in Settings before using phone money.'
              onOpenSettings={() => navigateToSettings(navigation)}
            />
          ) : null}

          {tab === 'deposit' ? (
            <Card>
              <Text style={styles.fieldLabel}>Your phone number</Text>
              <TextInput
                style={inputStyle}
                value={phone}
                onChangeText={setPhone}
                keyboardType='phone-pad'
                placeholder='Number that receives mobile money'
                placeholderTextColor={palette.textSecondary}
              />
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                How much ({region?.fiatLabel})
              </Text>
              <TextInput
                style={inputStyle}
                value={fiatAmount}
                onChangeText={setFiatAmount}
                keyboardType='decimal-pad'
                placeholder='Amount in local money'
                placeholderTextColor={palette.textSecondary}
              />
              <Text style={styles.hint}>
                At least {MIN_MOMO_USDT} USDT (~{minFiat.toLocaleString()} {region?.fiatLabel}). Your phone will
                show a prompt to approve — we text you when it starts and when USDT lands.
              </Text>
              <PrimaryButton
                label={busy ? 'Starting…' : 'Start pay-in'}
                onPress={() => setConfirmOpen(true)}
                disabled={busy || !complianceComplete || !phone.trim() || !fiatAmount.trim()}
                style={{ marginTop: 14 }}
              />
            </Card>
          ) : (
            <Card>
              {!totpEnabled ? (
                <Text style={styles.warn}>
                  Enable two-factor authentication in Settings to cash out to phone money.
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>Phone to receive money</Text>
              <TextInput
                style={inputStyle}
                value={phone}
                onChangeText={setPhone}
                keyboardType='phone-pad'
                placeholder='Your mobile money number'
                placeholderTextColor={palette.textSecondary}
              />
              <Text style={styles.hint}>We send local currency to this number in {region?.countryName}.</Text>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>USDT to cash out</Text>
              <TextInput
                style={inputStyle}
                value={cryptoAmount}
                onChangeText={setCryptoAmount}
                keyboardType='decimal-pad'
                placeholder='From your wallet balance'
                placeholderTextColor={palette.textSecondary}
              />
              <Text style={styles.meta}>At least {MIN_MOMO_USDT} USDT</Text>
              {maxUsdt > 0 ? (
                <Text style={styles.meta}>Available: {Math.floor(maxUsdt)} USDT</Text>
              ) : null}

              {estimatedFiat != null && region ? (
                <View style={styles.estimateCard}>
                  <Text style={styles.estimateLabel}>About what you receive in {region.countryName}</Text>
                  <Text style={styles.estimateValue}>
                    ≈ {estimatedFiat.toLocaleString()} {region.fiatLabel}
                  </Text>
                  <Text style={styles.estimateSub}>
                    1 USDT ≈ {region.usdtToFiatRate.toLocaleString()} {region.fiatLabel} (approx.)
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Authenticator code</Text>
              <TextInput
                style={inputStyle}
                value={totpCode}
                onChangeText={setTotpCode}
                keyboardType='number-pad'
                placeholder='6-digit code'
                placeholderTextColor={palette.textSecondary}
                maxLength={8}
              />

              <PrimaryButton
                label={busy ? 'Sending…' : 'Request cash-out'}
                onPress={() => setConfirmOpen(true)}
                disabled={
                  busy ||
                  !complianceComplete ||
                  !totpEnabled ||
                  !phone.trim() ||
                  !cryptoAmount.trim() ||
                  !Number.isFinite(cryptoNum) ||
                  cryptoNum < MIN_MOMO_USDT ||
                  totpCode.replace(/\s/g, '').length < 6
                }
                style={{ marginTop: 14 }}
              />
            </Card>
          )}
        </>
      ) : null}

      <FormModal
        visible={confirmOpen}
        title={tab === 'deposit' ? 'Confirm pay-in' : 'Confirm cash-out'}
        onClose={() => setConfirmOpen(false)}
        footer={
          <View style={{ gap: 8 }}>
            <PrimaryButton
              label={busy ? 'Please wait…' : 'Confirm'}
              onPress={tab === 'deposit' ? onDeposit : onWithdraw}
              disabled={busy}
            />
            <PrimaryButton label='Cancel' onPress={() => setConfirmOpen(false)} />
          </View>
        }
      >
        {tab === 'deposit' ? (
          <Text style={styles.confirmText}>
            Pay in {fiatAmount} {region?.fiatLabel} from {phone}? Approve the prompt on your phone when it pops up.
          </Text>
        ) : (
          <Text style={styles.confirmText}>
            Cash out {cryptoAmount} USDT
            {estimatedFiat != null && region
              ? ` (about ${estimatedFiat.toLocaleString()} ${region.fiatLabel} in ${region.countryName})`
              : ''}{' '}
            to {phone}? We text you when the money leaves and when it hits your phone.
          </Text>
        )}
      </FormModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  sub: { color: palette.textSecondary, lineHeight: 20, marginBottom: 14, fontSize: 13 },
  rateCard: { marginBottom: 14 },
  rateLabel: { color: palette.textSecondary, fontSize: 12 },
  rateValue: { color: palette.primary, fontSize: 22, fontWeight: '800', marginTop: 4 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  tabChipActive: { borderColor: palette.primary, backgroundColor: palette.surfaceElevated },
  tabText: { color: palette.textSecondary, fontWeight: '600' },
  tabTextActive: { color: palette.primary },
  fieldLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  hint: { color: palette.textSecondary, fontSize: 11, marginTop: 10, lineHeight: 16 },
  warn: { color: palette.warning, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  meta: { color: palette.textSecondary, fontSize: 12, marginTop: 4 },
  emptyTitle: { color: palette.textPrimary, fontWeight: '700', marginBottom: 4 },
  confirmText: { color: palette.textPrimary, lineHeight: 20 },
  estimateCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.surfaceElevated,
  },
  estimateLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  estimateValue: { color: palette.primary, fontSize: 26, fontWeight: '800', marginTop: 6 },
  estimateSub: { color: palette.textSecondary, fontSize: 11, marginTop: 8, lineHeight: 16 },
});
