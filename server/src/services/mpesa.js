const crypto = require('crypto');

const MPESA_ENV = process.env.MPESA_ENV || 'mock';
const MOCK_DELAY_MS = 4000;

let cachedToken = null; // { token, expiresAt } — sandbox/live only

// Deterministic, not random: the same checkoutId always derives the same receipt,
// with no shared state needed. This matters on serverless, where a background
// setTimeout scheduled during one invocation has no guarantee of surviving to run
// after the response is sent, and a separate poll request may land on a completely
// different (cold) instance with no memory of an in-memory Map. Readiness itself is
// computed from elapsed wall-clock time since the push was initiated (passed in by
// the caller from the Payment row's own createdAt) rather than a scheduled callback.
function mockReceiptFor(checkoutId) {
  const hash = crypto.createHash('sha256').update(checkoutId).digest('hex').toUpperCase();
  return `MOCK${hash.slice(0, 6)}`;
}

function randomCheckoutId() {
  return `mock-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const base = MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString(
    'base64'
  );

  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`);
  const data = await res.json();

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 };
  return cachedToken.token;
}

function darajaTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(
    d.getSeconds()
  )}`;
}

function darajaPassword(timestamp) {
  const raw = `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString('base64');
}

/**
 * Initiates an STK push to the given phone for the given amount.
 * accountRef is the unit label — shown on the tenant's phone as the account being paid.
 * Returns { checkoutId }.
 */
async function stkPush({ phone, amount, accountRef }) {
  if (MPESA_ENV === 'mock') {
    return { checkoutId: randomCheckoutId() };
  }

  const base = MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const token = await getAccessToken();
  const timestamp = darajaTimestamp();
  const shortcode = process.env.MPESA_SHORTCODE;

  const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: darajaPassword(timestamp),
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountRef,
      TransactionDesc: `Rent payment ${accountRef}`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.CheckoutRequestID) {
    throw new Error(data.errorMessage || 'STK push failed');
  }
  return { checkoutId: data.CheckoutRequestID };
}

/**
 * Polls the status of a previously-initiated STK push. In mock mode, pass
 * initiatedAt (the Payment row's createdAt) so readiness can be computed from
 * elapsed time rather than any stored/scheduled state.
 * Returns { status: 'pending' | 'success' | 'failed', receipt?, amount?, phone? }.
 */
async function stkQuery(checkoutId, { initiatedAt } = {}) {
  if (MPESA_ENV === 'mock') {
    const startedAt = initiatedAt ? new Date(initiatedAt).getTime() : Date.now();
    if (Date.now() - startedAt < MOCK_DELAY_MS) return { status: 'pending' };
    return { status: 'success', receipt: mockReceiptFor(checkoutId) };
  }

  const base = MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const token = await getAccessToken();
  const timestamp = darajaTimestamp();
  const shortcode = process.env.MPESA_SHORTCODE;

  const res = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: darajaPassword(timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutId,
    }),
  });
  const data = await res.json();

  if (String(data.ResultCode) === '0') {
    return {
      status: 'success',
      receipt: data.CallbackMetadata?.Item?.find((i) => i.Name === 'MpesaReceiptNumber')?.Value,
      amount: data.CallbackMetadata?.Item?.find((i) => i.Name === 'Amount')?.Value,
    };
  }
  if (data.errorCode || (data.ResultCode !== undefined && String(data.ResultCode) !== '0')) {
    // 1032 = cancelled by user, 1037 = timeout — Daraja still returns these while "pending" in early polls
    if (data.errorCode === '500.001.1001') return { status: 'pending' };
    return { status: 'failed' };
  }
  return { status: 'pending' };
}

module.exports = { stkPush, stkQuery, MPESA_ENV };
