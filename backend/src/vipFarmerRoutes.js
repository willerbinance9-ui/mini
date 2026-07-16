const { isMissingTableError, isSchemaError } = require('./db');
const {
  getVipSummary,
  investVip,
  addCapitalVip,
  reinvestVipEarnings,
  withdrawVipAtMaturity,
  earlyWithdrawVip,
  runVipDailyAccrual,
} = require('./vipFarmerService');
const {
  computeVipExitQuote,
  submitVipExitRequest,
  listUserVipExitRequests,
} = require('./vipExitService');
const {
  getVipLoanStatus,
  requestVipLoan,
  repayVipLoan,
} = require('./vipLoanService');

function requireCronSecret(req) {
  const expected = process.env.INTERNAL_CRON_SECRET;
  if (!expected) return false;
  const got = req.headers['x-internal-cron-secret'] || req.body?.secret;
  return String(got || '') === String(expected);
}

function registerVipFarmerRoutes(app, { authMiddleware }) {
  const schemaMsg =
    'VIP Farmers schema missing. Run backend/sql/migrations/20260605_vip_farmers.sql in Supabase.';
  const exitUnavailableMsg =
    'Exit withdrawals are not available yet. Please try again later or contact support.';
  const loanSchemaMsg =
    'VIP loan schema missing. Run backend/sql/migrations/20260707_vip_loans.sql in Supabase.';

  app.get('/vip-farmers/summary', authMiddleware, async (req, res) => {
    try {
      return res.json(await getVipSummary(req.userId));
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e.message || 'VIP summary failed' });
    }
  });

  app.post('/vip-farmers/invest', authMiddleware, async (req, res) => {
    try {
      const result = await investVip(req.userId, req.body?.amount);
      return res.status(201).json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e.message || 'Invest failed' });
    }
  });

  app.post('/vip-farmers/add-capital', authMiddleware, async (req, res) => {
    try {
      const result = await addCapitalVip(req.userId, req.body?.amount);
      return res.json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e.message || 'Add capital failed' });
    }
  });

  app.post('/vip-farmers/reinvest', authMiddleware, async (req, res) => {
    try {
      const result = await reinvestVipEarnings(req.userId, req.body?.amount);
      return res.json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e.message || 'Reinvest failed' });
    }
  });

  app.get('/vip-farmers/loans/status', authMiddleware, async (req, res) => {
    try {
      return res.json(await getVipLoanStatus(req.userId));
    } catch (e) {
      if (isMissingTableError(e) || isSchemaError(e)) {
        return res.status(503).json({ message: loanSchemaMsg });
      }
      return res.status(500).json({ message: e.message || 'Loan status failed' });
    }
  });

  app.post('/vip-farmers/loans/request', authMiddleware, async (req, res) => {
    try {
      const result = await requestVipLoan(req.userId, {
        amount: req.body?.amount,
        destination: req.body?.destination || req.body?.payoutDestination,
        walletAddress: req.body?.walletAddress || req.body?.payoutWalletAddress,
      });
      return res.status(201).json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e) || isSchemaError(e)) {
        return res.status(503).json({
          message:
            'VIP loan schema update required. Run backend/sql/migrations/20260716_vip_loan_payout_wallet.sql in Supabase.',
        });
      }
      // PostgREST unknown-column errors often arrive as PGRST204 without our schema helpers
      const msg = String(e?.message || '');
      if (
        msg.includes('payout_destination') ||
        msg.includes('borrower_tier') ||
        msg.includes('month_earnings_base_usd') ||
        msg.includes('haircut_rate') ||
        msg.includes('schema cache')
      ) {
        return res.status(503).json({
          message:
            'VIP loan schema update required. Run backend/sql/migrations/20260716_vip_loan_payout_wallet.sql in Supabase.',
        });
      }
      return res.status(500).json({ message: e.message || 'Loan request failed' });
    }
  });

  app.post('/vip-farmers/loans/repay', authMiddleware, async (req, res) => {
    try {
      const result = await repayVipLoan(req.userId, req.body?.amount);
      return res.json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e) || isSchemaError(e)) {
        return res.status(503).json({ message: loanSchemaMsg });
      }
      return res.status(500).json({ message: e.message || 'Loan repayment failed' });
    }
  });

  app.post('/vip-farmers/withdraw', authMiddleware, async (req, res) => {
    try {
      const result = await withdrawVipAtMaturity(req.userId);
      return res.json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e.message || 'Withdraw failed' });
    }
  });

  app.post('/vip-farmers/early-withdraw', authMiddleware, async (req, res) => {
    try {
      const result = await earlyWithdrawVip(req.userId);
      return res.json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e.message || 'Early withdraw failed' });
    }
  });

  app.post('/vip-farmers/exit/preview', authMiddleware, async (req, res) => {
    try {
      const quote = await computeVipExitQuote(req.userId, req.body || {});
      return res.json(quote);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e) || isSchemaError(e)) {
        return res.status(503).json({ message: exitUnavailableMsg });
      }
      return res.status(500).json({ message: e.message || 'Exit preview failed' });
    }
  });

  app.post('/vip-farmers/exit/request', authMiddleware, async (req, res) => {
    try {
      const result = await submitVipExitRequest(req.userId, req.body || {});
      return res.status(201).json(result);
    } catch (e) {
      if (e.statusCode === 400) return res.status(400).json({ message: e.message });
      if (isMissingTableError(e) || isSchemaError(e)) {
        return res.status(503).json({ message: exitUnavailableMsg });
      }
      console.error('[vip-farmers/exit/request]', e);
      return res.status(500).json({ message: e.message || 'Exit request failed' });
    }
  });

  app.get('/vip-farmers/exit/requests', authMiddleware, async (req, res) => {
    try {
      const result = await listUserVipExitRequests(req.userId, req.query.limit);
      return res.json(result);
    } catch (e) {
      if (isMissingTableError(e) || isSchemaError(e)) {
        return res.status(503).json({ message: exitUnavailableMsg });
      }
      return res.status(500).json({ message: e.message || 'Failed to load exit requests' });
    }
  });

  app.post('/internal/vip-farmers/daily-accrue', async (req, res) => {
    try {
      if (!requireCronSecret(req)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const planDate = String(req.body?.planDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const result = await runVipDailyAccrual(planDate);
      return res.json(result);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      console.error('[internal/vip-farmers/daily-accrue]', e);
      return res.status(500).json({ message: e.message || 'VIP accrue failed' });
    }
  });
}

module.exports = { registerVipFarmerRoutes };
