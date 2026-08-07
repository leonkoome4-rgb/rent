import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { BoardCell } from '../components/BoardCell';
import { Icon } from '../components/Icon';
import { TenantDetailModal } from '../components/TenantDetailModal';
import { formatPeriod } from '../format';
import { categoryMeta } from '../categories';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/board', label: 'Board' },
  { to: '/groups', label: 'Groups' },
];

export function Board() {
  const { token } = useAuth();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedTenantId, setSelectedTenantId] = useState(null);

  function load() {
    api.board(token).then(setBoard).catch((e) => setError(e.message));
  }

  useEffect(load, [token]);

  const categoriesPresent = useMemo(() => {
    if (!board) return [];
    return [...new Set(board.rows.map((r) => r.propertyCategory))];
  }, [board]);

  const rows = useMemo(() => {
    if (!board) return [];
    return filter === 'ALL' ? board.rows : board.rows.filter((r) => r.propertyCategory === filter);
  }, [board, filter]);

  return (
    <div>
      <Topbar links={NAV_LINKS} />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h3>Payments board</h3>
            <p className="page-subtitle">
              Green = paid, amber = partial, red = unpaid. Click a name for their history. Request payment sends an
              M-Pesa prompt straight to their phone.
            </p>
          </div>
          <button className="btn-ghost print-btn" onClick={() => window.print()}>
            <Icon name="printer" size={14} /> Print
          </button>
        </div>

        <p className="print-only-title">
          Printed {new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {error && <p className="error-text">{error}</p>}

        {categoriesPresent.length > 1 && (
          <div className="filter-tabs">
            <button className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
              All
            </button>
            {categoriesPresent.map((cat) => {
              const meta = categoryMeta(cat);
              return (
                <button key={cat} className={`filter-tab ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>
                  <Icon name={meta.icon} size={13} /> {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {board && (
          <div className="board-scroll">
            <table className="board-table">
              <thead>
                <tr>
                  <th>Payer</th>
                  {board.months.map((m) => (
                    <th key={m}>{formatPeriod(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.tenantId}>
                    <td>
                      <button className="board-tenant-cell board-tenant-btn" onClick={() => setSelectedTenantId(row.tenantId)}>
                        <span className="board-tenant-name">{row.tenantName}</span>
                        <span className="board-unit-label board-unit-label-icon">
                          <Icon name={categoryMeta(row.propertyCategory).icon} size={12} />
                          {row.propertyName} · {row.unitLabel}
                        </span>
                      </button>
                    </td>
                    {board.months.map((m) => (
                      <td key={m}>
                        <BoardCell cell={row.cells[m]} onChanged={load} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTenantId && (
        <TenantDetailModal
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onRemoved={() => {
            setSelectedTenantId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
