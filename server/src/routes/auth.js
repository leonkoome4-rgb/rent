const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { signToken } = require('../utils/jwt');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

// POST /api/auth/register — landlord (or agent) self-registration
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'name, phone and password are required' });
    }
    if (role && !['LANDLORD', 'AGENT'].includes(role)) {
      return res.status(400).json({ error: 'role must be LANDLORD or AGENT' });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return res.status(409).json({ error: 'Phone already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, phone, email: email || null, password: hashed, role: role || 'LANDLORD' },
    });

    const token = signToken({ id: user.id, role: user.role, name: user.name });
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
    });
  })
);

// POST /api/auth/login — landlord/agent, by phone or email
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ phone: identifier }, { email: identifier }] },
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, role: user.role, name: user.name });
    res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
    });
  })
);

// POST /api/auth/tenant-login — phone + password
router.post(
  '/tenant-login',
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { phone } });
    if (!tenant || !tenant.password) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, tenant.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: tenant.id, role: 'TENANT', name: tenant.name });
    res.json({
      token,
      tenant: { id: tenant.id, name: tenant.name, phone: tenant.phone, email: tenant.email, role: 'TENANT' },
    });
  })
);

module.exports = router;
