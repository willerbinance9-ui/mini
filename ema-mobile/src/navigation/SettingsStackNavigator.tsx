import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../screens/SettingsScreen';
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
    </Stack.Navigator>
  );
}
