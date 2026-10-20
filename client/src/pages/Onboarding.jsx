import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Topbar } from '../components/Topbar';
import { Icon } from '../components/Icon';
import { InviteShare } from '../components/InviteShare';
import { Illustration } from '../components/Illustration';
import { LANDLORD_NAV } from '../nav';
import { formatKES } from '../format';
import { CATEGORIES, categoryMeta } from '../categories';

const CHUNK = 50; // rows per request — keeps each serverless call short
const PRIMARY_TYPES = ['RENT', 'SCHOOL_FEES', 'MEMBERSHIP'];
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

const blankRow = (label = '', amount = '') => ({
  label,
  amount: String(amount),
  tenantName: '',
  tenantPhone: '',
  waterCharge: '',
  electricityCharge: '',
  trashCharge: '',
});

/** Splits one CSV line, honouring "quoted, values" (Excel quotes amounts like "15,000"). */
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

/**
 * Reads a pasted rent book: one unit per line as
 * unit, rent, tenant name, phone — tab-separated (copied from Excel/Sheets)
 * or comma-separated. A header row is skipped automatically.
 */
function parseList(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const cells = (line.includes('\t') ? line.split('\t') : splitCsvLine(line)).map((c) => c.trim());
    const amount = (cells[1] || '').replace(/[^\d]/g, '');
    if (i === 0 && !amount) return; // header
    const row = blankRow(cells[0], amount);
    row.tenantName = cells[2] || '';
    row.tenantPhone = cells[3] || '';
    rows.push(row);
  });
  return rows;
}

function RangeGenerator({ meta, onAdd }) {
  const [prefix, setPrefix] = useState(meta.rangePrefix);
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  const [rent, setRent] = useState('');
  const count = Math.max(0, Number(to) - Number(from) + 1);

  function add() {
    const rows = [];
    for (let n = Number(from); n <= Number(to) && rows.length < 500; n++) rows.push(blankRow(`${prefix}${n}`, rent));
    onAdd(rows);
  }

  return (
    <div className="range-gen">
      <div className="field">
        <label>Prefix</label>
        <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="A" />
      </div>
      <div className="field">
        <label>From</label>
        <input value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
      </div>
      <div className="field">
        <label>To</label>
        <input value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
      </div>
      <div className="field">
        <label>{meta.primaryLabel} each (KSh)</label>
        <input value={rent} onChange={(e) => setRent(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="15000" />
      </div>
      <button type="button" className="btn-primary" disabled={!count || count > 500 || !rent} onClick={add}>
        Add {count > 0 && count <= 500 ? `${prefix}${from}–${prefix}${to}` : meta.unitNounPlural}
      </button>
    </div>
  );
}

function PasteList({ meta, onAdd }) {
  const example = {
    RENT: 'A1, 15000, Jane Wanjiku, 0712 345 678\nA2, 15000\nB1, 18000, Peter Otieno, 0722 000 111',
    SCHOOL_FEES: 'ADM-1042, 18500, Brian Kamau, 0712 345 678\nADM-1043, 18500, Faith Achieng, 0722 000 111',
    MEMBERSHIP: 'M-01, 2000, Mama Wanjiru, 0712 345 678\nM-02, 2000, John Mwangi, 0722 000 111',
  }[meta.key] || 'P-01, 1000, Jane Wanjiku, 0712 345 678';
  const [text, setText] = useState('');

  function readFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setText);
    e.target.value = '';
  }

  return (
    <div>
      <div className="field">
        <label>
          One per line: {meta.identifierLabel.toLowerCase()}, {meta.primaryLabel.toLowerCase()}, name, phone
          {meta.key === 'RENT' ? ' (tenant is optional)' : ''}
        </label>
        <textarea
          className="paste-box"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={example}
        />
      </div>
      <div className="paste-actions">
        <button type="button" className="btn-primary" disabled={!text.trim()} onClick={() => { onAdd(parseList(text)); setText(''); }}>
          Add these {meta.unitNounPlural}
        </button>
        <label className="btn-ghost file-btn">
          Upload CSV
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={readFile} hidden />
        </label>
        <span className="field-hint">Tip: copy the columns straight from Excel or Google Sheets.</span>
      </div>
    </div>
  );
}

