export type TradeHubItemId = 'airfarming' | 'vip' | 'expert' | 'liveTrading';

export type TradeHubItem = {
  id: TradeHubItemId;
  title: string;
  meta: string;
  roi: string;
  route: 'AirfarmingTrade' | 'VipFarmersTrade' | 'ExpertAutoTrading' | 'LiveTrading';
};

export const TRADE_HUB_ITEMS: TradeHubItem[] = [
  {
    id: 'airfarming',
    title: 'Airfarmers',
    meta: 'Normal drop opportunities (2–4 per week)',
    roi: 'Event range: 20% to 85%',
    route: 'AirfarmingTrade',
  },
  {
    id: 'vip',
    title: 'Live VIP Farmers',
    meta: '30-day lock · 6% daily on principal to cash',
    roi: 'Locked yield program',
    route: 'VipFarmersTrade',
  },
  {
    id: 'expert',
    title: 'Expert Account Manager',
    meta: 'Managed MT5 trading — set risk limits and enable the expert',
    roi: 'Connect MT5, configure risk, then activate',
    route: 'ExpertAutoTrading',
  },
  {
    id: 'liveTrading',
    title: 'Live Trading',
    meta: 'Open a real account · Synthetix EA or Quantix EA',
    roi: 'Prices, open trades & history in-app',
    route: 'LiveTrading',
  },
];

export const TRADE_HUB_HIDDEN_STORAGE_KEY = 'ema_trade_hub_hidden_v3';
export const TRADE_HUB_DEFAULT_HIDDEN: TradeHubItemId[] = ['expert'];
