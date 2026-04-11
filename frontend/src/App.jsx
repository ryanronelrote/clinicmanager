import { Outlet, NavLink } from 'react-router-dom';
import { useClinicSettings } from './context/SettingsContext';

const sidebarStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: 200,
  height: '100vh',
  background: 'var(--sidebar-bg)',
  borderRight: '1px solid var(--sidebar-border)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'sans-serif',
  overflowY: 'auto',
};

const brandStyle = {
  padding: '20px 16px 16px',
  fontWeight: 'bold',
  fontSize: 16,
  letterSpacing: '0.3px',
  borderBottom: '1px solid var(--sidebar-border)',
  color: 'var(--brand-text)',
};

const sectionLabelStyle = {
  padding: '16px 16px 4px',
  fontSize: 11,
  fontWeight: 'bold',
  color: 'var(--sidebar-label)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

function navLinkStyle({ isActive }) {
  return {
    display: 'block',
    padding: '7px 16px',
    textDecoration: 'none',
    color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
    background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
    borderRadius: 8,
    margin: '1px 8px',
    fontWeight: isActive ? '600' : 'normal',
    fontSize: 14,
    transition: 'background 0.15s ease',
  };
}

function subNavLinkStyle({ isActive }) {
  return {
    display: 'block',
    padding: '6px 16px 6px 28px',
    textDecoration: 'none',
    color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-sub-text)',
    background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
    borderRadius: 8,
    margin: '1px 8px',
    fontWeight: isActive ? '600' : 'normal',
    fontSize: 13,
    transition: 'background 0.15s ease',
  };
}

export default function App({ onLogout }) {
  const { settings } = useClinicSettings();
  const clinicName = settings?.clinic_name || 'Clinic Manager';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
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
              width: '100%', padding: '7px 16px', fontSize: 13,
              background: 'none', border: '1px solid var(--signout-border)', borderRadius: 8,
              color: 'var(--signout-color)', cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.15s ease',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ marginLeft: 200, flex: 1, padding: '24px 28px', minHeight: '100vh', background: 'var(--page-bg)' }}>
        <Outlet />
      </main>
    </div>
  );
}
