import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Parts from './pages/Parts';
import PartCategories from './pages/PartCategories';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Locations from './pages/Locations';
import Depo from './pages/Depo';
import Irsaliye from './pages/Irsaliye';
import WorkOrders from './pages/WorkOrders';
import SupplyRequests from './pages/SupplyRequests';
import Raporlar from './pages/Raporlar';
import Settings from './pages/Settings';
import Departments from './pages/Departments';
import ServiceRecords from './pages/ServiceRecords';
import DataManagement from './pages/DataManagement';
import SupplyRequestForm from './pages/SupplyRequestForm';
import MainLayout from './layouts/MainLayout';
import ItemBOM from './pages/ItemBOM';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes (Wrapped in MainLayout) */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* DEPO */}
          <Route path="/depo" element={<Depo />} />
          <Route path="/irsaliye" element={<Irsaliye />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/supply-requests" element={<SupplyRequests />} />
          <Route path="/raporlar" element={<Raporlar />} />

          {/* ENVANTER */}
          <Route path="/parts" element={<Parts />} />
          <Route path="/part-categories" element={<PartCategories />} />
          <Route path="/products" element={<Products />} />
          <Route path="/item-bom" element={<ItemBOM />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/locations" element={<Locations />} />

          {/* KULLANICI & AYARLAR */}
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/service-records" element={<ServiceRecords />} />
          <Route path="/data-management" element={<DataManagement />} />
          <Route path="/tedarik-talepleri" element={<SupplyRequestForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

