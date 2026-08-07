const BASE = '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  landlordLogin: (identifier, password) =>
    request('/auth/login', { method: 'POST', body: { identifier, password } }),
  landlordRegister: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  tenantLogin: (phone, password) =>
    request('/auth/tenant-login', { method: 'POST', body: { phone, password } }),
  whoami: (token) => request('/auth/whoami', { token }),

  // Landlord
  dashboard: (token) => request('/dashboard', { token }),
  board: (token, period) => request(`/board${period ? `?period=${period}` : ''}`, { token }),
  markPaid: (token, invoiceId, { amount, method } = {}) =>
    request(`/invoices/${invoiceId}/mark-paid`, {
      method: 'POST',
      body: { ...(amount ? { amount } : {}), ...(method ? { method } : {}) },
      token,
    }),
  requestPayment: (token, invoiceId) =>
    request(`/invoices/${invoiceId}/request-payment`, { method: 'POST', token }),
  listGroups: (token) => request('/properties', { token }),
  createGroup: (token, payload) => request('/properties', { method: 'POST', body: payload, token }),
  addMember: (token, groupId, payload) =>
    request(`/properties/${groupId}/members`, { method: 'POST', body: payload, token }),
  removeMember: (token, groupId, unitId) =>
    request(`/properties/${groupId}/members/${unitId}`, { method: 'DELETE', token }),
  tenantStatement: (token, tenantId) => request(`/tenants/${tenantId}/statement`, { token }),
  updateTenantNote: (token, tenantId, note) =>
    request(`/tenants/${tenantId}`, { method: 'PATCH', body: { note }, token }),

  // Tenant
  myInvoices: (token) => request('/me/invoices', { token }),
  myPayments: (token) => request('/me/payments', { token }),
  initiateStk: (token, invoiceId, amount) =>
    request('/payments/stk', { method: 'POST', body: { invoiceId, ...(amount ? { amount } : {}) }, token }),

  // Shared (tenant polls their own, landlord polls one they requested)
  paymentStatus: (token, checkoutId) => request(`/payments/${checkoutId}/status`, { token }),
};
