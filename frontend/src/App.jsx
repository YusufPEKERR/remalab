import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Parts from './pages/Parts';
import PartCategories from './pages/PartCategories';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Locations from './pages/Locations';
import Depo from './pages/Depo';
import Servis from './pages/Servis';
import Irsaliye from './pages/Irsaliye';
import WorkOrders from './pages/WorkOrders';

import ImeiTracker from './pages/ImeiTracker';
import Raporlar from './pages/Raporlar';
import Settings from './pages/Settings';
import Departments from './pages/Departments';
import ServiceRecords from './pages/ServiceRecords';
import BatchEntry from './pages/BatchEntry';
import DataManagement from './pages/DataManagement';
import MainLayout from './layouts/MainLayout';
import ItemBOM from './pages/ItemBOM';

// Modül 5 
import ServiceTransition from './pages/ServiceTransition';
import BatchStatuTransition from './pages/BatchStatuTransition';
import TechnicianPanel from './pages/TechnicianPanel';
import TechnicianRepairOperations from './pages/TechnicianRepairOperations';
import DemontajServisOnarimlari from './pages/DemontajServisOnarimlari';
import SchemaMapper from './pages/SchemaMapper';
import CustomerApprovalDecision from './pages/CustomerApprovalDecision';
import AraTestSonuc from './pages/AraTestSonuc';
import SonTestSonuc from './pages/SonTestSonuc';
import StatuKontrol from './pages/StatuKontrol';
function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes (Wrapped in MainLayout) */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/statu-kontrol" element={<StatuKontrol />} />

            {/* DEPO */}
            <Route path="/depo" element={<Depo />} />
            <Route path="/servis" element={<Servis />} />
            <Route path="/irsaliye" element={<Irsaliye />} />
            <Route path="/work-orders" element={<WorkOrders />} />

            <Route path="/raporlar" element={<Raporlar />} />

            {/* ENVANTER */}
            <Route path="/parts" element={<Parts />} />
            <Route path="/part-categories" element={<PartCategories />} />
            <Route path="/products" element={<Products />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/locations" element={<Locations />} />

            {/* KULLANICI & AYARLAR */}
            <Route path="/users" element={<Users />} />
            <Route path="/batch-entry" element={<BatchEntry />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/service-records" element={<ServiceRecords />} />
            <Route path="/data-management" element={<DataManagement />} />

            {/* HIDDEN MODULES */}
            <Route path="/item-bom" element={<ItemBOM />} />
            {/* MODÜL 5 */}
            <Route path="/service-transition" element={<ServiceTransition />} />
            <Route path="/statu-gecis/MNG1_AS/138_124" element={<AraTestSonuc />} />
            <Route path="/statu-gecis/QAC/125_126" element={<SonTestSonuc />} />
            <Route path="/statu-gecis/:groupKey/:code" element={<BatchStatuTransition />} />
            <Route path="/musteri-onayi" element={<CustomerApprovalDecision />} />
            <Route path="/technician-panel" element={<TechnicianPanel />} />
            <Route path="/technician-repair" element={<TechnicianRepairOperations />} />
            <Route path="/servis-onarimlari-demontaj" element={<DemontajServisOnarimlari />} />
            <Route path="/schema-mapper" element={<SchemaMapper />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;

