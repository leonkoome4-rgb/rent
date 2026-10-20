const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { parseAmount, normalizePhone } = require('../utils/validate');
const sms = require('../services/sms');

const router = express.Router();

const CATEGORIES = ['RENT', 'SCHOOL_FEES', 'MEMBERSHIP', 'OTHER'];
const MAX_BULK_ROWS = 500;

const newPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

async function findOwnedProperty(id, ownerId) {
  const property = await prisma.property.findUnique({ where: { id } });
  return property && property.ownerId === ownerId ? property : null;
}

/** Issues a fresh one-time PIN for a tenant, records the invite in the Outbox and returns share details. */
async function issuePin({ tenant, property, unitLabel, kind = 'INVITE' }) {
  const pin = newPin();
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { password: await bcrypt.hash(pin, 10), mustChangePassword: true },
  });
  const message = sms.inviteMessage({
    tenantName: tenant.name,
    propertyName: property.name,
    category: property.category,
    unitLabel,
    phone: tenant.phone,
    pin,
    paybill: property.paybill,
  });
  await sms.send({ to: tenant.phone, message, kind, tenantId: tenant.id, landlordId: property.ownerId });
  return { pin, message, whatsapp: sms.whatsappLink(tenant.phone, message) };
}

/**
 * Validates one unit row (from the single-add form, a generated range, or a
 * pasted/CSV list). A row without a tenant is a vacant unit. Returns
 * { row } or { error }.
 */
function cleanRow(raw) {
  const label = String(raw.label || '').trim();
  const amount = parseAmount(raw.amount);
  if (!label) return { error: 'unit/house number is required' };
  if (label.length > 30) return { error: 'unit/house number is too long' };
  if (amount === null) return { error: 'rent must be a whole number above 0' };

  const tenantName = String(raw.tenantName || '').trim();
  const rawPhone = String(raw.tenantPhone || '').trim();
  if (Boolean(tenantName) !== Boolean(rawPhone)) {
    return { error: 'give both tenant name and phone, or neither for a vacant unit' };
  }
  const tenantPhone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !tenantPhone) return { error: `"${rawPhone}" is not a valid Kenyan phone number` };

  const charge = (v) => parseAmount(v, { allowZero: true }) ?? 0;
  const dueDay = Math.min(28, Math.max(1, parseInt(raw.dueDay, 10) || 5));

  return {
    row: {
      label,
      amount,
      tenantName,
      tenantPhone,
      waterCharge: charge(raw.waterCharge),
      electricityCharge: charge(raw.electricityCharge),
      trashCharge: charge(raw.trashCharge),
      dueDay,
      note: raw.note === undefined ? undefined : String(raw.note || '').trim() || null,
    },
  };
}

/**
 * Creates (or fills) one unit and, if a tenant is given, the tenant + lease.
 * An existing vacant unit with the same label is reused, so a landlord can
 * load all units first and assign tenants as they move in. Throws an Error
 * with .status for conflicts.
 */
async function addUnitRow(property, row) {
  const conflict = (msg) => Object.assign(new Error(msg), { status: 409 });

  let unit = await prisma.unit.findUnique({
    where: { propertyId_label: { propertyId: property.id, label: row.label } },
    include: { leases: { where: { active: true } } },
  });
  if (unit?.leases.length) throw conflict(`"${row.label}" already has a tenant`);

  let tenant = null;
  if (row.tenantPhone) {
    tenant = await prisma.tenant.findUnique({
      where: { phone: row.tenantPhone },
      include: { leases: { where: { active: true } } },
    });
    if (tenant?.leases.length) throw conflict(`${row.tenantPhone} is already an active tenant elsewhere`);
  }

  const unitData = {
    rentAmount: row.amount,
    waterCharge: row.waterCharge,
    electricityCharge: row.electricityCharge,
    trashCharge: row.trashCharge,
  };
  unit = unit
    ? await prisma.unit.update({ where: { id: unit.id }, data: unitData })
    : await prisma.unit.create({ data: { ...unitData, propertyId: property.id, label: row.label } });

  if (!row.tenantPhone) return { unit, lease: null, invite: null };

  tenant = tenant
    ? await prisma.tenant.update({
        where: { id: tenant.id },
        data: { name: row.tenantName, ...(row.note !== undefined && { note: row.note }) },
      })
    : await prisma.tenant.create({
        data: { name: row.tenantName, phone: row.tenantPhone, note: row.note ?? null },
      });

  const lease = await prisma.lease.create({
    data: {
      unitId: unit.id,
      tenantId: tenant.id,
      rentAmount: row.amount,
      dueDay: row.dueDay,
      startDate: new Date(),
      active: true,
    },
  });
  const invite = await issuePin({ tenant, property, unitLabel: unit.label });
  return { unit, lease, tenant, invite };
}

