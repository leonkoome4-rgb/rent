const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const mpesa = require('../services/mpesa');
const { applyPayment } = require('../services/reconcile');

const router = express.Router();

// POST /api/payments/stk — tenant initiates an STK push for a given invoice.
// Optional `amount` lets them pay ahead: if it's more than what's due for this
// period, the extra cascades onto future periods once the payment succeeds.
router.post(
  '/stk',
  authenticate,
  requireRole('TENANT'),
  asyncHandler(async (req, res) => {
    const { invoiceId } = req.body;
    const invoice = await prisma.rentInvoice.findUnique({
      where: { id: invoiceId },
      include: { lease: { include: { tenant: true, unit: true } } },
    });
    if (!invoice || invoice.lease.tenantId !== req.user.id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (invoice.status === 'PAID') {
      return res.status(409).json({ error: 'Invoice already paid' });
    }

    const remaining = invoice.amountDue - invoice.amountPaid;
    const amount = req.body.amount ? Number(req.body.amount) : remaining;
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be greater than zero' });

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

// GET /api/payments/:checkoutId/status — polls STK Query, applies payment on success.
// Callable by the tenant who owns the invoice, or the landlord/agent who owns the
// property (covers both self-service payment and landlord-triggered payment requests).
router.get(
  '/:checkoutId/status',
  authenticate,
  requireRole('TENANT', 'LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const { checkoutId } = req.params;

    const pending = await prisma.payment.findFirst({
      where: { checkoutId },
      include: { invoice: { include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } } } },
    });
    if (!pending) return res.status(404).json({ error: 'Unknown checkout' });

    const lease = pending.invoice?.lease;
    const authorized =
      (req.user.role === 'TENANT' && lease?.tenantId === req.user.id) ||
      (['LANDLORD', 'AGENT'].includes(req.user.role) && lease?.unit?.property?.ownerId === req.user.id);
    if (!authorized) return res.status(404).json({ error: 'Unknown checkout' });

    if (pending.status === 'SUCCESS') {
      return res.json({ status: 'success', receipt: pending.mpesaReceipt });
    }
    if (pending.status === 'FAILED') {
      return res.json({ status: 'failed' });
    }

    const result = await mpesa.stkQuery(checkoutId, { initiatedAt: pending.createdAt });

    if (result.status === 'success') {
      const { payment, periodsCovered } = await applyPayment({
        tenantId: lease.tenantId,
        amount: pending.amount,
        receipt: result.receipt,
        method: 'STK',
        phone: pending.phone,
        checkoutId,
        existingPaymentId: pending.id,
      });
      return res.json({ status: 'success', receipt: payment.mpesaReceipt, periodsCovered });
    }

    if (result.status === 'failed') {
      await prisma.payment.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
      return res.json({ status: 'failed' });
    }

    res.json({ status: 'pending' });
  })
);

module.exports = router;
