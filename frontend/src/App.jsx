import { Outlet, NavLink } from 'react-router-dom';
import { useClinicSettings } from './context/SettingsContext';

const sidebarStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: 220,
  height: '100vh',
  background: 'var(--sidebar-bg)',
  borderRight: '1px solid var(--sidebar-border)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-body)',
  overflowY: 'auto',
};

const brandStyle = {
  padding: '22px 18px 18px',
  fontFamily: 'var(--font-display)',
  fontWeight: '700',
  fontSize: 19,
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
  borderBottom: '1px solid var(--sidebar-border)',
  color: 'var(--brand-text)',
};

const sectionLabelStyle = {
  padding: '16px 16px 4px',
  fontSize: 10,
  fontWeight: '600',
  color: 'var(--sidebar-label)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  fontFamily: 'var(--font-body)',
};

function navLinkStyle({ isActive }) {
  return {
    display: 'block',
    padding: '8px 16px',
    textDecoration: 'none',
    color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
    background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
    borderRadius: 8,
    margin: '1px 8px',
    fontWeight: isActive ? '600' : '400',
    fontSize: 14,
    fontFamily: 'var(--font-body)',
    transition: 'background 0.15s ease',
  };
}

function subNavLinkStyle({ isActive }) {
  return {
    display: 'block',
    padding: '7px 16px 7px 28px',
    textDecoration: 'none',
    color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-sub-text)',
    background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
    borderRadius: 8,
    margin: '1px 8px',
    fontWeight: isActive ? '600' : '400',
    fontSize: 13,
    fontFamily: 'var(--font-body)',
    transition: 'background 0.15s ease',
  };
}

export default function App({ onLogout }) {
  const { settings } = useClinicSettings();
  const clinicName = settings?.clinic_name || 'Clinic Manager';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
      {/* Sidebar */}
      <nav style={sidebarStyle}>
        <div style={brandStyle}>{clinicName}</div>

        <div style={{ padding: '8px 0' }}>
          <NavLink to="/" end style={navLinkStyle}>Home</NavLink>
        </div>

        <div style={{ padding: '4px 0' }}>
          <div style={sectionLabelStyle}>Schedule</div>
          <NavLink to="/calendar" style={navLinkStyle}>Client Schedule</NavLink>
          <NavLink to="/therapist-schedule" style={navLinkStyle}>Shift Schedule</NavLink>
        </div>

        <div style={{ padding: '4px 0' }}>
          <div style={sectionLabelStyle}>Clients</div>
          <NavLink to="/clients" style={navLinkStyle}>Clients</NavLink>
          <NavLink to="/import-clients" style={subNavLinkStyle}>Import CSV</NavLink>
        </div>

        <div style={{ padding: '4px 0' }}>
          <div style={sectionLabelStyle}>Billing</div>
          <NavLink to="/invoices" style={navLinkStyle}>Invoices</NavLink>
          <NavLink to="/dashboard" style={subNavLinkStyle}>Sales KPIs</NavLink>
          <NavLink to="/payments" style={subNavLinkStyle}>Payments</NavLink>
        </div>

        <div style={{ padding: '4px 0' }}>
          <div style={sectionLabelStyle}>Items</div>
          <NavLink to="/inventory" style={navLinkStyle}>Stock</NavLink>
        </div>

        <div style={{ padding: '4px 0' }}>
          <div style={sectionLabelStyle}>System</div>
          <NavLink to="/settings" style={navLinkStyle}>Settings</NavLink>
        </div>

        <div style={{ marginTop: 'auto', padding: '16px 8px' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%', padding: '8px 16px', fontSize: 13,
              background: 'none', border: '1px solid var(--signout-border)', borderRadius: 8,
              color: 'var(--signout-color)', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-body)',
              transition: 'background 0.15s ease',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ marginLeft: 220, flex: 1, padding: '28px 36px', minHeight: '100vh', background: 'var(--page-bg)' }}>
        <Outlet />
      </main>
    </div>
  );
}
