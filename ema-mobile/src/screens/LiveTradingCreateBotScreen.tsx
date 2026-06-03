import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { LIVE_TRADING_BOTS, type LiveTradingBotType } from '../services/liveTradingService';
import type { RootStackParamList } from '../types';
import { palette } from '../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LiveTradingCreateBotScreen() {
  const navigation = useNavigation<Nav>();

  const choose = (botType: LiveTradingBotType) => {
    navigation.navigate('LiveTradingCreateSetup', { botType });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.step}>Step 1 of 2</Text>
      <Text style={styles.title}>Choose your bot</Text>
      <Text style={styles.hint}>Select the expert advisor that will manage this live account.</Text>

      {LIVE_TRADING_BOTS.map((bot) => (
        <Pressable key={bot.id} onPress={() => choose(bot.id)}>
          <Card style={styles.botCard}>
            <View style={styles.botRow}>
              <View style={styles.botIcon}>
                <Ionicons name='pulse' size={22} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.botTitle}>{bot.title}</Text>
                <Text style={styles.botMeta}>{bot.description}</Text>
              </View>
              <Ionicons name='chevron-forward' size={20} color={palette.textSecondary} />
            </View>
          </Card>
        </Pressable>
      ))}

      <PrimaryButton label='Cancel' variant='danger' onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  step: { color: palette.primary, fontWeight: '700', fontSize: 12, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: palette.textPrimary, marginBottom: 8 },
  hint: { color: palette.textSecondary, fontSize: 14, marginBottom: 16, lineHeight: 20 },
  botCard: { marginBottom: 12 },
  botRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  botIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  botTitle: { fontSize: 17, fontWeight: '800', color: palette.textPrimary },
  botMeta: { fontSize: 13, color: palette.textSecondary, marginTop: 2, lineHeight: 18 },
});
