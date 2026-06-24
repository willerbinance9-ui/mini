const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  listScheduledAirfarmingDropsAdmin,
  listScheduledAirfarmingDropsForUser,
  getAirfarmingDropById,
  updateAirfarmingDrop,
  getUsersByIds,
  getUserById,
  updateUserPasswordHash,
  listUsersAdmin,
  getAdminUserDetail,
  unbanUserAccount,
  userIsBanned,
  getAdminUserChartSeries,
  updateAirfarmingUserDropPause,
  getAirfarmingDropsPausedByUserIds,
  adminMoveCashToAirfarming,
  adminAdjustUserWallet,
  listSupportTicketsAdmin,
  getSupportTicketById,
  updateSupportTicketStatus,
  getActiveGlobalDropPauses,
  listGlobalDropPauses,
  insertGlobalDropPause,
  endGlobalDropPauseEarly,
  isMissingTableError,
  isSchemaError,
  listAirfarmingDropBandsAdmin,
  updateAirfarmingDropBand,
  getAirfarmingPlatformSettings,
  updateAirfarmingPlatformSettings,
  listPendingWithdrawalsAdmin,
  upsertAdminWithdrawalPriority,
  listPendingAirfarmingDropsAdmin,
  listP2pTradesDisputedAdmin,
  listP2pTradesAdmin,
  getP2pTradeById,
  updateP2pTrade,
  incrementP2pMerchantCompletedTrades,
  createAppNotification,
  getUserByEmail,
  deleteUserAdmin,
  getMaxAirfarmingDropIndex,
  insertAirfarmingDrop,
  deleteAirfarmingDropById,
  getAirfarmingWalletByUserId,
  upsertAirfarmingWalletRow,
  incrementAiDailyBudgetSpent,
  utcTodayYmd,
  listVipInvestmentsAdmin,
  listVipAccrualsForInvestmentIds,
  VIP_DAILY_RATE,
  VIP_LOCK_DAYS,
  vipInvestmentToApi,
} = require('./db');
const { normalizeTargetUserId } = require('./notificationRoutes');
const { approveWithdrawal, rejectWithdrawal } = require('./adminWithdrawals');
const { releaseP2pEscrow, refundP2pEscrow } = require('./p2pEscrow');
const {
  splitPlatformFee,
  recordPlatformRevenueIfNew,
  getPlatformRevenueAdminStats,
  PLATFORM_FEE_DROP_RATE,
} = require('./platformRevenueService');
const { getWithdrawalTrustScoreForUser } = require('./services/withdrawalTrustScore');
const { RED_DROP_BLOCK_SCORE } = require('./services/withdrawalTrustScoreCompute');
const {
  recallLendForDrop,
  processAllGhostLendQueues,
  listGhostAccountsAdminSummary,
  getGhostRevenueAdminStats,
  buildGhostNetworkAdmin,
  buildGhostParticleNetworkAdmin,
} = require('./ghostAccountService');
const {
  adminGetTradingDesk,
  adminCreateDeal,
  adminUpdateDeal,
  adminDeleteDeal,
  isMissingTableError: isTradingSchemaError,
  SCHEMA_MSG: TRADING_SCHEMA_MSG,
} = require('./services/userTradingService');

function newId() {
  return crypto.randomUUID();
}
const {
  adminAuthMiddleware,
  requireSuperAdmin,
  ADMIN_PURPOSE,
  ROLE_SUPERADMIN,
  ROLE_ADMIN,
} = require('./middleware/adminAuth');
const {
  clampAirfarmingPercent,
  MAX_AIRFARMING_PERCENT,
  clearAirfarmingSettingsCache,
  getEffectiveCaps,
  processDueDrops,
} = require('./airfarmingDrops');
const { parsePauseRange, pauseStatusFromState } = require('./airfarmingPause');
const { registerAdminAiRoutes } = require('./adminAiRoutes');
const { getJournalMonth, getJournalDay } = require('./journalService');
const {
  getUserDropScheduleView,
  saveUserDropScheduleDraft,
  aiSuggestUserDropSchedule,
  applyUserDropSchedule,
  setUserWeeklyDropBudget,
  WEEKLY_DROP_COUNT,
} = require('./userDropScheduleService');

const SUPPORT_STATUSES = new Set(['under_review', 'in_progress', 'resolved', 'closed']);

function ticketToAdminRow(row, emailByUserId) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: emailByUserId.get(row.user_id) || '—',
    category: row.category,
    status: row.status,
    payload: row.payload || {},
    relatedActivityId: row.related_activity_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function adminCredentials() {
  return {
    username: String(process.env.ADMIN_USERNAME || 'admin').trim(),
    password: String(process.env.ADMIN_PASSWORD || 'admin'),
  };
}

function superadminCredentials() {
  const username = String(process.env.SUPERADMIN_USERNAME || '').trim();
  const password = String(process.env.SUPERADMIN_PASSWORD || '');
  if (!username || !password) return null;
  return { username, password };
}

function dropToAdminRow(row, emailByUserId, pausedByUserId) {
  const dueMs = new Date(row.due_at).getTime();
  const secondsRemaining = Math.max(0, Math.floor((dueMs - Date.now()) / 1000));
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: emailByUserId.get(row.user_id) || '—',
    dropsPaused: Boolean(pausedByUserId?.get(row.user_id)),
    weekStart: row.week_start,
    dropIndex: Number(row.drop_index),
    dueAt: row.due_at,
    secondsRemaining,
    percent: Number(row.percent),
    minBalance: Number(row.min_balance),
    maxBalance: Number(row.max_balance),
    bandIndex: row.band_index != null ? Number(row.band_index) : null,
    isVipPriority: row.band_index == null && Boolean(row.percent_locked),
    percentLocked: Boolean(row.percent_locked),
    status: row.status,
  };
}

function pendingDropToAdminRow(row, emailByUserId) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: emailByUserId.get(row.user_id) || '—',
    weekStart: row.week_start,
    dropIndex: Number(row.drop_index),
    dueAt: row.due_at,
    percent: Number(row.percent),
    minBalance: Number(row.min_balance),
    maxBalance: Number(row.max_balance),
    eligibleBalance: row.eligible_balance != null ? Number(row.eligible_balance) : null,
    profitAmount: Number(row.profit_amount || 0),
    autoFundedCash: Number(row.auto_funded_cash || 0),
    autoFundedCrypto: Number(row.auto_funded_crypto || 0),
    isVipPriority: row.band_index == null && Boolean(row.percent_locked),
    status: row.status,
  };
}

function bandToAdminRow(row) {
  return {
    bandIndex: Number(row.band_index),
    label: row.label,
    balanceHint: row.balance_hint,
    percent: Number(row.percent),
    minBalance: Number(row.min_balance ?? 0),
    maxBalance: Number(row.max_balance ?? 0),
    active: Boolean(row.active),
    updatedAt: row.updated_at,
  };
}

function settingsToAdminRow(row) {
  return {
    maxPercent: Number(row.max_percent),
    maxProfitPerDrop: Number(row.max_profit_per_drop),
    updatedAt: row.updated_at,
  };
}

