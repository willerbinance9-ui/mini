import { Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/HomeScreen';
import { JournalScreen } from '../screens/JournalScreen';
import { TradesHubScreen } from '../screens/TradesHubScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { navigateToTransactionHistory } from '../utils/navigationHelpers';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { palette } from '../theme/colors';
import { RootTabParamList } from '../types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const focusedIconMap: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'sparkles',
  Journal: 'book',
  Trades: 'trending-up',
  Wallet: 'briefcase',
  Settings: 'settings',
};

const unfocusedIconMap: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'sparkles-outline',
  Journal: 'book-outline',
  Trades: 'trending-up-outline',
  Wallet: 'briefcase-outline',
  Settings: 'settings-outline',
};

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.textPrimary },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: Math.max(8, insets.bottom),
          height: 64 + Math.max(0, insets.bottom - 4),
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarShowLabel: true,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? focusedIconMap[route.name] : unfocusedIconMap[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen
        name='Home'
        component={HomeScreen}
        options={({ navigation }) => ({
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} color={color} size={size} />
          ),
          headerRight: () => (
            <Pressable
              onPress={() => navigation.getParent()?.navigate('Notifications')}
              style={{ marginRight: 14, padding: 4 }}
              hitSlop={12}
            >
              <Ionicons name='notifications-outline' size={24} color={palette.primary} />
            </Pressable>
          ),
        })}
      />
      <Tab.Screen
        name='Trades'
        component={TradesHubScreen}
        options={{
          tabBarLabel: 'Earn',
          title: 'Earn',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name='Journal'
        component={JournalScreen}
        options={{
          tabBarLabel: 'journal',
          title: 'journal',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name='Wallet'
        component={WalletScreen}
        options={({ navigation }) => ({
          tabBarLabel: 'Asset',
          title: 'Asset',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} color={color} size={size} />
          ),
          headerRight: () => (
            <Pressable
              onPress={() => navigateToTransactionHistory(navigation)}
              style={{ marginRight: 14, padding: 4 }}
              hitSlop={12}
              accessibilityLabel='Transaction history'
            >
              <Ionicons name='list-outline' size={24} color={palette.primary} />
            </Pressable>
          ),
        })}
      />
      <Tab.Screen
        name='Settings'
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: 'Settings',
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Settings', { screen: 'Settings' });
          },
        })}
      />
    </Tab.Navigator>
  );
}
