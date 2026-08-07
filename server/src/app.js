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
const { asyncHandler } = require('./middleware/asyncHandler');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ping: 'pong' });
});

app.get(
  '/api/health',
  asyncHandler(async (req, res) => {
    const userCount = await prisma.user.count();
    res.json({ ok: true, landlords: userCount });
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

// Catches errors from asyncHandler-wrapped routes so a bad request or a
// transient DB error returns a 500 instead of crashing the whole process.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