function mondayUtcYmd(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay();
  const offset = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

async function validateDropPatch(body) {
  const caps = await getEffectiveCaps();
  const maxPct = caps.maxPercent;
  const patch = {};
  if (body.percent !== undefined) {
    const p = Number(body.percent);
    if (!Number.isFinite(p) || p < 0.01 || p > maxPct) {
      return { error: `Percent must be between 0.01 and ${maxPct}` };
    }
    patch.percent = clampAirfarmingPercent(p, maxPct);
    patch.percent_locked = true;
  }
  if (body.minBalance !== undefined) {
    const n = Number(body.minBalance);
    if (!Number.isFinite(n) || n < 0) return { error: 'minBalance must be >= 0' };
    patch.min_balance = Math.round(n * 100) / 100;
  }
  if (body.maxBalance !== undefined) {
    const n = Number(body.maxBalance);
    if (!Number.isFinite(n) || n < 0) return { error: 'maxBalance must be >= 0' };
    patch.max_balance = Math.round(n * 100) / 100;
  }
  if (body.dueAt !== undefined) {
    const t = new Date(body.dueAt).getTime();
    if (!Number.isFinite(t)) return { error: 'dueAt must be a valid date/time' };
    patch.due_at = new Date(t).toISOString();
  }
  if (body.percentLocked !== undefined) {
    patch.percent_locked = Boolean(body.percentLocked);
  }
  if (Object.keys(patch).length === 0) {
    return { error: 'No valid fields to update' };
  }
  return { patch };
}

const { registerAdminPartnerRoutes } = require('./adminPartnerRoutes');

function registerAdminRoutes(app) {
  registerAdminAiRoutes(app);
  registerAdminPartnerRoutes(app);
  app.post('/admin/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const name = String(username || '').trim();
    const pass = String(password || '');

    const superCreds = superadminCredentials();
    if (superCreds && name === superCreds.username && pass === superCreds.password) {
      const token = jwt.sign(
        { purpose: ADMIN_PURPOSE, sub: superCreds.username, role: ROLE_SUPERADMIN },
        process.env.JWT_SECRET || 'ema-dev-secret',
        { expiresIn: '12h' }
      );
      return res.json({ token, expiresInHours: 12, role: ROLE_SUPERADMIN, username: superCreds.username });
    }

    const creds = adminCredentials();
    if (name !== creds.username || pass !== creds.password) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
    const token = jwt.sign(
      { purpose: ADMIN_PURPOSE, sub: creds.username, role: ROLE_ADMIN },
      process.env.JWT_SECRET || 'ema-dev-secret',
      { expiresIn: '12h' }
    );
    return res.json({ token, expiresInHours: 12, role: ROLE_ADMIN, username: creds.username });
  });

  app.get('/admin/api/me', adminAuthMiddleware, (req, res) => {
    return res.json({ username: req.adminUser, role: req.adminRole });
  });

  app.get('/admin/api/users', adminAuthMiddleware, async (req, res) => {
    try {
      const search = String(req.query.q || req.query.search || '').trim();
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
      const users = await listUsersAdmin({ limit, search });
      return res.json({ users, count: users.length });
    } catch (e) {
      console.error('[admin/users]', e);
      return res.status(500).json({ message: e.message || 'Failed to load users' });
    }
  });

  app.get('/admin/api/users/:id', adminAuthMiddleware, async (req, res) => {
    try {
      const detail = await getAdminUserDetail(req.params.id);
      if (!detail) return res.status(404).json({ message: 'User not found' });
      return res.json(detail);
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Database schema not ready. Run Supabase migrations.' });
      }
      console.error('[admin/users/:id]', e);
      return res.status(500).json({ message: 'Failed to load user' });
    }
  });

  app.get('/admin/api/users/:id/charts', adminAuthMiddleware, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
      const series = await getAdminUserChartSeries(req.params.id, days);
      return res.json(series);
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Database schema not ready. Run Supabase migrations.' });
      }
      console.error('[admin/users/:id/charts]', e);
      return res.status(500).json({ message: e.message || 'Failed to load charts' });
    }
  });

  app.get('/admin/api/users/:id/journal/month', adminAuthMiddleware, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const now = new Date();
      const year = Number(req.query.year) || now.getUTCFullYear();
      const month = Number(req.query.month) || now.getUTCMonth() + 1;
      if (month < 1 || month > 12) return res.status(400).json({ message: 'Invalid month' });
      const data = await getJournalMonth(req.params.id, year, month);
      return res.json(data);
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Journal schema not ready.' });
      }
      return res.status(500).json({ message: e.message || 'Failed to load journal' });
    }
  });

  app.get('/admin/api/users/:id/journal/day', adminAuthMiddleware, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const date = String(req.query.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'date query required (YYYY-MM-DD)' });
      }
      const data = await getJournalDay(req.params.id, date);
      return res.json(data);
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Journal schema not ready.' });
      }
      return res.status(500).json({ message: e.message || 'Failed to load journal day' });
    }
  });

  const dropScheduleSchemaMsg =
    'User drop schedules schema missing. Run backend/sql/migrations/20260606_user_drop_schedules.sql and 20260702_weekly_drop_budget.sql in Supabase.';

  app.get('/admin/api/users/:id/drop-schedule', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const weekStart = req.query.weekStart ? String(req.query.weekStart).slice(0, 10) : undefined;
      const view = await getUserDropScheduleView(req.params.id, weekStart);
      if (!view) return res.status(404).json({ message: 'User not found' });
      return res.json(view);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: dropScheduleSchemaMsg });
      return res.status(500).json({ message: e.message || 'Failed to load drop schedule' });
    }
  });

  app.post('/admin/api/users/:id/drop-schedule', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const dropCount = Number(req.body?.dropCount);
      const targetTotalUsd = Number(req.body?.targetTotalUsd);
      const weekStart = req.body?.weekStart ? String(req.body.weekStart).slice(0, 10) : undefined;
      if (!Number.isInteger(dropCount) || dropCount < 1 || dropCount > 20) {
        return res.status(400).json({ message: 'dropCount must be 1–20' });
      }
      if (!Number.isFinite(targetTotalUsd) || targetTotalUsd < 0) {
        return res.status(400).json({ message: 'targetTotalUsd must be a non-negative number' });
      }
      const result = await saveUserDropScheduleDraft(req.params.id, { weekStart, dropCount, targetTotalUsd });
      if (!result.ok) return res.status(400).json({ message: result.error });
      return res.json(result);
    } catch (e) {
      if (isMissingTableError(e) || e.statusCode === 503) {
        return res.status(503).json({ message: e.message || dropScheduleSchemaMsg });
      }
      return res.status(500).json({ message: e.message || 'Failed to save drop schedule' });
    }
  });

  app.post('/admin/api/users/:id/drop-schedule/ai-suggest', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const dropCount = Number(req.body?.dropCount);
      const targetTotalUsd = Number(req.body?.targetTotalUsd);
      const weekStart = req.body?.weekStart ? String(req.body.weekStart).slice(0, 10) : undefined;
      if (!Number.isInteger(dropCount) || dropCount < 1 || dropCount > 20) {
        return res.status(400).json({ message: 'dropCount must be 1–20' });
      }
      if (!Number.isFinite(targetTotalUsd) || targetTotalUsd < 0) {
        return res.status(400).json({ message: 'targetTotalUsd must be a non-negative number' });
      }
      const result = await aiSuggestUserDropSchedule(req.params.id, {
        weekStart,
        dropCount,
        targetTotalUsd,
        forceDeterministic: req.body?.deterministic !== false,
      });
      if (!result.ok) return res.status(400).json({ message: result.error });
      return res.json(result);
    } catch (e) {
      if (isMissingTableError(e) || e.statusCode === 503) {
        return res.status(503).json({ message: e.message || dropScheduleSchemaMsg });
      }
      console.error('[admin/drop-schedule/ai-suggest]', e);
      return res.status(500).json({ message: e.message || 'AI suggest failed' });
    }
  });

  app.post('/admin/api/users/:id/drop-schedule/apply', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const weekStart = req.body?.weekStart ? String(req.body.weekStart).slice(0, 10) : undefined;
      const result = await applyUserDropSchedule(req.params.id, { weekStart });
      if (!result.ok) return res.status(400).json({ message: result.error });
      return res.json(result);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: dropScheduleSchemaMsg });
      console.error('[admin/drop-schedule/apply]', e);
      return res.status(500).json({ message: e.message || 'Apply failed' });
    }
  });

  app.post('/admin/api/users/:id/weekly-drop-budget', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const budgetUsd = Number(req.body?.budgetUsd ?? req.body?.targetTotalUsd);
      const weekStart = req.body?.weekStart ? String(req.body.weekStart).slice(0, 10) : undefined;
      const apply = req.body?.apply === true;
      if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
        return res.status(400).json({ message: 'budgetUsd must be greater than zero' });
      }
      const result = await setUserWeeklyDropBudget(req.params.id, {
        weekStart,
        budgetUsd,
        forceDeterministic: req.body?.deterministic !== false,
        apply,
      });
      if (!result.ok) return res.status(400).json({ message: result.error });
      return res.json({
        ...result,
        dropCount: WEEKLY_DROP_COUNT,
        schedulePattern: '4 drops per weekday (Mon–Fri UTC)',
      });
    } catch (e) {
      if (isMissingTableError(e) || e.statusCode === 503) {
        return res.status(503).json({ message: e.message || dropScheduleSchemaMsg });
      }
      console.error('[admin/weekly-drop-budget]', e);
      return res.status(500).json({ message: e.message || 'Weekly drop budget failed' });
    }
  });

  app.get('/admin/api/users/:id/trading', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const desk = await adminGetTradingDesk(req.params.id);
      return res.json(desk);
    } catch (e) {
      if (isTradingSchemaError(e)) return res.status(503).json({ message: TRADING_SCHEMA_MSG });
      console.error('[admin/users/trading]', e);
      return res.status(500).json({ message: e.message || 'Failed to load trading desk' });
    }
  });

  app.post('/admin/api/users/:id/trading/deals', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const deal = await adminCreateDeal(req.params.id, req.body || {});
      return res.status(201).json({ deal });
    } catch (e) {
      if (isTradingSchemaError(e)) return res.status(503).json({ message: TRADING_SCHEMA_MSG });
      if (e.status) return res.status(e.status).json({ message: e.message });
      console.error('[admin/users/trading/deals POST]', e);
      return res.status(500).json({ message: e.message || 'Failed to create deal' });
    }
  });

  app.patch('/admin/api/users/:id/trading/deals/:dealId', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const deal = await adminUpdateDeal(req.params.id, req.params.dealId, req.body || {});
      return res.json({ deal });
    } catch (e) {
      if (isTradingSchemaError(e)) return res.status(503).json({ message: TRADING_SCHEMA_MSG });
      if (e.status) return res.status(e.status).json({ message: e.message });
      console.error('[admin/users/trading/deals PATCH]', e);
      return res.status(500).json({ message: e.message || 'Failed to update deal' });
    }
  });

  app.delete('/admin/api/users/:id/trading/deals/:dealId', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      await adminDeleteDeal(req.params.id, req.params.dealId);
      return res.json({ ok: true });
    } catch (e) {
      if (isTradingSchemaError(e)) return res.status(503).json({ message: TRADING_SCHEMA_MSG });
      if (e.status) return res.status(e.status).json({ message: e.message });
      console.error('[admin/users/trading/deals DELETE]', e);
      return res.status(500).json({ message: e.message || 'Failed to delete deal' });
    }
  });

  app.post('/admin/api/users/:id/unban', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!userIsBanned(user)) {
        return res.status(400).json({ message: 'User is not banned' });
      }
      await unbanUserAccount(req.params.id);
      const detail = await getAdminUserDetail(req.params.id);
      return res.json({ ok: true, user: detail?.user });
    } catch (e) {
      console.error('[admin/users/unban]', e);
      return res.status(500).json({ message: e.message || 'Failed to unban user' });
    }
  });

  app.post('/admin/api/users/:id/password', adminAuthMiddleware, async (req, res) => {
    try {
      const user = await getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const password = String(req.body?.password || '');
      const confirm = String(req.body?.confirmPassword || req.body?.passwordConfirm || '');
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      if (confirm && password !== confirm) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await updateUserPasswordHash(user.id, passwordHash);
      return res.json({ ok: true, message: 'Password updated for ' + user.email });
    } catch (e) {
      console.error('[admin/users/password]', e);
      return res.status(500).json({ message: e.message || 'Failed to update password' });
    }
  });

  app.post(
    '/admin/api/users/:id/wallets/adjust',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
    try {
      const detail = await getAdminUserDetail(req.params.id);
      if (!detail) return res.status(404).json({ message: 'User not found' });

      const wallet = String(req.body?.wallet || '').toLowerCase();
      const mode = req.body?.mode === 'adjust' ? 'adjust' : 'set';
      const direction = req.body?.direction === 'remove' ? 'remove' : 'add';
      let amount = Number(req.body?.amount);
      if (mode === 'adjust' && Number.isFinite(amount)) {
        amount = Math.abs(amount);
        if (direction === 'remove') amount = -amount;
      }
      const reason = String(req.body?.reason || req.body?.note || '').trim();

      const result = await adminAdjustUserWallet(req.params.id, {
        wallet,
        mode,
        amount,
        reason,
      });

      const updated = await getAdminUserDetail(req.params.id);
      return res.json({
        ok: true,
        adjustment: result,
        cashBalance: updated.cashBalance,
        airfarmingBalance: updated.airfarmingBalance,
        usdtBalance: updated.usdtBalance,
        user: updated.user,
      });
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Wallet schema not ready. Run migrations.' });
      }
      console.error('[admin/users/wallets/adjust]', e);
      return res.status(500).json({ message: e.message || 'Failed to adjust balance' });
    }
  }
  );

  app.post(
    '/admin/api/users/:id/wallets/move-to-airfarming',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
    try {
      const detail = await getAdminUserDetail(req.params.id);
      if (!detail) return res.status(404).json({ message: 'User not found' });
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Valid amount is required' });
      }
      const result = await adminMoveCashToAirfarming(req.params.id, amount);
      return res.json({
        userId: req.params.id,
        amount: result.amount,
        cashBalance: result.cashWallet,
        airfarmingBalance: result.airfarmingBalance,
      });
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Wallet schema not ready. Run migrations.' });
      }
      console.error('[admin/users/move-to-airfarming]', e);
      return res.status(500).json({ message: 'Failed to move funds' });
    }
  }
  );

  app.delete(
    '/admin/api/users/:id',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const reason = String(req.body?.reason || req.query?.reason || '').trim();
        if (!reason) {
          return res.status(400).json({ message: 'A reason is required to delete a user' });
        }
        const result = await deleteUserAdmin(req.params.id);
        console.info(
          '[admin/users/delete]',
          req.adminUser,
          result.userId,
          result.email,
          reason.slice(0, 200)
        );
        return res.json({ ok: true, ...result, reason });
      } catch (e) {
        if (e.statusCode === 404) return res.status(404).json({ message: e.message });
        console.error('[admin/users/delete]', e);
        return res.status(500).json({ message: e.message || 'Failed to delete user' });
      }
    }
  );

  app.patch('/admin/api/users/:id/airfarming', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const detail = await getAdminUserDetail(req.params.id);
      if (!detail) return res.status(404).json({ message: 'User not found' });

      let state;
      if (req.body?.clearPause) {
        state = await updateAirfarmingUserDropPause(req.params.id, { clearPause: true });
      } else if (req.body?.dropsPaused !== undefined && !req.body?.pauseFrom && !req.body?.pauseUntil) {
        const pause = Boolean(req.body.dropsPaused);
        state = pause
          ? await updateAirfarmingUserDropPause(req.params.id, { indefinitePause: true })
          : await updateAirfarmingUserDropPause(req.params.id, { clearPause: true });
      } else if (
        req.body?.pauseFrom !== undefined ||
        req.body?.pauseUntil !== undefined ||
        req.body?.bandIndexes !== undefined
      ) {
        const range = parsePauseRange(req.body);
        if (range.error) return res.status(400).json({ message: range.error });
        state = await updateAirfarmingUserDropPause(req.params.id, {
          pauseFrom: range.pauseFrom,
          pauseUntil: range.pauseUntil,
          bandIndexes: req.body.bandIndexes,
          indefinitePause: false,
        });
      } else {
        return res.status(400).json({
          message:
            'Send clearPause, dropsPaused (indefinite), or pauseFrom/pauseUntil with optional bandIndexes (0–3)',
        });
      }

      const pause = pauseStatusFromState(state);
      return res.json({
        userId: req.params.id,
        ...pause,
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Airfarming schema not ready. Run migrations.' });
      }
      console.error('[admin/users/airfarming]', e);
      return res.status(500).json({ message: e.message || 'Failed to update airfarming settings' });
    }
  });

  app.post(
    '/admin/api/users/:id/drops/direct',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const detail = await getAdminUserDetail(req.params.id);
        if (!detail) return res.status(404).json({ message: 'User not found' });

        const body = req.body || {};
        const percent = Number(body.percent);
        const minBalance = Number(body.minBalance);
        const maxBalance = Number(body.maxBalance);
        const delayMinutes = Number(body.delayMinutes);

        if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
          return res.status(400).json({ message: 'delayMinutes must be a number >= 0' });
        }
        if (!Number.isFinite(minBalance) || minBalance < 0) {
          return res.status(400).json({ message: 'minBalance must be >= 0' });
        }
        if (!Number.isFinite(maxBalance) || maxBalance < 0) {
          return res.status(400).json({ message: 'maxBalance must be >= 0' });
        }
        if (maxBalance < minBalance) {
          return res.status(400).json({ message: 'maxBalance must be >= minBalance' });
        }

        const caps = await getEffectiveCaps();
        if (!Number.isFinite(percent) || percent < 0.01 || percent > caps.maxPercent) {
          return res.status(400).json({ message: `percent must be between 0.01 and ${caps.maxPercent}` });
        }

        const nowMs = Date.now();
        let dueMs = nowMs + Math.round(delayMinutes * 60 * 1000);
        const weekStart = mondayUtcYmd(new Date(dueMs));
        const existing = await listScheduledAirfarmingDropsForUser(req.params.id, weekStart, 100);
        const earliestDueMs = existing.length
          ? Math.min(...existing.map((d) => new Date(d.due_at).getTime()).filter((n) => Number.isFinite(n)))
          : null;
        if (Number.isFinite(earliestDueMs) && dueMs >= earliestDueMs) {
          // Keep VIP direct drops ahead of current queue while respecting now.
          dueMs = Math.max(nowMs, earliestDueMs - 1000);
        }
        const sameMomentExists = existing.some((d) => new Date(d.due_at).getTime() === dueMs);
        if (sameMomentExists) dueMs -= 1;
        const dueAtIso = new Date(dueMs).toISOString();
        const nextDropIndex = (await getMaxAirfarmingDropIndex(req.params.id, weekStart)) + 1;

        const row = await insertAirfarmingDrop({
          id: newId(),
          user_id: req.params.id,
          week_start: weekStart,
          drop_index: nextDropIndex,
          due_at: dueAtIso,
          band_index: null,
          percent: clampAirfarmingPercent(percent, caps.maxPercent),
          min_balance: Math.round(minBalance * 100) / 100,
          max_balance: Math.round(maxBalance * 100) / 100,
          status: 'scheduled',
          profit_amount: 0,
          percent_locked: true,
        });

        const users = await getUsersByIds([row.user_id]);
        const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
        const pausedByUserId = await getAirfarmingDropsPausedByUserIds([row.user_id]);
        return res.status(201).json({ ok: true, drop: dropToAdminRow(row, emailByUserId, pausedByUserId) });
      } catch (e) {
        if (isMissingTableError(e)) {
          return res.status(503).json({ message: 'Airfarming drops schema not ready. Run migrations.' });
        }
        console.error('[admin/users/drops/direct]', e);
        return res.status(500).json({ message: e.message || 'Failed to create direct drop' });
      }
    }
  );

  app.get('/admin/api/airfarming/global-pause', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const active = await getActiveGlobalDropPauses();
      const recent = await listGlobalDropPauses({ limit: 15 });
      const mapRow = (r) => ({
        id: r.id,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        bandIndexes: r.band_indexes || [],
        note: r.note || null,
        createdAt: r.created_at,
        activeNow: active.some((a) => a.id === r.id),
      });
      return res.json({
        active: active.map(mapRow),
        recent: recent.map(mapRow),
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({
          message: 'Run migration 20260601_airfarming_scheduled_pauses.sql in Supabase.',
        });
      }
      console.error('[admin/global-pause]', e);
      return res.status(500).json({ message: e.message || 'Failed to load global pause' });
    }
  });

  app.post('/admin/api/airfarming/global-pause', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const range = parsePauseRange({
        pauseFrom: req.body?.startsAt,
        pauseUntil: req.body?.endsAt,
      });
      if (range.error) return res.status(400).json({ message: range.error });
      if (!range.pauseFrom || !range.pauseUntil) {
        return res.status(400).json({ message: 'startsAt and endsAt are required' });
      }
      const row = await insertGlobalDropPause({
        startsAt: range.pauseFrom,
        endsAt: range.pauseUntil,
        bandIndexes: req.body?.bandIndexes,
        note: req.body?.note,
      });
      return res.status(201).json({
        pause: {
          id: row.id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          bandIndexes: row.band_indexes || [],
          note: row.note || null,
        },
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Global pause table missing. Run migrations.' });
      }
      console.error('[admin/global-pause/post]', e);
      return res.status(500).json({ message: e.message || 'Failed to create global pause' });
    }
  });

  app.post('/admin/api/airfarming/global-pause/:id/end', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const row = await endGlobalDropPauseEarly(req.params.id);
      if (!row) return res.status(404).json({ message: 'Pause not found or already ended' });
      return res.json({
        pause: {
          id: row.id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          bandIndexes: row.band_indexes || [],
        },
      });
    } catch (e) {
      console.error('[admin/global-pause/end]', e);
      return res.status(500).json({ message: e.message || 'Failed to end global pause' });
    }
  });

  app.get('/admin/api/support/tickets', adminAuthMiddleware, async (req, res) => {
    try {
      const status = String(req.query.status || '').trim() || undefined;
      const category = String(req.query.category || '').trim() || undefined;
      const search = String(req.query.q || req.query.search || '').trim() || undefined;
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
      const rows = await listSupportTicketsAdmin({ limit, status, category, search });
      const users = await getUsersByIds(rows.map((r) => r.user_id));
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
      const tickets = rows.map((r) => ticketToAdminRow(r, emailByUserId));
      return res.json({ tickets, count: tickets.length });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.json({
          tickets: [],
          count: 0,
          schemaNote: 'Support tickets table missing. Run 20260524_support_tickets.sql in Supabase.',
        });
      }
      console.error('[admin/support/tickets]', e);
      return res.status(500).json({ message: e.message || 'Failed to load support tickets' });
    }
  });

  app.get('/admin/api/support/tickets/:id', adminAuthMiddleware, async (req, res) => {
    try {
      const row = await getSupportTicketById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Ticket not found' });
      const users = await getUsersByIds([row.user_id]);
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
      return res.json({ ticket: ticketToAdminRow(row, emailByUserId) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: 'Support schema not ready.' });
      console.error('[admin/support/tickets/:id]', e);
      return res.status(500).json({ message: 'Failed to load ticket' });
    }
  });

  app.patch('/admin/api/support/tickets/:id', adminAuthMiddleware, async (req, res) => {
    try {
      const existing = await getSupportTicketById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Ticket not found' });
      const status = String(req.body?.status || '').trim();
      if (!SUPPORT_STATUSES.has(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const updated = await updateSupportTicketStatus(existing.id, status);
      const users = await getUsersByIds([updated.user_id]);
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
      return res.json({ ticket: ticketToAdminRow(updated, emailByUserId) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: 'Support schema not ready.' });
      console.error('[admin/support/tickets/patch]', e);
      return res.status(500).json({ message: 'Failed to update ticket' });
    }
  });

  const dropSettingsSchemaMsg =
    'Airfarming drop settings schema missing. Run backend/sql/migrations/20260603_airfarming_drop_settings.sql and 20260528_airfarming_drop_bands.sql in Supabase.';

  app.get('/admin/api/airfarming/settings', adminAuthMiddleware, requireSuperAdmin, async (_req, res) => {
    try {
      const [settings, bands] = await Promise.all([
        getAirfarmingPlatformSettings(),
        listAirfarmingDropBandsAdmin(),
      ]);
      const caps = await getEffectiveCaps();
      return res.json({
        settings: settingsToAdminRow(settings),
        bands: bands.map(bandToAdminRow),
        defaults: { maxPercent: MAX_AIRFARMING_PERCENT, maxProfitPerDrop: 5000 },
        effectiveCaps: caps,
      });
    } catch (e) {
      if (isMissingTableError(e) || isSchemaError(e) || e.statusCode === 503) {
        return res.status(503).json({ message: e.message || dropSettingsSchemaMsg });
      }
      console.error('[admin/airfarming/settings GET]', e);
      return res.status(500).json({ message: e.message || 'Failed to load drop settings' });
    }
  });

  app.patch('/admin/api/airfarming/settings', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const body = req.body || {};
      const maxPercent = body.maxPercent !== undefined ? Number(body.maxPercent) : undefined;
      const maxProfitPerDrop =
        body.maxProfitPerDrop !== undefined ? Number(body.maxProfitPerDrop) : undefined;

      if (maxPercent !== undefined) {
        if (!Number.isFinite(maxPercent) || maxPercent < 0.01 || maxPercent > 100) {
          return res.status(400).json({ message: 'maxPercent must be between 0.01 and 100' });
        }
      }
      if (maxProfitPerDrop !== undefined) {
        if (!Number.isFinite(maxProfitPerDrop) || maxProfitPerDrop <= 0) {
          return res.status(400).json({ message: 'maxProfitPerDrop must be greater than 0' });
        }
      }

      const settings = await updateAirfarmingPlatformSettings({
        maxPercent: maxPercent !== undefined ? Math.round(maxPercent * 100) / 100 : undefined,
        maxProfitPerDrop:
          maxProfitPerDrop !== undefined ? Math.round(maxProfitPerDrop * 100) / 100 : undefined,
      });
      clearAirfarmingSettingsCache();
      return res.json({ settings: settingsToAdminRow(settings) });
    } catch (e) {
      console.error('[admin/airfarming/settings PATCH]', e);
      return res.status(500).json({ message: e.message || 'Failed to save platform caps' });
    }
  });

  app.patch('/admin/api/airfarming/bands/:index', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const bandIndex = Number(req.params.index);
      if (!Number.isInteger(bandIndex) || bandIndex < 0 || bandIndex > 3) {
        return res.status(400).json({ message: 'band index must be 0–3' });
      }
      const body = req.body || {};
      const caps = await getEffectiveCaps();
      const patch = {};

      if (body.percent !== undefined) {
        const p = Number(body.percent);
        if (!Number.isFinite(p) || p < 0.01 || p > caps.maxPercent) {
          return res.status(400).json({ message: `percent must be between 0.01 and ${caps.maxPercent}` });
        }
        patch.percent = clampAirfarmingPercent(p, caps.maxPercent);
      }
      if (body.minBalance !== undefined) {
        const n = Number(body.minBalance);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: 'minBalance must be >= 0' });
        patch.minBalance = Math.round(n * 100) / 100;
      }
      if (body.maxBalance !== undefined) {
        const n = Number(body.maxBalance);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ message: 'maxBalance must be >= 0' });
        patch.maxBalance = Math.round(n * 100) / 100;
      }
      if (body.label !== undefined) patch.label = body.label;
      if (body.balanceHint !== undefined) patch.balanceHint = body.balanceHint;
      if (body.active !== undefined) patch.active = body.active;

      if (patch.minBalance != null && patch.maxBalance != null && patch.maxBalance < patch.minBalance) {
        return res.status(400).json({ message: 'maxBalance must be >= minBalance' });
      }

      const existing = (await listAirfarmingDropBandsAdmin()).find((b) => Number(b.band_index) === bandIndex);
      if (!existing) return res.status(404).json({ message: 'Band not found' });

      const minBal =
        patch.minBalance != null ? patch.minBalance : Number(existing.min_balance ?? existing.min ?? 0);
      const maxBal =
        patch.maxBalance != null ? patch.maxBalance : Number(existing.max_balance ?? existing.max ?? 0);
      if (Number.isFinite(minBal) && Number.isFinite(maxBal) && maxBal < minBal) {
        return res.status(400).json({ message: 'maxBalance must be >= minBalance' });
      }

      if (!Object.keys(patch).length) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      const updated = await updateAirfarmingDropBand(bandIndex, patch);
      clearAirfarmingSettingsCache();
      return res.json({ band: bandToAdminRow(updated) });
    } catch (e) {
      console.error('[admin/airfarming/bands PATCH]', e);
      return res.status(500).json({ message: e.message || 'Failed to update band' });
    }
  });

  app.get('/admin/api/withdrawals/pending', adminAuthMiddleware, async (req, res) => {
    try {
      const withdrawals = await listPendingWithdrawalsAdmin({
        limit: Number(req.query.limit) || 200,
      });
      return res.json({ withdrawals, count: withdrawals.length });
    } catch (e) {
      console.error('[admin/withdrawals/pending]', e);
      return res.status(500).json({ message: e.message || 'Failed to load pending withdrawals' });
    }
  });

  app.get('/admin/api/airfarming/payouts/pending', adminAuthMiddleware, async (req, res) => {
    try {
      const scheduled = await listScheduledAirfarmingDropsAdmin({ upcomingOnly: false, limit: 500 });
      const overdue = (scheduled || []).filter(
        (d) => new Date(d.due_at).getTime() <= Date.now() && d.status === 'scheduled'
      );
      const keys = new Set(overdue.map((d) => `${d.user_id}:${d.week_start}`));
      for (const key of keys) {
        const [userId, weekStart] = key.split(':');
        // Ensure countdown-elapsed drops are transformed into pending_approval before listing.
        await processDueDrops(userId, weekStart, { autoFundEnabled: true }).catch(() => {});
      }

      await processAllGhostLendQueues().catch(() => {});

      const rows = await listPendingAirfarmingDropsAdmin(Number(req.query.limit) || 300);
      const users = await getUsersByIds(rows.map((r) => r.user_id));
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
      const payouts = rows.map((r) => pendingDropToAdminRow(r, emailByUserId));
      return res.json({ payouts, count: payouts.length });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({
          message:
            'Airfarming schema missing pending approval status. Run backend/sql/migrations/20260602_airfarming_pending_approvals.sql.',
        });
      }
      console.error('[admin/airfarming/payouts/pending]', e);
      return res.status(500).json({ message: e.message || 'Failed to load pending drop payouts' });
    }
  });

  app.post(
    '/admin/api/airfarming/payouts/:id/approve',
    adminAuthMiddleware,
    async (req, res) => {
      try {
        const drop = await getAirfarmingDropById(req.params.id);
        if (!drop) return res.status(404).json({ message: 'Drop not found' });
        if (drop.status !== 'pending_approval') {
          return res.status(400).json({ message: 'Drop is not pending approval' });
        }

        const profit = Number(drop.profit_amount || 0);
        const { net: netProfit, fee: platformFee } = splitPlatformFee(profit, PLATFORM_FEE_DROP_RATE);
        const now = new Date().toISOString();
        if (netProfit > 0) {
          const af = await getAirfarmingWalletByUserId(drop.user_id);
          const current = Number.parseFloat(String(af?.balance ?? 0)) || 0;
          await upsertAirfarmingWalletRow({
            user_id: drop.user_id,
            balance: Math.round((current + netProfit) * 100) / 100,
            updated_at: now,
          });
          const planDate = String(drop.due_at || utcTodayYmd()).slice(0, 10);
          await incrementAiDailyBudgetSpent(planDate, netProfit).catch(() => {});
        }
        if (platformFee > 0) {
          await recordPlatformRevenueIfNew({
            eventType: 'airfarming_drop',
            userId: drop.user_id,
            sourceId: drop.id,
            grossAmount: profit,
            feeRate: PLATFORM_FEE_DROP_RATE,
            meta: { dropId: drop.id, netPaidToUser: netProfit },
            eventAt: now,
          }).catch((e) => console.error('[platform-revenue/drop]', e));
        }

        const updated = await updateAirfarmingDrop(drop.id, {
          status: 'paid',
          paid_at: now,
        });
        await recallLendForDrop(drop.id, { netProfit }).catch((e) =>
          console.error('[ghost/recall/approve]', e)
        );
        return res.json({ ok: true, payout: updated });
      } catch (e) {
        if (isMissingTableError(e)) {
          return res.status(503).json({
            message:
              'Airfarming schema missing pending approval status. Run backend/sql/migrations/20260602_airfarming_pending_approvals.sql.',
          });
        }
        console.error('[admin/airfarming/payouts/approve]', e);
        return res.status(500).json({ message: e.message || 'Failed to approve drop payout' });
      }
    }
  );

  app.post(
    '/admin/api/airfarming/payouts/:id/reject',
    adminAuthMiddleware,
    async (req, res) => {
      try {
        const drop = await getAirfarmingDropById(req.params.id);
        if (!drop) return res.status(404).json({ message: 'Drop not found' });
        if (drop.status !== 'pending_approval') {
          return res.status(400).json({ message: 'Drop is not pending approval' });
        }
        const updated = await updateAirfarmingDrop(drop.id, {
          status: 'missed',
          profit_amount: 0,
          paid_at: new Date().toISOString(),
        });
        await recallLendForDrop(drop.id, { netProfit: 0 }).catch((e) =>
          console.error('[ghost/recall/reject]', e)
        );
        return res.json({ ok: true, payout: updated });
      } catch (e) {
        if (isMissingTableError(e)) {
          return res.status(503).json({
            message:
              'Airfarming schema missing pending approval status. Run backend/sql/migrations/20260602_airfarming_pending_approvals.sql.',
          });
        }
        console.error('[admin/airfarming/payouts/reject]', e);
        return res.status(500).json({ message: e.message || 'Failed to reject drop payout' });
      }
    }
  );

  app.get('/admin/api/p2p/disputed', adminAuthMiddleware, async (req, res) => {
    try {
      const trades = await listP2pTradesDisputedAdmin(Number(req.query.limit) || 100);
      return res.json({ trades, count: trades.length });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.json({ trades: [], count: 0, schemaMissing: true });
      }
      console.error('[admin/p2p/disputed]', e);
      return res.status(500).json({ message: e.message || 'Failed to load disputed P2P trades' });
    }
  });

  app.get('/admin/api/levels', adminAuthMiddleware, async (req, res) => {
    try {
      const search = String(req.query.search || '').trim();
      const users = await listUsersAdmin({
        limit: Number(req.query.limit) || 300,
        search,
      });
      const levels = await Promise.all(
        users.map(async (u) => {
          const trust = await getWithdrawalTrustScoreForUser(u.id);
          return {
            userId: u.id,
            email: u.email,
            cashBalance: u.cashBalance,
            airfarmingBalance: u.airfarmingBalance,
            score: trust.score,
            band: trust.band,
            label: trust.label,
            levelColor: trust.levelColor,
            dropsBlocked: trust.dropsBlocked,
            dropPotentialPercent: trust.dropPotentialPercent,
            stats: trust.stats,
            dropsPaused: u.dropsPaused,
          };
        })
      );
      levels.sort((a, b) => a.score - b.score);
      const blockedCount = levels.filter((l) => l.dropsBlocked).length;
      return res.json({
        levels,
        count: levels.length,
        blockedCount,
        redBlockScore: RED_DROP_BLOCK_SCORE,
      });
    } catch (e) {
      console.error('[admin/levels]', e);
      return res.status(500).json({ message: e.message || 'Failed to load withdrawal levels' });
    }
  });

  app.get('/admin/api/account/revenue', adminAuthMiddleware, async (req, res) => {
    try {
      const recentLimit = Number(req.query.recentLimit) || 80;
      const stats = await getPlatformRevenueAdminStats({ recentLimit });
      const userIds = [...new Set(stats.recent.map((r) => r.userId).filter(Boolean))];
      const users = await getUsersByIds(userIds);
      const emailById = new Map(users.map((u) => [u.id, u.email]));
      stats.recent = stats.recent.map((r) => ({
        ...r,
        email: r.userId ? emailById.get(r.userId) || '—' : '—',
      }));

      let ghostRevenue = null;
      try {
        ghostRevenue = await getGhostRevenueAdminStats({ recentLimit: 50 });
      } catch (ghostErr) {
        if (!isMissingTableError(ghostErr) && !isSchemaError(ghostErr)) throw ghostErr;
        ghostRevenue = {
          schemaMissing: true,
          message:
            'Ghost account schema missing. Run backend/sql/migrations/20260618_ghost_accounts.sql in Supabase.',
          summary: {
            all: { count: 0, profitUsd: 0, principalUsd: 0, totalSweepUsd: 0 },
            today: { count: 0, profitUsd: 0, principalUsd: 0, totalSweepUsd: 0 },
            month: { count: 0, profitUsd: 0, principalUsd: 0, totalSweepUsd: 0 },
          },
          recent: [],
        };
      }

      return res.json({ ...stats, ghostRevenue });
    } catch (e) {
      if (isMissingTableError(e) || isSchemaError(e)) {
        const empty = () => ({ count: 0, grossUsd: 0, feeUsd: 0 });
        return res.json({
          schemaMissing: true,
          message:
            'Platform revenue schema missing. Run backend/sql/migrations/20260612_platform_revenue.sql in Supabase.',
          rates: { airfarmingDrop: 0.1, withdrawal: 0.05, vipAccrual: 0.03 },
          summary: {
            all: empty(),
            today: empty(),
            month: empty(),
            byType: { airfarming_drop: empty(), withdrawal: empty(), vip_accrual: empty() },
          },
          recent: [],
          ghostRevenue: {
            schemaMissing: true,
            summary: {
              all: { count: 0, profitUsd: 0, principalUsd: 0, totalSweepUsd: 0 },
              today: { count: 0, profitUsd: 0, principalUsd: 0, totalSweepUsd: 0 },
              month: { count: 0, profitUsd: 0, principalUsd: 0, totalSweepUsd: 0 },
            },
            recent: [],
          },
        });
      }
      console.error('[admin/account/revenue]', e);
      return res.status(500).json({ message: e.message || 'Failed to load platform revenue' });
    }
  });

  app.get('/admin/api/vip-farmers', adminAuthMiddleware, async (req, res) => {
    try {
      const status = String(req.query.status || 'active').trim();
      const rows = await listVipInvestmentsAdmin({ status, limit: Number(req.query.limit) || 500 });
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const investmentIds = rows.map((r) => r.id);
      const [users, accrualRows] = await Promise.all([
        getUsersByIds(userIds),
        listVipAccrualsForInvestmentIds(investmentIds),
      ]);
      const emailById = new Map(users.map((u) => [u.id, u.email]));
      const accrualsByInvestment = new Map();
      for (const a of accrualRows) {
        const list = accrualsByInvestment.get(a.investment_id) || [];
        list.push(a);
        accrualsByInvestment.set(a.investment_id, list);
      }
      const planDate = utcTodayYmd();
      const members = rows.map((row) => {
        const inv = vipInvestmentToApi(row);
        const principal = Number(inv.principalUsd || 0);
        const dailyIncomeUsd = Math.round(principal * VIP_DAILY_RATE * 100) / 100;
        const accruals = (accrualsByInvestment.get(row.id) || [])
          .sort((a, b) => String(b.accrual_date).localeCompare(String(a.accrual_date)))
          .map((a) => ({
            date: a.accrual_date,
            amount: Number(a.amount),
            rate: Number(a.rate),
          }));
        const todayRow = accruals.find((a) => a.date === planDate);
        return {
          userId: row.user_id,
          email: emailById.get(row.user_id) || '—',
          investmentId: row.id,
          status: row.status,
          principalUsd: principal,
          dailyIncomeUsd,
          dailyRate: VIP_DAILY_RATE,
          totalAccruedUsd: Number(inv.totalAccruedUsd || 0),
          daysAccrued: Number(inv.daysAccrued || 0),
          daysLeft: inv.daysLeft,
          lockDays: VIP_LOCK_DAYS,
          startedAt: inv.startedAt,
          maturesAt: inv.maturesAt,
          matured: inv.matured,
          todayAccruedUsd: todayRow ? todayRow.amount : null,
          accruals,
        };
      });
      const activeMembers = members.filter((m) => m.status === 'active');
      const summary = {
        count: members.length,
        activeCount: activeMembers.length,
        totalPrincipalUsd: activeMembers.reduce((s, m) => s + m.principalUsd, 0),
        totalDailyIncomeUsd: activeMembers.reduce((s, m) => s + m.dailyIncomeUsd, 0),
        totalAccruedUsd: members.reduce((s, m) => s + m.totalAccruedUsd, 0),
      };
      return res.json({
        dailyRate: VIP_DAILY_RATE,
        lockDays: VIP_LOCK_DAYS,
        planDate,
        compounding: false,
        members,
        summary,
      });
    } catch (e) {
      if (isMissingTableError(e) || isSchemaError(e)) {
        return res.status(503).json({
          message: 'VIP Farmers schema missing. Run backend/sql/migrations/20260605_vip_farmers.sql in Supabase.',
          schemaMissing: true,
        });
      }
      console.error('[admin/vip-farmers]', e);
      return res.status(500).json({ message: e.message || 'Failed to load VIP members' });
    }
  });

  app.get('/admin/api/p2p/trades', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const status = String(req.query.status || 'all').trim();
      const rows = await listP2pTradesAdmin({
        status,
        limit: Number(req.query.limit) || 250,
      });
      const ids = [
        ...new Set(
          rows
            .flatMap((r) => [r.merchant_user_id, r.counterparty_user_id, r.usdt_sender_id, r.usdt_receiver_id])
            .filter(Boolean)
        ),
      ];
      const users = await getUsersByIds(ids);
      const emailById = new Map(users.map((u) => [u.id, u.email]));
      const trades = rows.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        cryptoAmount: Number(r.crypto_amount || 0),
        fiatAmount: Number(r.fiat_amount || 0),
        fiatCurrency: r.fiat_currency,
        merchantEmail: emailById.get(r.merchant_user_id) || '—',
        buyerEmail: emailById.get(r.counterparty_user_id) || '—',
        sellerEmail: emailById.get(r.usdt_sender_id) || '—',
        receiverEmail: emailById.get(r.usdt_receiver_id) || '—',
      }));
      return res.json({ trades, count: trades.length });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: 'P2P schema not ready.' });
      console.error('[admin/p2p/trades]', e);
      return res.status(500).json({ message: e.message || 'Failed to load P2P trades' });
    }
  });

  app.post('/admin/api/p2p/trades/:id/resolve-release', adminAuthMiddleware, async (req, res) => {
    try {
      const row = await getP2pTradeById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Trade not found' });
      if (row.status !== 'disputed') {
        return res.status(400).json({ message: 'Trade is not disputed.' });
      }
      if (!row.ledger_escrow_posted) {
        return res.status(400).json({ message: 'Escrow was not posted for this trade.' });
      }
      await releaseP2pEscrow({
        receiverId: row.usdt_receiver_id,
        amount: row.crypto_amount,
        tradeId: row.id,
        newId,
      });
      const updated = await updateP2pTrade(row.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      await incrementP2pMerchantCompletedTrades(row.merchant_user_id);
      return res.json({ ok: true, trade: updated });
    } catch (e) {
      console.error('[admin/p2p/resolve-release]', e);
      return res.status(500).json({ message: e.message || 'Failed to release escrow' });
    }
  });

  app.post('/admin/api/p2p/trades/:id/resolve-refund', adminAuthMiddleware, async (req, res) => {
    try {
      const row = await getP2pTradeById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Trade not found' });
      if (row.status !== 'disputed') {
        return res.status(400).json({ message: 'Trade is not disputed.' });
      }
      if (!row.ledger_escrow_posted) {
        return res.status(400).json({ message: 'Escrow was not posted for this trade.' });
      }
      await refundP2pEscrow({
        senderId: row.usdt_sender_id,
        amount: row.crypto_amount,
        tradeId: row.id,
        newId,
      });
      const updated = await updateP2pTrade(row.id, { status: 'cancelled' });
      return res.json({ ok: true, trade: updated });
    } catch (e) {
      console.error('[admin/p2p/resolve-refund]', e);
      return res.status(500).json({ message: e.message || 'Failed to refund escrow' });
    }
  });

  app.post(
    '/admin/api/withdrawals/:source/:id/priority',
    adminAuthMiddleware,
    async (req, res) => {
      try {
        const row = await upsertAdminWithdrawalPriority({
          source: req.params.source,
          withdrawalId: req.params.id,
          adminUser: req.adminUser,
        });
        return res.json({
          ok: true,
          message: 'Withdrawal marked as priority.',
          adminPriority: true,
          adminPushedAt: row.admin_pushed_at,
          adminPushedBy: row.admin_pushed_by,
        });
      } catch (e) {
        const status = e.status || 500;
        if (status >= 500) console.error('[admin/withdrawals/priority]', e);
        return res.status(status).json({ message: e.message || 'Failed to mark priority' });
      }
    }
  );

  app.post(
    '/admin/api/withdrawals/:source/:id/approve',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
    try {
      const result = await approveWithdrawal({
        source: req.params.source,
        id: req.params.id,
      });
      return res.json({ ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[admin/withdrawals/approve]', e);
      return res.status(status).json({ message: e.message || 'Failed to approve withdrawal' });
    }
    }
  );

  app.post('/admin/api/withdrawals/:source/:id/reject', adminAuthMiddleware, async (req, res) => {
    try {
      const result = await rejectWithdrawal({
        source: req.params.source,
        id: req.params.id,
        note: req.body?.note,
      });
      return res.json({ ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[admin/withdrawals/reject]', e);
      return res.status(status).json({ message: e.message || 'Failed to reject withdrawal' });
    }
  });

  app.get('/admin/api/airfarming/drops', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const upcomingOnly = String(req.query.upcoming || '1') !== '0';
      const rows = await listScheduledAirfarmingDropsAdmin({ upcomingOnly, limit: 500 });
      const userIds = rows.map((r) => r.user_id);
      const users = await getUsersByIds(userIds);
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
      const pausedByUserId = await getAirfarmingDropsPausedByUserIds(userIds);
      const drops = rows.map((r) => dropToAdminRow(r, emailByUserId, pausedByUserId));
      const schemaNote =
        rows.length === 0
          ? 'No scheduled drops. If you expect data, run airfarming migrations in Supabase.'
          : undefined;
      const caps = await getEffectiveCaps();
      return res.json({ drops, count: drops.length, maxPercent: caps.maxPercent, schemaNote });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.json({
          drops: [],
          count: 0,
          maxPercent: MAX_AIRFARMING_PERCENT,
          maxProfitPerDrop: 5000,
          schemaNote: 'Airfarming drops table missing. Run backend/sql/migrations for airfarming_drops in Supabase.',
        });
      }
      console.error('[admin/airfarming/drops]', e);
      return res.status(500).json({ message: e.message || 'Failed to load drops' });
    }
  });

  app.patch('/admin/api/airfarming/drops/:id', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const existing = await getAirfarmingDropById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Drop not found' });
      if (existing.status !== 'scheduled') {
        return res.status(400).json({ message: 'Only scheduled drops can be edited' });
      }

      const { patch, error } = await validateDropPatch(req.body || {});
      if (error) return res.status(400).json({ message: error });

      const minBal = patch.min_balance != null ? patch.min_balance : Number(existing.min_balance);
      const maxBal = patch.max_balance != null ? patch.max_balance : Number(existing.max_balance);
      if (maxBal < minBal) {
        return res.status(400).json({ message: 'maxBalance must be >= minBalance' });
      }

      const updated = await updateAirfarmingDrop(existing.id, patch);
      const users = await getUsersByIds([updated.user_id]);
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
      const pausedByUserId = await getAirfarmingDropsPausedByUserIds([updated.user_id]);
      return res.json({ drop: dropToAdminRow(updated, emailByUserId, pausedByUserId) });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({ message: 'Airfarming drops schema not ready.' });
      }
      console.error('[admin/airfarming/drops/patch]', e);
      return res.status(500).json({ message: 'Failed to update drop' });
    }
  });

  app.post('/admin/api/airfarming/drops/:id/postpone', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const existing = await getAirfarmingDropById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Drop not found' });
      if (existing.status !== 'scheduled') {
        return res.status(400).json({ message: 'Only scheduled drops can be postponed' });
      }
      const minutes = Number(req.body?.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return res.status(400).json({ message: 'minutes must be greater than 0' });
      }
      const dueAt = new Date(new Date(existing.due_at).getTime() + Math.round(minutes * 60 * 1000)).toISOString();
      const updated = await updateAirfarmingDrop(existing.id, { due_at: dueAt });
      const users = await getUsersByIds([updated.user_id]);
      const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
      const pausedByUserId = await getAirfarmingDropsPausedByUserIds([updated.user_id]);
      return res.json({ drop: dropToAdminRow(updated, emailByUserId, pausedByUserId) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: 'Airfarming drops schema not ready.' });
      console.error('[admin/airfarming/drops/postpone]', e);
      return res.status(500).json({ message: e.message || 'Failed to postpone drop' });
    }
  });

  app.delete('/admin/api/airfarming/drops/:id', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const existing = await getAirfarmingDropById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Drop not found' });
      if (!['scheduled', 'pending_approval'].includes(existing.status)) {
        return res.status(400).json({ message: 'Only scheduled or pending approval drops can be deleted' });
      }
      await deleteAirfarmingDropById(existing.id);
      return res.json({ ok: true, id: existing.id });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: 'Airfarming drops schema not ready.' });
      console.error('[admin/airfarming/drops/delete]', e);
      return res.status(500).json({ message: e.message || 'Failed to delete drop' });
    }
  });

  app.post('/admin/api/airfarming/drops/:id/pause-user', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const existing = await getAirfarmingDropById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Drop not found' });
      const state = await updateAirfarmingUserDropPause(existing.user_id, { indefinitePause: true });
      const pause = pauseStatusFromState(state);
      return res.json({ ok: true, userId: existing.user_id, ...pause });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: 'Airfarming schema not ready.' });
      console.error('[admin/airfarming/drops/pause-user]', e);
      return res.status(500).json({ message: e.message || 'Failed to pause user drops' });
    }
  });

  const notificationsSchemaMsg =
    'Notifications schema missing. Run backend/sql/migrations/20260518_app_notifications.sql in Supabase.';

  function notificationToAdmin(row) {
    return {
      id: row.id,
      userId: row.user_id || null,
      audience: row.user_id ? 'user' : 'broadcast',
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
    };
  }

  const ghostSchemaMsg =
    'Ghost Account schema missing. Run backend/sql/migrations/20260618_ghost_accounts.sql in Supabase.';

  app.get('/admin/api/ghost-accounts', adminAuthMiddleware, requireSuperAdmin, async (_req, res) => {
    try {
      const accounts = await listGhostAccountsAdminSummary();
      return res.json({ accounts, count: accounts.length });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: ghostSchemaMsg });
      console.error('[admin/ghost-accounts]', e);
      return res.status(500).json({ message: e.message || 'Failed to load ghost accounts' });
    }
  });

  app.get('/admin/api/ghost-accounts/particle-network', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const userLimit = Number(req.query.limit) || 500;
      const network = await buildGhostParticleNetworkAdmin({ userLimit });
      return res.json(network);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: ghostSchemaMsg });
      console.error('[admin/ghost-accounts/particle-network]', e);
      return res.status(500).json({ message: e.message || 'Failed to load particle network' });
    }
  });

  app.get('/admin/api/ghost-accounts/:id/network', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const network = await buildGhostNetworkAdmin(req.params.id);
      return res.json(network);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: ghostSchemaMsg });
      if (e.message === 'Ghost account not found') return res.status(404).json({ message: e.message });
      console.error('[admin/ghost-accounts/network]', e);
      return res.status(500).json({ message: e.message || 'Failed to load ghost network' });
    }
  });

  app.post('/admin/api/notifications', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim();
      const body = String(req.body?.body || '').trim();
      if (!title || !body) {
        return res.status(400).json({ message: 'title and body are required' });
      }

      const broadcast = Boolean(req.body?.broadcast);
      let userId = null;
      if (!broadcast) {
        userId = normalizeTargetUserId(req.body?.userId ?? req.body?.user_id);
        const email = String(req.body?.userEmail || req.body?.email || '')
          .trim()
          .toLowerCase();
        if (!userId && email) {
          const user = await getUserByEmail(email);
          if (!user) return res.status(404).json({ message: 'User not found for that email' });
          userId = user.id;
        }
        if (!userId) {
          return res.status(400).json({
            message: 'Provide userEmail or userId, or set broadcast to send to all users',
          });
        }
      }

      const row = await createAppNotification({ userId, title, body });
      return res.status(201).json({ notification: notificationToAdmin(row) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: notificationsSchemaMsg });
      console.error('[admin/notifications]', e);
      return res.status(500).json({ message: e.message || 'Failed to send notification' });
    }
  });
}

module.exports = { registerAdminRoutes };
