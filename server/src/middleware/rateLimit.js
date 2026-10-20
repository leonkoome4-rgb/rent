// Small in-memory limiter for login endpoints. On Vercel each warm instance
// keeps its own counts, so this slows brute-forcing rather than hard-capping it;
// swap for a shared store (e.g. Upstash) if that ever matters.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const hits = new Map(); // key -> { count, resetAt }

function rateLimit(keyFn) {
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10000) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    }
    const key = `${req.ip}|${keyFn(req)}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return next();
    }
    entry.count += 1;
    if (entry.count > MAX_ATTEMPTS) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }
    next();
  };
}

module.exports = { rateLimit };
