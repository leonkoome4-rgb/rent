import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { EmptyState } from '../components/Illustration';
import { LANDLORD_NAV } from '../nav';
import { formatKES, formatDateTime, formatPeriod } from '../format';

function AssignRow({ payment, units, onAssigned }) {
  const { token } = useAuth();
  const [unitId, setUnitId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function assign() {
    setBusy(true);
    setError('');
    try {
      await api.assignPayment(token, payment.id, unitId);
      onAssigned();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="unmatched-row">
      <div className="payment-row-main">
        <span className="payment-tenant">
          {formatKES(payment.amount)} · account typed: <strong>“{payment.accountRef || '—'}”</strong>
        </span>
        <span className="payment-meta">
          {formatDateTime(payment.createdAt)} · {payment.phone} · {payment.mpesaReceipt} · Paybill {payment.shortcode}
        </span>
        {error && <span className="error-text">{error}</span>}
      </div>
      <div className="unmatched-actions">
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Assign to unit">
          <option value="">Belongs to…</option>
          {units.map((u) => (
            <option key={u.unitId} value={u.unitId}>
              {u.propertyName} · {u.label} · {u.tenantName}
            </option>
          ))}
        </select>
        <button className="btn-primary btn-small" disabled={!unitId || busy} onClick={assign}>
          {busy ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </div>
  );
}

function SimulatePaybill({ groups, onDone }) {
  const { token } = useAuth();
  const withPaybill = groups.filter((g) => g.paybill);
  const [propertyId, setPropertyId] = useState('');
  const [accountRef, setAccountRef] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const pid = propertyId || withPaybill[0]?.id || '';
  const paybill = withPaybill.find((g) => g.id === pid)?.paybill;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      const res = await api.simulatePaybill(token, { propertyId: pid, accountRef, amount });
      setResult(res);
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!withPaybill.length) {
    return <p className="field-hint">Add a Paybill number to a property to try a test payment.</p>;
  }

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <div className="field">
          <label>Property</label>
          <select value={pid} onChange={(e) => setPropertyId(e.target.value)}>
            {withPaybill.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} (Paybill {g.paybill})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Account number typed</label>
          <input value={accountRef} onChange={(e) => setAccountRef(e.target.value)} placeholder="A1" />
        </div>
        <div className="field">
          <label>Amount (KSh)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {result && (
        <p className={result.matched ? 'success-text' : 'error-text'}>
          {result.matched
            ? `Matched and receipted (${result.receipt}). Covered ${result.periodsCovered.map(formatPeriod).join(', ')}.`
            : `No unit "${accountRef}" on Paybill ${paybill}. It's waiting in the inbox above.`}
        </p>
      )}
      <button className="btn-ghost" type="submit" disabled={!accountRef || !amount}>
        Send test Paybill payment
      </button>
    </form>
  );
}

export function Payments() {
  const { token } = useAuth();
  const [unmatched, setUnmatched] = useState(null);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');

  function load() {
    api.unmatchedPayments(token).then(setUnmatched).catch((e) => setError(e.message));
    api.listGroups(token).then(setGroups).catch(() => {});
  }
  useEffect(load, [token]);

  const units = groups.flatMap((g) => g.members.map((m) => ({ ...m, propertyName: g.name })));

  return (
    <div>
      <Topbar links={LANDLORD_NAV} />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h3>Payments</h3>
            <p className="page-subtitle">Paybill payments that need you: the account number didn't match any unit.</p>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}

        <div className="card section-gap">
          <h4>Needs assigning</h4>
          {unmatched && unmatched.length === 0 && (
            <EmptyState art="allPaid" title="Nothing to sort out">
              Every Paybill payment was matched to a unit automatically.
            </EmptyState>
          )}
          {unmatched?.map((p) => (
            <AssignRow key={p.id} payment={p} units={units} onAssigned={load} />
          ))}
        </div>

        <div className="card">
          <h4>Try a test Paybill payment</h4>
          <p className="field-hint" style={{ marginTop: -8 }}>
            Shows what happens when a tenant pays your Paybill from their M-Pesa menu. Good for showing a landlord how
            it works. Test mode only, no real money moves.
          </p>
          <SimulatePaybill groups={groups} onDone={load} />
        </div>
      </div>
    </div>
  );
}
