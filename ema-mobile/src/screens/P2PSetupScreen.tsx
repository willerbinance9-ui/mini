import { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { ComplianceProfileNotice } from '../components/ComplianceProfileNotice';
import { LocationGateCard } from '../components/LocationGateCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocalMoneyRegion } from '../hooks/useLocalMoneyRegion';
import { useToast } from '../hooks/useToast';
import { complianceService } from '../services/complianceService';
import { p2pService, type P2pMerchantProfile, type P2pMerchantSide } from '../services/p2pService';
import { P2PStackParamList } from '../types';
import { palette } from '../theme/colors';
import { navigateToSettings } from '../utils/navigationHelpers';
import { sanitizeUserFacingError } from '../utils/userFacingError';

type Nav = NativeStackNavigationProp<P2PStackParamList, 'P2PSetup'>;

export function P2PSetupScreen() {
  const navigation = useNavigation<Nav>();
  const { showToast } = useToast();
  const {
    region,
    countryCode,
    detectedCountryName,
    supported,
    locationReady,
    bootstrapComplete,
    locationStatus,
    error: locationError,
    detectLocation,
  } = useLocalMoneyRegion();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [p2pUnavailable, setP2pUnavailable] = useState(false);
  const [complianceComplete, setComplianceComplete] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [side, setSide] = useState<P2pMerchantSide>('sell_usdt');
  const [pricePerUsdt, setPricePerUsdt] = useState('');
  const [limitMinFiat, setLimitMinFiat] = useState('');
  const [limitMaxFiat, setLimitMaxFiat] = useState('');
  const [paymentName, setPaymentName] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [notes, setNotes] = useState('');

  const marketCountryCode = region?.countryCode || countryCode || '';

  const applyProfile = (p: P2pMerchantProfile | null) => {
    if (!p) return;
    setEnabled(p.enabled);
    setSide(p.side);
    setPricePerUsdt(String(p.pricePerUsdt));
    setLimitMinFiat(String(p.limitMinFiat));
    setLimitMaxFiat(String(p.limitMaxFiat));
    setPaymentName(p.paymentName);
    setPaymentPhone(p.paymentPhone);
    setBankName(p.bankName);
    setBankAccount(p.bankAccount);
    setNotes(p.notes);
  };

  const load = useCallback(async () => {
    setP2pUnavailable(false);
    try {
      const complianceRes = await complianceService.getProfile();
      setComplianceComplete(Boolean(complianceRes.complete));
      if (complianceRes.profile?.phone) setPaymentPhone((prev) => prev || complianceRes.profile!.phone || '');
      const name = [complianceRes.profile?.legalFirstName, complianceRes.profile?.legalLastName]
        .filter(Boolean)
        .join(' ');
      if (name) setPaymentName((prev) => prev || name);
    } catch {
      /* compliance prefill is optional */
    }

    try {
      const p2pRes = await p2pService.getMyProfile();
      if (p2pRes.unavailable) {
        setP2pUnavailable(true);
      } else if (p2pRes.profile) {
        applyProfile(p2pRes.profile);
      }
    } catch {
      /* no saved merchant profile yet */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (region?.usdtToFiatRate) {
      setPricePerUsdt((prev) => prev || String(region.usdtToFiatRate));
    }
  }, [region?.usdtToFiatRate]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onSave = async () => {
    if (p2pUnavailable) {
      Alert.alert('Unavailable', 'P2P is not available right now. Please try again later.');
      return;
    }
    if (!supported || !marketCountryCode) {
      Alert.alert('Not available', 'P2P is not available in your region.');
      return;
    }
    if (enabled && !complianceComplete) {
      Alert.alert('Profile required', 'Complete withdrawal requirements in Settings first.');
      return;
    }
    const price = Number(pricePerUsdt);
    const minF = Number(limitMinFiat) || 0;
    const maxF = Number(limitMaxFiat);
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert('Invalid price', 'Enter price per 1 USDT in local currency.');
      return;
    }
    if (!Number.isFinite(maxF) || maxF <= 0) {
      Alert.alert('Invalid limits', 'Enter a maximum trade size.');
      return;
    }
    if (enabled && side === 'sell_usdt' && (!paymentName.trim() || !paymentPhone.trim())) {
      Alert.alert('Payment details', 'Name and phone are required when you sell USDT.');
      return;
    }
    setBusy(true);
    try {
      const res = await p2pService.saveProfile({
        enabled,
        side,
        countryCode: marketCountryCode,
        pricePerUsdt: price,
        limitMinFiat: minF,
        limitMaxFiat: maxF,
        paymentName: paymentName.trim(),
        paymentPhone: paymentPhone.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        notes: notes.trim(),
      });
      applyProfile(res.profile);
      showToast(enabled ? 'P2P offer is live' : 'P2P offer saved');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Save failed', sanitizeUserFacingError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  };

  if (!bootstrapComplete) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.meta}>Loading…</Text>
      </ScrollView>
    );
  }

  if (!locationReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.sub}>Turn on location to set up P2P for your country.</Text>
        <LocationGateCard locationStatus={locationStatus} error={locationError} onEnableLocation={detectLocation} />
      </ScrollView>
    );
  }

  if (!supported || !region) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <Text style={styles.unavailableTitle}>Not available in your region</Text>
          <Text style={styles.meta}>
            {detectedCountryName
              ? `P2P is not available in ${detectedCountryName} yet.`
              : 'P2P is not available in your country yet.'}
          </Text>
        </Card>
      </ScrollView>
    );
  }

  const countryLabel = region.countryName || detectedCountryName || marketCountryCode;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />}
    >
      <Text style={styles.sub}>
        Set your price and payment details. When enabled, you appear on the P2P market in {countryLabel}.
      </Text>

      <Card style={styles.countryCard}>
        <Text style={styles.countryLabel}>Your market</Text>
        <Text style={styles.countryValue}>{countryLabel}</Text>
        <Text style={styles.meta}>Based on your device location</Text>
      </Card>

      {p2pUnavailable ? (
        <Card style={styles.warnCard}>
          <Text style={styles.warnText}>
            P2P could not be loaded right now. You can still fill the form, but saving may not work until the
            service is ready.
          </Text>
        </Card>
      ) : null}

      {!complianceComplete ? (
        <ComplianceProfileNotice
          noticeId='p2p_setup'
          message='Complete your withdrawal requirements in Settings before enabling P2P.'
          onOpenSettings={() => navigateToSettings(navigation)}
        />
      ) : null}

      <Card>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Visible on P2P</Text>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: palette.border, true: palette.primary }}
            thumbColor={palette.textPrimary}
          />
        </View>

        <Text style={styles.fieldLabel}>I want to</Text>
        <View style={styles.sideRow}>
          <PrimaryButton
            label='Sell USDT'
            onPress={() => setSide('sell_usdt')}
            style={{ flex: 1, opacity: side === 'sell_usdt' ? 1 : 0.5 }}
          />
          <PrimaryButton
            label='Buy USDT'
            onPress={() => setSide('buy_usdt')}
            style={{ flex: 1, opacity: side === 'buy_usdt' ? 1 : 0.5 }}
          />
        </View>
        <Text style={styles.hint}>
          {side === 'sell_usdt'
            ? 'Others will buy USDT from you and pay fiat to your number/bank.'
            : 'Others will sell USDT to you; you pay fiat to their details.'}
        </Text>

        <Text style={styles.fieldLabel}>Price per 1 USDT ({region.fiatLabel})</Text>
        <TextInput
          style={inputStyle}
          value={pricePerUsdt}
          onChangeText={setPricePerUsdt}
          keyboardType='decimal-pad'
          placeholder={region.usdtToFiatRate ? `e.g. ${region.usdtToFiatRate}` : 'e.g. 1450'}
          placeholderTextColor={palette.textSecondary}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Min trade (fiat)</Text>
        <TextInput
          style={inputStyle}
          value={limitMinFiat}
          onChangeText={setLimitMinFiat}
          keyboardType='decimal-pad'
          placeholder='0'
          placeholderTextColor={palette.textSecondary}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Max trade (fiat)</Text>
        <TextInput
          style={inputStyle}
          value={limitMaxFiat}
          onChangeText={setLimitMaxFiat}
          keyboardType='decimal-pad'
          placeholder='500000'
          placeholderTextColor={palette.textSecondary}
        />

        {side === 'sell_usdt' ? (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Your payment details (receive fiat)</Text>
            <TextInput
              style={inputStyle}
              value={paymentName}
              onChangeText={setPaymentName}
              placeholder='Account name'
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              style={inputStyle}
              value={paymentPhone}
              onChangeText={setPaymentPhone}
              keyboardType='phone-pad'
              placeholder='Mobile money number'
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              style={inputStyle}
              value={bankName}
              onChangeText={setBankName}
              placeholder='Bank name (optional)'
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              style={inputStyle}
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder='Bank account (optional)'
              placeholderTextColor={palette.textSecondary}
            />
          </>
        ) : null}

        <TextInput
          style={[inputStyle, { marginTop: 12 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder='Notes for traders (optional)'
          placeholderTextColor={palette.textSecondary}
        />

        <PrimaryButton
          label={busy ? 'Saving…' : 'Save'}
          onPress={() => void onSave()}
          disabled={busy || loading}
          style={{ marginTop: 16 }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  sub: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  countryCard: { marginBottom: 12, borderColor: palette.primary, borderLeftWidth: 3 },
  countryLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  countryValue: { color: palette.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 4 },
  unavailableTitle: { color: palette.textPrimary, fontWeight: '700', marginBottom: 4 },
  meta: { color: palette.textSecondary, fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowLabel: { color: palette.textPrimary, fontSize: 16, fontWeight: '700' },
  fieldLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 4 },
  hint: { color: palette.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 4 },
  sideRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  warnCard: { marginBottom: 12, borderColor: palette.danger, borderLeftWidth: 3 },
  warnText: { color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
});
