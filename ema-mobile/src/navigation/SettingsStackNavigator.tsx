import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LocalMoneyScreen } from '../screens/LocalMoneyScreen';
import { SendByIdScreen } from '../screens/SendByIdScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MT5Screen } from '../screens/MT5Screen';
import { SettingsStackParamList } from '../types';
import { palette } from '../theme/colors';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName='Settings'
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.textPrimary },
        headerTintColor: palette.primary,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name='Settings' component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name='SendById' component={SendByIdScreen} options={{ title: 'Send by ID' }} />
      <Stack.Screen name='LocalMoney' component={LocalMoneyScreen} options={{ title: 'Phone money' }} />
      <Stack.Screen name='MT5' component={MT5Screen} options={{ title: 'MT5' }} />
    </Stack.Navigator>
  );
}
