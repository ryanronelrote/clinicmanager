import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Login from './pages/Login';
import Home from './pages/Home';
import ClientList from './pages/ClientList';
import AddClient from './pages/AddClient';
import ClientDetail from './pages/ClientDetail';
import Calendar from './pages/Calendar';
import AddAppointment from './pages/AddAppointment';
import AppointmentDetail from './pages/AppointmentDetail';
import BlockTime from './pages/BlockTime';
import ImportClients from './pages/ImportClients';
import InventoryList from './pages/InventoryList';
import AddInventoryItem from './pages/AddInventoryItem';
import InventoryDetail from './pages/InventoryDetail';
import Settings from './pages/Settings';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'default');
}

function AuthWrapper() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'in' | 'out'

  useEffect(() => {
    const token = localStorage.getItem('clinic_token');
    if (!token) { setStatus('out'); return; }
    fetch('/auth/verify', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          fetch('/settings').then(r => r.json()).then(s => applyTheme(s.app_theme)).catch(() => {});
          setStatus('in');
        } else {
          setStatus('out');
        }
      })
      .catch(() => setStatus('out'));
  }, []);

  function handleLogin() { setStatus('in'); }
  function handleLogout() {
    localStorage.removeItem('clinic_token');
    setStatus('out');
  }

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Loading…
      </div>
    );
  }

  if (status === 'out') return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App onLogout={handleLogout} />}>
          <Route index element={<Home />} />
          <Route path="clients" element={<ClientList />} />
          <Route path="add" element={<AddClient />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="appointments/add" element={<AddAppointment />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="block-time" element={<BlockTime />} />
          <Route path="import-clients" element={<ImportClients />} />
          <Route path="inventory" element={<InventoryList />} />
          <Route path="inventory/add" element={<AddInventoryItem />} />
          <Route path="inventory/:id" element={<InventoryDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthWrapper />
  </React.StrictMode>
);
