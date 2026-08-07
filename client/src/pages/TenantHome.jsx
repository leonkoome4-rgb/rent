import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { StatusPill } from '../components/StatusPill';
import { Icon } from '../components/Icon';
import { formatKES, formatPeriod, formatDateTime } from '../format';
import { categoryMeta } from '../categories';

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60000;

export function TenantHome() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState(null);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  // 'idle' | 'initiating' | 'polling' | 'success' | 'failed' | 'timeout'
  const [payState, setPayState] = useState('idle');
  const [receipt, setReceipt] = useState(null);
  const [periodsCovered, setPeriodsCovered] = useState(null);
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const pollTimer = useRef(null);
  const pollDeadline = useRef(null);

  function loadInvoices() {
    return api.myInvoices(token).then(setInvoices).catch((e) => setError(e.message));
  }
  function loadPayments() {
    api.myPayments(token).then(setPayments).catch(() => {});
  }

  useEffect(() => {
    loadInvoices();
    loadPayments();
    return () => clearTimeout(pollTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handlePay() {
    if (!invoices?.current) return;
    const amount = customAmount ? Number(customAmount) : undefined;
    if (customAmount && !(amount > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setError('');
    setPayState('initiating');
    try {
      const { checkoutId } = await api.initiateStk(token, invoices.current.id, amount);
      setPayState('polling');
      pollDeadline.current = Date.now() + TIMEOUT_MS;
      poll(checkoutId);
    } catch (e) {
      setError(e.message);
      setPayState('idle');
    }
  }

  function poll(checkoutId) {
    pollTimer.current = setTimeout(async () => {
      try {
        const result = await api.paymentStatus(token, checkoutId);
        if (result.status === 'success') {
          setReceipt(result.receipt);
          setPeriodsCovered(result.periodsCovered || null);
          setPayState('success');
          await loadInvoices();
          loadPayments();
          return;
        }
        if (result.status === 'failed') {
          setPayState('failed');
          return;
        }
        if (Date.now() > pollDeadline.current) {
          setPayState('timeout');
          return;
        }
        poll(checkoutId);
      } catch (e) {
        setError(e.message);
        setPayState('idle');
      }
    }, POLL_INTERVAL_MS);
  }

  function reset() {
    clearTimeout(pollTimer.current);
    setPayState('idle');
    setReceipt(null);
    setPeriodsCovered(null);
    setCustomAmount('');
    setShowCustomAmount(false);
  }

  const current = invoices?.current;
  const isPaid = current?.status === 'PAID';
  const meta = categoryMeta(invoices?.unit?.category);

  const payAmount = customAmount ? Number(customAmount) : invoices?.balance || 0;
  const extraPeriodsAhead =
    current && payAmount > 0 ? Math.max(0, Math.floor((payAmount - (current.amountDue - current.amountPaid)) / current.amountDue)) : 0;

  return (
    <div>
      <Topbar />
      <div className="page-body">
        {error && <p className="error-text">{error}</p>}

        {payState === 'idle' && invoices && (
          <>
            <div className="balance-card">
              <div className="balance-label balance-label-icon">
                {invoices.unit ? (
                  <>
                    <Icon name={meta.icon} size={13} />
                    {invoices.unit.property} · {invoices.unit.label}
                  </>
                ) : (
                  'Your account'
                )}
              </div>
              <div className="balance-amount">{formatKES(invoices.balance)}</div>
              <div className="balance-sub">
                {invoices.balance === 0
                  ? "You're all paid up"
                  : `Owed for ${current ? formatPeriod(current.period) : 'this period'}`}
              </div>
              {current && meta.supportsUtilities && (
                <div className="balance-breakdown">
                  <div className="balance-breakdown-item">
                    Rent
                    <strong>{formatKES(current.rentAmount)}</strong>
                  </div>
                  <div className="balance-breakdown-item">
                    Water
                    <strong>{formatKES(current.waterCharge)}</strong>
                  </div>
                  <div className="balance-breakdown-item">
                    Electricity
                    <strong>{formatKES(current.electricityCharge)}</strong>
                  </div>
                  <div className="balance-breakdown-item">
                    Trash
                    <strong>{formatKES(current.trashCharge)}</strong>
                  </div>
                </div>
              )}
            </div>

            {!isPaid && (
              <button className="link-btn" onClick={() => setShowCustomAmount((v) => !v)}>
                {showCustomAmount ? 'Pay the exact amount due instead' : 'Want to pay ahead for future periods?'}
              </button>
            )}

            {!isPaid && showCustomAmount && (
              <div className="card custom-amount-card">
                <label htmlFor="custom-amount">Amount to pay</label>
                <input
                  id="custom-amount"
                  type="number"
                  min="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={String(invoices.balance)}
                />
                {extraPeriodsAhead > 0 && (
                  <p className="field-hint">
                    That's {formatKES(payAmount)} — covers this period plus {extraPeriodsAhead} more ahead.
                  </p>
                )}
              </div>
            )}

            <button className={`pay-button ${isPaid ? 'paid-up' : ''}`} disabled={isPaid} onClick={handlePay}>
              {isPaid ? (
                <span className="inline-icon-text">
                  <Icon name="check" size={15} /> Paid up
                </span>
              ) : (
                `Pay ${meta.primaryLabel.toLowerCase()} — ${formatKES(payAmount)}`
              )}
            </button>

            <div className="card section-gap">
              <h4>Payment history</h4>
              {payments.length === 0 ? (
                <p className="empty-state">No payments yet.</p>
              ) : (
                <div className="history-list">
                  {payments.map((p) => (
                    <div className="history-row" key={p.id}>
                      <div>
                        <div className="history-period">{formatPeriod(p.period)}</div>
                        <div className="history-meta">
                          {formatDateTime(p.createdAt)}
                          {p.mpesaReceipt ? ` · ${p.mpesaReceipt}` : ''} · {p.method}
                        </div>
                      </div>
                      <div>
                        {p.status === 'SUCCESS' ? (
                          <span className="payment-amount">{formatKES(p.amount)}</span>
                        ) : (
                          <StatusPill status={p.status === 'PENDING' ? 'PARTIAL' : 'UNPAID'} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {payState === 'initiating' && (
          <div className="pay-status-box">
            <div className="spinner" />
            <h3>Sending M-Pesa prompt…</h3>
            <p>Requesting payment on your phone.</p>
          </div>
        )}

        {payState === 'polling' && (
          <div className="pay-status-box">
            <div className="spinner" />
            <h3>Check your phone</h3>
            <p>Enter your M-Pesa PIN on the prompt to complete payment of {formatKES(current?.amountDue - current?.amountPaid)}.</p>
          </div>
        )}

        {payState === 'success' && (
          <div className="pay-status-box">
            <div className="success-icon">
              <Icon name="check" size={24} />
            </div>
            <h3>Payment received</h3>
            <p>Receipt {receipt}</p>
            {periodsCovered && periodsCovered.length > 1 && (
              <p>Covers {periodsCovered.length} periods: {periodsCovered.map(formatPeriod).join(', ')}</p>
            )}
            <button className="btn-primary" style={{ maxWidth: 220, margin: '20px auto 0' }} onClick={reset}>
              Done
            </button>
          </div>
        )}

        {payState === 'failed' && (
          <div className="pay-status-box">
            <div className="fail-icon">
              <Icon name="close" size={24} />
            </div>
            <h3>Payment failed</h3>
            <p>The M-Pesa transaction wasn't completed.</p>
            <button className="btn-primary" style={{ maxWidth: 220, margin: '20px auto 0' }} onClick={reset}>
              Try again
            </button>
          </div>
        )}

        {payState === 'timeout' && (
          <div className="pay-status-box">
            <div className="fail-icon">
              <Icon name="alertTriangle" size={22} />
            </div>
            <h3>Still waiting</h3>
            <p>We haven't heard back yet. You can keep waiting or try again.</p>
            <button className="btn-primary" style={{ maxWidth: 220, margin: '20px auto 0' }} onClick={reset}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
