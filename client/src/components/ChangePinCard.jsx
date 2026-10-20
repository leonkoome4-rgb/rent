import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';

/** Shown to a tenant still on the landlord-issued one-time PIN until they pick their own. */
export function ChangePinCard() {
  const { token, updateUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) return setError("The new PINs don't match.");
    setError('');
    setSaving(true);
    try {
      await api.changePassword(token, current, next);
      updateUser({ mustChangePassword: false });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="card change-pin-card" onSubmit={submit}>
      <div className="change-pin-head">
        <span className="metric-icon">
          <Icon name="key" size={18} />
        </span>
        <div>
          <h4>Choose your own PIN</h4>
          <p className="page-subtitle">You signed in with the PIN your landlord sent. Pick one only you know.</p>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="field-row">
        <div className="field">
          <label htmlFor="pin-current">PIN you received</label>
          <input id="pin-current" type="password" inputMode="numeric" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pin-new">New PIN (4+ digits)</label>
          <input id="pin-new" type="password" inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pin-confirm">Repeat new PIN</label>
          <input id="pin-confirm" type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary" type="submit" disabled={saving || !current || next.length < 4 || !confirm}>
        {saving ? 'Saving…' : 'Save my PIN'}
      </button>
    </form>
  );
}
