import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { P2PScreen } from '../screens/P2PScreen';
import { P2PSetupScreen } from '../screens/P2PSetupScreen';
import { P2PTradeScreen } from '../screens/P2PTradeScreen';
import { P2PStackParamList } from '../types';
import { palette } from '../theme/colors';

const Stack = createNativeStackNavigator<P2PStackParamList>();

export function P2PStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName='P2P'
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.textPrimary },
        headerTintColor: palette.primary,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name='P2P' component={P2PScreen} options={{ title: 'P2P' }} />
      <Stack.Screen name='P2PSetup' component={P2PSetupScreen} options={{ title: 'Start P2P' }} />
      <Stack.Screen name='P2PTrade' component={P2PTradeScreen} options={{ title: 'P2P trade' }} />
    </Stack.Navigator>
  );
}
