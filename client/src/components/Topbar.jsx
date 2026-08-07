import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Topbar({ links }) {
  const { user, logout } = useAuth();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="brand-mark">RentTrack</span>
        {links && (
          <nav className="topbar-nav">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => 'topbar-link' + (isActive ? ' active' : '')}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      <div className="topbar-right">
        <span className="topbar-user">{user?.name}</span>
        <button className="btn-ghost" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
