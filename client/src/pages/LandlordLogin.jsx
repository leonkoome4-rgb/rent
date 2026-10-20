import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';

export function LandlordLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginLandlord } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.landlordLogin(identifier, password);
      loginLandlord(token, user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual auth-visual-photo">
        <img src="/images/hero-nairobi.webp" alt="" />
        <div className="auth-visual-brand">RentTrack</div>
        <div className="auth-visual-copy">
          <h2>Stop chasing rent. Let the board fill itself in.</h2>
          <p>
            Send an M-Pesa payment request in one tap, watch it turn green the moment it lands — rent, school fees,
            chama dues, whatever you collect.
          </p>
        </div>
        <div className="auth-visual-tags">
          <span className="auth-visual-tag">
            <Icon name="home" size={13} /> Rent
          </span>
          <span className="auth-visual-tag">
            <Icon name="gradCap" size={13} /> School fees
          </span>
          <span className="auth-visual-tag">
            <Icon name="handshake" size={13} /> Chama dues
          </span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <h1 className="brand-mark">RentTrack</h1>
          <p className="auth-subtitle">Landlord &amp; agent login</p>

          <form onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}
            <div className="field">
              <label htmlFor="identifier">Phone or email</label>
              <input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="0712 345 678 or email"
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
            New landlord? <Link to="/register">Create an account</Link>
          </p>
          <p className="auth-switch" style={{ marginTop: 8 }}>
            Tenant, student, or member? <Link to="/tenant-login">Log in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
