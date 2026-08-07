const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

async function findOwnedLease(tenantId, ownerId) {
  return prisma.lease.findFirst({
    where: { tenantId, unit: { property: { ownerId } } },
    include: { unit: { include: { property: true } }, tenant: true },
    orderBy: { startDate: 'desc' },
  });
}

// GET /api/tenants/:id/statement — full ledger for one payer: their info, every
// period's invoice, and every payment against them. Reachable by clicking their
// name on the board.
router.get(
  '/:id/statement',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const lease = await findOwnedLease(req.params.id, req.user.id);
    if (!lease) return res.status(404).json({ error: 'Payer not found' });

    const invoices = await prisma.rentInvoice.findMany({
      where: { leaseId: lease.id },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
      orderBy: { period: 'desc' },
    });

    const totalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalDue = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);

    res.json({
      tenant: {
        id: lease.tenant.id,
        name: lease.tenant.name,
        phone: lease.tenant.phone,
        email: lease.tenant.email,
        note: lease.tenant.note,
      },
      group: {
        id: lease.unit.property.id,
        name: lease.unit.property.name,
        category: lease.unit.property.category,
        unitLabel: lease.unit.label,
        unitId: lease.unit.id,
      },
      active: lease.active,
      leaseStartDate: lease.startDate,
      balance: Math.max(0, totalDue - totalPaid),
      totalPaid,
      invoices,
    });
  })
);

// PATCH /api/tenants/:id — update the landlord's note on a payer
router.patch(
  '/:id',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const lease = await findOwnedLease(req.params.id, req.user.id);
    if (!lease) return res.status(404).json({ error: 'Payer not found' });

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { note: req.body.note ?? null },
    });
    res.json({ id: tenant.id, note: tenant.note });
  })
);

module.exports = router;
