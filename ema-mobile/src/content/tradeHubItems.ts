export type TradeHubItemId = 'airfarming' | 'ghost' | 'vip' | 'liveTrading' | 'trades' | 'expert';

export type TradeHubItem = {
  id: TradeHubItemId;
  title: string;
  meta: string;
  roi: string;
  route:
    | 'AirfarmingTrade'
    | 'GhostAccount'
    | 'VipFarmersTrade'
    | 'LiveTrading'
    | 'Trades'
    | 'ExpertAutoTrading';
};

/**
 * Earn hub tiles. VIP Loan stays available from Live VIP Farmers (not a separate hub tile).
 * Expert + in-app Trades stay registered but hidden by default to reduce overlap with Live Trading.
 */
export const TRADE_HUB_ITEMS: TradeHubItem[] = [
  {
    id: 'airfarming',
    title: 'Airfarmers',
    meta: 'Normal drop opportunities (2–4 per week)',
    roi: 'Event range: 20% to 85%',
    route: 'AirfarmingTrade',
  },
  {
    id: 'ghost',
    title: 'Ghost Account',
    meta: 'Pool balance for member drops · 5k+ allocation',
    roi: 'Fund members at T-24h · recall profit to pool',
    route: 'GhostAccount',
  },
  {
    id: 'vip',
    title: 'Live VIP Farmers',
    meta: '38-day lock · 6% daily on principal to cash · VIP loans inside',
    roi: 'Locked yield program',
    route: 'VipFarmersTrade',
  },
  {
    id: 'liveTrading',
    title: 'Live Trading',
    meta: 'Open a real account · Synthetix EA or Quantix EA',
    roi: 'Prices, open trades & history in-app',
    route: 'LiveTrading',
  },
  {
    id: 'trades',
    title: 'Trades',
    meta: 'MT5-style desk · open positions & deal history',
    roi: 'Allocate cash and track balance & P&L',
    route: 'Trades',
  },
  {
    id: 'expert',
    title: 'Expert Account Manager',
    meta: 'Managed MT5 trading — set risk limits and enable the expert',
    roi: 'Connect MT5, configure risk, then activate',
    route: 'ExpertAutoTrading',
  },
];

export const TRADE_HUB_HIDDEN_STORAGE_KEY = 'ema_trade_hub_hidden_v4';
export const TRADE_HUB_DEFAULT_HIDDEN: TradeHubItemId[] = ['expert', 'trades'];
