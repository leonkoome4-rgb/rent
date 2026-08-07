import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { Icon } from '../components/Icon';
import { CATEGORIES, categoryMeta } from '../categories';
import { formatKES } from '../format';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/board', label: 'Board' },
  { to: '/groups', label: 'Groups' },
];

function NewGroupForm({ onCreated, onCancel }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('RENT');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createGroup(token, { name, category, location: location || undefined });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
      <h4>New group</h4>
      {error && <p className="error-text">{error}</p>}

      <div className="field">
        <label>What kind of group is this?</label>
        <div className="category-picker">
          {Object.entries(CATEGORIES).map(([key, meta]) => (
            <button
              type="button"
              key={key}
              className={`category-option ${category === key ? 'selected' : ''}`}
              onClick={() => setCategory(key)}
            >
              <span className="category-icon" style={{ color: meta.color }}>
                <Icon name={meta.icon} size={15} />
              </span>
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            category === 'RENT' ? 'Kileleshwa Court' : category === 'SCHOOL_FEES' ? 'Form 2 West' : 'Baraka Chama'
          }
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="group-location">Location / note (optional)</label>
        <input id="group-location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" type="submit" disabled={saving || !name}>
          {saving ? 'Creating…' : 'Create group'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddMemberForm({ group, onAdded, onCancel }) {
  const { token } = useAuth();
  const meta = categoryMeta(group.category);
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [waterCharge, setWaterCharge] = useState('');
  const [electricityCharge, setElectricityCharge] = useState('');
  const [trashCharge, setTrashCharge] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.addMember(token, group.id, {
        tenantName,
        tenantPhone,
        label,
        amount: Number(amount),
        waterCharge: meta.supportsUtilities ? Number(waterCharge) || 0 : 0,
        electricityCharge: meta.supportsUtilities ? Number(electricityCharge) || 0 : 0,
        trashCharge: meta.supportsUtilities ? Number(trashCharge) || 0 : 0,
        note: note || undefined,
      });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card add-member-form" onSubmit={handleSubmit}>
      <h4>Add {meta.memberNoun}</h4>
      {error && <p className="error-text">{error}</p>}

      <div className="field-row">
        <div className="field">
          <label>Name</label>
          <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Phone (M-Pesa)</label>
          <input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="2547XXXXXXXX" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>{meta.identifierLabel}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={meta.identifierPlaceholder} />
        </div>
        <div className="field">
          <label>{meta.amountLabel}</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>

      {meta.supportsUtilities && (
        <div className="field-row">
          <div className="field">
            <label>Water (KSh)</label>
            <input type="number" value={waterCharge} onChange={(e) => setWaterCharge(e.target.value)} />
          </div>
          <div className="field">
            <label>Electricity (KSh)</label>
            <input type="number" value={electricityCharge} onChange={(e) => setElectricityCharge(e.target.value)} />
          </div>
          <div className="field">
            <label>Trash (KSh)</label>
            <input type="number" value={trashCharge} onChange={(e) => setTrashCharge(e.target.value)} />
          </div>
        </div>
      )}

      <div className="field">
        <label>Note (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. pays late, prefers SMS reminders" />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" type="submit" disabled={saving || !tenantName || !tenantPhone || !label || !amount}>
          {saving ? 'Adding…' : `Add ${meta.memberNoun}`}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="field-hint">New members can log in to the tenant portal with this phone number and password "tenant123".</p>
    </form>
  );
}

export function Groups() {
  const { token } = useAuth();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [addingMemberTo, setAddingMemberTo] = useState(null);
  const [filter, setFilter] = useState('ALL');

  function load() {
    api.listGroups(token).then(setGroups).catch((e) => setError(e.message));
  }

  useEffect(load, [token]);

  const categoriesPresent = groups ? [...new Set(groups.map((g) => g.category))] : [];
  const visibleGroups = groups ? (filter === 'ALL' ? groups : groups.filter((g) => g.category === filter)) : null;

  async function handleRemoveMember(groupId, unitId, tenantName) {
    if (!window.confirm(`Remove ${tenantName}? They'll lose access and drop off the board. Past payments are kept.`)) return;
    try {
      await api.removeMember(token, groupId, unitId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Topbar links={NAV_LINKS} />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h3>Groups</h3>
            <p className="page-subtitle">Rent, school fees, chama dues — anything you collect from people.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn-ghost print-btn" onClick={() => window.print()}>
              <Icon name="printer" size={14} /> Print
            </button>
            {!showNewGroup && (
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setShowNewGroup(true)}>
                + New group
              </button>
            )}
          </div>
        </div>

        <p className="print-only-title">
          Printed {new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {error && <p className="error-text">{error}</p>}

        {showNewGroup && (
          <NewGroupForm
            onCreated={() => {
              setShowNewGroup(false);
              load();
            }}
            onCancel={() => setShowNewGroup(false)}
          />
        )}

        {groups && groups.length === 0 && !showNewGroup && (
          <div className="card">
            <p className="empty-state">No groups yet. Create one to start adding tenants, students, or members.</p>
          </div>
        )}

        {categoriesPresent.length > 1 && !showNewGroup && (
          <div className="filter-tabs">
            <button className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
              All
            </button>
            {categoriesPresent.map((cat) => {
              const catMeta = categoryMeta(cat);
              return (
                <button key={cat} className={`filter-tab ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>
                  <Icon name={catMeta.icon} size={13} /> {catMeta.label}
                </button>
              );
            })}
          </div>
        )}

        {visibleGroups &&
          visibleGroups.map((group) => {
            const meta = categoryMeta(group.category);
            const isExpanded = expandedGroupId === group.id;
            return (
              <div className="card group-card" style={{ borderLeft: `4px solid ${meta.color}` }} key={group.id}>
                <button className="group-card-header" onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}>
                  <div className="group-card-title">
                    <span className="category-icon-badge" style={{ background: `${meta.color}1a`, color: meta.color }}>
                      <Icon name={meta.icon} size={20} />
                    </span>
                    <div>
                      <div className="group-name">{group.name}</div>
                      <div className="group-meta">
                        {meta.label}
                        {group.location ? ` · ${group.location}` : ''} · {group.memberCount} {meta.memberNoun}
                        {group.memberCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  <span
                    className="group-card-chevron"
                    style={{ display: 'inline-flex', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                  >
                    <Icon name="chevronDown" size={16} />
                  </span>
                </button>

                {isExpanded && (
                  <div className="group-card-body">
                    {group.members.length > 0 && (
                      <div className="member-list">
                        {group.members.map((m) => (
                          <div className="member-row" key={m.unitId}>
                            <div>
                              <span>
                                {m.tenantName} <span className="board-unit-label">· {m.label}</span>
                              </span>
                              {m.note && <div className="member-note">{m.note}</div>}
                            </div>
                            <div className="member-row-right">
                              <span className="board-unit-label">{formatKES(m.amount)}</span>
                              <button
                                className="member-remove-btn"
                                title={`Remove ${m.tenantName}`}
                                onClick={() => handleRemoveMember(group.id, m.unitId, m.tenantName)}
                              >
                                <Icon name="close" size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {addingMemberTo === group.id ? (
                      <AddMemberForm
                        group={group}
                        onAdded={() => {
                          setAddingMemberTo(null);
                          load();
                        }}
                        onCancel={() => setAddingMemberTo(null)}
                      />
                    ) : (
                      <button className="btn-ghost" onClick={() => setAddingMemberTo(group.id)}>
                        + Add {meta.memberNoun}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