// GET /api/properties — landlord's groups, with members and vacant units
router.get(
  '/',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id },
      include: {
        units: {
          include: { leases: { where: { active: true }, include: { tenant: true } } },
          orderBy: { label: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      properties.map((p) => {
        const occupied = p.units.filter((u) => u.leases.length);
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          location: p.location,
          paybill: p.paybill,
          unitCount: p.units.length,
          memberCount: occupied.length,
          members: occupied.map((u) => ({
            unitId: u.id,
            label: u.label,
            amount: u.rentAmount,
            tenantId: u.leases[0].tenant.id,
            tenantName: u.leases[0].tenant.name,
            tenantPhone: u.leases[0].tenant.phone,
            note: u.leases[0].tenant.note,
            pinPending: u.leases[0].tenant.mustChangePassword,
          })),
          vacant: p.units
            .filter((u) => !u.leases.length)
            .map((u) => ({ unitId: u.id, label: u.label, amount: u.rentAmount })),
        };
      })
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
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of ${CATEGORIES.join(', ')}` });
    }
    const cleanPaybill = paybill ? String(paybill).replace(/\D/g, '') : null;
    if (paybill && !/^\d{5,7}$/.test(cleanPaybill)) {
      return res.status(400).json({ error: 'Paybill/Till must be 5–7 digits' });
    }

    const property = await prisma.property.create({
      data: {
        name: String(name).trim(),
        category: category || 'RENT',
        location: location ? String(location).trim() : null,
        paybill: cleanPaybill,
        ownerId: req.user.id,
      },
    });

    res.status(201).json(property);
  })
);

// POST /api/properties/:id/members — add one payer (or one vacant unit) to a group.
// The tenant's phone number is their ID, used for both M-Pesa and tenant login.
// New tenants get a one-time PIN, returned here so the landlord can share it.
router.post(
  '/:id/members',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const property = await findOwnedProperty(req.params.id, req.user.id);
    if (!property) return res.status(404).json({ error: 'Group not found' });

    const { tenantName, tenantPhone, label, amount, ...rest } = req.body;
    const { row, error } = cleanRow({ ...rest, tenantName, tenantPhone, label, amount });
    if (error) return res.status(400).json({ error });

    try {
      const result = await addUnitRow(property, row);
      res.status(201).json({
        unit: result.unit,
        lease: result.lease,
        pin: result.invite?.pin,
        inviteMessage: result.invite?.message,
        whatsapp: result.invite?.whatsapp,
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
  })
);

// POST /api/properties/:id/bulk — add many units at once (generated range,
// pasted list or CSV). Each row is independent: good rows are created, bad
// rows are reported back with their line number so the landlord can fix them.
router.post(
  '/:id/bulk',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const property = await findOwnedProperty(req.params.id, req.user.id);
    if (!property) return res.status(404).json({ error: 'Group not found' });

    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'rows is required' });
    if (rows.length > MAX_BULK_ROWS) {
      return res.status(400).json({ error: `At most ${MAX_BULK_ROWS} rows per import` });
    }

    const created = [];
    const errors = [];
    const seen = new Set();
    for (let i = 0; i < rows.length; i++) {
      const { row, error } = cleanRow(rows[i] || {});
      if (error) {
        errors.push({ line: i + 1, label: rows[i]?.label, error });
        continue;
      }
      const key = row.label.toUpperCase();
      if (seen.has(key)) {
        errors.push({ line: i + 1, label: row.label, error: 'duplicate unit number in this list' });
        continue;
      }
      seen.add(key);
      try {
        const result = await addUnitRow(property, row);
        created.push({
          label: result.unit.label,
          tenantName: result.tenant?.name || null,
          tenantPhone: result.tenant?.phone || null,
          pin: result.invite?.pin || null,
          whatsapp: result.invite?.whatsapp || null,
        });
      } catch (err) {
        if (!err.status) throw err;
        errors.push({ line: i + 1, label: row.label, error: err.message });
      }
    }

    res.status(created.length ? 201 : 200).json({ created, errors });
  })
);

// POST /api/properties/:id/members/:unitId/reset-pin — new one-time PIN for a
// tenant who forgot theirs (or never received the invite).
router.post(
  '/:id/members/:unitId/reset-pin',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const property = await findOwnedProperty(req.params.id, req.user.id);
    if (!property) return res.status(404).json({ error: 'Member not found' });
    const lease = await prisma.lease.findFirst({
      where: { unitId: req.params.unitId, active: true, unit: { propertyId: property.id } },
      include: { tenant: true, unit: true },
    });
    if (!lease) return res.status(404).json({ error: 'Member not found' });

    const invite = await issuePin({ tenant: lease.tenant, property, unitLabel: lease.unit.label, kind: 'PIN_RESET' });
    res.json({ pin: invite.pin, inviteMessage: invite.message, whatsapp: invite.whatsapp });
  })
);

// DELETE /api/properties/:id/members/:unitId — tenant moves out. Deactivates the
// lease (past invoices/payments stay for statements); the unit stays as vacant
// and the tenant's phone number frees up to be re-added elsewhere.
router.delete(
  '/:id/members/:unitId',
  authenticate,
  requireRole('LANDLORD', 'AGENT'),
  asyncHandler(async (req, res) => {
    const property = await findOwnedProperty(req.params.id, req.user.id);
    if (!property) return res.status(404).json({ error: 'Member not found' });
    const lease = await prisma.lease.findFirst({
      where: { unitId: req.params.unitId, active: true, unit: { propertyId: property.id } },
    });
    if (!lease) return res.status(404).json({ error: 'Member not found' });

    await prisma.lease.update({ where: { id: lease.id }, data: { active: false } });
    res.json({ removed: true });
  })
);

module.exports = router;
