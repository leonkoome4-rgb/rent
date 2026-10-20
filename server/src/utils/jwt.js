const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET is not set — refusing to start without a signing secret');
}
if (SECRET === 'change-me' || SECRET.length < 32) {
  console.warn('JWT_SECRET is weak — set a random value of 32+ characters before real landlords use this');
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
