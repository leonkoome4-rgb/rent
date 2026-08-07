// Vercel serverless entrypoint — Express apps are already valid (req, res)
// handlers, matching Vercel's Node.js function signature directly, so the
// same app used for local dev (server/src/app.js) can be exported as-is.
// (No serverless-http here: that wraps for AWS Lambda's separate
// event/context/callback shape, which is not what Vercel's runtime calls.)
module.exports = require('../server/src/app');
