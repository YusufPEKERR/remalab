import { useState, useEffect, useCallback, useMemo } from 'react';
import { Target, Plus, Trash2, X, Save, RefreshCw, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

// Excel içe aktarma sütunları (ExcelMappingModal'a verilen dbColumns/friendlyNames) -
// backend (bulk_import_customer_target_prices) Müşteri/Model'i KOD veya OKUNAKLI
// İSİMLE çözer, kullanıcı Excel'e product_family_code gibi içsel kodları bilmek
// zorunda kalmaz.
const IMPORT_DB_COLUMNS = ['musteri', 'model', 'screen_test', 'power_test', 'hedef_fiyat'];
const IMPORT_FRIENDLY_NAMES = {
  musteri: 'Müşteri (kod veya ad)',
  model: 'Model (kod veya cihaz adı)',
  screen_test: 'Screen Test (OK/NOK/BOŞ)',
  power_test: 'Power Test (OK/NOK) *',
  hedef_fiyat: 'Hedef Fiyat',
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

const TEST_RESULT_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'NOK', label: 'NOK' },
  { value: 'BOŞ', label: 'BOŞ (test yapılmamış)' },
];

// Power Test, Screen Test'ten daha üstün/öncelikli bir alandır (fiyatlandırma kuralı
// Power Test sonucuna dayanıyor) - bu yüzden BOŞ seçeneği yok, her zaman OK ya da NOK
// seçilmek zorunda.
const POWER_TEST_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'NOK', label: 'NOK' },
];

const selectClass = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed";
const inputClass = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none";

