// End-to-end API tests against the database in DATABASE_URL (use a dev DB —
// every run creates its own landlords/tenants with unique phone numbers).
// Run: npm test
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const prisma = require('../src/prisma');

let server;
let base;
const run = Date.now().toString().slice(-7); // 7 digits → unique phones per run
const phone = (n) => `07${String(n)}${run}`.slice(0, 10);
// Unique per run too: leftover leases from earlier runs on the same Paybill would
// (correctly) make an account number ambiguous.
const paybill = (n) => `${n}${run.slice(-5)}`;

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function registerLandlord(n, paybill) {
  const { body } = await api('/auth/register', {
    method: 'POST',
    body: { name: `Landlord ${n}`, phone: phone(n), password: 'secret12' },
  });
  const token = body.token;
  const prop = await api('/properties', { token, method: 'POST', body: { name: `Block ${n}`, paybill } });
  return { token, propertyId: prop.body.id };
}

before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(async () => {
  server.close();
  await prisma.$disconnect();
});

test('register ignores role=AGENT and normalises the phone', async () => {
  const { status, body } = await api('/auth/register', {
    method: 'POST',
    body: { name: 'Sneaky', phone: `+254 7${run.slice(0, 2)} ${run.slice(2)}9`.slice(0, 17), password: 'secret12', role: 'AGENT' },
  });
  assert.equal(status, 201);
  assert.equal(body.user.role, 'LANDLORD');
  assert.match(body.user.phone, /^2547\d{8}$/);
});

test('bulk import creates 50 units, reports bad rows, issues PINs', async () => {
  const { token, propertyId } = await registerLandlord(1, paybill(1));
  const rows = Array.from({ length: 50 }, (_, i) => ({
    label: `A${i + 1}`,
    amount: '12,000',
    ...(i < 3 && { tenantName: `Tenant ${i}`, tenantPhone: phone(20 + i) }),
  }));
  rows.push({ label: 'A1', amount: 1 }, { label: 'X', amount: 'abc' });

  const { status, body } = await api(`/properties/${propertyId}/bulk`, { token, method: 'POST', body: { rows } });
  assert.equal(status, 201);
  assert.equal(body.created.length, 50);
  assert.deepEqual(body.errors.map((e) => e.line), [51, 52]);
  assert.match(body.created[0].pin, /^\d{4}$/);
  assert.match(body.created[0].whatsapp, /^https:\/\/wa\.me\/2547/);

  const props = await api('/properties', { token });
  assert.equal(props.body[0].unitCount, 50);
  assert.equal(props.body[0].vacant.length, 47);
});

test('Paybill payment to "B4" lands only on the landlord whose Paybill it hit', async () => {
  const a = await registerLandlord(2, paybill(2));
  const b = await registerLandlord(3, paybill(3));
  for (const [l, n] of [[a, 30], [b, 31]]) {
    await api(`/properties/${l.propertyId}/members`, {
      token: l.token,
      method: 'POST',
      body: { label: 'B4', amount: 10000, tenantName: `B4 tenant ${n}`, tenantPhone: phone(n) },
    });
  }

  const res = await api('/mpesa/c2b/confirmation', {
    method: 'POST',
    body: { TransID: `T${run}B4`, TransAmount: '10000.00', BillRefNumber: ' b4 ', MSISDN: '254700000000', BusinessShortCode: paybill(3) },
  });
  assert.equal(res.body.ResultCode, 0);

  const boardA = await api('/board', { token: a.token });
  const boardB = await api('/board', { token: b.token });
  const latest = (board) => board.body.rows[0].cells[board.body.months.at(-1)];
  assert.equal(latest(boardA).status, 'UNPAID');
  assert.equal(latest(boardB).status, 'PAID');

  // Same receipt delivered twice by Daraja → applied once
  await api('/mpesa/c2b/confirmation', {
    method: 'POST',
    body: { TransID: `T${run}B4`, TransAmount: '10000.00', BillRefNumber: 'B4', BusinessShortCode: paybill(3) },
  });
  const payments = await prisma.payment.count({ where: { mpesaReceipt: `T${run}B4` } });
  assert.equal(payments, 1);
});

