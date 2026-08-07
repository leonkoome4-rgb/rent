// Vercel serverless entrypoint — wraps the same Express app used for local dev
// (server/src/app.js) so every route behaves identically in both places.
const serverless = require('serverless-http');
const app = require('../server/src/app');

module.exports = serverless(app);
