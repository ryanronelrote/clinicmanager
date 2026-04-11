import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useClinicSettings } from './context/SettingsContext';
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
import TherapistSchedule from './pages/TherapistSchedule';
import InvoiceList from './pages/InvoiceList';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import Dashboard from './pages/Dashboard';
import { useEffect } from 'react';

function AppShell() {
  const { status, logout } = useAuth();
  const { loadSettings } = useClinicSettings();

  useEffect(() => {
    if (status === 'in') loadSettings();
  }, [status, loadSettings]);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Loading…
      </div>
    );
  }

  if (status === 'out') return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App onLogout={logout} />}>
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
          <Route path="therapist-schedule" element={<TherapistSchedule />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="invoices/create" element={<CreateInvoice />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <AppShell />
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);
