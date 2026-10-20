import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Illustration } from '../components/Illustration';
import { categoryMeta } from '../categories';

const STEPS = [
  {
    art: 'building',
    title: 'Load the whole building in minutes',
    body: 'Type a range like A1–A40 with the rent, or paste your rent book from Excel. Vacant units are fine. Fill them as tenants move in.',
  },
  {
    art: 'phonePay',
    title: 'Tenants pay with M-Pesa',
    body: 'Paybill with their house number as the account, or a one-tap prompt to their phone. No app to install.',
  },
  {
    art: 'allPaid',
    title: 'Every shilling lands on the right unit',
    body: 'Payments match themselves, receipts go out instantly, and the board turns green. Wrong account numbers wait in an inbox for you to assign.',
  },
];

const USES = [
  ['RENT', 'Each unit is a house number. Tenants pay with it as the Paybill account; vacant units are tracked too.'],
  ['SCHOOL_FEES', 'Each student is an admission number. Parents pay fees per term or month and get a receipt every time.'],
  ['MEMBERSHIP', 'Each member has a number. Contributions are matched automatically, and everyone can see their own balance.'],
];

const COMPARISON = [
  ['Set up a 100-unit building', 'One sitting: range or paste', 'Days of data entry', 'Never really "done"'],
  ['Paybill payments matched to units', 'Automatic, per Paybill', 'Usually', 'By hand, from statements'],
  ['Tenant typed the wrong account', 'Inbox: assign in one tap', 'Support ticket', 'Phone calls'],
  ['Receipts to tenants', 'Instant, every payment', 'Often extra', 'Handwritten'],
  ['Reminders before & after due date', 'Automatic', 'Often extra', 'You, on the phone'],
  ['Pay several months at once', 'Rolls forward automatically', 'Varies', 'Manual'],
  ['Tenant portal', 'Balance, history, pay', 'Usually', '—'],
];

export function Landing() {
  const { token, user, loading } = useAuth();
  if (!loading && token && user) {
    return <Navigate to={user.role === 'TENANT' ? '/home' : '/dashboard'} replace />;
  }

  return (
    <div className="landing">
      <header className="landing-hero">
        <img
          className="landing-hero-img"
          src="/images/hero-nairobi.webp"
          alt="Apartment blocks and the Nairobi skyline"
          fetchPriority="high"
        />
        <div className="landing-hero-shade" />
        <nav className="landing-nav">
          <span className="landing-logo">RentTrack</span>
          <div className="landing-nav-links">
            <Link to="/tenant-login">I'm a tenant</Link>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="landing-nav-cta">
              Start free
            </Link>
          </div>
        </nav>
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">Rent · School fees · Chama · M-Pesa native</span>
          <h1>Collect rent from every unit without chasing a single tenant.</h1>
          <p>
            Tenants pay through M-Pesa. RentTrack matches each payment to the right house, sends the receipt, reminds
            the ones who haven't paid, and shows you the whole building on one screen.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="landing-btn-primary">
              Set up my building <Icon name="arrowRight" size={16} />
            </Link>
            <Link to="/login" className="landing-btn-secondary">
              Log in
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-strip">
        <span>
          <Icon name="phone" size={15} /> M-Pesa Paybill &amp; STK push
        </span>
        <span>
          <Icon name="message" size={15} /> Receipts &amp; reminders
        </span>
        <span>
          <Icon name="building" size={15} /> 5 units or 500
        </span>
        <span>
          <Icon name="shield" size={15} /> Your data, your account
        </span>
      </section>

      <section className="landing-section">
        <h2>Rent, school fees or chama: same simple setup</h2>
        <div className="landing-uses">
          {USES.map(([type, body]) => {
            const m = categoryMeta(type);
            return (
              <Link key={type} to={`/register?type=${type}`} className="landing-use" style={{ '--type-color': m.color }}>
                <h3>
                  <Icon name={m.icon} size={20} /> {m.label}
                </h3>
                <p>{body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="landing-section">
        <h2>How it works</h2>
        <div className="landing-steps">
          {STEPS.map((s, i) => (
            <div className="landing-step" key={s.title}>
              <Illustration name={s.art} size={120} />
              <span className="landing-step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-split">
        <img src="/images/apartment-block.webp" alt="A residential apartment block behind palm trees" loading="lazy" />
        <div>
          <h2>Walk into the building today. Collecting by tonight.</h2>
          <ul className="landing-list">
            <li>
              <Icon name="check" size={16} /> The landlord signs up with their own phone number. It's their account,
              not yours.
            </li>
            <li>
              <Icon name="check" size={16} /> Add every unit at once. Tenants get a PIN by WhatsApp or SMS to see their
              balance.
            </li>
            <li>
              <Icon name="check" size={16} /> Their existing Paybill keeps working. Tenants just use the house number as
              the account.
            </li>
            <li>
              <Icon name="check" size={16} /> Cash and bank payments are recorded in two taps, so the books stay
              complete.
            </li>
          </ul>
          <Link to="/register" className="landing-btn-primary dark">
            Create the landlord's account <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </section>

      <section className="landing-split reverse">
        <img src="/images/tenant-phone.webp" alt="A man checking his phone" loading="lazy" />
        <div>
          <h2>Tenants pay from any phone.</h2>
          <p className="landing-muted">
            Even a basic phone works with Paybill. Smartphone users get a portal showing exactly what they owe,
            every receipt, and a one-tap M-Pesa prompt. Paying three months ahead? It rolls forward automatically.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <h2>How it compares</h2>
        <div className="landing-table-wrap">
          <table className="landing-table">
            <thead>
              <tr>
                <th />
                <th className="ours">RentTrack</th>
                <th>Typical rent software</th>
                <th>Excel + M-Pesa statements</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([feature, ours, typical, manual]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td className="ours">{ours}</td>
                  <td>{typical}</td>
                  <td>{manual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="landing-cta">
        <img src="/images/living-room.webp" alt="" loading="lazy" />
        <div className="landing-cta-shade" />
        <div className="landing-cta-copy">
          <h2>Free during early access.</h2>
          <p>Set up a building, add your tenants, and see the board fill in. No card, no contract.</p>
          <Link to="/register" className="landing-btn-primary">
            Start free <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} RentTrack</span>
        <span>
          Photos by Seth Salimo, Kevin Menya, Michael Odida and Cytonn Photography on{' '}
          <a href="https://unsplash.com" target="_blank" rel="noreferrer">
            Unsplash
          </a>
        </span>
      </footer>
    </div>
  );
}
