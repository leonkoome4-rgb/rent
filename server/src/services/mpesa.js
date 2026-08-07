const MPESA_ENV = process.env.MPESA_ENV || 'mock';

// In-memory store for mock mode: checkoutId -> { status, receipt, amount, phone, accountRef, createdAt }
const mockTransactions = new Map();

let cachedToken = null; // { token, expiresAt } — sandbox/live only

function randomReceipt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = 'MOCK';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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
    const checkoutId = randomCheckoutId();
    mockTransactions.set(checkoutId, { status: 'PENDING', phone, amount, accountRef, createdAt: Date.now() });
    setTimeout(() => {
      const tx = mockTransactions.get(checkoutId);
      if (tx && tx.status === 'PENDING') {
        tx.status = 'SUCCESS';
        tx.receipt = randomReceipt();
      }
    }, 4000);
    return { checkoutId };
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
 * Polls the status of a previously-initiated STK push.
 * Returns { status: 'pending' | 'success' | 'failed', receipt?, amount?, phone? }.
 */
async function stkQuery(checkoutId) {
  if (MPESA_ENV === 'mock') {
    const tx = mockTransactions.get(checkoutId);
    if (!tx) return { status: 'failed' };
    if (tx.status === 'PENDING') return { status: 'pending' };
    return { status: 'success', receipt: tx.receipt, amount: tx.amount, phone: tx.phone };
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
