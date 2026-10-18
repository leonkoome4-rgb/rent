# RentTrack

![CI](https://github.com/leonkoome4-rgb/rent/actions/workflows/ci.yml/badge.svg)

**Collect rent, school fees or group contributions by M-Pesa — and always know who has paid.**

**Live demo:** https://rent-psi-roan.vercel.app · Payments run in mock M-Pesa mode on the demo, so no real money moves.

## Why I built it

Kenyan landlords, school bursars and chama treasurers still track payments in notebooks and WhatsApp threads. RentTrack gives them one colour-coded board that updates itself when an M-Pesa payment lands, and gives payers a simple portal where they log in with their phone number and pay by STK Push.

## Features

- **Phone-number login** for payers, and an M-Pesa **STK Push** to pay from their phone
- **Automatic reconciliation** — each payment is matched to the payer's oldest unpaid invoice (and can match paybill payments by unit/account reference)
- **Pay ahead** — overpayments cascade forward and mark future months as paid (capped at 24 months to protect against typos)
- **Idempotent** — the same M-Pesa receipt can never be applied twice
- **Landlord board** — colour-coded paid / partial / unpaid grid, payment requests, manual cash or bank entries, and full payer history
- **One flexible model** for rentals, school fees and memberships (`PropertyCategory`)
- **Mock M-Pesa mode** that is deterministic and stateless, so it works reliably on serverless hosting

## Tech stack

React (Vite) · Node.js · Express · PostgreSQL · Prisma · JWT auth · M-Pesa Daraja API · Jest + Supertest · GitHub Actions · Vercel (serverless)

## How a payment flows

```
Tenant taps "Pay"  →  POST /api/payments/stk  →  Daraja STK Push  →  phone prompt
                                                                      │
Board updates  ←  applyPayment() reconciles invoices  ←  payment confirmed (STK Query)
```

The reconciliation logic lives in [`server/src/services/reconcile.js`](server/src/services/reconcile.js) and is shared by STK Push and the landlord's manual mark-paid action. It already supports paybill (C2B) payments matched by account reference, ready for a confirmation webhook.

## Tests

17 tests run on every push via GitHub Actions — no database needed (an in-memory fake stands in for Prisma).

```bash
cd server
npm test               # run the suite
npm run test:coverage  # with coverage
```

What's covered: exact, partial and over-payments; cascading across December into January; oldest-invoice-first; duplicate receipts; paybill matching by account reference; unmatched payments; the 24-month safety cap; the mock M-Pesa flow; JWT auth and role checks.

## Run it locally

```bash
cd server
cp .env.example .env       # set DATABASE_URL and JWT_SECRET; MPESA_ENV=mock needs no Safaricom keys
npm install
npm run prisma:migrate     # applies migrations against DATABASE_URL
npm run seed               # a landlord, 1 property, 6 units, 6 tenants, 3 months of invoices
npm run dev                # http://localhost:5001/api/health
```

```bash
cd client
npm install
npm run dev                # http://localhost:5173
```

Seeded logins:
- Landlord: phone `254712000001`, password `password123`
- Tenant (John Mwangi): phone `254712000011`, password `tenant123`

The API listens on port **5001** (macOS AirPlay Receiver uses 5000).

## Project structure

```
rent/
├── api/                   Vercel serverless entry (wraps the Express app)
├── server/
│   ├── prisma/            schema, migrations, seed
│   ├── src/
│   │   ├── app.js         Express app and routes
│   │   ├── services/      reconcile.js, mpesa.js, invoices.js
│   │   ├── routes/        auth, board, payments, invoices, properties, tenants…
│   │   └── middleware/    JWT auth, async error handling
│   └── tests/             Jest + Supertest
└── client/                React (Vite) frontend
```

## What I'd build next

- SMS reminders for overdue payers
- Live Daraja callbacks and a C2B confirmation webhook (currently polls STK Query)
- Monthly PDF statements per payer

Built by [Leon Koome](https://leon-virid.vercel.app).
