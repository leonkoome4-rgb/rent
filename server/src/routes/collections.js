const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { applyPayment } = require('../services/reconcile');
const { remindAllUnpaid, runDailyReminders } = require('../services/reminders');
const { SMS_DRIVER } = require('../services/sms');

const router = express.Router();
const landlordOnly = [authenticate, requireRole('LANDLORD', 'AGENT')];

async function ownedPaybills(ownerId) {
  const properties = await prisma.property.findMany({
    where: { ownerId, paybill: { not: null } },
    select: { paybill: true },
  });
  return [...new Set(properties.map((p) => p.paybill))];
}

// GET /api/outbox — every message sent (or, in mock mode, queued) to this landlord's tenants
router.get(
  '/outbox',
  ...landlordOnly,
  asyncHandler(async (req, res) => {
    const messages = await prisma.reminderLog.findMany({
      where: { landlordId: req.user.id },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });
    const tenantIds = [...new Set(messages.map((m) => m.tenantId).filter(Boolean))];
    const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
    const names = Object.fromEntries(tenants.map((t) => [t.id, t.name]));
    res.json({
      driver: SMS_DRIVER,
      messages: messages.map((m) => ({ ...m, tenantName: names[m.tenantId] || null })),
    });
  })
);

// POST /api/reminders/send — "Remind all unpaid" button
router.post(
  '/reminders/send',
  ...landlordOnly,
  asyncHandler(async (req, res) => {
    res.json(await remindAllUnpaid(req.user.id));
  })
);

// GET /api/unmatched — Paybill payments that arrived on this landlord's
// Paybill(s) but whose account number didn't match any active unit.
router.get(
  '/unmatched',
  ...landlordOnly,
  asyncHandler(async (req, res) => {
    const paybills = await ownedPaybills(req.user.id);
    if (!paybills.length) return res.json([]);
    const payments = await prisma.payment.findMany({
      where: { status: 'UNMATCHED', shortcode: { in: paybills } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        phone: p.phone,
        accountRef: p.accountRef,
        mpesaReceipt: p.mpesaReceipt,
        shortcode: p.shortcode,
        createdAt: p.createdAt,
      }))
    );
  })
);

// POST /api/unmatched/:id/assign { unitId } — landlord says who it belongs to;
// it's then reconciled exactly like a matched Paybill payment.
router.post(
  '/unmatched/:id/assign',
  ...landlordOnly,
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    const paybills = await ownedPaybills(req.user.id);
    if (!payment || payment.status !== 'UNMATCHED' || !paybills.includes(payment.shortcode)) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const lease = await prisma.lease.findFirst({
      where: { unitId: String(req.body.unitId || ''), active: true, unit: { property: { ownerId: req.user.id } } },
    });
    if (!lease) return res.status(400).json({ error: 'Pick a unit that has an active tenant' });

    const result = await applyPayment({
      tenantId: lease.tenantId,
      amount: payment.amount,
      receipt: payment.mpesaReceipt,
      method: payment.method,
      phone: payment.phone,
      shortcode: payment.shortcode,
      existingPaymentId: payment.id,
    });
    res.json({ assigned: true, periodsCovered: result.periodsCovered });
  })
);

// GET /api/cron/daily — Vercel Cron. Vercel sends "Authorization: Bearer $CRON_SECRET";
// with no CRON_SECRET configured the endpoint is closed.
router.get(
  '/cron/daily',
  asyncHandler(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(await runDailyReminders());
  })
);

module.exports = router;
