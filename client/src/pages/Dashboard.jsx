import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { formatKES, formatDateTime } from '../format';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/board', label: 'Board' },
  { to: '/groups', label: 'Groups' },
];

export function Dashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  return (
    <div>
      <Topbar links={NAV_LINKS} />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h3>Dashboard</h3>
            <p className="page-subtitle">This month at a glance</p>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {data && (
          <>
            <div className="metric-row">
              <div className="metric-card">
                <div className="metric-icon accent-green">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9 12.5l2 2 4-4.5" />
                  </svg>
                </div>
                <div>
                  <div className="metric-label">Collected this month</div>
                  <div className="metric-value accent-green">{formatKES(data.collected)}</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon accent-red">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v4" />
                    <path d="M10.3 3.9l-8 14A1.5 1.5 0 0 0 3.6 20h16.8a1.5 1.5 0 0 0 1.3-2.1l-8-14a1.5 1.5 0 0 0-2.6 0z" />
                    <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div className="metric-label">Outstanding</div>
                  <div className="metric-value accent-red">{formatKES(data.outstanding)}</div>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 21V8l8-5 8 5v13" />
                    <path d="M9 21v-6h6v6" />
                  </svg>
                </div>
                <div>
                  <div className="metric-label">Occupancy</div>
                  <div className="metric-value">
                    {data.occupancy}%{' '}
                    <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
                      ({data.unitsOccupied}/{data.unitsTotal})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h4>Recent payments</h4>
              {data.recentPayments.length === 0 ? (
                <p className="empty-state">No payments recorded yet this month.</p>
              ) : (
                <div>
                  {data.recentPayments.map((p) => (
                    <div className="payment-row" key={p.id}>
                      <div className="payment-row-main">
                        <span className="payment-tenant">
                          {p.tenantName} · {p.unitLabel}
                          {p.autoMatched && <span className="auto-tag">auto-matched via M-Pesa</span>}
                        </span>
                        <span className="payment-meta">
                          {formatDateTime(p.createdAt)}
                          {p.mpesaReceipt ? ` · ${p.mpesaReceipt}` : ''}
                        </span>
                      </div>
                      <span className="payment-amount">+{formatKES(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
