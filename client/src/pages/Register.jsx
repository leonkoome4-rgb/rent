import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';

export function Register() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginLandlord } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.landlordRegister({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
      });
      loginLandlord(token, user);
      navigate(params.get('type') ? `/onboarding?type=${params.get('type')}` : '/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual auth-visual-photo">
        <img src="/images/apartment-block.webp" alt="" />
        <div className="auth-visual-brand">RentTrack</div>
        <div className="auth-visual-copy">
          <h2>Your building, collecting rent by tonight.</h2>
          <p>
            Create your account, add your units, and share each tenant's PIN. It takes about ten minutes for a whole
            block.
          </p>
        </div>
        <div className="auth-visual-tags">
          <span className="auth-visual-tag">
            <Icon name="check" size={13} /> Free during early access
          </span>
          <span className="auth-visual-tag">
            <Icon name="phone" size={13} /> M-Pesa ready
          </span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <h1 className="brand-mark">RentTrack</h1>
          <p className="auth-subtitle">Create your account: landlord, school or chama</p>

          <form onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" value={form.name} onChange={set('name')} autoComplete="name" autoFocus />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                value={form.phone}
                onChange={set('phone')}
                placeholder="0712 345 678"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Email (optional)</label>
              <input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <button
              className="btn-primary"
              type="submit"
              disabled={loading || !form.name || !form.phone || form.password.length < 6}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
