import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/Illustration';
import { LANDLORD_NAV } from '../nav';
import { formatDateTime } from '../format';

const KIND_LABEL = { INVITE: 'Invite', PIN_RESET: 'New PIN', RECEIPT: 'Receipt', REMINDER: 'Reminder' };
const waLink = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export function Messages() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [kind, setKind] = useState('ALL');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    api.outbox(token).then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, [token]);

  async function remindAll() {
    setSending(true);
    setNotice('');
    try {
      const { sent, skipped } = await api.remindAllUnpaid(token);
      setNotice(
        sent
          ? `Reminders queued for ${sent} tenant${sent === 1 ? '' : 's'}${skipped ? ` (${skipped} already reminded today)` : ''}.`
          : skipped
            ? 'Everyone with a balance was already reminded today.'
            : 'Nobody owes anything right now.'
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const messages = data?.messages.filter((m) => kind === 'ALL' || m.kind === kind) || [];
  const isMock = data?.driver === 'mock';

  return (
    <div>
      <Topbar links={LANDLORD_NAV} />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h3>Messages</h3>
            <p className="page-subtitle">Invites, receipts and rent reminders sent to your tenants.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px' }} disabled={sending} onClick={remindAll}>
              <Icon name="send" size={14} /> {sending ? 'Sending…' : 'Remind all unpaid'}
            </button>
          </div>
        </div>

        {isMock && (
          <div className="notice-banner">
            <Icon name="alertTriangle" size={16} />
            <span>
              SMS isn't connected yet, so messages are saved here but not sent. Use the WhatsApp button to deliver
              any of them now.
            </span>
          </div>
        )}
        {notice && <p className="success-text">{notice}</p>}
        {error && <p className="error-text">{error}</p>}

        <div className="filter-tabs">
          {['ALL', 'REMINDER', 'RECEIPT', 'INVITE', 'PIN_RESET'].map((k) => (
            <button key={k} className={`filter-tab ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
              {k === 'ALL' ? 'All' : KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="card">
          {data && messages.length === 0 && (
            <EmptyState art="inbox" title="No messages yet">
              Receipts go out automatically when rent is paid. Reminders go out before and after the due date.
            </EmptyState>
          )}
          {messages.map((m) => (
            <div className="message-row" key={m.id}>
              <div className="message-row-head">
                <span className={`kind-pill kind-${m.kind.toLowerCase()}`}>{KIND_LABEL[m.kind] || m.kind}</span>
                <span className="payment-tenant">{m.tenantName || m.phone}</span>
                <span className="payment-meta">{formatDateTime(m.sentAt)}</span>
                {m.phone && (
                  <a className="btn-whatsapp btn-small" href={waLink(m.phone, m.message)} target="_blank" rel="noreferrer">
                    <Icon name="message" size={13} /> WhatsApp
                  </a>
                )}
              </div>
              <p className="message-body">{m.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
