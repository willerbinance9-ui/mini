import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { OptionGrid } from '../components/OptionGrid';
import { PrimaryButton } from '../components/PrimaryButton';
import { useToast } from '../hooks/useToast';
import {
  LIVE_TRADING_BOTS,
  LIVE_TRADING_LEVERAGES,
  liveTradingService,
} from '../services/liveTradingService';
import type { RootStackParamList } from '../types';
import { palette } from '../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'LiveTradingCreateSetup'>;

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

export function LiveTradingCreateSetupScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { showToast } = useToast();
  const botType = route.params.botType;
  const bot = LIVE_TRADING_BOTS.find((b) => b.id === botType);

  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [leverage, setLeverage] = useState<string>('100');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setBusy(true);
    try {
      const res = await liveTradingService.createAccount({
        botType,
        accountName,
        password,
        leverage: Number(leverage),
      });
      showToast('Live account created');
      Alert.alert(
        'Account created',
        `Login: ${res.account.login}\nServer: ${res.account.server}\n\nSave your trading password — it cannot be shown again.`,
        [{ text: 'Done', onPress: () => navigation.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'LiveTrading' }] }) }]
      );
    } catch (e) {
      Alert.alert('Could not create account', (e as Error).message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.step}>Step 2 of 2</Text>
      <Text style={styles.title}>Set up your account</Text>
      <Text style={styles.hint}>Real · MT5 · {bot?.title || botType}</Text>

      <Card>
        <Text style={styles.fieldLabel}>Account nickname</Text>
        <TextInput
          style={inputStyle}
          value={accountName}
          onChangeText={setAccountName}
          placeholder='e.g. Main FX'
          placeholderTextColor={palette.textSecondary}
          maxLength={32}
        />

        <Text style={styles.fieldLabel}>Max leverage</Text>
        <OptionGrid
          options={LIVE_TRADING_LEVERAGES.map(String)}
          value={leverage}
          onChange={setLeverage}
          formatLabel={(v) => `1:${v}`}
        />

        <Text style={styles.fieldLabel}>Trading password</Text>
        <TextInput
          style={inputStyle}
          value={password}
          onChangeText={setPassword}
          placeholder='8–15 chars, upper, lower, number, special'
          placeholderTextColor={palette.textSecondary}
          secureTextEntry
          maxLength={15}
        />
        <Text style={styles.passwordHint}>
          Used to log in on MT5. Do not use characters: {'<>"\'&?^*#@'}
        </Text>
      </Card>

      <PrimaryButton label={busy ? 'Creating…' : 'Create account'} onPress={() => void onCreate()} disabled={busy} />
      <View style={{ height: 8 }} />
      <PrimaryButton label='Back' variant='danger' onPress={() => navigation.goBack()} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  step: { color: palette.primary, fontWeight: '700', fontSize: 12, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: palette.textPrimary, marginBottom: 4 },
  hint: { color: palette.textSecondary, fontSize: 14, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: palette.textPrimary, marginBottom: 6 },
  passwordHint: { fontSize: 12, color: palette.textSecondary, lineHeight: 17, marginTop: -4 },
});
