# RentTrack

Rent tracking for Kenyan landlords, with M-Pesa payments. Local-only for now.

## Structure

```
rent/
├── server/           Node + Express + Prisma + PostgreSQL API
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   ├── src/
│   │   ├── index.js  Express entrypoint
│   │   └── prisma.js Shared PrismaClient instance
│   └── .env           (gitignored — copy from .env.example)
└── client/            React (Vite) frontend
    └── vite.config.js Proxies /api to http://localhost:5001
```

## Phase 1 — DB & seed (done)

```bash
cd server
npm install
npm run prisma:migrate   # applies migrations against DATABASE_URL
npm run seed              # seeds a landlord, 1 property, 6 units, 6 tenants, 3 months of invoices
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

Note: the app listens on port **5001**, not 5000 — macOS AirPlay Receiver occupies 5000 by default on this machine.

## Onboarding a building

1. A landlord signs up at `/register` and is taken to the setup wizard (`/onboarding`).
2. The wizard creates the building (with its Paybill/Till), then adds every unit at once, either by generating a range (`A1–A40`) or by pasting/uploading a list (`unit, rent, tenant name, phone`, copied from Excel). Units without a tenant are saved as vacant.
3. Each new tenant gets a one-time 4-digit PIN. The landlord shares it by WhatsApp or by printing invite slips. On first login the tenant has to choose their own PIN.

## Payments

- **Paybill (C2B):** `POST /api/mpesa/c2b/confirmation` matches by **Paybill + account number** (case and spaces are ignored), falling back to the payer's phone. Money that doesn't match exactly one active unit is saved as `UNMATCHED` and appears on the landlord's **Payments** page to assign.
- **STK push:** confirmed by `POST /api/mpesa/stk-callback` or by client polling, whichever arrives first. Both paths are idempotent on the M-Pesa receipt.
- Every recorded payment (STK, Paybill, cash, bank) generates a receipt message.
- In `MPESA_ENV=mock`, the Payments page can send a test Paybill payment.

## Messages

`SMS_DRIVER=mock` (the only driver so far) saves invites, receipts and reminders to the **Messages** page without sending them. Each message has a WhatsApp button. Reminders go out 3 days before the due date, on the due date, and 3/7/14 days late. They are sent by Vercel Cron (`/api/cron/daily`, which needs `CRON_SECRET`) or by the "Remind all unpaid" button. To send real SMS, add a driver in `server/src/services/sms.js`.

## Tests

```bash
cd server
npm test   # API tests against DATABASE_URL; use a dev database (creates its own test landlords)
```

Photos in `client/public/images` are used under the Unsplash License; see `CREDITS.md` there.
