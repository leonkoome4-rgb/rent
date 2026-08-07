const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/auth/whoami — resolves the current JWT to a fresh user/tenant record
router.get(
  '/whoami',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'TENANT') {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user.id } });
      if (!tenant) return res.status(404).json({ error: 'Not found' });
      return res.json({ id: tenant.id, name: tenant.name, phone: tenant.phone, email: tenant.email, role: 'TENANT' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role });
  })
);

module.exports = router;
