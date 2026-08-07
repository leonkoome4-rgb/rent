const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { applyPayment } = require('../services/reconcile');
const mpesa = require('../services/mpesa');

const router = express.Router();

// POST /api/invoices/:id/request-payment — landlord/agent triggers an STK push
// to the tenant's phone directly from the board, instead of waiting for the
// tenant to initiate it themselves.
router.post(
  '/:id/request-payment',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.rentInvoice.findUnique({
      where: { id: req.params.id },
      include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } },
    });
    if (!invoice || invoice.lease.unit.property.ownerId !== req.user.id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (invoice.status === 'PAID') {
      return res.status(409).json({ error: 'Invoice already paid' });
    }

    const STALE_PENDING_MS = 90000;
    const existingPending = await prisma.payment.findFirst({
      where: { invoiceId: invoice.id, method: 'STK', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPending) {
      const isStale = Date.now() - new Date(existingPending.createdAt).getTime() > STALE_PENDING_MS;
      if (!isStale) {
        return res.json({ checkoutId: existingPending.checkoutId, reused: true });
      }
      await prisma.payment.update({ where: { id: existingPending.id }, data: { status: 'FAILED' } });
    }

    const amount = invoice.amountDue - invoice.amountPaid;
    const { checkoutId } = await mpesa.stkPush({
      phone: invoice.lease.tenant.phone,
      amount,
      accountRef: invoice.lease.unit.label,
    });

    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        phone: invoice.lease.tenant.phone,
        checkoutId,
        accountRef: invoice.lease.unit.label,
        method: 'STK',
        status: 'PENDING',
      },
    });

    res.json({ checkoutId });
  })
);

// POST /api/invoices/:id/mark-paid — manual override recorded by the landlord,
// method CASH or BANK. If the amount covers more than this one period, the extra
// cascades forward and marks as many future periods PAID as it covers.
router.post(
  '/:id/mark-paid',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.rentInvoice.findUnique({
      where: { id: req.params.id },
      include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } },
    });
    if (!invoice || invoice.lease.unit.property.ownerId !== req.user.id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (invoice.status === 'PAID') {
      return res.status(409).json({ error: 'Invoice already paid' });
    }

    const method = ['CASH', 'BANK'].includes(req.body?.method) ? req.body.method : 'CASH';
    const remaining = invoice.amountDue - invoice.amountPaid;
    const amount = req.body?.amount ? Number(req.body.amount) : remaining;
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be greater than zero' });

    const result = await applyPayment({
      tenantId: invoice.lease.tenantId,
      targetInvoiceId: invoice.id,
      amount,
      method,
      phone: invoice.lease.tenant.phone,
    });

    res.json(result);
  })
);

module.exports = router;
