import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { LANDLORD_NAV } from '../nav';
import { Icon } from '../components/Icon';
import { InviteShare } from '../components/InviteShare';
import { EmptyState } from '../components/Illustration';
import { categoryMeta } from '../categories';
import { formatKES } from '../format';


function AddMemberForm({ group, prefill, onAdded, onCancel }) {
  const { token } = useAuth();
  const meta = categoryMeta(group.category);
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [label, setLabel] = useState(prefill?.label || '');
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '');
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
      const res = await api.addMember(token, group.id, {
        tenantName,
        tenantPhone,
        label,
        amount: Number(amount),
        waterCharge: meta.supportsUtilities ? Number(waterCharge) || 0 : 0,
        electricityCharge: meta.supportsUtilities ? Number(electricityCharge) || 0 : 0,
        trashCharge: meta.supportsUtilities ? Number(trashCharge) || 0 : 0,
        note: note || undefined,
      });
      onAdded(res.pin ? { name: `${tenantName} · ${label}`, phone: tenantPhone, pin: res.pin, message: res.inviteMessage, whatsapp: res.whatsapp } : null);
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
          <input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="0712 345 678" inputMode="tel" />
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
      <p className="field-hint">They'll get a one-time PIN to log in. You can share it by WhatsApp right after adding them.</p>
    </form>
  );
}

export function Groups() {
  const { token } = useAuth();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [addingMemberTo, setAddingMemberTo] = useState(null); // { groupId, prefill }
  const [invite, setInvite] = useState(null); // { groupId, ...InviteShare props }
  const [filter, setFilter] = useState('ALL');

  function load() {
    api.listGroups(token).then(setGroups).catch((e) => setError(e.message));
  }

  useEffect(load, [token]);

  const categoriesPresent = groups ? [...new Set(groups.map((g) => g.category))] : [];
  const visibleGroups = groups ? (filter === 'ALL' ? groups : groups.filter((g) => g.category === filter)) : null;

  async function handleResetPin(group, m) {
    if (!window.confirm(`Give ${m.tenantName} a new PIN? Their old one stops working.`)) return;
    try {
      const res = await api.resetPin(token, group.id, m.unitId);
      setInvite({ groupId: group.id, name: `${m.tenantName} · ${m.label}`, phone: m.tenantPhone, pin: res.pin, message: res.inviteMessage, whatsapp: res.whatsapp });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveMember(groupId, unitId, tenantName) {
    if (!window.confirm(`${tenantName} is moving out? They'll lose access and the unit becomes vacant. Past payments are kept.`)) return;
    try {
      await api.removeMember(token, groupId, unitId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Topbar links={LANDLORD_NAV} />
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
            <Link className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} to="/onboarding">
              + New group
            </Link>
          </div>
        </div>

        <p className="print-only-title">
          Printed {new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {error && <p className="error-text">{error}</p>}


        {groups && groups.length === 0 && (
          <div className="card">
            <EmptyState
              art="building"
              title="Nothing here yet"
              action={
                <Link className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} to="/onboarding">
                  Set up rent, school fees or a chama
                </Link>
              }
            >
              Add everyone at once, then share each person's PIN by WhatsApp.
            </EmptyState>
          </div>
        )}

        {categoriesPresent.length > 1 && (
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
                        {group.vacant.length > 0 ? ` · ${group.vacant.length} vacant` : ''}
                        {group.paybill ? ` · Paybill ${group.paybill}` : ''}
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
                              {m.pinPending && <span className="pin-pending-tag" title="Hasn't logged in and set their own PIN yet">PIN not used</span>}
                              <span className="board-unit-label">{formatKES(m.amount)}</span>
                              <button className="member-remove-btn" title={`New PIN for ${m.tenantName}`} onClick={() => handleResetPin(group, m)}>
                                <Icon name="key" size={13} />
                              </button>
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

                    {invite?.groupId === group.id && (
                      <div className="invite-callout">
                        <p>Share this PIN so they can log in. They'll choose their own afterwards.</p>
                        <InviteShare {...invite} />
                        <button className="link-btn" onClick={() => setInvite(null)}>
                          Done
                        </button>
                      </div>
                    )}

                    {group.vacant.length > 0 && (
                      <div className="vacant-list">
                        <div className="modal-section-title">Vacant</div>
                        <div className="vacant-chips">
                          {group.vacant.map((v) => (
                            <button
                              key={v.unitId}
                              className="vacant-chip"
                              title={`Add a ${meta.memberNoun} to ${v.label}`}
                              onClick={() => setAddingMemberTo({ groupId: group.id, prefill: v })}
                            >
                              {v.label} <span>+</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {addingMemberTo?.groupId === group.id ? (
                      <AddMemberForm
                        key={addingMemberTo.prefill?.unitId || 'new'}
                        group={group}
                        prefill={addingMemberTo.prefill}
                        onAdded={(inv) => {
                          setAddingMemberTo(null);
                          if (inv) setInvite({ groupId: group.id, ...inv });
                          load();
                        }}
                        onCancel={() => setAddingMemberTo(null)}
                      />
                    ) : (
                      <div className="group-card-actions">
                        <button className="btn-ghost" onClick={() => setAddingMemberTo({ groupId: group.id })}>
                          + Add {meta.memberNoun}
                        </button>
                        <Link className="btn-ghost" to={`/onboarding?property=${group.id}`}>
                          + Add many at once
                        </Link>
                      </div>
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