// ─── YENİ KURAL EKLE MODALI ──────────────────────────────────────────
// Model her zaman zorunludur; marka seçilince modeller yüklenir, model
// seçilince ürün tipi otomatik (salt-okunur) görünür - backend de brand/
// product_type'ı istemciden almaz, product_family_code'dan kendisi türetir.
const AddRuleModal = ({ customers, onClose, onSave, submitting }) => {
  const [customerCode, setCustomerCode] = useState('');
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [screenResult, setScreenResult] = useState('OK');
  const [powerResult, setPowerResult] = useState('OK');
  const [targetPrice, setTargetPrice] = useState('');

  useEffect(() => {
    api.getTargetPriceBrands().then(res => { if (res.success) setBrands(res.brands || []); });
  }, []);

  useEffect(() => {
    setSelectedModel('');
    if (!selectedBrand) { setModels([]); return undefined; }
    let cancelled = false;
    setModelsLoading(true);
    api.getTargetPriceModels(selectedBrand)
      .then(res => { if (!cancelled && res.success) setModels(res.models || []); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBrand]);

  const selectedModelInfo = models.find(m => m.value === selectedModel);
  const priceNum = parseFloat(targetPrice);
  const priceInvalid = targetPrice.trim() !== '' && (Number.isNaN(priceNum) || priceNum < 0);
  const canSave = customerCode && selectedModel && targetPrice.trim() !== '' && !priceInvalid && !submitting;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#181a24] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e222d] max-w-lg w-full mx-4 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e222d] flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Target size={18} className="text-slate-400" /> Yeni Hedef Fiyat Kuralı
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Müşteri</label>
            <select value={customerCode} onChange={e => setCustomerCode(e.target.value)} className={selectClass}>
              <option value="">Müşteri seçin...</option>
              {customers.map(c => <option key={c.code} value={c.code}>{c.short_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Marka</label>
              <select value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)} className={selectClass}>
                <option value="">Marka seçin...</option>
                {brands.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Model *</label>
              <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={!selectedBrand || modelsLoading} className={selectClass}>
                <option value="">{modelsLoading ? 'Yükleniyor...' : 'Model seçin...'}</option>
                {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {selectedModelInfo && (
            <div className="text-xs text-slate-500 dark:text-slate-400 px-1">
              Ürün Tipi (otomatik): <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedModelInfo.productType}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Screen Test</label>
              <select value={screenResult} onChange={e => setScreenResult(e.target.value)} className={selectClass}>
                {TEST_RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Power Test *</label>
              <select value={powerResult} onChange={e => setPowerResult(e.target.value)} className={selectClass}>
                {POWER_TEST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Hedef Fiyat *</label>
            <input
              type="number" step="0.01" min="0" value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} ${priceInvalid ? 'border-red-400 dark:border-red-500/60 focus:ring-red-500' : ''}`}
            />
            {priceInvalid && (
              <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={13} /> Hedef fiyat negatif olamaz.
              </p>
            )}
          </div>
        </div>
        <div className="px-5 pb-5 pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-700">
            İptal
          </button>
          <button
            onClick={() => onSave({ customerCode, productFamilyCode: selectedModel, screenResult, powerResult, targetPrice })}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-md flex items-center justify-center gap-1.5"
          >
            <Save size={15} /> {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CustomerTargetPriceMatrix() {
  const [customers, setCustomers] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  const loadAll = useCallback(async (customerCode) => {
    setLoading(true);
    const [custRes, rulesRes] = await Promise.all([
      api.getTargetPriceCustomers(),
      api.getCustomerTargetPrices(customerCode || ''),
    ]);
    if (custRes.success) setCustomers(custRes.customers || []);
    if (rulesRes.success) setRules(rulesRes.rules || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(filterCustomer); }, [filterCustomer, loadAll]);

  const customerName = useMemo(() => {
    const map = {};
    for (const c of customers) map[c.code] = c.short_name;
    return map;
  }, [customers]);

  const handleAddRule = async ({ customerCode, productFamilyCode, screenResult, powerResult, targetPrice }) => {
    setSubmitting(true);
    const res = await api.createCustomerTargetPrice(customerCode, productFamilyCode, screenResult, powerResult, targetPrice, getCurrentUser()?.username);
    setSubmitting(false);
    if (res.success) {
      setShowAddModal(false);
      await loadAll(filterCustomer);
    } else {
      alert(res.message || 'Kural eklenemedi.');
    }
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setEditingPrice(String(rule.targetPrice));
  };

  const saveEdit = async (id) => {
    const priceNum = parseFloat(editingPrice);
    if (editingPrice.trim() === '' || Number.isNaN(priceNum) || priceNum < 0) {
      alert('Hedef fiyat negatif olamaz ve geçerli bir sayı olmalıdır.');
      return;
    }
    const res = await api.updateCustomerTargetPrice(id, editingPrice, getCurrentUser()?.username);
    if (res.success) {
      setEditingId(null);
      await loadAll(filterCustomer);
    } else {
      alert(res.message || 'Güncellenemedi.');
    }
  };

  const handleDelete = async (rule) => {
    const res = await api.deleteCustomerTargetPrice(rule.id);
    if (res.success) {
      await loadAll(filterCustomer);
    } else {
      alert(res.message || 'Silinemedi.');
    }
  };

  // ── Excel Şablon / Dışa Aktar / İçe Aktar ─────────────────────
  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';

    if (action === 'download_template') {
      const templateData = [{
        'Müşteri (kod veya ad)': 'Recommerce SA',
        'Model (kod veya cihaz adı)': 'iPhone 14',
        'Screen Test (OK/NOK/BOŞ)': 'OK',
        'Power Test (OK/NOK) *': 'NOK',
        'Hedef Fiyat': 100,
      }];
      await api.exportTableToExcel(templateData, 'hedef_fiyat_matrisi_sablonu.xlsx');
    } else if (action === 'export') {
      const exportData = rules.map(r => ({
        'Müşteri': customerName[r.customerCode] || r.customerCode,
        'Marka': r.brand,
        'Model': r.productFamilyCode,
        'Ürün Tipi': r.productType,
        'Screen Test': r.screenTestResult,
        'Power Test': r.powerTestResult,
        'Hedef Fiyat': r.targetPrice,
        'Para Birimi': r.currency,
      }));
      await api.exportTableToExcel(exportData, 'musteri_hedef_fiyat_matrisi.xlsx');
    } else if (action === 'import') {
      setImportErrors([]);
      setIsExcelModalOpen(true);
    }
  };

  const handleExcelImport = async (mappedRows) => {
    setImporting(true);
    const res = await api.bulkImportCustomerTargetPrices(mappedRows, getCurrentUser()?.username);
    setImporting(false);
    if (res.success) {
      setIsExcelModalOpen(false);
      setImportErrors([]);
      await loadAll(filterCustomer);
      alert(res.message || `${res.imported} kural içe aktarıldı.`);
    } else {
      setImportErrors(res.errors && res.errors.length > 0 ? res.errors : [{ row: '-', field: '-', message: res.message || 'İçe aktarma başarısız oldu.' }]);
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1400px] mx-auto animate-in fade-in duration-300">
      {showAddModal && (
        <AddRuleModal customers={customers} onClose={() => setShowAddModal(false)} onSave={handleAddRule} submitting={submitting} />
      )}

      <ExcelMappingModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        dbColumns={IMPORT_DB_COLUMNS}
        friendlyNames={IMPORT_FRIENDLY_NAMES}
      />
      {importing && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/40">
          <div className="bg-white dark:bg-[#181a24] rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3">
            <RefreshCw size={18} className="animate-spin text-blue-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">İçe aktarılıyor...</span>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(47, 168, 110,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(47, 168, 110,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <Target size={13} className="text-emerald-400" /> FİYATLANDIRMA
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Müşteri Hedef Fiyat Matrisi
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Demontaj'da eklenen parçaların toplam fiyatı, müşteri + model + test sonucuna göre buradaki limiti aşarsa cihaz otomatik Müşteri Onayına gider.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="relative">
              <select
                onChange={handleExcelAction}
                defaultValue=""
                className="appearance-none bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl px-4 py-2.5 pr-9 text-xs font-bold transition-all cursor-pointer focus:outline-none"
              >
                <option value="">Excel İşlemleri...</option>
                <option value="download_template">Boş Şablon İndir</option>
                <option value="export">Dışa Aktar</option>
                <option value="import">Excel'den İçe Aktar</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2.5 pointer-events-none text-[#5A6685] dark:text-[#8892B5]">
                <FileSpreadsheet size={15} />
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus size={16} /> Yeni Kural
            </button>
          </div>
        </div>
      </div>

      {importErrors.length > 0 && (
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm mb-2">
            <AlertCircle size={16} /> İçe aktarma başarısız — hiçbir kayıt eklenmedi ({importErrors.length} hata)
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {importErrors.map((err, i) => (
              <div key={i} className="text-xs text-red-600 dark:text-red-400">
                Satır {err.row} — <span className="font-semibold">{err.field}:</span> {err.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#DCE1F1] dark:border-[#1e222d] bg-[#F5F7FC] dark:bg-[#181a24] flex items-center gap-3 flex-wrap">
          <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className={`${selectClass} max-w-xs`}>
            <option value="">Tüm müşteriler</option>
            {customers.map(c => <option key={c.code} value={c.code}>{c.short_name}</option>)}
          </select>
          <button onClick={() => loadAll(filterCustomer)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1e222d] transition-colors" title="Yeniden Yükle">
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-400' : 'text-slate-400'} />
          </button>
          {!loading && <span className="text-xs text-slate-400 font-medium">{rules.length} kural</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#181a24] text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Müşteri</th>
                <th className="px-4 py-3">Marka</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Ürün Tipi</th>
                <th className="px-4 py-3 text-center">Screen Test</th>
                <th className="px-4 py-3 text-center">Power Test</th>
                <th className="px-4 py-3 text-right">Hedef Fiyat</th>
                <th className="px-4 py-3 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-400" /></td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-500">Henüz kural tanımlanmamış.</td></tr>
              ) : (
                rules.map(rule => (
                  <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-[#1e222d] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{customerName[rule.customerCode] || rule.customerCode}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{rule.brand}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">{rule.productFamilyCode}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{rule.productType}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${rule.screenTestResult === 'OK' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : rule.screenTestResult === 'NOK' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                        {rule.screenTestResult}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${rule.powerTestResult === 'OK' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : rule.powerTestResult === 'NOK' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                        {rule.powerTestResult}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editingId === rule.id ? (
                        <input
                          type="number" step="0.01" min="0" autoFocus value={editingPrice}
                          onChange={e => setEditingPrice(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(rule.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="w-24 text-right px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-500/40 bg-white dark:bg-[#12141c] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <button onClick={() => startEdit(rule)} className="font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" title="Düzenlemek için tıklayın">
                          {rule.targetPrice.toFixed(2)} {rule.currency}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {editingId === rule.id ? (
                          <>
                            <button onClick={() => saveEdit(rule.id)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors" title="Kaydet">
                              <Save size={14} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Vazgeç">
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleDelete(rule)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Sil">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
