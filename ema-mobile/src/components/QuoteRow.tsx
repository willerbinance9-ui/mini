import { StyleSheet, Text, View } from 'react-native';
import type { MarketPriceRow } from '../services/liveTradingService';
import { palette } from '../theme/colors';

const QUOTE_UP = '#5B9CF5';
const QUOTE_DOWN = '#FF444F';

function splitQuotePrice(value: number, digits: number) {
  const s = value.toFixed(digits);
  const pipLen = digits >= 5 ? 2 : digits >= 3 ? 1 : 2;
  if (s.length <= pipLen) return { main: '', pip: s };
  return { main: s.slice(0, -pipLen), pip: s.slice(-pipLen) };
}

function formatChange(changePts: number | null | undefined, changePct: number | null | undefined) {
  if (changePts == null || changePct == null || !Number.isFinite(changePts)) return null;
  const pts =
    Math.abs(changePts) >= 100
      ? Math.round(changePts).toLocaleString()
      : Math.abs(changePts) >= 10
        ? changePts.toFixed(1)
        : changePts.toFixed(2);
  return `${pts} ${changePct.toFixed(2)}%`;
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

type QuoteRowProps = {
  row: MarketPriceRow;
  bidDir?: 'up' | 'down' | 'flat';
  askDir?: 'up' | 'down' | 'flat';
};

function PriceCell({
  value,
  digits,
  dir,
}: {
  value: number;
  digits: number;
  dir?: 'up' | 'down' | 'flat';
}) {
  const { main, pip } = splitQuotePrice(value, digits);
  const color = dir === 'up' ? QUOTE_UP : dir === 'down' ? QUOTE_DOWN : palette.textPrimary;
  return (
    <View style={styles.priceCell}>
      <Text style={[styles.priceMain, { color }]} numberOfLines={1}>
        {main}
        <Text style={styles.pricePip}>{pip}</Text>
      </Text>
    </View>
  );
}

export function QuoteRow({ row, bidDir = 'flat', askDir = 'flat' }: QuoteRowProps) {
  const digits = row.digits ?? 5;
  const changeText = formatChange(row.changePts, row.changePct);
  const isUp = (row.changePts ?? 0) >= 0;
  const changeColor = changeText == null ? palette.textSecondary : isUp ? QUOTE_UP : QUOTE_DOWN;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {changeText ? (
          <Text style={[styles.changeLine, { color: changeColor }]} numberOfLines={1}>
            {changeText}
          </Text>
        ) : (
          <Text style={styles.changeLineMuted}>—</Text>
        )}
        <Text style={styles.symbol} numberOfLines={1}>
          {row.symbol}
        </Text>
        <View style={styles.metaLine}>
          <Text style={styles.timeText}>{formatQuoteTime(row.updatedAt)}</Text>
          <Text style={styles.spreadText}>⇅ {row.spread.toFixed(Math.min(digits, 5))}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <View style={styles.bidAskRow}>
          <PriceCell value={row.bid} digits={digits} dir={bidDir} />
          <PriceCell value={row.ask} digits={digits} dir={askDir} />
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
  changeLineMuted: {
    fontSize: 12,
    color: palette.textSecondary,
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
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    color: palette.textSecondary,
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
