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
import InventoryList from './pages/InventoryList';
import AddInventoryItem from './pages/AddInventoryItem';
import InventoryDetail from './pages/InventoryDetail';

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
          <Route path="inventory" element={<InventoryList />} />
          <Route path="inventory/add" element={<AddInventoryItem />} />
          <Route path="inventory/:id" element={<InventoryDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
