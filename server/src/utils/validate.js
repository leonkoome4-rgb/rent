const MAX_AMOUNT = 10_000_000; // KES — guards against typos like an extra few zeros

/** Parses a whole-shilling amount. Returns null if missing/invalid/out of range. */
function parseAmount(value, { allowZero = false } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[,\s]/g, ''));
  if (!Number.isInteger(n) || n > MAX_AMOUNT) return null;
  if (n < 0 || (!allowZero && n === 0)) return null;
  return n;
}

/**
 * Normalises a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX, the format
 * M-Pesa uses. Accepts 07.., 01.., +254.., 254.. with spaces/dashes. Returns
 * null if it doesn't look like a Kenyan mobile.
 */
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  let local;
  if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^[17]\d{8}$/.test(digits)) local = digits;
  else return null;
  return `254${local}`;
}

module.exports = { parseAmount, normalizePhone, MAX_AMOUNT };
