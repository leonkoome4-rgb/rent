// Runs the M-Pesa service in its built-in mock mode, so no Safaricom keys are needed.
process.env.MPESA_ENV = 'mock';
const { stkPush, stkQuery } = require('../src/services/mpesa');

describe('M-Pesa service (mock mode)', () => {
  test('stkPush returns a checkout id', async () => {
    const { checkoutId } = await stkPush({ phone: '254700000000', amount: 100, accountRef: 'B4' });
    expect(checkoutId).toMatch(/^mock-ws-/);
  });

  test('a just-started push is still pending', async () => {
    const result = await stkQuery('mock-ws-1', { initiatedAt: new Date() });
    expect(result).toEqual({ status: 'pending' });
  });

  test('after the delay it succeeds with a receipt', async () => {
    const result = await stkQuery('mock-ws-1', { initiatedAt: new Date(Date.now() - 10000) });
    expect(result.status).toBe('success');
    expect(result.receipt).toMatch(/^MOCK[0-9A-F]{6}$/);
  });

  test('the receipt is deterministic per checkout id (safe across serverless instances)', async () => {
    const past = new Date(Date.now() - 10000);
    const a = await stkQuery('mock-ws-abc', { initiatedAt: past });
    const b = await stkQuery('mock-ws-abc', { initiatedAt: past });
    const c = await stkQuery('mock-ws-xyz', { initiatedAt: past });
    expect(a.receipt).toBe(b.receipt);
    expect(a.receipt).not.toBe(c.receipt);
  });
});
