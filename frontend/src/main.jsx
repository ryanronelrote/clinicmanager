import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import ClientList from './pages/ClientList';
import AddClient from './pages/AddClient';
import ClientDetail from './pages/ClientDetail';
import Calendar from './pages/Calendar';
import AddAppointment from './pages/AddAppointment';
import AppointmentDetail from './pages/AppointmentDetail';
import BlockTime from './pages/BlockTime';
import ImportClients from './pages/ImportClients';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="clients" element={<ClientList />} />
          <Route path="add" element={<AddClient />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="appointments/add" element={<AddAppointment />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="block-time" element={<BlockTime />} />
          <Route path="import-clients" element={<ImportClients />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
