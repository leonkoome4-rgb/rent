
let prisma;
jest.mock('../src/prisma', () => {
  const { createFakePrisma: make } = require('./helpers/fakePrisma');
  return make();
});

beforeEach(() => {
  jest.resetModules();
  prisma = require('../src/prisma');
  // Fresh in-memory DB for every test.
  Object.assign(prisma._db, { users: [], units: [], tenants: [], leases: [], invoices: [], payments: [] });
});

const applyPayment = (args) => require('../src/services/reconcile').applyPayment(args);

describe('applyPayment — reconciling M-Pesa payments against rent invoices', () => {
  test('exact payment marks the invoice PAID and stores the receipt', async () => {
    const { tenant, invoice } = prisma._seedLease({ rent: 10000 });

    const result = await applyPayment({ tenantId: tenant.id, amount: 10000, receipt: 'QAB123', method: 'STK' });

    expect(result.matched).toBe(true);
    expect(prisma._db.invoices.find((i) => i.id === invoice.id)).toMatchObject({ amountPaid: 10000, status: 'PAID' });
    expect(result.payments).toHaveLength(1);
    expect(result.payment.mpesaReceipt).toBe('QAB123');
  });

  test('underpayment leaves the invoice PARTIAL', async () => {
    const { tenant, invoice } = prisma._seedLease({ rent: 10000 });

    await applyPayment({ tenantId: tenant.id, amount: 4000, receipt: 'QAB124', method: 'STK' });

    expect(prisma._db.invoices.find((i) => i.id === invoice.id)).toMatchObject({ amountPaid: 4000, status: 'PARTIAL' });
  });

  test('overpayment cascades forward into future months', async () => {
    const { tenant } = prisma._seedLease({ rent: 10000, period: '2026-08' });

    const result = await applyPayment({ tenantId: tenant.id, amount: 25000, receipt: 'QAB125', method: 'STK' });

    expect(result.periodsCovered).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(result.invoices.map((i) => i.status)).toEqual(['PAID', 'PAID', 'PARTIAL']);
    expect(result.invoices[2].amountPaid).toBe(5000);
    // Receipts are unique per M-Pesa transaction, so only the first ledger row carries it.
    expect(result.payments.map((p) => p.mpesaReceipt)).toEqual(['QAB125', null, null]);
    expect(result.payments.reduce((sum, p) => sum + p.amount, 0)).toBe(25000);
  });

  test('cascading across December rolls into January of the next year', async () => {
    const { tenant } = prisma._seedLease({ rent: 10000, period: '2026-12' });

    const result = await applyPayment({ tenantId: tenant.id, amount: 20000, receipt: 'QAB126', method: 'STK' });

    expect(result.periodsCovered).toEqual(['2026-12', '2027-01']);
  });

  test('pays the oldest outstanding invoice first', async () => {
    const { tenant, lease } = prisma._seedLease({ rent: 10000, period: '2026-09' });
    prisma._db.invoices.push({ id: 'inv_old', leaseId: lease.id, period: '2026-07', amountDue: 10000, amountPaid: 0, status: 'UNPAID' });

    const result = await applyPayment({ tenantId: tenant.id, amount: 10000, receipt: 'QAB127', method: 'STK' });

    expect(result.periodsCovered).toEqual(['2026-07']);
  });

  test('the same M-Pesa receipt is never applied twice', async () => {
    const { tenant, invoice } = prisma._seedLease({ rent: 10000 });

    await applyPayment({ tenantId: tenant.id, amount: 5000, receipt: 'QAB128', method: 'STK' });
    const second = await applyPayment({ tenantId: tenant.id, amount: 5000, receipt: 'QAB128', method: 'STK' });

    expect(second.duplicate).toBe(true);
    expect(prisma._db.payments).toHaveLength(1);
    expect(prisma._db.invoices.find((i) => i.id === invoice.id).amountPaid).toBe(5000);
  });

  test('a paybill payment is matched to the tenant by unit account reference', async () => {
    const { invoice } = prisma._seedLease({ rent: 10000, label: 'B4' });

    const result = await applyPayment({ accountRef: 'B4', amount: 10000, receipt: 'QAB129', method: 'C2B', phone: '254711111111' });

    expect(result.matched).toBe(true);
    expect(prisma._db.invoices.find((i) => i.id === invoice.id).status).toBe('PAID');
  });

  test('a payment with an unknown account reference is kept as unmatched, not lost', async () => {
    prisma._seedLease({ rent: 10000, label: 'B4' });

    const result = await applyPayment({ accountRef: 'Z99', amount: 3000, receipt: 'QAB130', method: 'C2B', phone: '254722222222' });

    expect(result.matched).toBe(false);
    expect(result.payment).toMatchObject({ amount: 3000, accountRef: 'Z99', status: 'SUCCESS' });
  });

  test('a huge mistyped amount stops after 24 months instead of cascading forever', async () => {
    const { tenant } = prisma._seedLease({ rent: 1000, period: '2026-01' });

    const result = await applyPayment({ tenantId: tenant.id, amount: 1000000, receipt: 'QAB131', method: 'MANUAL' });

    expect(result.periodsCovered).toHaveLength(24);
  });
});
