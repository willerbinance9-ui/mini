export type TradeHubItemId = 'airfarming' | 'vip';

export type TradeHubItem = {
  id: TradeHubItemId;
  title: string;
  meta: string;
  roi: string;
  route: 'AirfarmingTrade' | 'VipFarmersTrade';
};

/** Earn hub: Airfarming + VIP Farmers only. */
export const TRADE_HUB_ITEMS: TradeHubItem[] = [
  {
    id: 'airfarming',
    title: 'Airfarmers',
    meta: 'Scheduled drop opportunities credited to cash',
    roi: 'Event range: 20% to 85%',
    route: 'AirfarmingTrade',
  },
  {
    id: 'vip',
    title: 'Live VIP Farmers',
    meta: '38-day lock · 6% daily on principal to cash',
    roi: 'Locked yield program',
    route: 'VipFarmersTrade',
  },
];

export const TRADE_HUB_HIDDEN_STORAGE_KEY = 'ema_trade_hub_hidden_v5';
export const TRADE_HUB_DEFAULT_HIDDEN: TradeHubItemId[] = [];
