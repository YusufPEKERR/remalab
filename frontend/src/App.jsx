import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MainLayout from './layouts/MainLayout';

// ESKİ PARÇA ADI KORUMASI.
// Derleme, parça adlarını içeriğe göre hash'liyor (EtiketTasarimi-C7uzMj4A.js) ve her
// yeni derlemede eski adı diskten SİLİYOR. Uygulama açıkken güncelleme yapılırsa
// (update.bat veya yeniden derleme) çalışan sekme hâlâ ESKİ adları hatırlar; o ana
// kadar ziyaret edilmemiş bir rotaya tıklandığında 404 alınır, dinamik import
// reddedilir ve sayfa "açılmıyor, hata veriyor" hâline gelir. Statik sunucu
// /assets/* için index.html'e düşmediğinden (bkz. core/main_window.py::do_GET)
// bu gerçek bir 404'tür, kendiliğinden düzelmez.
//
// Çözüm: parça yüklenemezse sayfa BİR KEZ yenilenir. index.html "no-store" ile
// servis edildiği için yenileme güncel parça adlarını getirir. Bayrak sessionStorage'da
// tutulur; parça gerçekten yoksa sonsuz yenileme döngüsüne girilmez, hata yüzeye çıkar.
const PARCA_YENILEME_ANAHTARI = "parca_yenilendi";
const dayanikliLazy = (yukleyici) => lazy(() =>
  yukleyici().then((mod) => {
    try { sessionStorage.removeItem(PARCA_YENILEME_ANAHTARI); } catch (_e) { /* önemsiz */ }
    return mod;
  }).catch((hata) => {
    let yenilendi = false;
    try { yenilendi = !!sessionStorage.getItem(PARCA_YENILEME_ANAHTARI); } catch (_e) { /* önemsiz */ }
    if (yenilendi) throw hata;
    try { sessionStorage.setItem(PARCA_YENILEME_ANAHTARI, "1"); } catch (_e) { /* önemsiz */ }
    window.location.reload();
    // Yenileme sürerken bileşen çözülmemeli; aksi halde bir an hata ekranı görünür.
    return new Promise(() => {});
  })
);

// Route-bazlı code splitting: kullanıcı tek oturumda genelde birkaç sayfa
// ziyaret ediyor, ama eskiden 28 sayfanın TAMAMI tek bir ~1.4MB JS paketinde
// birleşip ilk açılışta indiriliyordu. Login/Dashboard/MainLayout hemen her
// oturumda görüldüğü için eager kalıyor, geri kalan sayfalar sadece o rotaya
// gidildiğinde indirilir.
const Users = dayanikliLazy(() => import('./pages/Users'));
const Parts = dayanikliLazy(() => import('./pages/Parts'));
const PartCategories = dayanikliLazy(() => import('./pages/PartCategories'));
const Products = dayanikliLazy(() => import('./pages/Products'));
const Suppliers = dayanikliLazy(() => import('./pages/Suppliers'));
const Locations = dayanikliLazy(() => import('./pages/Locations'));
const Depo = dayanikliLazy(() => import('./pages/Depo'));
const Servis = dayanikliLazy(() => import('./pages/Servis'));
const Irsaliye = dayanikliLazy(() => import('./pages/Irsaliye'));
const WorkOrders = dayanikliLazy(() => import('./pages/WorkOrders'));
const Raporlar = dayanikliLazy(() => import('./pages/Raporlar'));
const Settings = dayanikliLazy(() => import('./pages/Settings'));
const Departments = dayanikliLazy(() => import('./pages/Departments'));
const FlowDgdMapping = dayanikliLazy(() => import('./pages/FlowDgdMapping'));
const CustomerPriceMatrix = dayanikliLazy(() => import('./pages/CustomerPriceMatrix'));
const CustomerTargetPriceMatrix = dayanikliLazy(() => import('./pages/CustomerTargetPriceMatrix'));
const ServiceRecords = dayanikliLazy(() => import('./pages/ServiceRecords'));
const BatchEntry = dayanikliLazy(() => import('./pages/BatchEntry'));
const DataManagement = dayanikliLazy(() => import('./pages/DataManagement'));
const ItemBOM = dayanikliLazy(() => import('./pages/ItemBOM'));
const ServiceTransition = dayanikliLazy(() => import('./pages/ServiceTransition'));
const BatchStatuTransition = dayanikliLazy(() => import('./pages/BatchStatuTransition'));
const TechnicianPanel = dayanikliLazy(() => import('./pages/TechnicianPanel'));
const TechnicianRepairOperations = dayanikliLazy(() => import('./pages/TechnicianRepairOperations'));
const DemontajServisOnarimlari = dayanikliLazy(() => import('./pages/DemontajServisOnarimlari'));
const HizliOnarimBitir = dayanikliLazy(() => import('./pages/HizliOnarimBitir'));
const SchemaMapper = dayanikliLazy(() => import('./pages/SchemaMapper'));
const EtiketTasarimi = dayanikliLazy(() => import('./pages/EtiketTasarimi'));
const CustomerApprovalDecision = dayanikliLazy(() => import('./pages/CustomerApprovalDecision'));
const AraTestSonuc = dayanikliLazy(() => import('./pages/AraTestSonuc'));
const SonTestSonuc = dayanikliLazy(() => import('./pages/SonTestSonuc'));
const StatuKontrol = dayanikliLazy(() => import('./pages/StatuKontrol'));
const ParcaTeslim = dayanikliLazy(() => import('./pages/ParcaTeslim'));
const DepartmentRepairPool = dayanikliLazy(() => import('./pages/DepartmentRepairPool'));

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
              {/* "Müşteri Onay/Red Geldi" — eskiden düz bir statü geçişi ekranıydı, cihazı
                  yalnızca 107'den 136'ya taşıyordu ve orada bırakıyordu (136'dan çıkan aktif
                  geçiş yoktu, cihaz kilitleniyordu). Artık kararın verildiği ekran burası:
                  akış şemasındaki 107 → 136 → 109/124 zincirini tek işlemde yürütür. */}
              <Route path="/musteri-onay-red" element={
                <CustomerApprovalDecision
                  sourceStatu={107}
                  araStatu={136}
                  approveTarget={109}
                  rejectTarget={124}
                  rozet="MÜŞTERİ ONAY/RED GELDİ"
                  baslik="Müşteri Onay/Red Geldi"
                  bosMetin="Müşteri kararı bekleyen cihaz bulunmuyor."
                />
              } />
              <Route path="/technician-panel" element={<TechnicianPanel />} />
              <Route path="/technician-repair" element={<TechnicianRepairOperations />} />
              <Route path="/onarim-havuzu/:deptCode" element={<DepartmentRepairPool />} />
              <Route path="/servis-onarimlari-demontaj" element={<DemontajServisOnarimlari />} />
              {/* Menüde departman başına ayrı görünür, tek bileşen görev grubunu rotadan okur. */}
              <Route path="/hizli-onarim-bitir/:missionGroup" element={<HizliOnarimBitir />} />
              <Route path="/schema-mapper" element={<SchemaMapper />} />
              <Route path="/etiket-tasarimi" element={<EtiketTasarimi />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