test('overpayment rolls forward; receipt does not count next month as owed', async () => {
  const l = await registerLandlord(4, paybill(4));
  const added = await api(`/properties/${l.propertyId}/members`, {
    token: l.token,
    method: 'POST',
    body: { label: 'C1', amount: 8000, tenantName: 'Prepayer', tenantPhone: phone(40) },
  });
  assert.equal(added.status, 201);

  const sim = await api('/mpesa/simulate-c2b', {
    token: l.token,
    method: 'POST',
    body: { propertyId: l.propertyId, accountRef: 'C1', amount: 12000 },
  });
  assert.equal(sim.body.matched, true);
  assert.equal(sim.body.periodsCovered.length, 2);

  const outbox = await api('/outbox', { token: l.token });
  const receipt = outbox.body.messages.find((m) => m.kind === 'RECEIPT');
  assert.match(receipt.message, /fully paid up/);
});

test('unknown account number is parked, visible only to that landlord, then assignable', async () => {
  const l = await registerLandlord(5, paybill(5));
  const other = await registerLandlord(6, paybill(6));
  const added = await api(`/properties/${l.propertyId}/members`, {
    token: l.token,
    method: 'POST',
    body: { label: 'D1', amount: 5000, tenantName: 'Typo Payer', tenantPhone: phone(50) },
  });

  await api('/mpesa/c2b/confirmation', {
    method: 'POST',
    body: { TransID: `U${run}`, TransAmount: '5000', BillRefNumber: 'house d one', BusinessShortCode: paybill(5) },
  });

  const mine = await api('/unmatched', { token: l.token });
  const theirs = await api('/unmatched', { token: other.token });
  assert.equal(mine.body.length, 1);
  assert.equal(theirs.body.length, 0);

  const assigned = await api(`/unmatched/${mine.body[0].id}/assign`, {
    token: l.token,
    method: 'POST',
    body: { unitId: added.body.unit.id },
  });
  assert.equal(assigned.body.assigned, true);
  assert.equal((await api('/unmatched', { token: l.token })).body.length, 0);
});

test('tenant signs in with one-time PIN and must then choose their own', async () => {
  const l = await registerLandlord(7, paybill(7));
  const added = await api(`/properties/${l.propertyId}/members`, {
    token: l.token,
    method: 'POST',
    body: { label: 'E1', amount: 5000, tenantName: 'New Tenant', tenantPhone: phone(70) },
  });

  const login = await api('/auth/tenant-login', {
    method: 'POST',
    body: { phone: phone(70), password: added.body.pin },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.mustChangePassword, true);

  const changed = await api('/auth/change-password', {
    token: login.body.token,
    method: 'POST',
    body: { currentPassword: added.body.pin, newPassword: '4321' },
  });
  assert.equal(changed.status, 200);
  const who = await api('/auth/whoami', { token: login.body.token });
  assert.equal(who.body.mustChangePassword, false);

  // Moving out frees the unit and the phone; re-letting the same unit works.
  await api(`/properties/${l.propertyId}/members/${added.body.unit.id}`, { token: l.token, method: 'DELETE' });
  const relet = await api(`/properties/${l.propertyId}/members`, {
    token: l.token,
    method: 'POST',
    body: { label: 'E1', amount: 5500, tenantName: 'Next Tenant', tenantPhone: phone(71) },
  });
  assert.equal(relet.status, 201);
});

test('cron endpoint is closed without the secret; amounts are validated', async () => {
  assert.equal((await api('/cron/daily')).status, 401);
  const l = await registerLandlord(8, paybill(8));
  const sim = await api('/mpesa/simulate-c2b', {
    token: l.token,
    method: 'POST',
    body: { propertyId: l.propertyId, accountRef: 'Z', amount: '1e9' },
  });
  assert.equal(sim.status, 400);
});
