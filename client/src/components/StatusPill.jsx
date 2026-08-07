const LABELS = { PAID: 'Paid', PARTIAL: 'Partial', UNPAID: 'Unpaid' };

export function StatusPill({ status }) {
  return <span className={`status-pill status-${status?.toLowerCase()}`}>{LABELS[status] || status}</span>;
}
