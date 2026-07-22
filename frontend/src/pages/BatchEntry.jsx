import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, FileSpreadsheet, Search, RefreshCw, RotateCcw, User, Wrench, Smartphone, AlertCircle, Layers, Check } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

const FLOW_OPTIONS = ['Hepsi', 'Refurbish', 'Repair', 'RMA', 'Battery Replacement'];
const GB_OPTIONS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];

const FLOW_STYLES = {
  'Hepsi': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Refurbish': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Repair': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'RMA': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Battery Replacement': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};

const CURRENCY_OPTIONS = ['TRY', 'EUR', 'USD', 'CHF', 'GBP'];

const CURRENCY_SYMBOLS = {
  'TRY': '₺', 'EUR': '€', 'USD': '$', 'CHF': 'CHF', 'GBP': '£'
};

const EMPTY_FORM = {
  customer_no: '',
  customer_name: '',
  imei_number: '',
  serial_number: '',
  internal_id: '',
  batch_no: '',
  model: '',
  gb: '',
  color: '',
  unit_price: '',
  currency: 'TRY',
  defects: '',
  screen_test: '',
  power_test: '',
  flow: 'Refurbish'
};

export default function BatchEntry() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [registeredCustomers, setRegisteredCustomers] = useState([]);

  useEffect(() => {
    const fetchCustomersList = async () => {
      try {
        const res = await api.getCustomers();
        if (res && res.success) {
          setRegisteredCustomers(res.customers || []);
        }
      } catch (err) {
        console.error("Müşteriler yüklenemedi:", err);
      }
    };
    fetchCustomersList();
  }, []);

  // Batch Summary Table Modal State
  const [isBatchSummaryModalOpen, setIsBatchSummaryModalOpen] = useState(false);
  const [batchSummaryList, setBatchSummaryList] = useState([]);
  const [loadingBatchSummary, setLoadingBatchSummary] = useState(false);
  const [summarySearch, setSummarySearch] = useState('');

  const handleFetchBatchSummary = async () => {
    setIsBatchSummaryModalOpen(true);
    setLoadingBatchSummary(true);
    const res = await api.getBatchSummary();
    if (res.success) {
      setBatchSummaryList(res.batches || []);
    }
    setLoadingBatchSummary(false);
  };

  // Pagination & Filters & Bulk Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlow, setSelectedFlow] = useState('Tümü');
  const [selectedIds, setSelectedIds] = useState([]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pageIds = records.map(r => r.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = records.map(r => r.id);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllSelected = records.length > 0 && records.every(r => selectedIds.includes(r.id));

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (window.confirm(`Seçilen ${selectedIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      setLoading(true);
      const res = await api.bulkDeleteBatchEntries(selectedIds);
      if (res.success) {
        setSelectedIds([]);
        fetchRecords();
      } else {
        alert("Toplu silme hatası: " + (res.message || ""));
      }
      setLoading(false);
    }
  };

  const handleBulkFlowChange = async (newFlow) => {
    if (!selectedIds.length || !newFlow) return;
    setLoading(true);
    const res = await api.bulkUpdateBatchFlow(selectedIds, newFlow);
    if (res.success) {
      setSelectedIds([]);
      fetchRecords();
    } else {
      alert("Toplu akış güncelleme hatası: " + (res.message || ""));
    }
    setLoading(false);
  };

  const dbColumns = [
    "customer_no", "customer_name", "batch_no", "internal_id", "imei_number",
    "serial_number", "model", "gb", "color", "defects", "screen_test",
    "power_test", "flow", "unit_price"
  ];

  const friendlyNames = {
    customer_no: "Müşteri No (Customer no)",
    customer_name: "Müşteri Adı (Customer Name)",
    batch_no: "Batch No (Batch No)",
    internal_id: "Internal ID (Internal ID)",
    imei_number: "IMEI Numarası (IMEI Number)",
    serial_number: "Seri Numarası (Serial Number)",
    model: "Model (Model)",
    gb: "GB (GB)",
    color: "Renk (Color)",
    defects: "Kusur/Arıza (Defects)",
    screen_test: "Ekran Testi (Screen Test)",
    power_test: "Güç Testi (Power Test)",
    flow: "Akış Durumu (Flow)",
    unit_price: "Birim Fiyat (Unit Price)"
  };

  const fetchRecords = async (page = currentPage, pageSize = itemsPerPage, search = searchTerm, flow = selectedFlow) => {
    setLoading(true);
    const res = await api.getBatchEntries(page, pageSize, search, flow);
    if (res.success) {
      setRecords(res.records || []);
      setTotalCount(res.total || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords(currentPage, itemsPerPage, searchTerm, selectedFlow);
  }, [currentPage, itemsPerPage, searchTerm, selectedFlow]);

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

  const [autoFilledMessage, setAutoFilledMessage] = useState('');

  const handleAutoLookup = async (fieldKey, value) => {
    const updated = { ...formData, [fieldKey]: value };
    setFormData(updated);

    const term = String(value || '').trim();
    if (term.length >= 2) {
      const res = await api.lookupBatchEntry(term);
      if (res.success && res.found && res.data) {
        setFormData(prev => ({
          ...res.data,
          [fieldKey]: value
        }));
        setAutoFilledMessage(`Kayıtlı cihaz bulundu! "${term}" eşleşmesine göre tüm bilgiler otomatik dolduruldu.`);
        setTimeout(() => setAutoFilledMessage(''), 6000);
      }
    }
  };

  const handleOpenModal = (record = null) => {
    setAutoFilledMessage('');
    if (record) {
      setEditingRecord(record);
      setFormData({
        customer_no: record.customer_no || '',
        customer_name: record.customer_name || '',
        imei_number: record.imei_number || '',
        serial_number: record.serial_number || '',
        internal_id: record.internal_id || '',
        batch_no: record.batch_no || '',
        model: record.model || '',
        gb: record.gb || '',
        color: record.color || '',
        unit_price: record.unit_price || '',
        currency: record.currency || 'EUR',
        defects: record.defects || '',
        screen_test: record.screen_test || '',
        power_test: record.power_test || '',
        flow: record.flow || 'Refurbish'
      });
    } else {
      setEditingRecord(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const imei = (formData.imei_number || '').trim();
    if (!imei || imei.length !== 15 || !/^\d{15}$/.test(imei)) {
      alert("Hata: IMEI numarası 15 haneli ve sadece rakamlardan oluşmalıdır.");
      return;
    }

    let res;
    if (editingRecord) {
      res = await api.updateBatchEntry(editingRecord.id, formData);
    } else {
      res = await api.createBatchEntry(formData);
    }

    if (res.success) {
      setIsModalOpen(false);
      fetchRecords();
    } else {
      alert("Hata: " + (res.message || "İşlem gerçekleştirilemedi."));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu Batch kaydını silmek istediğinize emin misiniz?")) {
      const res = await api.deleteBatchEntry(id);
      if (res.success) {
        fetchRecords();
      } else {
        alert("Silme başarısız: " + (res.message || ""));
      }
    }
  };

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';

    if (action === 'download_template') {
      const templateData = [{
        customer_no: 'CUST-001',
        customer_name: 'Örnek Müşteri Ltd.',
        batch_no: 'BATCH-2026-01',
        internal_id: 'INT-9901',
        imei_number: '358901234567890',
        serial_number: 'SN99887766',
        model: 'iPhone 13 Pro',
        gb: '128GB',
        color: 'Graphite',
        defects: 'Dokunmatik yanıt vermiyor',
        screen_test: 'BAŞARISIZ',
        power_test: 'BAŞARILI',
        flow: 'Refurbish',
        unit_price: 1500
      }];
      await api.exportTableToExcel(templateData, "Batch_Entry_Template.xlsx");
    } else if (action === 'export') {
      setLoading(true);
      const allRes = await api.getBatchEntries(1, 10000, searchTerm, selectedFlow);
      setLoading(false);
      if (allRes.success && allRes.records) {
        const exportData = allRes.records.map(r => ({
          "Customer no": r.customer_no,
          "Customer Name": r.customer_name,
          "Batch No": r.batch_no,
          "Internal ID": r.internal_id,
          "IMEI Number": r.imei_number,
          "Serial Number": r.serial_number,
          "Model": r.model,
          "GB": r.gb,
          "Color": r.color,
          "Defects": r.defects,
          "Screen Test": r.screen_test,
          "Power Test": r.power_test,
          "Flow": r.flow,
          "Unit Price": r.unit_price
        }));
        await api.exportTableToExcel(exportData, "batch_giris_listesi.xlsx");
      }
    } else if (action === 'import') {
      setIsExcelModalOpen(true);
    }
  };

  const handleExcelImport = async (data) => {
    const getVal = (item, keys, fallback = '') => {
      for (const k of keys) {
        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
          return String(item[k]).trim();
        }
      }
      return fallback;
    };

    for (const item of data) {
      await api.createBatchEntry({
        customer_no: getVal(item, ["customer_no", "Customer no", "Customer No", "Customer NO", "Müşteri No", "Musteri No", "Müşt. No"]),
        customer_name: getVal(item, ["customer_name", "Customer Name", "Customer name", "Customer NAME", "Müşteri Adı", "Musteri Adi", "Müşteri Unvanı"]),
        batch_no: getVal(item, ["batch_no", "Batch No", "Batch no", "Batch NO", "Parti No"]),
        internal_id: getVal(item, ["internal_id", "Internal ID", "Internal Id", "Internal id", "Dahili ID"]),
        imei_number: getVal(item, ["imei_number", "IMEI Number", "IMEI number", "IMEI", "Imei"]),
        serial_number: getVal(item, ["serial_number", "Serial Number", "Serial number", "SN", "Seri No"]),
        model: getVal(item, ["model", "Model", "MODEL", "Cihaz Modeli"]),
        gb: getVal(item, ["gb", "GB", "Gb", "Kapasite"]),
        color: getVal(item, ["color", "Color", "Renk"]),
        defects: getVal(item, ["defects", "Defects", "Arıza", "Kusur"]),
        screen_test: getVal(item, ["screen_test", "Screen Test", "Ekran Testi"]),
        power_test: getVal(item, ["power_test", "Power Test", "Güç Testi"]),
        flow: getVal(item, ["flow", "Flow", "Akış", "Durum"], "Refurbish"),
        unit_price: parseFloat(getVal(item, ["unit_price", "Unit Price", "Birim Fiyat", "Fiyat"], "0")) || 0
      });
    }
    setIsExcelModalOpen(false);
    fetchRecords();
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Batch Girişi Yönetimi</h1>
          <p className="text-slate-400 mt-1">Müşteri parti cihazlarını, servis ve arıza akış bilgilerini buradan yönetin.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFetchBatchSummary}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-xl transition-all font-medium text-sm shadow-sm"
          >
            <Layers size={16} />
            Batch Tablosu (Özet)
          </button>
          <div className="relative">
            <select
              onChange={handleExcelAction}
              className="appearance-none bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
            >
              <option value="">Excel İşlemi Seç...</option>
              <option value="download_template">Boş Şablon İndir</option>
              <option value="export">Tümünü Dışa Aktar</option>
              <option value="import">Excel'den İçe Aktar</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
              <FileSpreadsheet size={16} />
            </div>
          </div>
          <button
            onClick={() => handleOpenModal(null)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-sm shadow-lg shadow-blue-500/20"
          >
            <Plus size={18} />
            Yeni Batch Girişi
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#1a1f2b] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Müşteri, IMEI, Seri No, Batch No veya Model ile ara..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="w-44">
            <select
              value={selectedFlow}
              onChange={(e) => { setSelectedFlow(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 shadow-sm cursor-pointer"
            >
              <option value="Tümü">Akış: Tümü</option>
              {FLOW_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {(searchTerm || selectedFlow !== 'Tümü') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedFlow('Tümü');
                setCurrentPage(1);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-xl transition-colors font-medium"
            >
              <RotateCcw size={14} />
              Temizle
            </button>
          )}

          {/* Bulk Actions Panel */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-1.5 rounded-xl text-xs font-medium animate-in fade-in ml-auto">
              <span><b>{selectedIds.length}</b> kayıt seçildi</span>
              <div className="h-4 w-px bg-blue-500/30 mx-1" />
              <select
                onChange={e => {
                  if (e.target.value) handleBulkFlowChange(e.target.value);
                  e.target.value = '';
                }}
                className="bg-white dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border border-blue-500/30 rounded-lg px-2.5 py-1 text-xs cursor-pointer focus:outline-none"
              >
                <option value="">Toplu Akış Değiştir...</option>
                {FLOW_OPTIONS.filter(f => f !== 'Hepsi').map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Trash2 size={13} /> Seçilenleri Sil
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-slate-200 p-1"
                title="Seçimi Temizle"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-center w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">Müşteri</th>
                <th className="px-6 py-4">Servis & Batch Bilgisi</th>
                <th className="px-6 py-4">Cihaz</th>
                <th className="px-6 py-4">Fiyat</th>
                <th className="px-6 py-4">Kusur / Testler</th>
                <th className="px-6 py-4">Akış Durumu</th>
                <th className="px-6 py-4 text-xs">Tarih</th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-400" /></td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                </tr>
              ) : (
                records.map(rec => (
                  <tr key={rec.id} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 transition-colors ${selectedIds.includes(rec.id) ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`}>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rec.id)}
                        onChange={() => handleToggleSelect(rec.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{rec.customer_name || '-'}</div>
                      <div className="text-xs text-slate-400 font-mono">No: {rec.customer_no || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div><span className="font-semibold text-slate-400">IMEI:</span> <span className="font-mono">{rec.imei_number || '-'}</span></div>
                      <div><span className="font-semibold text-slate-400">SN:</span> <span className="font-mono">{rec.serial_number || '-'}</span></div>
                      <div><span className="font-semibold text-slate-400">Batch / Internal:</span> {rec.batch_no || '-'} / {rec.internal_id || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-blue-400">{rec.model || '-'}</div>
                      <div className="text-xs text-slate-400">{[rec.gb, rec.color].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-400">
                      {CURRENCY_SYMBOLS[rec.currency] || rec.currency || '€'}{Number(rec.unit_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="max-w-xs truncate font-medium text-slate-700 dark:text-slate-300" title={rec.defects}>
                        {rec.defects || '-'}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        Scr: <span className="text-slate-200">{rec.screen_test || '-'}</span> | Pwr: <span className="text-slate-200">{rec.power_test || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${FLOW_STYLES[rec.flow] || FLOW_STYLES['Refurbish']}`}>
                        {rec.flow}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {rec.created_at}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => handleOpenModal(rec)} className="text-slate-400 hover:text-green-400 transition-colors" title="Düzenle">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(rec.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Sil">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#1a1f2b] flex items-center justify-between text-xs text-slate-400">
          <div>Toplam <b>{totalCount}</b> kayıt</div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 disabled:opacity-40 rounded-lg"
            >
              ← Önceki
            </button>
            <span>Sayfa {currentPage} / {totalPages}</span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 disabled:opacity-40 rounded-lg"
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>

      {/* YENİ BATCH GİRİŞİ MODAL FORMU (4 Bölüm) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-[#1e2330] z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-blue-500" />
                {editingRecord ? 'Batch Kaydını Düzenle' : 'Yeni Batch Girişi'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {autoFilledMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <Check size={16} />
                  <span>{autoFilledMessage}</span>
                </div>
              )}

              {/* BÖLÜM 1: Müşteri Bilgileri */}
              <div className="bg-slate-50/50 dark:bg-[#242a38]/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2 uppercase tracking-wider">
                    <User size={16} /> 1. Müşteri Bilgileri
                  </h3>
                  {registeredCustomers.length > 0 && (
                    <span className="text-xs text-slate-400"><b>{registeredCustomers.length}</b> kayıtlı müşteri hazır</span>
                  )}
                </div>

                {registeredCustomers.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Müşteriler Modülünden Seç:</label>
                    <select
                      onChange={e => {
                        const selectedId = e.target.value;
                        if (!selectedId) return;
                        const cust = registeredCustomers.find(c => String(c.id) === String(selectedId));
                        if (cust) {
                          setFormData(prev => ({
                            ...prev,
                            customer_no: cust.code || cust.customer_name || prev.customer_no,
                            customer_name: cust.short_name || cust.customer_name || cust.company || prev.customer_name,
                            currency: cust.currency && CURRENCY_OPTIONS.includes(cust.currency) ? cust.currency : prev.currency
                          }));
                        }
                      }}
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">-- Müşteri Seçerek Otomatik Doldur --</option>
                      {registeredCustomers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `[${c.code}] ` : ''}{c.short_name || c.customer_name || c.company || 'İsimsiz Müşteri'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Customer No (Müşteri No)</label>
                    <input
                      type="text"
                      list="customer-list-no"
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.customer_no}
                      onChange={e => setFormData({ ...formData, customer_no: e.target.value })}
                      placeholder="Örn: CUST-001"
                    />
                    <datalist id="customer-list-no">
                      {registeredCustomers.map(c => (
                        <option key={c.id} value={c.code || c.customer_name}>
                          {c.short_name || c.customer_name || c.company}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Customer Name (Müşteri Adı)</label>
                    <input
                      type="text"
                      list="customer-list-name"
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.customer_name}
                      onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                      placeholder="Örn: ABC İletişim Ltd."
                    />
                    <datalist id="customer-list-name">
                      {registeredCustomers.map(c => (
                        <option key={c.id} value={c.short_name || c.customer_name || c.company}>
                          {c.code ? `Kod: ${c.code}` : ''}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* BÖLÜM 2: Servis Bilgileri */}
              <div className="bg-slate-50/50 dark:bg-[#242a38]/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <Wrench size={16} /> 2. Servis Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      IMEI Number (IMEI Numarası) <span className="text-red-400 font-semibold">* (15 Haneli)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-mono tracking-wider"
                      value={formData.imei_number}
                      onChange={e => handleAutoLookup('imei_number', e.target.value.replace(/\D/g, ''))}
                      onBlur={e => handleAutoLookup('imei_number', e.target.value.replace(/\D/g, ''))}
                      placeholder="15 haneli IMEI giriniz"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Serial Number (Seri Numarası)</label>
                    <input
                      type="text"
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.serial_number}
                      onChange={e => handleAutoLookup('serial_number', e.target.value)}
                      onBlur={e => handleAutoLookup('serial_number', e.target.value)}
                      placeholder="Cihaz seri numarası"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Internal ID (Dahili Kimlik)</label>
                    <input
                      type="text"
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.internal_id}
                      onChange={e => handleAutoLookup('internal_id', e.target.value)}
                      onBlur={e => handleAutoLookup('internal_id', e.target.value)}
                      placeholder="İç takip ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Batch No (Parti Numarası)</label>
                    <input
                      type="text"
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.batch_no}
                      onChange={e => handleAutoLookup('batch_no', e.target.value)}
                      onBlur={e => handleAutoLookup('batch_no', e.target.value)}
                      placeholder="Batch grup numarası"
                    />
                  </div>
                </div>
              </div>

              {/* BÖLÜM 3: Cihaz Bilgileri */}
              <div className="bg-slate-50/50 dark:bg-[#242a38]/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <Smartphone size={16} /> 3. Cihaz Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Model (Cihaz Modeli)</label>
                    <input
                      type="text"
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.model}
                      onChange={e => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Örn: iPhone 13 Pro"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">GB (Depolama / Hafıza)</label>
                    <select
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                      value={formData.gb}
                      onChange={e => setFormData({ ...formData, gb: e.target.value })}
                    >
                      <option value="">Hafıza Seçiniz...</option>
                      {GB_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Color (Renk)</label>
                    <input
                      type="text"
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      placeholder="Örn: Graphite, Siyah"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Unit Price (Birim Fiyat)</label>
                    <div className="flex gap-2">
                      <select
                        className="w-28 bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      >
                        {CURRENCY_OPTIONS.map(c => (
                          <option key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="flex-1 bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                        value={formData.unit_price}
                        onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BÖLÜM 4: Cihazın Servise Geliş Nedeni & Durum */}
              <div className="bg-slate-50/50 dark:bg-[#242a38]/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <AlertCircle size={16} /> 4. Cihazın Servise Geliş Nedeni & Durum
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Defects (Kusur / Arıza Detayı)</label>
                    <textarea
                      rows={2}
                      className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                      value={formData.defects}
                      onChange={e => setFormData({ ...formData, defects: e.target.value })}
                      placeholder="Müşterinin belirttiği kusur veya arızalar..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Screen Test (Ekran Testi)</label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                        value={formData.screen_test}
                        onChange={e => setFormData({ ...formData, screen_test: e.target.value })}
                        placeholder="Örn: Tamamlandı / Hasarlı"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Power Test (Güç Testi)</label>
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                        value={formData.power_test}
                        onChange={e => setFormData({ ...formData, power_test: e.target.value })}
                        placeholder="Örn: Açılıyor / Şarj Olmuyor"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Flow (Akış / Durum Takibi)</label>
                      <select
                        className="w-full bg-white dark:bg-[#0f1219] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        value={formData.flow}
                        onChange={e => setFormData({ ...formData, flow: e.target.value })}
                      >
                        {FLOW_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium text-sm"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-sm shadow-lg shadow-blue-500/20"
                >
                  {editingRecord ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH ÖZETİ TABLOSU MODALI */}
      {isBatchSummaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-[#1e2330]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Layers size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Batch Tablosu (Parti Özetleri)</h2>
                  <p className="text-xs text-slate-400">Oluşturulan tüm parti gruplarının özet durumları</p>
                </div>
              </div>
              <button onClick={() => setIsBatchSummaryModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#1a1f2b] flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={summarySearch}
                  onChange={e => setSummarySearch(e.target.value)}
                  placeholder="Batch No veya Müşteri Adı ile süz..."
                  className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="overflow-auto flex-1 p-6">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Batch No</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3 text-center">Toplam Cihaz</th>
                    <th className="px-4 py-3">Toplam Tutar</th>
                    <th className="px-4 py-3">Son İşlem Tarihi</th>
                    <th className="px-4 py-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loadingBatchSummary ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center"><RefreshCw className="animate-spin mx-auto text-emerald-400" /></td>
                    </tr>
                  ) : batchSummaryList.filter(b => 
                      (b.batch_no || '').toLowerCase().includes(summarySearch.toLowerCase()) ||
                      (b.customer_name || '').toLowerCase().includes(summarySearch.toLowerCase())
                    ).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">Batch özeti bulunamadı.</td>
                    </tr>
                  ) : (
                    batchSummaryList.filter(b => 
                      (b.batch_no || '').toLowerCase().includes(summarySearch.toLowerCase()) ||
                      (b.customer_name || '').toLowerCase().includes(summarySearch.toLowerCase())
                    ).map((b, idx) => (
                      <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300">
                        <td className="px-4 py-3 font-bold text-blue-400 font-mono">{b.batch_no}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{b.customer_name}</div>
                          <div className="text-xs text-slate-400 font-mono">No: {b.customer_no}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold text-xs">
                            {b.total_devices} Cihaz
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">
                          ₺{Number(b.total_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{b.last_created}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setSearchTerm(b.batch_no === 'Tanımsız Batch' ? '' : b.batch_no);
                              setCurrentPage(1);
                              setIsBatchSummaryModalOpen(false);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                          >
                            Cihazları Listele
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Excel Mapping Modal */}
      <ExcelMappingModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        dbColumns={dbColumns}
        friendlyNames={friendlyNames}
      />
    </div>
  );
}
