const prisma = require('../prisma');

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dueDateForPeriod(period, dueDay) {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, dueDay);
}

/**
 * Creates the current-period invoice for a lease if it doesn't exist yet, using
 * the unit's current rent + utility charges as the snapshot. Idempotent — uses
 * upsert (not find-then-create) so concurrent callers (e.g. dashboard and board
 * loading at once) can't race each other into a unique constraint violation.
 */
async function ensureInvoiceForPeriod(lease, unit, period) {
  const amountDue = unit.rentAmount + unit.waterCharge + unit.electricityCharge + unit.trashCharge;
  return prisma.rentInvoice.upsert({
    where: { leaseId_period: { leaseId: lease.id, period } },
    update: {},
    create: {
      leaseId: lease.id,
      period,
      rentAmount: unit.rentAmount,
      waterCharge: unit.waterCharge,
      electricityCharge: unit.electricityCharge,
      trashCharge: unit.trashCharge,
      amountDue,
      amountPaid: 0,
      status: 'UNPAID',
      dueDate: dueDateForPeriod(period, lease.dueDay),
    },
  });
}

/** Ensures every active lease has an invoice for the current month. */
async function ensureCurrentInvoices() {
  const period = currentPeriod();
  const leases = await prisma.lease.findMany({ where: { active: true }, include: { unit: true } });
  for (const lease of leases) {
    await ensureInvoiceForPeriod(lease, lease.unit, period);
  }
}

module.exports = { currentPeriod, dueDateForPeriod, ensureInvoiceForPeriod, ensureCurrentInvoices };
