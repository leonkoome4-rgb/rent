const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { signToken } = require('../utils/jwt');
const { normalizePhone } = require('../utils/validate');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

const MIN_PASSWORD = 6;
const userJson = (u) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role });

// POST /api/auth/register — landlord self-registration. Agents are not
// self-serve: they'll be invited by a landlord onto specific properties.
router.post(
  '/register',
  rateLimit((req) => `register|${req.body?.phone}`),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!name || !String(name).trim() || !req.body.phone || !password) {
      return res.status(400).json({ error: 'name, phone and password are required' });
    }
    if (!phone) return res.status(400).json({ error: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' });
    if (String(password).length < MIN_PASSWORD) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
    }
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ phone }, ...(cleanEmail ? [{ email: cleanEmail }] : [])] },
    });
    if (existing) return res.status(409).json({ error: 'An account with this phone or email already exists' });

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        phone,
        email: cleanEmail,
        password: await bcrypt.hash(String(password), 10),
        role: 'LANDLORD',
      },
    });

    const token = signToken({ id: user.id, role: user.role, name: user.name });
    res.status(201).json({ token, user: userJson(user) });
  })
);

// POST /api/auth/login — landlord/agent, by phone or email
router.post(
  '/login',
  rateLimit((req) => `login|${req.body?.identifier}`),
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier and password are required' });
    }

    const raw = String(identifier).trim();
    const phone = normalizePhone(raw);
    const user = await prisma.user.findFirst({
      where: { OR: [{ phone: phone || raw }, { email: raw.toLowerCase() }] },
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(String(password), user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, role: user.role, name: user.name });
    res.json({ token, user: userJson(user) });
  })
);

// POST /api/auth/tenant-login — phone + PIN/password
router.post(
  '/tenant-login',
  rateLimit((req) => `tenant|${req.body?.phone}`),
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    if (!req.body.phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }
    const phone = normalizePhone(req.body.phone) || String(req.body.phone).trim();

    const tenant = await prisma.tenant.findUnique({ where: { phone } });
    if (!tenant || !tenant.password) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(String(password), tenant.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: tenant.id, role: 'TENANT', name: tenant.name });
    res.json({
      token,
      tenant: { id: tenant.id, name: tenant.name, phone: tenant.phone, email: tenant.email, role: 'TENANT' },
      mustChangePassword: tenant.mustChangePassword,
    });
  })
);

// POST /api/auth/change-password — any signed-in user. Tenants on a one-time
// PIN use this to choose their own; it clears mustChangePassword.
router.post(
  '/change-password',
  authenticate,
  rateLimit((req) => `change|${req.user?.id}`),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const isTenant = req.user.role === 'TENANT';
    const min = isTenant ? 4 : MIN_PASSWORD;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (String(newPassword).length < min) {
      return res.status(400).json({ error: `New ${isTenant ? 'PIN' : 'password'} must be at least ${min} characters` });
    }

    const model = isTenant ? prisma.tenant : prisma.user;
    const record = await model.findUnique({ where: { id: req.user.id } });
    if (!record?.password || !(await bcrypt.compare(String(currentPassword), record.password))) {
      return res.status(401).json({ error: `Current ${isTenant ? 'PIN' : 'password'} is incorrect` });
    }
    if (String(newPassword) === String(currentPassword)) {
      return res.status(400).json({ error: 'Choose a different one from the current' });
    }

    await model.update({
      where: { id: req.user.id },
      data: {
        password: await bcrypt.hash(String(newPassword), 10),
        ...(isTenant && { mustChangePassword: false }),
      },
    });
    res.json({ ok: true });
  })
);

module.exports = router;
