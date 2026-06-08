import type {
  NowpaymentsCreateDepositResponse,
  RootStackParamList,
  TransactionHistoryTab,
  WalletActivityRow,
} from '../types';

type NavLike = {
  getParent: () => NavLike | undefined;
  navigate: (name: string, params?: object) => void;
};

/** Walk up navigators until we reach the root stack (parent of tab navigator). */
function getRootNavigation(navigation: NavLike): NavLike {
  let current: NavLike = navigation;
  let parent = current.getParent();
  while (parent?.getParent()) {
    current = parent;
    parent = current.getParent();
  }
  return parent ?? current;
}

export function navigateToTransactionHistory(
  navigation: NavLike,
  initialTab?: TransactionHistoryTab
) {
  const root = getRootNavigation(navigation);
  root.navigate('TransactionHistory', initialTab ? { initialTab } : undefined);
}

export function navigateToTransactionDetail(navigation: NavLike, row: WalletActivityRow) {
  const root = getRootNavigation(navigation);
  root.navigate('TransactionDetail', { row });
}

export function navigateToCryptoDepositPayment(
  navigation: NavLike,
  deposit: NowpaymentsCreateDepositResponse
) {
  const root = getRootNavigation(navigation);
  root.navigate('CryptoDepositPayment', { deposit });
}

export function navigateToSupport(
  navigation: NavLike,
  params?: RootStackParamList['Support']
) {
  const root = getRootNavigation(navigation);
  root.navigate('Support', params);
}

export function navigateToSendById(navigation: NavLike) {
  navigation.navigate('Settings', { screen: 'SendById' });
}

export function navigateToLocalMoney(navigation: NavLike, initialTab?: 'deposit' | 'withdraw') {
  navigation.navigate('Settings', {
    screen: 'LocalMoney',
    params: initialTab ? { initialTab } : undefined,
  });
}

export function navigateToSettings(navigation: NavLike, params?: { openSecurity?: boolean }) {
  getRootNavigation(navigation).navigate('MainTabs', {
    screen: 'Settings',
    params: params?.openSecurity ? { screen: 'Settings', params } : undefined,
  });
}

export function navigateToP2P(navigation: NavLike) {
  getRootNavigation(navigation).navigate('P2P');
}

export function navigateToP2PSetup(navigation: NavLike) {
  getRootNavigation(navigation).navigate('P2P', { screen: 'P2PSetup' });
}

export function navigateToMT5(navigation: NavLike) {
  navigation.navigate('Settings', { screen: 'MT5' });
}

export function navigateToAirfarmingTrade(navigation: NavLike) {
  getRootNavigation(navigation).navigate('AirfarmingTrade');
}

export function navigateToGhostAccount(navigation: NavLike) {
  getRootNavigation(navigation).navigate('GhostAccount');
}

export function navigateToVipFarmersTrade(navigation: NavLike) {
  getRootNavigation(navigation).navigate('VipFarmersTrade');
}
