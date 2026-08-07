import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { StatusPill } from './StatusPill';
import { Icon } from './Icon';
import { categoryMeta } from '../categories';
import { formatKES, formatPeriod, formatDateTime } from '../format';

export function TenantDetailModal({ tenantId, onClose, onRemoved }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [removing, setRemoving] = useState(false);

  function load() {
    api
      .tenantStatement(token, tenantId)
      .then((d) => {
        setData(d);
        setNote(d.tenant.note || '');
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [token, tenantId]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSaveNote() {
    setSavingNote(true);
    try {
      await api.updateTenantNote(token, tenantId, note);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleRemove() {
    if (!data) return;
    if (!window.confirm(`Remove ${data.tenant.name}? They'll lose access and drop off the board. Past payments are kept.`)) return;
    setRemoving(true);
    try {
      await api.removeMember(token, data.group.id, data.group.unitId);
      onRemoved();
    } catch (e) {
      setError(e.message);
      setRemoving(false);
    }
  }

  const meta = data ? categoryMeta(data.group.category) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" size={16} />
        </button>

        {error && <p className="error-text">{error}</p>}

        {!data && !error && <p className="empty-state">Loading…</p>}

        {data && (
          <>
            <div className="modal-header">
              <span className="category-icon-badge" style={{ background: `${meta.color}1a`, color: meta.color }}>
                <Icon name={meta.icon} size={20} />
              </span>
              <div>
                <h3>{data.tenant.name}</h3>
                <p className="page-subtitle">
                  {data.tenant.phone} · {data.group.name} · {data.group.unitLabel}
                  {!data.active && ' · removed'}
                </p>
              </div>
            </div>

            <div className="metric-row modal-metric-row">
              <div className="metric-card">
                <div className="metric-label">Balance owed</div>
                <div className={`metric-value ${data.balance > 0 ? 'accent-red' : 'accent-green'}`}>
                  {formatKES(data.balance)}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total paid to date</div>
                <div className="metric-value accent-green">{formatKES(data.totalPaid)}</div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="tenant-note">Note</label>
              <div className="note-editor">
                <input
                  id="tenant-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. pays late, prefers SMS reminders"
                />
                <button className="btn-ghost" onClick={handleSaveNote} disabled={savingNote}>
                  {noteSaved ? 'Saved' : savingNote ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <h4 className="modal-section-title">Payment history</h4>
            <div className="statement-list">
              {data.invoices.map((inv) => (
                <div className="statement-invoice" key={inv.id}>
                  <div className="statement-invoice-header">
                    <span className="history-period">{formatPeriod(inv.period)}</span>
                    <StatusPill status={inv.status} />
                    <span className="board-cell-amount">
                      {formatKES(inv.amountPaid)} / {formatKES(inv.amountDue)}
                    </span>
                  </div>
                  {inv.payments.length > 0 && (
                    <div className="statement-payments">
                      {inv.payments.map((p) => (
                        <div className="history-row" key={p.id}>
                          <span className="history-meta">
                            {formatDateTime(p.createdAt)} · {p.method}
                            {p.mpesaReceipt ? ` · ${p.mpesaReceipt}` : ''}
                          </span>
                          <span className="payment-amount">{formatKES(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              {data.active && (
                <button className="btn-ghost danger" onClick={handleRemove} disabled={removing}>
                  {removing ? 'Removing…' : 'Remove payer'}
                </button>
              )}
              <button className="btn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
