process.env.JWT_SECRET = 'test-secret';
process.env.MPESA_ENV = 'mock';

jest.mock('../src/prisma', () => {
  const { createFakePrisma } = require('./helpers/fakePrisma');
  return createFakePrisma();
});

const request = require('supertest');
const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');

const landlordToken = signToken({ id: 'u1', role: 'LANDLORD', name: 'Landlord' });

describe('API', () => {
  test('GET /api/health responds ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('protected routes reject requests without a token', async () => {
    const res = await request(app).get('/api/board');
    expect(res.status).toBe(401);
  });

  test('a forged or expired token is rejected', async () => {
    const res = await request(app).get('/api/board').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('only tenants can start an STK push', async () => {
    const res = await request(app)
      .post('/api/payments/stk')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ invoiceId: 'inv_1' });
    expect(res.status).toBe(403);
  });
});
