const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { ensureInvoiceForPeriod, currentPeriod } = require('../services/invoices');

const router = express.Router();

async function getActiveLease(tenantId) {
  return prisma.lease.findFirst({
    where: { tenantId, active: true },
    include: { unit: { include: { property: true } }, tenant: true },
  });
}

// GET /api/me/invoices — current + past invoices, balance
router.get(
  '/invoices',
  authenticate,
  requireRole('TENANT'),
  asyncHandler(async (req, res) => {
    const lease = await getActiveLease(req.user.id);
    if (!lease) return res.json({ current: null, past: [], balance: 0 });

    await ensureInvoiceForPeriod(lease, lease.unit, currentPeriod());

    const invoices = await prisma.rentInvoice.findMany({
      where: { leaseId: lease.id },
      orderBy: { period: 'desc' },
    });

    const current = invoices.find((inv) => inv.period === currentPeriod()) || null;
    const past = invoices.filter((inv) => inv.period !== currentPeriod());
    const balance = invoices.reduce((sum, inv) => sum + Math.max(0, inv.amountDue - inv.amountPaid), 0);

    res.json({
      unit: {
        label: lease.unit.label,
        property: lease.unit.property.name,
        category: lease.unit.property.category,
      },
      current,
      past,
      balance,
    });
  })
);

// GET /api/me/payments — history
router.get(
  '/payments',
  authenticate,
  requireRole('TENANT'),
  asyncHandler(async (req, res) => {
    const lease = await getActiveLease(req.user.id);
    if (!lease) return res.json([]);

    const payments = await prisma.payment.findMany({
      where: { invoice: { leaseId: lease.id } },
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
    });

    res.json(
      payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        method: p.method,
        mpesaReceipt: p.mpesaReceipt,
        period: p.invoice?.period,
        createdAt: p.createdAt,
      }))
    );
  })
);

module.exports = router;
