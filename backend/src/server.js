require('dotenv').config();

const express = require('express');
const cors = require('cors');
const logger = require('./lib/logger');
const handoverRoutes = require('./routes/handover');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── middleware ───────────────────────────────────────────────────────────────

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://vouch-handover.vercel.app',
  'https://vouchjayasitumorangtest.vercel.app',
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman)
      if (!origin) return cb(null, true);
      // In development, allow any localhost port
      if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
        return cb(null, true);
      }
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
  })
);

app.use(express.json({ limit: '2mb' }));

// Structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start },
      'http'
    );
  });
  next();
});

// ─── routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vouch-handover',
    version: '1.0.0',
    ai_enabled: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/handover', handoverRoutes);

// ─── error handlers ───────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ─── start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info({ port: PORT, ai_enabled: !!process.env.GEMINI_API_KEY }, 'Service started');
});

module.exports = app;
