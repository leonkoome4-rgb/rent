const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function monthsAgoPeriod(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function dueDateForPeriod(period, dueDay) {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, dueDay);
}

async function main() {
  console.log('Cleaning existing data...');
  await prisma.payment.deleteMany();
  await prisma.rentInvoice.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding database...');

  const landlordPassword = await bcrypt.hash('password123', 10);
  const landlord = await prisma.user.create({
    data: {
      name: 'Grace Wanjiru',
      phone: '254712000001',
      email: 'landlord@renttrack.dev',
      password: landlordPassword,
      role: 'LANDLORD',
    },
  });

  const properties = await Promise.all([
    prisma.property.create({
      data: {
        name: 'Kileleshwa Court',
        category: 'RENT',
        location: 'Kileleshwa, Nairobi',
        paybill: '400200',
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        name: 'Ruaka Heights',
        category: 'RENT',
        location: 'Ruaka, Kiambu',
        paybill: '400200',
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        name: 'Greenview Academy — Form 2 West',
        category: 'SCHOOL_FEES',
        location: 'Term 2, 2026',
        paybill: '400200',
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        name: 'Baraka Chama',
        category: 'MEMBERSHIP',
        location: 'Monthly contribution',
        paybill: '400200',
        ownerId: landlord.id,
      },
    }),
  ]);

  // [propertyIndex, label, rentAmount, waterCharge, electricityCharge, trashCharge]
  const unitDefs = [
    [0, 'A1', 25000, 500, 800, 200],
    [0, 'A2', 25000, 500, 800, 200],
    [0, 'B1', 30000, 600, 1000, 200],
    [0, 'B2', 30000, 600, 1000, 200],
    [0, 'B3', 32000, 600, 1200, 200],
    [0, 'B4', 32000, 600, 1200, 200],
    [1, 'C1', 18000, 400, 600, 150],
    [1, 'C2', 18000, 400, 600, 150],
    [1, 'C3', 20000, 400, 700, 150],
    [1, 'C4', 20000, 400, 700, 150],
    [2, 'F2W-01', 15000, 0, 0, 0],
    [2, 'F2W-02', 15000, 0, 0, 0],
    [2, 'F2W-03', 15000, 0, 0, 0],
    [3, 'M-01', 2000, 0, 0, 0],
    [3, 'M-02', 2000, 0, 0, 0],
  ];

  const units = [];
  for (const [propIdx, label, rentAmount, waterCharge, electricityCharge, trashCharge] of unitDefs) {
    const unit = await prisma.unit.create({
      data: {
        label,
        rentAmount,
        waterCharge,
        electricityCharge,
        trashCharge,
        propertyId: properties[propIdx].id,
      },
    });
    units.push(unit);
  }

  const tenantDefs = [
    { name: 'John Mwangi', phone: '254712000011' },
    { name: 'Faith Achieng', phone: '254712000012' },
    { name: 'Peter Otieno', phone: '254712000013' },
    { name: 'Mary Njeri', phone: '254712000014' },
    { name: 'Samuel Kiplagat', phone: '254712000015' },
    { name: 'Lucy Wambui', phone: '254712000016' },
    { name: 'Brian Kamau', phone: '254712000017' },
    { name: 'Esther Nyambura', phone: '254712000018' },
    { name: 'David Mutiso', phone: '254712000019' },
    { name: 'Angela Chebet', phone: '254712000020' },
    { name: 'Kevin Otieno', phone: '254712000021' },
    { name: 'Winnie Adhiambo', phone: '254712000022' },
    { name: 'Collins Njoroge', phone: '254712000023' },
    { name: 'Rose Wangari', phone: '254712000024' },
    { name: 'Tom Kariuki', phone: '254712000025' },
  ];

  const tenantPassword = await bcrypt.hash('tenant123', 10);
  const leases = [];
  for (let i = 0; i < tenantDefs.length; i++) {
    const tenant = await prisma.tenant.create({
      data: {
        ...tenantDefs[i],
        password: tenantPassword,
        idNumber: `3${1000000 + i}`,
      },
    });
    const unit = units[i];
    const lease = await prisma.lease.create({
      data: {
        unitId: unit.id,
        tenantId: tenant.id,
        rentAmount: unit.rentAmount,
        dueDay: 5,
        startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 8, 1),
        active: true,
      },
    });
    leases.push({ lease, tenant, unit });
  }

  // Status pattern per tenant across the last 4 months (oldest -> newest, newest = current month).
  const statusPattern = [
    ['PAID', 'PAID', 'PAID', 'PAID'], // John: always pays on time
    ['PAID', 'PAID', 'PAID', 'UNPAID'], // Faith: defaulted this month
    ['PAID', 'PAID', 'PARTIAL', 'UNPAID'], // Peter: falling behind
    ['UNPAID', 'UNPAID', 'UNPAID', 'UNPAID'], // Mary: chronic defaulter
    ['PAID', 'PAID', 'PAID', 'PARTIAL'], // Samuel: partial this month
    ['PAID', 'PAID', 'PAID', 'PAID'], // Lucy: always pays on time
    ['PAID', 'PARTIAL', 'PAID', 'UNPAID'], // Brian: mixed
    ['PAID', 'PAID', 'PAID', 'PAID'], // Esther: always pays on time
    ['UNPAID', 'PAID', 'PAID', 'UNPAID'], // David: mixed
    ['PAID', 'PAID', 'UNPAID', 'PARTIAL'], // Angela: mixed
    ['PAID', 'PAID', 'PAID', 'UNPAID'], // Kevin (school fees): owes this term
    ['PAID', 'PAID', 'PAID', 'PAID'], // Winnie (school fees): paid up
    ['PAID', 'PARTIAL', 'PAID', 'PARTIAL'], // Collins (school fees): part-payer
    ['PAID', 'PAID', 'PAID', 'PAID'], // Rose (chama member): paid up
    ['PAID', 'PAID', 'UNPAID', 'UNPAID'], // Tom (chama member): behind
  ];

  const MONTHS_BACK = 4;
  for (let i = 0; i < leases.length; i++) {
    const { lease, tenant, unit } = leases[i];
    const pattern = statusPattern[i];
    for (let m = MONTHS_BACK - 1; m >= 0; m--) {
      const period = monthsAgoPeriod(m);
      const status = pattern[MONTHS_BACK - 1 - m];
      const amountDue = unit.rentAmount + unit.waterCharge + unit.electricityCharge + unit.trashCharge;
      let amountPaid = 0;
      if (status === 'PAID') amountPaid = amountDue;
      else if (status === 'PARTIAL') amountPaid = Math.round(amountDue * 0.5);

      const invoice = await prisma.rentInvoice.create({
        data: {
          leaseId: lease.id,
          period,
          rentAmount: unit.rentAmount,
          waterCharge: unit.waterCharge,
          electricityCharge: unit.electricityCharge,
          trashCharge: unit.trashCharge,
          amountDue,
          amountPaid,
          status,
          dueDate: dueDateForPeriod(period, lease.dueDay),
        },
      });

      if (amountPaid > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: amountPaid,
            phone: tenant.phone,
            mpesaReceipt: `SEED${invoice.id.slice(-8).toUpperCase()}`,
            method: 'STK',
            status: 'SUCCESS',
          },
        });
      }
    }
  }

  console.log('Seed complete:');
  console.log(`  ${properties.length} groups (2 rent, 1 school fees, 1 membership), ${units.length} slots, ${leases.length} payers, ${MONTHS_BACK} periods of invoices`);
  console.log(`  Landlord login: phone=254712000001 password=password123`);
  console.log(`  Tenant login (John Mwangi, rent, always current): phone=254712000011 password=tenant123`);
  console.log(`  Tenant login (Faith Achieng, rent, owes this month): phone=254712000012 password=tenant123`);
  console.log(`  Tenant login (Kevin Otieno, school fees, owes this term): phone=254712000021 password=tenant123`);
  console.log(`  Tenant login (Tom Kariuki, chama member, behind): phone=254712000025 password=tenant123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
