import { StyleSheet, Text, View } from 'react-native';
import type { MarketPriceRow } from '../services/liveTradingService';
import { palette } from '../theme/colors';

const QUOTE_UP = '#5B9CF5';
const QUOTE_DOWN = '#FF444F';
export const QUOTE_STALE_MS = 3 * 60 * 1000;

function splitQuotePrice(value: number, digits: number) {
  const s = value.toFixed(digits);
  const pipLen = digits >= 5 ? 2 : digits >= 3 ? 1 : 2;
  if (s.length <= pipLen) return { main: '', pip: s };
  return { main: s.slice(0, -pipLen), pip: s.slice(-pipLen) };
}

function formatChange(changePts: number | null | undefined, changePct: number | null | undefined) {
  if (changePts == null || changePct == null || !Number.isFinite(changePts)) return null;
  const sign = changePts >= 0 ? '+' : '';
  const pts =
    Math.abs(changePts) >= 100
      ? Math.round(changePts).toLocaleString()
      : Math.abs(changePts) >= 10
        ? changePts.toFixed(1)
        : changePts.toFixed(2);
  return `${sign}${pts} ${changePct.toFixed(2)}%`;
}

function formatQuoteTime(iso: string | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatLevel(value: number | null | undefined, digits: number) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function isQuoteStale(updatedAt: string | undefined, now = Date.now()) {
  if (!updatedAt) return true;
  const ms = Date.parse(updatedAt);
  if (!Number.isFinite(ms)) return true;
  return now - ms > QUOTE_STALE_MS;
}

type QuoteRowProps = {
  row: MarketPriceRow;
  bidDir?: 'up' | 'down' | 'flat';
  askDir?: 'up' | 'down' | 'flat';
};

function quoteColor(dir: 'up' | 'down' | 'flat' | undefined, stale: boolean) {
  if (stale || !dir || dir === 'flat') return palette.textPrimary;
  return dir === 'up' ? QUOTE_UP : QUOTE_DOWN;
}

function PriceCell({
  value,
  digits,
  dir,
  stale,
}: {
  value: number;
  digits: number;
  dir?: 'up' | 'down' | 'flat';
  stale: boolean;
}) {
  const { main, pip } = splitQuotePrice(value, digits);
  const color = quoteColor(dir, stale);
  return (
    <View style={styles.priceCell}>
      <Text style={[styles.priceMain, { color }]} numberOfLines={1}>
        {main}
        <Text style={[styles.pricePip, { color }]}>{pip}</Text>
      </Text>
    </View>
  );
}

function SpreadIndicator({ dir, stale }: { dir: 'up' | 'down' | 'flat'; stale: boolean }) {
  const color = quoteColor(dir, stale);
  const arrow = stale || dir === 'flat' ? '⇅' : dir === 'up' ? '▲' : '▼';
  return <Text style={[styles.spreadArrow, { color }]}>{arrow}</Text>;
}

export function QuoteRow({ row, bidDir = 'flat', askDir = 'flat' }: QuoteRowProps) {
  const digits = row.digits ?? 5;
  const stale = isQuoteStale(row.updatedAt);
  const changeText = formatChange(row.changePts, row.changePct);
  const dayUp = (row.changePts ?? 0) >= 0;
  const changeColor = stale
    ? palette.textPrimary
    : changeText == null
      ? palette.textSecondary
      : dayUp
        ? QUOTE_UP
        : QUOTE_DOWN;
  const spreadDir: 'up' | 'down' | 'flat' =
    bidDir === 'up' || askDir === 'up' ? (bidDir === 'down' || askDir === 'down' ? 'flat' : 'up') : askDir === 'down' ? 'down' : 'flat';

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {changeText ? (
          <Text style={[styles.changeLine, { color: changeColor }]} numberOfLines={1}>
            {changeText}
          </Text>
        ) : (
          <Text style={[styles.changeLine, { color: palette.textPrimary }]}>—</Text>
        )}
        <Text style={styles.symbol} numberOfLines={1}>
          {row.symbol}
        </Text>
        <View style={styles.metaLine}>
          <Text style={[styles.timeText, stale && styles.timeStale]}>{formatQuoteTime(row.updatedAt)}</Text>
          <SpreadIndicator dir={spreadDir} stale={stale} />
          <Text style={[styles.spreadText, stale && styles.timeStale]}>
            {row.spread.toFixed(Math.min(digits, 5))}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <View style={styles.bidAskRow}>
          <PriceCell value={row.bid} digits={digits} dir={bidDir} stale={stale} />
          <PriceCell value={row.ask} digits={digits} dir={askDir} stale={stale} />
        </View>
        <Text style={styles.lhLine} numberOfLines={1}>
          L: {formatLevel(row.dayLow, digits)}  H: {formatLevel(row.dayHigh, digits)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
    minHeight: 72,
  },
  left: {
    flex: 1,
    paddingRight: 10,
    justifyContent: 'center',
  },
  changeLine: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 2,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  timeStale: {
    color: palette.textPrimary,
  },
  spreadArrow: {
    fontSize: 10,
    fontWeight: '800',
  },
  spreadText: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 168,
  },
  bidAskRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  priceCell: {
    minWidth: 78,
    alignItems: 'flex-end',
  },
  priceMain: {
    fontSize: 15,
    fontWeight: '600',
  },
  pricePip: {
    fontSize: 20,
    fontWeight: '800',
  },
  lhLine: {
    marginTop: 4,
    fontSize: 11,
    color: palette.textSecondary,
  },
});
