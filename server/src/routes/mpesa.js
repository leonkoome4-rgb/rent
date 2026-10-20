const crypto = require('crypto');
const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { applyPayment } = require('../services/reconcile');
const { parseAmount, normalizePhone } = require('../utils/validate');
const mpesa = require('../services/mpesa');

const router = express.Router();

// Daraja calls these URLs unauthenticated. When MPESA_CALLBACK_SECRET is set,
// register the URLs with ?secret=<value> so forged callbacks are rejected.
function checkSecret(req, res, next) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (secret && req.query.secret !== secret) return res.status(401).json({ ResultCode: 1, ResultDesc: 'Rejected' });
  next();
}

const accepted = (res) => res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

// POST /api/mpesa/stk-callback — Daraja's push result for an STK request. The
// client also polls /api/payments/:checkoutId/status; whichever lands first
// applies the payment and the other is a no-op (applyPayment is idempotent).
router.post(
  '/stk-callback',
  checkSecret,
  asyncHandler(async (req, res) => {
    const cb = req.body?.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) return accepted(res);

    const pending = await prisma.payment.findFirst({
      where: { checkoutId: cb.CheckoutRequestID },
      include: { invoice: { include: { lease: true } } },
    });
    if (!pending || pending.status !== 'PENDING') return accepted(res);

    if (String(cb.ResultCode) !== '0') {
      await prisma.payment.update({ where: { id: pending.id }, data: { status: 'FAILED', rawPayload: req.body } });
      return accepted(res);
    }

    const item = (name) => cb.CallbackMetadata?.Item?.find((i) => i.Name === name)?.Value;
    await applyPayment({
      tenantId: pending.invoice?.lease?.tenantId,
      amount: Number(item('Amount')) || pending.amount,
      receipt: item('MpesaReceiptNumber'),
      method: 'STK',
      phone: String(item('PhoneNumber') || pending.phone),
      checkoutId: cb.CheckoutRequestID,
      existingPaymentId: pending.id,
      rawPayload: req.body,
    });
    accepted(res);
  })
);

// POST /api/mpesa/c2b/validation — we accept everything; unknown account
// numbers are parked as UNMATCHED rather than bouncing the tenant's money.
router.post('/c2b/validation', checkSecret, (req, res) => accepted(res));

// POST /api/mpesa/c2b/confirmation — a tenant paid the landlord's Paybill
// directly from their M-Pesa menu. Matched by Paybill + account number.
router.post(
  '/c2b/confirmation',
  checkSecret,
  asyncHandler(async (req, res) => {
    const { TransID, TransAmount, BillRefNumber, MSISDN, BusinessShortCode } = req.body || {};
    const amount = Math.round(Number(TransAmount));
    if (!TransID || !(amount > 0)) return accepted(res);

    await applyPayment({
      accountRef: BillRefNumber,
      shortcode: BusinessShortCode,
      amount,
      receipt: TransID,
      method: 'C2B',
      phone: normalizePhone(MSISDN) || String(MSISDN || ''),
      rawPayload: req.body,
    });
    accepted(res);
  })
);

// POST /api/mpesa/simulate-c2b — mock mode only: lets a landlord demo a
// Paybill payment ("tenant pays 15,000 to account B4") end to end, exactly as
// the real confirmation would arrive.
router.post(
  '/simulate-c2b',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    if (mpesa.MPESA_ENV !== 'mock') return res.status(404).json({ error: 'Not available' });

    const property = await prisma.property.findUnique({ where: { id: String(req.body.propertyId || '') } });
    if (!property || property.ownerId !== req.user.id) return res.status(404).json({ error: 'Group not found' });
    if (!property.paybill) return res.status(400).json({ error: 'Add a Paybill number to this property first' });

    const amount = parseAmount(req.body.amount);
    if (!amount) return res.status(400).json({ error: 'Enter an amount' });
    if (!req.body.accountRef) return res.status(400).json({ error: 'Enter the account number the tenant typed' });

    const result = await applyPayment({
      accountRef: String(req.body.accountRef),
      shortcode: property.paybill,
      amount,
      receipt: `SIM${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      method: 'C2B',
      phone: normalizePhone(req.body.phone) || '254700000000',
    });
    res.json({ matched: result.matched, periodsCovered: result.periodsCovered || [], receipt: result.payment?.mpesaReceipt });
  })
);

module.exports = router;
