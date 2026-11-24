let app;
let initError;

try {
  const loaded = require('./_bundle.cjs');
  app = loaded && loaded.default ? loaded.default : loaded;
} catch (error) {
  initError = error;
  console.error('[Vercel API] Gagal memuat server bundle:', error);
}

module.exports = (req, res) => {
  if (initError || typeof app !== 'function') {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      error: `Server API gagal diinisialisasi: ${initError instanceof Error ? initError.message : 'handler tidak valid'}`,
    }));
    return;
  }
  return app(req, res);
};
