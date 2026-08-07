const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { ensureCurrentInvoices, currentPeriod } = require('../services/invoices');

const router = express.Router();

function lastNPeriods(n, endPeriod) {
  const [y, m] = endPeriod.split('-').map(Number);
  const periods = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
}

// GET /api/board?period=YYYY-MM — grid data: tenants x recent months with statuses
router.get(
  '/',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    await ensureCurrentInvoices();

    const endPeriod = req.query.period || currentPeriod();
    const months = lastNPeriods(4, endPeriod);

    const leases = await prisma.lease.findMany({
      where: { active: true, unit: { property: { ownerId: req.user.id } } },
      include: {
        tenant: true,
        unit: { include: { property: true } },
        invoices: { where: { period: { in: months } } },
      },
      orderBy: [{ unit: { property: { name: 'asc' } } }, { unit: { label: 'asc' } }],
    });

    const rows = leases.map((lease) => {
      const cells = {};
      for (const period of months) {
        const invoice = lease.invoices.find((inv) => inv.period === period);
        cells[period] = invoice
          ? {
              invoiceId: invoice.id,
              status: invoice.status,
              amountDue: invoice.amountDue,
              amountPaid: invoice.amountPaid,
            }
          : null;
      }
      return {
        tenantId: lease.tenant.id,
        tenantName: lease.tenant.name,
        tenantPhone: lease.tenant.phone,
        unitLabel: lease.unit.label,
        propertyName: lease.unit.property.name,
        propertyCategory: lease.unit.property.category,
        cells,
      };
    });

    res.json({ months, rows });
  })
);

module.exports = router;
