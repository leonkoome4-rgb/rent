const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

const CATEGORIES = ['RENT', 'SCHOOL_FEES', 'MEMBERSHIP', 'OTHER'];

// GET /api/properties — landlord's groups, with member counts
router.get(
  '/',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id },
      include: { units: { include: { lease: { include: { tenant: true } } } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      properties.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        location: p.location,
        memberCount: p.units.filter((u) => u.lease?.active).length,
        members: p.units
          .filter((u) => u.lease?.active)
          .map((u) => ({
            unitId: u.id,
            label: u.label,
            amount: u.rentAmount,
            tenantId: u.lease.tenant.id,
            tenantName: u.lease.tenant.name,
            tenantPhone: u.lease.tenant.phone,
            note: u.lease.tenant.note,
          })),
      }))
    );
  })
);

// POST /api/properties — create a new group (rental property, school class, chama, etc.)
router.post(
  '/',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const { name, category, location, paybill } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(', ')}` });
    }

    const property = await prisma.property.create({
      data: {
        name,
        category: category || 'RENT',
        location: location || null,
        paybill: paybill || null,
        ownerId: req.user.id,
      },
    });

    res.status(201).json(property);
  })
);

// POST /api/properties/:id/members — add a payer to a group in one step:
// creates the Tenant (if new, matched by phone — their phone number is their ID,
// used for both M-Pesa and tenant login), the Unit (their "slot" — house number,
// student ID, member number, etc.), and the Lease linking them, together.
router.post(
  '/:id/members',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!property || property.ownerId !== req.user.id) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const {
      tenantName,
      tenantPhone,
      label,
      amount,
      waterCharge,
      electricityCharge,
      trashCharge,
      dueDay,
      note,
    } = req.body;

    if (!tenantName || !tenantPhone || !label || !amount) {
      return res.status(400).json({ error: 'tenantName, tenantPhone, label and amount are required' });
    }

    const existingUnit = await prisma.unit.findUnique({
      where: { propertyId_label: { propertyId: property.id, label } },
    });
    if (existingUnit) return res.status(409).json({ error: `"${label}" is already in use in this group` });

    let tenant = await prisma.tenant.findUnique({ where: { phone: tenantPhone }, include: { lease: true } });
    if (tenant?.lease?.active) {
      return res.status(409).json({ error: 'This phone number is already assigned to an active member elsewhere' });
    }
    const isNewTenant = !tenant;
    if (isNewTenant) {
      const defaultPassword = await bcrypt.hash('tenant123', 10);
      tenant = await prisma.tenant.create({
        data: { name: tenantName, phone: tenantPhone, password: defaultPassword, note: note || null },
      });
    } else if (note !== undefined) {
      tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: { note: note || null } });
    }

    const unit = await prisma.unit.create({
      data: {
        propertyId: property.id,
        label,
        rentAmount: Number(amount),
        waterCharge: Number(waterCharge) || 0,
        electricityCharge: Number(electricityCharge) || 0,
        trashCharge: Number(trashCharge) || 0,
      },
    });

    const lease = await prisma.lease.create({
      data: {
        unitId: unit.id,
        tenantId: tenant.id,
        rentAmount: Number(amount),
        dueDay: Number(dueDay) || 5,
        startDate: new Date(),
        active: true,
      },
      include: { tenant: true, unit: true },
    });

    res.status(201).json({ lease, tenantDefaultPassword: isNewTenant ? 'tenant123' : undefined });
  })
);

// DELETE /api/properties/:id/members/:unitId — remove a member from a group.
// Deactivates their lease rather than deleting records outright, so past
// invoices/payments stay intact for statements; they immediately drop off the
// board, dashboard, and group listings, and their phone number frees up to be
// re-added elsewhere.
router.delete(
  '/:id/members/:unitId',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.findUnique({
      where: { id: req.params.unitId },
      include: { property: true, lease: true },
    });
    if (!unit || unit.propertyId !== req.params.id || unit.property.ownerId !== req.user.id) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (!unit.lease) return res.status(404).json({ error: 'Member not found' });

    await prisma.lease.update({ where: { id: unit.lease.id }, data: { active: false } });
    res.json({ removed: true });
  })
);

module.exports = router;
