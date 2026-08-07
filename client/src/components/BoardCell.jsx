import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { StatusPill } from './StatusPill';
import { formatKES } from '../format';

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60000;

// 'idle' | 'requesting' | 'pending' | 'timeout'
export function BoardCell({ cell, onChanged }) {
  const { token } = useAuth();
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const pollTimer = useRef(null);
  const deadline = useRef(null);

  useEffect(() => () => clearTimeout(pollTimer.current), []);

  if (!cell) return <span className="board-cell-amount">—</span>;

  async function handleRequestPayment(e) {
    e.stopPropagation();
    setError('');
    setState('requesting');
    try {
      const { checkoutId } = await api.requestPayment(token, cell.invoiceId);
      setState('pending');
      deadline.current = Date.now() + TIMEOUT_MS;
      poll(checkoutId);
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  }

  function poll(checkoutId) {
    pollTimer.current = setTimeout(async () => {
      try {
        const result = await api.paymentStatus(token, checkoutId);
        if (result.status === 'success') {
          setState('idle');
          onChanged();
          return;
        }
        if (result.status === 'failed') {
          setError('Payment failed or was cancelled.');
          setState('idle');
          return;
        }
        if (Date.now() > deadline.current) {
          setState('timeout');
          return;
        }
        poll(checkoutId);
      } catch (err) {
        setError(err.message);
        setState('idle');
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleMarkPaid(e, method) {
    e.stopPropagation();
    const label = method === 'BANK' ? 'a bank transfer' : 'cash';
    if (!window.confirm(`Mark this as paid in full via ${label}?`)) return;
    setError('');
    try {
      await api.markPaid(token, cell.invoiceId, { method });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (cell.status === 'PAID') {
    return (
      <div className="board-cell">
        <StatusPill status="PAID" />
        <span className="board-cell-amount">
          {formatKES(cell.amountPaid)} / {formatKES(cell.amountDue)}
        </span>
      </div>
    );
  }

  return (
    <div className="board-cell">
      <StatusPill status={cell.status} />
      <span className="board-cell-amount">
        {formatKES(cell.amountPaid)} / {formatKES(cell.amountDue)}
      </span>

      {state === 'idle' && (
        <div className="board-cell-actions">
          <button className="cell-action-btn primary" onClick={handleRequestPayment}>
            Request payment
          </button>
          <div className="cell-action-row">
            <button className="cell-action-btn" onClick={(e) => handleMarkPaid(e, 'CASH')}>
              Cash
            </button>
            <button className="cell-action-btn" onClick={(e) => handleMarkPaid(e, 'BANK')}>
              Bank
            </button>
          </div>
        </div>
      )}

      {state === 'requesting' && <span className="board-cell-status">Sending request…</span>}

      {(state === 'pending' || state === 'timeout') && (
        <div className="board-cell-actions">
          <span className="board-cell-status">
            {state === 'pending' ? (
              <>
                <span className="mini-spinner" /> Waiting on tenant…
              </>
            ) : (
              "Still waiting — hasn't paid yet"
            )}
          </span>
        </div>
      )}

      {error && <span className="board-cell-error">{error}</span>}
    </div>
  );
}
