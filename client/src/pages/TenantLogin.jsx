import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';

export function TenantLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginTenant } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, tenant } = await api.tenantLogin(phone, password);
      loginTenant(token, tenant);
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-visual-brand">RentTrack</div>
        <div className="auth-visual-copy">
          <h2>See what you owe. Pay it in one tap.</h2>
          <p>Get an M-Pesa prompt straight to your phone — no queueing, no chasing, no paper receipts to lose.</p>
        </div>
        <div className="auth-visual-tags">
          <span className="auth-visual-tag">
            <Icon name="zap" size={13} /> Instant
          </span>
          <span className="auth-visual-tag">
            <Icon name="phone" size={13} /> M-Pesa
          </span>
          <span className="auth-visual-tag">
            <Icon name="check" size={13} /> Auto-confirmed
          </span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <h1 className="brand-mark">RentTrack</h1>
          <p className="auth-subtitle">Tenant, student &amp; member login</p>

          <form onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}
            <div className="field">
              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="254712000011"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            Landlord or agent? <Link to="/login">Log in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
