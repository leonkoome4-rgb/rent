// Local dev entrypoint only — starts a long-running server with app.listen().
// On Vercel, api/index.js imports src/app.js directly and wraps it with
// serverless-http instead; this file is never used in that path.
const app = require('./app');

// Last-resort net for local dev: log and keep the process alive rather than
// dying silently. Not attached in the serverless path (app.js), where a global
// process-level listener doesn't make sense across invocations.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`RentTrack server listening on http://localhost:${PORT}`);
});
