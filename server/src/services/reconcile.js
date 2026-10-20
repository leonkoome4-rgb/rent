const prisma = require('../prisma');
const { currentPeriod, ensureInvoiceForPeriod } = require('./invoices');
const { sendReceipt } = require('./sms');

const MAX_PERIODS_PER_PAYMENT = 24; // safety cap against a fat-fingered amount cascading forever

function nextPeriodOf(period) {
  const [y, m] = period.split('-').map(Number); // m is 1-indexed current month
  const d = new Date(y, m, 1); // rolls forward one month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const LEASE_INCLUDE = { unit: { include: { property: true } }, tenant: true };

const normalizeRef = (ref) => String(ref || '').replace(/\s+/g, '').toUpperCase();

/**
 * Finds the active lease a payment belongs to. By tenant when we know who paid
 * (STK, manual); otherwise by the account number typed on a Paybill payment,
 * scoped to the Paybill it arrived on so two landlords who both have a "B4"
 * never collide. Falls back to the payer's phone number. Returns null when
 * nothing (or more than one lease) matches, so ambiguous money is parked as
 * UNMATCHED rather than credited to the wrong tenant.
 */
async function resolveActiveLease({ tenantId, accountRef, shortcode, phone }) {
  if (tenantId) {
    return prisma.lease.findFirst({ where: { tenantId, active: true }, include: LEASE_INCLUDE });
  }
  const propertyScope = shortcode ? { property: { paybill: String(shortcode) } } : {};
  if (accountRef) {
    const ref = normalizeRef(accountRef);
    const leases = await prisma.lease.findMany({
      where: { active: true, unit: propertyScope },
      include: LEASE_INCLUDE,
    });
    const matches = leases.filter((l) => normalizeRef(l.unit.label) === ref);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
  }
  if (phone) {
    const matches = await prisma.lease.findMany({
      where: { active: true, tenant: { phone: String(phone) }, unit: propertyScope },
      include: LEASE_INCLUDE,
    });
    if (matches.length === 1) return matches[0];
  }
  return null;
}

/**
 * Shared reconciliation used by STK success, C2B confirmation, and manual-mark.
 * Idempotent on mpesaReceipt. By default starts at the oldest outstanding invoice
 * for the resolved lease (used by STK/C2B, where we only know the tenant or account
 * ref, not which specific period they're paying for). Pass targetInvoiceId to start
 * at one specific invoice instead — used by the manual-mark action, where the
 * landlord clicked a specific cell and expects that exact cell to update first.
 *
 * The amount determines how many periods it covers: if it's more than one period's
 * amountDue, the remainder cascades forward through as many future periods as it
 * covers (e.g. paying 3 months of rent at once marks all 3 PAID), stopping when the
 * amount runs out. One Payment row is created per period touched — only the first
 * carries the mpesaReceipt/checkoutId (receipts are unique per transaction), so each
 * period's ledger entry still shows its own amount for statements and the dashboard.
 */
async function applyPayment({
  tenantId,
  accountRef,
  amount,
  receipt,
  method,
  phone,
  checkoutId,
  existingPaymentId,
  targetInvoiceId,
  shortcode,
  rawPayload,
  silent, // skip the receipt SMS (e.g. seeding)
}) {
  if (existingPaymentId) {
    const existingRow = await prisma.payment.findUnique({ where: { id: existingPaymentId } });
    if (existingRow?.status === 'SUCCESS') return { payment: existingRow, payments: [existingRow], duplicate: true, matched: true };
  }
  if (receipt) {
    const existing = await prisma.payment.findUnique({ where: { mpesaReceipt: receipt } });
    // When assigning an UNMATCHED payment, the receipt already lives on that same row.
    if (existing && existing.id !== existingPaymentId) return { payment: existing, payments: [existing], duplicate: true, matched: true };
  }

  const lease = await resolveActiveLease({ tenantId, accountRef, shortcode, phone: tenantId ? null : phone });

  if (!lease) {
    const data = {
      amount,
      phone: phone || '',
      mpesaReceipt: receipt || null,
      checkoutId: checkoutId || null,
      accountRef: accountRef || null,
      shortcode: shortcode ? String(shortcode) : null,
      rawPayload: rawPayload || undefined,
      method,
      status: 'UNMATCHED',
    };
    const payment = existingPaymentId
      ? await prisma.payment.update({ where: { id: existingPaymentId }, data })
      : await prisma.payment.create({ data });
    return { payment, payments: [payment], matched: false };
  }

  let invoice = targetInvoiceId
    ? await prisma.rentInvoice.findUnique({ where: { id: targetInvoiceId } })
    : await prisma.rentInvoice.findFirst({
        where: { leaseId: lease.id, status: { in: ['UNPAID', 'PARTIAL'] } },
        orderBy: { period: 'asc' },
      });
  if (!invoice) {
    invoice = await ensureInvoiceForPeriod(lease, lease.unit, currentPeriod());
  }

  let remaining = amount;
  const payments = [];
  const invoicesTouched = [];

  for (let i = 0; i < MAX_PERIODS_PER_PAYMENT && remaining > 0 && invoice; i++) {
    const due = invoice.amountDue - invoice.amountPaid;
    const portion = Math.min(remaining, due);
    const newAmountPaid = invoice.amountPaid + portion;
    const status = newAmountPaid >= invoice.amountDue ? 'PAID' : 'PARTIAL';

    const updatedInvoice = await prisma.rentInvoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newAmountPaid, status },
    });
    invoicesTouched.push(updatedInvoice);

    const isFirst = i === 0;
    const paymentData = {
      invoiceId: invoice.id,
      amount: portion,
      phone: phone || lease.tenant?.phone || '',
      mpesaReceipt: isFirst ? receipt || null : null,
      checkoutId: isFirst ? checkoutId || null : null,
      accountRef: accountRef || lease.unit.label,
      shortcode: isFirst && shortcode ? String(shortcode) : null,
      rawPayload: isFirst && rawPayload ? rawPayload : undefined,
      method,
      status: 'SUCCESS',
    };
    const payment =
      isFirst && existingPaymentId
        ? await prisma.payment.update({ where: { id: existingPaymentId }, data: paymentData })
        : await prisma.payment.create({ data: paymentData });
    payments.push(payment);

    remaining -= portion;
    if (remaining > 0) {
      invoice = await ensureInvoiceForPeriod(lease, lease.unit, nextPeriodOf(invoice.period));
    }
  }

  const periodsCovered = invoicesTouched.map((inv) => inv.period);
  if (!silent) {
    const open = await prisma.rentInvoice.findMany({
      // Only months that have started — a prepaid part of next month isn't owed yet.
      where: { leaseId: lease.id, status: { in: ['UNPAID', 'PARTIAL'] }, period: { lte: currentPeriod() } },
    });
    const balance = open.reduce((sum, inv) => sum + inv.amountDue - inv.amountPaid, 0);
    await sendReceipt({ lease, amount, receipt, periodsCovered, balance });
  }

  return {
    payment: payments[0],
    payments,
    invoice: invoicesTouched[0],
    invoices: invoicesTouched,
    periodsCovered,
    matched: true,
  };
}

module.exports = { applyPayment, resolveActiveLease, normalizeRef };
