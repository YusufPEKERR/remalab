import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MainLayout from './layouts/MainLayout';

// Route-bazlı code splitting: kullanıcı tek oturumda genelde birkaç sayfa
// ziyaret ediyor, ama eskiden 28 sayfanın TAMAMI tek bir ~1.4MB JS paketinde
// birleşip ilk açılışta indiriliyordu. Login/Dashboard/MainLayout hemen her
// oturumda görüldüğü için eager kalıyor, geri kalan sayfalar sadece o rotaya
// gidildiğinde indirilir.
const Users = lazy(() => import('./pages/Users'));
const Parts = lazy(() => import('./pages/Parts'));
const PartCategories = lazy(() => import('./pages/PartCategories'));
const Products = lazy(() => import('./pages/Products'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Locations = lazy(() => import('./pages/Locations'));
const Depo = lazy(() => import('./pages/Depo'));
const Servis = lazy(() => import('./pages/Servis'));
const Irsaliye = lazy(() => import('./pages/Irsaliye'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const Raporlar = lazy(() => import('./pages/Raporlar'));
const Settings = lazy(() => import('./pages/Settings'));
const Departments = lazy(() => import('./pages/Departments'));
const FlowDgdMapping = lazy(() => import('./pages/FlowDgdMapping'));
const CustomerPriceMatrix = lazy(() => import('./pages/CustomerPriceMatrix'));
const CustomerTargetPriceMatrix = lazy(() => import('./pages/CustomerTargetPriceMatrix'));
const ServiceRecords = lazy(() => import('./pages/ServiceRecords'));
const BatchEntry = lazy(() => import('./pages/BatchEntry'));
const DataManagement = lazy(() => import('./pages/DataManagement'));
const ItemBOM = lazy(() => import('./pages/ItemBOM'));
const ServiceTransition = lazy(() => import('./pages/ServiceTransition'));
const BatchStatuTransition = lazy(() => import('./pages/BatchStatuTransition'));
const TechnicianPanel = lazy(() => import('./pages/TechnicianPanel'));
const TechnicianRepairOperations = lazy(() => import('./pages/TechnicianRepairOperations'));
const DemontajServisOnarimlari = lazy(() => import('./pages/DemontajServisOnarimlari'));
const HizliOnarimBitir = lazy(() => import('./pages/HizliOnarimBitir'));
const SchemaMapper = lazy(() => import('./pages/SchemaMapper'));
const CustomerApprovalDecision = lazy(() => import('./pages/CustomerApprovalDecision'));
const AraTestSonuc = lazy(() => import('./pages/AraTestSonuc'));
const SonTestSonuc = lazy(() => import('./pages/SonTestSonuc'));
const StatuKontrol = lazy(() => import('./pages/StatuKontrol'));
const ParcaTeslim = lazy(() => import('./pages/ParcaTeslim'));
const DepartmentRepairPool = lazy(() => import('./pages/DepartmentRepairPool'));

function RouteLoading() {
  return (
    <div className="flex items-center justify-center h-full py-24">
      <div className="w-8 h-8 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<RouteLoading />}>
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
              <Route path="/parca-teslim" element={<ParcaTeslim />} />
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
              <Route path="/flow-dgd-mapping" element={<FlowDgdMapping />} />
              <Route path="/customer-price-matrix" element={<CustomerPriceMatrix />} />
              <Route path="/customer-target-price-matrix" element={<CustomerTargetPriceMatrix />} />
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
              <Route path="/onarim-havuzu/:deptCode" element={<DepartmentRepairPool />} />
              <Route path="/servis-onarimlari-demontaj" element={<DemontajServisOnarimlari />} />
              {/* Menüde departman başına ayrı görünür, tek bileşen görev grubunu rotadan okur. */}
              <Route path="/hizli-onarim-bitir/:missionGroup" element={<HizliOnarimBitir />} />
              <Route path="/schema-mapper" element={<SchemaMapper />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
