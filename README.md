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
