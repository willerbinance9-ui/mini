const { checkDatabaseHealth } = require('./db');

function registerPublicStatusRoutes(app) {
  app.get('/v1/public/status', async (_req, res) => {
    const checks = {
      api: 'ok',
      database: 'unknown',
      partnerApi: 'unknown',
      applications: 'unknown',
    };

    try {
      await checkDatabaseHealth();
      checks.database = 'ok';
    } catch {
      checks.database = 'degraded';
    }

    checks.partnerApi = checks.database === 'ok' ? 'ok' : 'degraded';
    checks.applications = checks.database === 'ok' ? 'ok' : 'degraded';

    const overall = checks.database === 'degraded' ? 'degraded' : 'operational';

    return res.json({
      status: overall,
      updatedAt: new Date().toISOString(),
      services: checks,
      environment: process.env.NODE_ENV || 'production',
    });
  });
}

module.exports = { registerPublicStatusRoutes };
