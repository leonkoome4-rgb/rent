const prisma = require('../prisma');
const sms = require('./sms');
const { ensureCurrentInvoices, currentPeriod } = require('./invoices');

const DAY_MS = 24 * 60 * 60 * 1000;
// Days relative to the due date on which the daily job nudges a tenant:
// 3 days before, on the day, then 3/7/14 days late.
const SCHEDULE = new Set([-3, 0, 3, 7, 14]);

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtDate = (d) => d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

function reminderText({ tenant, unit, property, balance, dueDate, daysLate }) {
  const first = tenant.name.split(' ')[0];
  const pay = property.paybill ? ` Pay via M-Pesa Paybill ${property.paybill}, account ${unit.label}.` : '';
  // balance can span several months, so overdue messages name the oldest unpaid due date
  const status =
    daysLate > 0
      ? `your balance is ${sms.ksh(balance)}, unpaid since ${fmtDate(dueDate)}`
      : `${sms.ksh(balance)} is due ${daysLate === 0 ? 'today' : `on ${fmtDate(dueDate)}`}`;
  return `Hi ${first}, ${property.name} ${unit.label}: ${status}.${pay}`;
}

/** Open leases with their outstanding balance and earliest unpaid due date. */
async function outstandingLeases(where = {}) {
  const leases = await prisma.lease.findMany({
    where: { active: true, ...where },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      invoices: {
        where: { status: { in: ['UNPAID', 'PARTIAL'] }, period: { lte: currentPeriod() } },
        orderBy: { period: 'asc' },
      },
    },
  });
  return leases
    .map((lease) => ({
      lease,
      balance: lease.invoices.reduce((s, inv) => s + inv.amountDue - inv.amountPaid, 0),
      dueDate: lease.invoices[0]?.dueDate,
    }))
    .filter((x) => x.balance > 0);
}

async function alreadyRemindedToday(tenantId, now) {
  const count = await prisma.reminderLog.count({
    where: { tenantId, kind: 'REMINDER', sentAt: { gte: startOfDay(now) } },
  });
  return count > 0;
}

async function remind({ lease, balance, dueDate }, now) {
  const daysLate = Math.round((startOfDay(now) - startOfDay(new Date(dueDate))) / DAY_MS);
  return sms.send({
    to: lease.tenant.phone,
    kind: 'REMINDER',
    tenantId: lease.tenantId,
    landlordId: lease.unit.property.ownerId,
    message: reminderText({ ...lease, property: lease.unit.property, balance, dueDate: new Date(dueDate), daysLate }),
  });
}

/**
 * Daily job (Vercel Cron): make sure this month's invoices exist, then remind
 * every tenant whose earliest unpaid due date falls on a SCHEDULE day.
 */
async function runDailyReminders(now = new Date()) {
  await ensureCurrentInvoices();
  let sent = 0;
  for (const item of await outstandingLeases()) {
    const daysLate = Math.round((startOfDay(now) - startOfDay(new Date(item.dueDate))) / DAY_MS);
    if (!SCHEDULE.has(daysLate)) continue;
    if (await alreadyRemindedToday(item.lease.tenantId, now)) continue;
    await remind(item, now);
    sent++;
  }
  return { period: currentPeriod(), sent };
}

/** Landlord's "Remind all unpaid" button — everyone with a balance, once per day. */
async function remindAllUnpaid(ownerId, now = new Date()) {
  let sent = 0;
  let skipped = 0;
  for (const item of await outstandingLeases({ unit: { property: { ownerId } } })) {
    if (await alreadyRemindedToday(item.lease.tenantId, now)) {
      skipped++;
      continue;
    }
    await remind(item, now);
    sent++;
  }
  return { sent, skipped };
}

module.exports = { runDailyReminders, remindAllUnpaid };