function UnitTable({ meta, rows, setRows }) {
  const update = (i, key) => (e) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)));
  const remove = (i) => setRows((rs) => rs.filter((_, j) => j !== i));

  return (
    <div className="unit-table-wrap">
      <table className="unit-table">
        <thead>
          <tr>
            <th>{meta.identifierLabel}</th>
            <th>{meta.primaryLabel}</th>
            <th>{cap(meta.memberNoun)} name</th>
            <th>Phone (M-Pesa)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <input value={r.label} onChange={update(i, 'label')} aria-label="Unit" />
              </td>
              <td>
                <input value={r.amount} onChange={update(i, 'amount')} inputMode="numeric" aria-label="Rent" />
              </td>
              <td>
                <input value={r.tenantName} onChange={update(i, 'tenantName')} placeholder={meta.key === 'RENT' ? 'Vacant' : 'Name'} aria-label="Name" />
              </td>
              <td>
                <input value={r.tenantPhone} onChange={update(i, 'tenantPhone')} placeholder="07…" inputMode="tel" aria-label="Phone" />
              </td>
              <td>
                <button type="button" className="member-remove-btn" title="Remove row" onClick={() => remove(i)}>
                  <Icon name="close" size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Onboarding() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = CATEGORIES[params.get('type')] ? params.get('type') : null;
  const [category, setCategory] = useState(initialType);
  const [step, setStep] = useState(initialType ? 1 : 0);
  const [building, setBuilding] = useState({ name: '', location: '', paybill: '' });
  const [property, setProperty] = useState(null); // created/selected property
  const [mode, setMode] = useState('range');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { created, errors }

  // /onboarding?property=<id> adds units to an existing building, skipping step 1.
  useEffect(() => {
    const id = params.get('property');
    if (!id) return;
    api.listGroups(token).then((groups) => {
      const g = groups.find((x) => x.id === id);
      if (g) {
        setProperty(g);
        setCategory(g.category);
        setMode(g.category === 'RENT' ? 'range' : 'paste');
        setStep(2);
      }
    });
  }, [params, token]);

  const meta = { ...categoryMeta(category || 'RENT'), key: category || 'RENT' };
  const STEPS = category
    ? ['What you collect', `${cap(meta.groupNoun)} details`, cap(meta.unitNounPlural), 'Done']
    : ['What you collect', 'Details', 'People', 'Done'];

  function choose(type) {
    setCategory(type);
    setMode(type === 'RENT' ? 'range' : 'paste');
    setStep(1);
  }

  const tenantsCount = rows.filter((r) => r.tenantName && r.tenantPhone).length;
  const monthlyTotal = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  function addRows(newRows) {
    setRows((existing) => {
      const seen = new Set(existing.map((r) => r.label.toUpperCase()));
      return [...existing, ...newRows.filter((r) => r.label && !seen.has(r.label.toUpperCase()))];
    });
  }

  async function createBuilding(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const created = await api.createGroup(token, {
        name: building.name,
        category,
        location: building.location || undefined,
        paybill: building.paybill || undefined,
      });
      setProperty(created);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveUnits() {
    setError('');
    setBusy(true);
    const created = [];
    const errors = [];
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        setProgress(`Saving ${Math.min(i + CHUNK, rows.length)} of ${rows.length}…`);
        const chunk = rows.slice(i, i + CHUNK);
        try {
          const res = await api.bulkAddUnits(token, property.id, chunk);
          created.push(...res.created);
          errors.push(...res.errors.map((e) => ({ ...e, row: chunk[e.line - 1] })));
        } catch (err) {
          // Network/server failure for the whole chunk — report every row in it.
          errors.push(...chunk.map((row) => ({ label: row.label, error: err.message, row })));
        }
      }
      setResult({ created, errors });
      setStep(3);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function fixFailed() {
    setRows(result.errors.map((e) => e.row).filter(Boolean));
    setResult(null);
    setStep(2);
  }

  const invites = result?.created.filter((c) => c.pin) || [];

  return (
    <div>
      <Topbar links={LANDLORD_NAV} />
      <div className="page-body onboarding">
        <div className="page-header">
          <div>
            <h3>
              {property && params.get('property')
                ? `Add ${meta.unitNounPlural} to ${property.name}`
                : step === 0
                  ? `Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}. What are you collecting?`
                  : `Set up your ${meta.groupNoun}`}
            </h3>
            <p className="page-subtitle">
              {step === 0 ? 'Pick one to start. You can add the others later.' : 'A few quick steps. You can always add more later.'}
            </p>
          </div>
        </div>

        <ol className="wizard-steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? 'active' : i < step ? 'done' : ''}>
              <span>{i < step ? <Icon name="check" size={13} /> : i + 1}</span> {label}
            </li>
          ))}
        </ol>

        {error && <p className="error-text">{error}</p>}

        {step === 0 && (
          <>
            <div className="type-picker">
              {PRIMARY_TYPES.map((type) => {
                const m = categoryMeta(type);
                return (
                  <button key={type} type="button" className="type-card" style={{ '--type-color': m.color }} onClick={() => choose(type)}>
                    <span className="type-card-icon">
                      <Icon name={m.icon} size={26} />
                    </span>
                    <span className="type-card-title">{m.label}</span>
                    <span className="type-card-tagline">{m.tagline}</span>
                    <span className="type-card-go">
                      Set up a {m.groupNoun} <Icon name="arrowRight" size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="type-picker-other">
              Collecting something else, like parking or a service charge?{' '}
              <button type="button" className="link-inline" onClick={() => choose('OTHER')}>
                Set up another kind of group
              </button>
            </p>
          </>
        )}

        {step === 1 && (
          <form className="card wizard-card" onSubmit={createBuilding}>
            <div className="wizard-card-art">
              <span className="type-badge" style={{ '--type-color': meta.color }}>
                <Icon name={meta.icon} size={14} /> {meta.label}
              </span>
              <Illustration name={meta.art} size={150} />
              {!initialType && (
                <button type="button" className="link-inline" onClick={() => setStep(0)}>
                  Change
                </button>
              )}
            </div>
            <div>
              <div className="field">
                <label htmlFor="b-name">{cap(meta.groupNoun)} name</label>
                <input
                  id="b-name"
                  value={building.name}
                  onChange={(e) => setBuilding({ ...building, name: e.target.value })}
                  placeholder={meta.groupNamePlaceholder}
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="b-loc">{meta.key === 'RENT' ? 'Location' : 'Note'} (optional)</label>
                <input
                  id="b-loc"
                  value={building.location}
                  onChange={(e) => setBuilding({ ...building, location: e.target.value })}
                  placeholder={meta.locationPlaceholder}
                />
              </div>
              <div className="field">
                <label htmlFor="b-paybill">M-Pesa Paybill or Till number (optional)</label>
                <input
                  id="b-paybill"
                  value={building.paybill}
                  onChange={(e) => setBuilding({ ...building, paybill: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g. 522533"
                  inputMode="numeric"
                />
                <p className="field-hint">
                  {cap(meta.payerNounPlural)} pay here with the {meta.identifierLabel.toLowerCase()} as the account
                  number. RentTrack matches each payment automatically.
                </p>
              </div>
              <button className="btn-primary" type="submit" disabled={busy || !building.name.trim()}>
                {busy ? 'Saving…' : `Next: add ${meta.unitNounPlural}`}
              </button>
            </div>
          </form>
        )}

        {step === 2 && property && (
          <>
            <div className="card section-gap">
              <div className="filter-tabs" style={{ marginBottom: 16 }}>
                <button className={`filter-tab ${mode === 'range' ? 'active' : ''}`} onClick={() => setMode('range')}>
                  <Icon name="layers" size={13} /> Generate a range
                </button>
                <button className={`filter-tab ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>
                  <Icon name="card" size={13} /> Paste or upload a list
                </button>
              </div>
              {mode === 'range' ? <RangeGenerator meta={meta} onAdd={addRows} /> : <PasteList meta={meta} onAdd={addRows} />}
            </div>

            {rows.length > 0 ? (
              <div className="card section-gap">
                <div className="unit-table-head">
                  <h4>
                    {rows.length} {meta.unitNounPlural}
                    {meta.key === 'RENT' ? ` · ${tenantsCount} with tenants` : ''} · {formatKES(monthlyTotal)} per period
                  </h4>
                  <button type="button" className="link-btn" onClick={() => setRows([])}>
                    Clear all
                  </button>
                </div>
                <p className="field-hint" style={{ marginTop: 0 }}>
                  {meta.key === 'RENT'
                    ? 'Walking the building? Fill in names and phones as you go. Leave them blank for vacant units.'
                    : `Check names and phone numbers. Each ${meta.memberNoun} gets a PIN to see what they owe.`}
                </p>
                <UnitTable meta={meta} rows={rows} setRows={setRows} />
                <button className="btn-primary" style={{ marginTop: 16 }} disabled={busy} onClick={saveUnits}>
                  {busy ? progress || 'Saving…' : `Save ${rows.length} ${meta.unitNounPlural} to ${property.name}`}
                </button>
              </div>
            ) : (
              <p className="empty-state">Add {meta.unitNounPlural} above. They'll appear here to review before saving.</p>
            )}
          </>
        )}

        {step === 3 && result && (
          <>
            <div className="card section-gap wizard-done">
              <Illustration name="allPaid" size={120} />
              <div>
                <h4>
                  {result.created.length} {meta.unitNounPlural} added to {property.name}
                </h4>
                <p className="page-subtitle">
                  {invites.length
                    ? `Share each ${meta.memberNoun}'s PIN below. They log in with their phone number and choose their own PIN.`
                    : `Add ${meta.payerNounPlural} from the Groups page as they join.`}
                </p>
                <div className="wizard-done-actions">
                  <button className="btn-primary" onClick={() => navigate('/board')}>
                    Open the board
                  </button>
                  {invites.length > 0 && (
                    <button className="btn-ghost" onClick={() => window.print()}>
                      <Icon name="printer" size={14} /> Print invite slips
                    </button>
                  )}
                  <Link className="btn-ghost" to={`/onboarding?property=${property.id}`} onClick={() => { setRows([]); setResult(null); setStep(2); }}>
                    Add more {meta.unitNounPlural}
                  </Link>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="card section-gap">
                <h4 className="accent-red">{result.errors.length === 1 ? '1 row needs' : `${result.errors.length} rows need`} fixing</h4>
                <ul className="error-list">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      <strong>{e.label || `Line ${e.line}`}</strong>: {e.error}
                    </li>
                  ))}
                </ul>
                <button className="btn-ghost" onClick={fixFailed}>
                  Fix these rows
                </button>
              </div>
            )}

            {invites.length > 0 && (
              <div className="card section-gap">
                <h4>{cap(meta.memberNoun)} invites</h4>
                <div className="invite-list">
                  {invites.map((c) => (
                    <InviteShare
                      key={c.label}
                      name={`${c.tenantName} · ${c.label}`}
                      phone={c.tenantPhone}
                      pin={c.pin}
                      whatsapp={c.whatsapp}
                      message={decodeURIComponent(c.whatsapp.split('?text=')[1] || '')}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="print-slips">
              {invites.map((c) => (
                <div className="print-slip" key={c.label}>
                  <strong>{property.name} · {c.label}</strong>
                  <span>{c.tenantName}</span>
                  {property.paybill && (
                    <span>
                      Pay {meta.primaryLabel.toLowerCase()}: M-Pesa Paybill <b>{property.paybill}</b>, account <b>{c.label}</b>
                    </span>
                  )}
                  <span>
                    See your balance &amp; receipts: {window.location.origin}/tenant-login
                  </span>
                  <span>
                    Phone {c.tenantPhone} · PIN <b>{c.pin}</b>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
