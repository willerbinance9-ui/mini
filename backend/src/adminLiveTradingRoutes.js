const {
  listAllPlatformLiveTradingAccountsAdmin,
  sumLiveTradingDepositsByAccountIds,
  listRecentLiveTradingTransfers,
  isMissingTableError,
} = require('./db');
const { adminAuthMiddleware, requireSuperAdmin } = require('./middleware/adminAuth');
const { positionsFromAccountRow, computeLiveBalances } = require('./services/mt5BridgeService');
const { botLabel } = require('./services/liveTradingValidation');

function registerAdminLiveTradingRoutes(app) {
  app.get('/admin/api/live-trading/overview', adminAuthMiddleware, requireSuperAdmin, async (_req, res) => {
    try {
      const rows = await listAllPlatformLiveTradingAccountsAdmin();
      const accountIds = rows.map((r) => r.id);
      const depositMap = await sumLiveTradingDepositsByAccountIds(accountIds);
      const recentActivity = await listRecentLiveTradingTransfers(50);

      let totalDeposited = 0;
      let totalWalletBalance = 0;
      let totalOpenProfit = 0;
      const userIds = new Set();

      const accounts = rows.map((acc) => {
        userIds.add(acc.user_id);
        const wallet = acc.live_wallet;
        const totalDepositedAcc = depositMap[acc.id] || 0;
        const balances = computeLiveBalances(acc, wallet);
        const positions = positionsFromAccountRow(acc);
        totalDeposited += totalDepositedAcc;
        totalWalletBalance += balances.depositedBalance;
        totalOpenProfit += balances.openProfit;

        return {
          accountId: acc.id,
          userId: acc.user_id,
          userEmail: acc.user_email,
          accountName: acc.account_name || '',
          login: acc.login,
          botType: acc.bot_type,
          botLabel: botLabel(acc.bot_type),
          totalDeposited: totalDepositedAcc,
          walletBalance: balances.depositedBalance,
          openProfit: balances.openProfit,
          displayBalance: balances.displayBalance,
          positionCount: positions.length,
          lastActivityAt: acc.ea_snapshot_at || acc.updated_at,
          positions: positions.map((p) => ({
            id: p.id,
            symbol: p.symbol,
            type: p.type,
            volume: p.volume,
            profit: p.profit,
          })),
        };
      });

      return res.json({
        summary: {
          enrolledUsers: userIds.size,
          accountCount: accounts.length,
          totalDeposited,
          totalWalletBalance,
          totalOpenProfit,
        },
        accounts,
        recentActivity: recentActivity.map((t) => ({
          id: t.id,
          direction: t.direction,
          amount: Number(t.amount),
          createdAt: t.created_at,
          userEmail: t.user_email,
          accountName: t.account_name,
          login: t.login,
          botLabel: botLabel(t.bot_type),
        })),
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Live trading tables missing. Run migrations in Supabase.' });
      }
      return res.status(500).json({ message: e?.message || 'Failed to load live trading overview' });
    }
  });
}

module.exports = { registerAdminLiveTradingRoutes };
