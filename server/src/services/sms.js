const prisma = require('../prisma');

// Only a mock driver for now: messages are recorded in ReminderLog (shown in the
// landlord's Outbox) but not delivered. To go live, add a driver here (e.g.
// Africa's Talking) selected by SMS_DRIVER and set status from its response.
const SMS_DRIVER = process.env.SMS_DRIVER || 'mock';

const ksh = (n) => `KES ${Number(n).toLocaleString('en-KE')}`;

async function send({ to, message, kind, tenantId, landlordId }) {
  return prisma.reminderLog.create({
    data: {
      phone: to,
      message,
      kind,
      tenantId: tenantId || null,
      landlordId: landlordId || null,
      channel: 'SMS',
      status: SMS_DRIVER === 'mock' ? 'MOCK' : 'FAILED',
    },
  });
}

function appUrl() {
  return process.env.APP_URL || 'https://rent-psi-roan.vercel.app';
}

// What the payer is paying, in the words each kind of group uses.
const PAY_WORD = { RENT: 'rent', SCHOOL_FEES: 'school fees', MEMBERSHIP: 'your contribution', OTHER: 'your payment' };

function inviteMessage({ tenantName, propertyName, category, unitLabel, phone, pin, paybill }) {
  const what = PAY_WORD[category] || PAY_WORD.OTHER;
  const payLine = paybill ? ` Pay ${what} via M-Pesa Paybill ${paybill}, account ${unitLabel}.` : '';
  return (
    `Hi ${tenantName.split(' ')[0]}, welcome to ${propertyName} (${unitLabel}).` +
    `${payLine} See your balance & receipts at ${appUrl()}/tenant-login — phone ${phone}, PIN ${pin}.`
  );
}

/** WhatsApp click-to-chat link carrying the same invite, for landlords without an SMS account. */
function whatsappLink(phone, message) {
  return `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

/**
 * Sends a receipt for a reconciled payment. Called by applyPayment so every
 * path (STK, C2B, cash/bank) produces one. Never throws — a failed message
 * must not roll back a recorded payment.
 */
async function sendReceipt({ lease, amount, receipt, periodsCovered, balance }) {
  try {
    const property = lease.unit.property || (await prisma.property.findUnique({ where: { id: lease.unit.propertyId } }));
    const periods = periodsCovered?.length ? ` for ${periodsCovered.join(', ')}` : '';
    const ref = receipt ? ` Ref ${receipt}.` : '';
    const bal = balance > 0 ? ` Balance ${ksh(balance)}.` : ' You are fully paid up. Asante!';
    await send({
      to: lease.tenant.phone,
      kind: 'RECEIPT',
      tenantId: lease.tenantId,
      landlordId: property?.ownerId,
      message: `${property?.name || 'Payment'} ${lease.unit.label}: received ${ksh(amount)}${periods}.${ref}${bal}`,
    });
  } catch (err) {
    console.error('Receipt SMS failed:', err);
  }
}

module.exports = { send, sendReceipt, inviteMessage, whatsappLink, ksh, SMS_DRIVER };
