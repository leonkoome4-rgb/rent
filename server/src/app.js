require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./prisma');
const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const tenantMeRoutes = require('./routes/tenantMe');
const boardRoutes = require('./routes/board');
const dashboardRoutes = require('./routes/dashboard');
const invoicesRoutes = require('./routes/invoices');
const paymentsRoutes = require('./routes/payments');
const propertiesRoutes = require('./routes/properties');
const tenantsRoutes = require('./routes/tenants');
const mpesaRoutes = require('./routes/mpesa');
const collectionsRoutes = require('./routes/collections');
const { asyncHandler } = require('./middleware/asyncHandler');

const app = express();
app.set('trust proxy', 1); // Vercel/any proxy: makes req.ip the client IP for rate limiting

// The client is served from the same origin in production, so CORS only needs
// to allow the Vite dev server plus anything listed in CORS_ORIGINS.
const allowedOrigins = new Set(
  ['http://localhost:5173', process.env.APP_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
    .map((o) => (o || '').trim())
    .filter(Boolean)
);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)) }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ping: 'pong' });
});

app.get(
  '/api/health',
  asyncHandler(async (req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/auth', meRoutes);
app.use('/api/me', tenantMeRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api', collectionsRoutes);

// Catches errors from asyncHandler-wrapped routes so a bad request or a
// transient DB error returns a 500 instead of crashing the whole process.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
