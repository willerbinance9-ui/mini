const {
  enrollGhostAccount,
  allocateToPool,
  deallocateFromPool,
  lookupMemberByExactEmail,
  addGhostMember,
  removeGhostMember,
  setGhostAccountPaused,
  buildGhostAccountStatus,
  getGhostAccountBalance,
  processAllGhostLendQueues,
  getGhostOwnerJournalMonth,
  getGhostOwnerJournalDay,
} = require('./ghostAccountService');
const { isMissingTableError } = require('./db');

function requireCronSecret(req) {
  const expected = process.env.INTERNAL_CRON_SECRET;
  if (!expected) return false;
  const got = req.headers['x-internal-cron-secret'] || req.body?.secret;
  return String(got || '') === String(expected);
}

function registerGhostAccountRoutes(app, { authMiddleware }) {
  const schemaMsg =
    'Ghost Account schema missing. Run backend/sql/migrations/20260618_ghost_accounts.sql in Supabase.';

  app.get('/ghost-account/status', authMiddleware, async (req, res) => {
    try {
      const status = await buildGhostAccountStatus(req.userId);
      return res.json(status);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Ghost Account status failed' });
    }
  });

  app.get('/ghost-account/balance', authMiddleware, async (req, res) => {
    try {
      const balance = await getGhostAccountBalance(req.userId);
      return res.json(balance);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Ghost Account balance failed' });
    }
  });

  app.get('/ghost-account/journal/month', authMiddleware, async (req, res) => {
    try {
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: 'year and month are required' });
      }
      const data = await getGhostOwnerJournalMonth(req.userId, year, month);
      return res.json(data);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Ghost journal month failed' });
    }
  });

  app.get('/ghost-account/journal/day', authMiddleware, async (req, res) => {
    try {
      const date = String(req.query.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'date=YYYY-MM-DD is required' });
      }
      const data = await getGhostOwnerJournalDay(req.userId, date);
      return res.json(data);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Ghost journal day failed' });
    }
  });

  app.post('/ghost-account/enroll', authMiddleware, async (req, res) => {
    try {
      const account = await enrollGhostAccount(req.userId);
      const status = await buildGhostAccountStatus(req.userId);
      return res.status(201).json({ account, status });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      if (e.message?.includes('requires more than')) return res.status(400).json({ message: e.message });
      return res.status(500).json({ message: e?.message || 'Enrollment failed' });
    }
  });

  app.post('/ghost-account/allocate', authMiddleware, async (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      const account = await allocateToPool(req.userId, amount);
      const status = await buildGhostAccountStatus(req.userId);
      return res.json({ account, status });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(400).json({ message: e?.message || 'Allocation failed' });
    }
  });

  app.post('/ghost-account/deallocate', authMiddleware, async (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      const account = await deallocateFromPool(req.userId, amount);
      const status = await buildGhostAccountStatus(req.userId);
      return res.json({ account, status });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(400).json({ message: e?.message || 'Deallocation failed' });
    }
  });

  app.post('/ghost-account/members/lookup', authMiddleware, async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim();
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const result = await lookupMemberByExactEmail(req.userId, email);
      if (!result) return res.status(404).json({ message: 'No user found with that email' });
      if (result.error) return res.status(400).json({ message: result.error });

      return res.json(result);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Lookup failed' });
    }
  });

  app.post('/ghost-account/members', authMiddleware, async (req, res) => {
    try {
      const memberUserId = String(req.body?.memberUserId || '').trim();
      if (!memberUserId) return res.status(400).json({ message: 'memberUserId is required' });

      const member = await addGhostMember(req.userId, memberUserId);
      const status = await buildGhostAccountStatus(req.userId);
      return res.status(201).json({ member, status });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(400).json({ message: e?.message || 'Failed to add member' });
    }
  });

  app.delete('/ghost-account/members/:memberUserId', authMiddleware, async (req, res) => {
    try {
      await removeGhostMember(req.userId, req.params.memberUserId);
      const status = await buildGhostAccountStatus(req.userId);
      return res.json({ ok: true, status });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(400).json({ message: e?.message || 'Failed to remove member' });
    }
  });

  app.patch('/ghost-account/pause', authMiddleware, async (req, res) => {
    try {
      const paused = Boolean(req.body?.paused);
      const account = await setGhostAccountPaused(req.userId, paused);
      const status = await buildGhostAccountStatus(req.userId);
      return res.json({ account, status });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(400).json({ message: e?.message || 'Failed to update pause state' });
    }
  });

  app.post('/internal/ghost-account/process', async (req, res) => {
    try {
      if (!requireCronSecret(req)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const result = await processAllGhostLendQueues();
      return res.json({ ok: true, ...result });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Ghost Account process failed' });
    }
  });
}

module.exports = { registerGhostAccountRoutes };
