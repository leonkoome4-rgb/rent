// In-memory stand-in for the Prisma client, covering only the calls the
// services under test make. Lets the money logic be tested without a database.
let seq = 0;
const id = (p) => `${p}_${++seq}`;

function createFakePrisma() {
  const db = { users: [], units: [], tenants: [], leases: [], invoices: [], payments: [] };

  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
      return row[k] === v;
    });

  const prisma = {
    _db: db,
    user: { count: async () => db.users.length },
    lease: {
      findFirst: async ({ where }) => {
        const lease = db.leases.find((l) => matches(l, where));
        if (!lease) return null;
        return {
          ...lease,
          unit: db.units.find((u) => u.id === lease.unitId),
          tenant: db.tenants.find((t) => t.id === lease.tenantId),
        };
      },
    },
    unit: {
      findFirst: async ({ where }) => {
        const unit = db.units.find((u) => matches(u, where));
        if (!unit) return null;
        const lease = db.leases.find((l) => l.unitId === unit.id);
        return {
          ...unit,
          lease: lease ? { ...lease, tenant: db.tenants.find((t) => t.id === lease.tenantId) } : null,
        };
      },
    },
    rentInvoice: {
      findUnique: async ({ where }) => db.invoices.find((i) => i.id === where.id) || null,
      findFirst: async ({ where, orderBy }) => {
        let rows = db.invoices.filter((i) => matches(i, where));
        if (orderBy?.period === 'asc') rows = rows.sort((a, b) => a.period.localeCompare(b.period));
        return rows[0] || null;
      },
      update: async ({ where, data }) => {
        const inv = db.invoices.find((i) => i.id === where.id);
        Object.assign(inv, data);
        return { ...inv };
      },
      upsert: async ({ where, create }) => {
        const { leaseId, period } = where.leaseId_period;
        const existing = db.invoices.find((i) => i.leaseId === leaseId && i.period === period);
        if (existing) return { ...existing };
        const inv = { id: id('inv'), ...create };
        db.invoices.push(inv);
        return { ...inv };
      },
    },
    payment: {
      findUnique: async ({ where }) =>
        db.payments.find((p) => (where.id ? p.id === where.id : p.mpesaReceipt === where.mpesaReceipt)) || null,
      create: async ({ data }) => {
        const row = { id: id('pay'), ...data };
        db.payments.push(row);
        return { ...row };
      },
      update: async ({ where, data }) => {
        const row = db.payments.find((p) => p.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
    },
  };

  // Seeds one tenant on unit "B4" paying KES 10,000/month, with one unpaid invoice.
  prisma._seedLease = ({ rent = 10000, period = '2026-08', label = 'B4' } = {}) => {
    const unit = { id: id('unit'), label, rentAmount: rent, waterCharge: 0, electricityCharge: 0, trashCharge: 0 };
    const tenant = { id: id('ten'), name: 'Test Tenant', phone: '254700000000' };
    const lease = { id: id('lease'), unitId: unit.id, tenantId: tenant.id, rentAmount: rent, dueDay: 5, active: true };
    const invoice = {
      id: id('inv'),
      leaseId: lease.id,
      period,
      amountDue: rent,
      amountPaid: 0,
      status: 'UNPAID',
    };
    db.units.push(unit);
    db.tenants.push(tenant);
    db.leases.push(lease);
    db.invoices.push(invoice);
    return { unit, tenant, lease, invoice };
  };

  return prisma;
}

module.exports = { createFakePrisma };
