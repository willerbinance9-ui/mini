import { useMemo } from 'react';
import type { ActivityFeedItem, CryptoActivityRow } from '../types';

function parseCryptoTime(c: CryptoActivityRow): number {
  const ms = Date.parse(c.createdAt);
  return Number.isFinite(ms) ? ms : 0;
}

function formatTs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'Unknown time';
  return new Date(ms).toLocaleString();
}

export function buildActivityFeed(cryptoActivity: CryptoActivityRow[], maxItems = 20): ActivityFeedItem[] {
  const entries = cryptoActivity.map((c) => ({
    ts: parseCryptoTime(c),
    item: {
      id: `crypto:${c.id}`,
      title: `${c.direction === 'in' ? 'Receive' : 'Send'} ${c.asset}`,
      subtitle: (c.txHash || '').slice(0, 14) + (c.txHash && c.txHash.length > 14 ? '…' : ''),
      amountLabel: c.amountDisplay,
      directionLabel: c.direction === 'in' ? ('incoming' as const) : ('outgoing' as const),
      timestampLabel: formatTs(parseCryptoTime(c)),
      kind: 'crypto_tx' as const,
    },
  }));

  entries.sort((a, b) => b.ts - a.ts);
  return entries.slice(0, maxItems).map((e) => e.item);
}

export function useActivityFeed(cryptoActivity: CryptoActivityRow[]) {
  return useMemo(() => {
    const merged = buildActivityFeed(cryptoActivity, 25);
    if (merged.length) return merged;
    return [
      {
        id: 'placeholder:1',
        title: 'Activity feed',
        subtitle: 'Your unified timeline will appear here soon.',
        directionLabel: 'neutral',
        timestampLabel: '—',
        kind: 'placeholder',
      },
    ] as ActivityFeedItem[];
  }, [cryptoActivity]);
}
