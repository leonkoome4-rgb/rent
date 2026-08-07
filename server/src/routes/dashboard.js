const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { ensureCurrentInvoices, currentPeriod } = require('../services/invoices');

const router = express.Router();

// GET /api/dashboard — collected, outstanding, occupancy, recent payments
router.get(
  '/',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    await ensureCurrentInvoices();
    const period = currentPeriod();

    const invoices = await prisma.rentInvoice.findMany({
      where: { period, lease: { unit: { property: { ownerId: req.user.id } } } },
    });

    const collected = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const outstanding = invoices.reduce((sum, inv) => sum + Math.max(0, inv.amountDue - inv.amountPaid), 0);

    const units = await prisma.unit.findMany({
      where: { property: { ownerId: req.user.id } },
      include: { lease: true },
    });
    const occupied = units.filter((u) => u.lease?.active).length;
    const occupancy = units.length ? Math.round((occupied / units.length) * 100) : 0;

    const recentPayments = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        invoice: { lease: { unit: { property: { ownerId: req.user.id } } } },
      },
      include: {
        invoice: { include: { lease: { include: { tenant: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({
      period,
      collected,
      outstanding,
      occupancy,
      unitsTotal: units.length,
      unitsOccupied: occupied,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        tenantName: p.invoice?.lease?.tenant?.name || 'Unknown',
        unitLabel: p.invoice?.lease?.unit?.label,
        method: p.method,
        autoMatched: p.method === 'STK' || p.method === 'C2B',
        mpesaReceipt: p.mpesaReceipt,
        createdAt: p.createdAt,
      })),
    });
  })
);

module.exports = router;
