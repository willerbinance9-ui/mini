const {
  buildTradingStatus,
  allocateToTrading,
  withdrawFromTrading,
  isMissingTableError,
  SCHEMA_MSG,
} = require('./services/userTradingService');

function registerTradingRoutes(app, { authMiddleware }) {
  app.get('/trading/status', authMiddleware, async (req, res) => {
    try {
      const status = await buildTradingStatus(req.userId);
      return res.json(status);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load trading status' });
    }
  });

  app.post('/trading/allocate', authMiddleware, async (req, res) => {
    try {
      const status = await allocateToTrading(req.userId, req.body?.amount);
      return res.json(status);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      if (e.status) return res.status(e.status).json({ message: e.message });
      return res.status(500).json({ message: e?.message || 'Allocation failed' });
    }
  });

  app.post('/trading/withdraw', authMiddleware, async (req, res) => {
    try {
      const status = await withdrawFromTrading(req.userId, req.body?.amount);
      return res.json(status);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      if (e.status) return res.status(e.status).json({ message: e.message });
      return res.status(500).json({ message: e?.message || 'Withdraw failed' });
    }
  });
}

module.exports = { registerTradingRoutes };
