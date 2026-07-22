import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Search, Plus, Trash2, Edit, AlertCircle, RefreshCw, X, Users, Download, Upload, FileSpreadsheet, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';

// Native <select> yerine: modal alt kenara yakınken tarayıcı listeyi
// yukarı açabiliyor. Bu bileşen her zaman aşağı doğru açılır.
function Dropdown({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
      >
        <span className={selected ? '' : 'text-slate-500'}>{selected ? selected.label : (placeholder || 'Seçiniz...')}</span>
        <ChevronDown size={16} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-52 overflow-y-auto z-50">
          {options.map(o => (
            <div
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`px-4 py-2 text-sm cursor-pointer hover:bg-indigo-500/10 ${o.value === value ? 'text-indigo-500 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Backend'deki CUSTOMER_FLOW_VALUES (core/web_bridge.py) ile birebir aynı olmalı.
const FLOW_VALUES = ['Refurbish', 'Repair', 'RMA', 'Battery Replacement'];

const CURRENCY_VALUES = ['TRY', 'EUR', 'USD', 'CHF', 'GBP'];

const LANGUAGE_VALUES = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pt', label: 'Português' }
];

// Toplu (Excel) yükleme şablonundaki sütun sırası ve zorunluluk bilgisi.
// generate_customer_bulk_template (core/web_bridge.py) ile birebir eşleşmeli.
const BULK_TEMPLATE_COLUMNS = [
  { header: 'IMEI Numarası', key: 'imei_number', required: true },
  { header: 'Seri Numarası', key: 'serial_number', required: true },
  { header: 'Internal ID', key: 'internal_id', required: true },
  { header: 'Cihaz Modeli', key: 'cihaz_modeli', required: true },
  { header: 'Flow (İş Akışı)', key: 'flow', required: true },
  { header: 'Müşteri Şikayeti', key: 'customer_reported_complaint', required: true },
  { header: 'Giriş Tarihi', key: 'intake_date', required: true },
  { header: 'Müşteri Adı', key: 'customer_name', required: false },
  { header: 'Müşteri Telefon', key: 'customer_phone', required: false },
  { header: 'Müşteri E-posta', key: 'customer_email', required: false },
  { header: 'Firma', key: 'company', required: false }
];

const EMPTY_FORM = {
  customer_name: '', customer_phone: '', customer_email: '', company: '',
  imei_number: '', serial_number: '', internal_id: '', cihaz_modeli: '',
  flow: '', customer_reported_complaint: '', intake_date: '',
  code: '', short_name: '', currency: '', customer_language: '', use_mio: false
};

export default function Suppliers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Sıralama state'leri (varsayılan: MÜŞTERİ adıp artan sıralama)
  const [sortField, setSortField] = useState('customer_name');
  const [sortDirection, setSortDirection] = useState('asc');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // --- Toplu (Excel) Yükleme state ---
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkRows, setBulkRows] = useState(null);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(null);
  const [templateDownloading, setTemplateDownloading] = useState(false);

  const fetchCustomers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getCustomers();
      if (res && res.success) {
        setCustomers(res.customers || []);
        setError('');
      } else {
        setError(res ? res.message : 'Hata');
      }
    } catch (_err) {
      setError('Müşteriler alınamadı.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    const interval = setInterval(() => fetchCustomers(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setCurrentCustomer(customer);
      setFormData({
        customer_name: customer.customer_name || '',
        customer_phone: customer.customer_phone || '',
        customer_email: customer.customer_email || '',
        company: customer.company || '',
        imei_number: customer.imei_number || '',
        serial_number: customer.serial_number || '',
        internal_id: customer.internal_id || '',
        cihaz_modeli: (customer.brand || customer.model) ? `${customer.brand || ''} ${customer.model || ''}`.trim() : '',
        flow: customer.flow || '',
        customer_reported_complaint: customer.customer_reported_complaint || '',
        intake_date: customer.intake_date || '',
        code: customer.code || '',
        short_name: customer.short_name || '',
        currency: customer.currency || '',
        customer_language: customer.customer_language || '',
        use_mio: Boolean(customer.use_mio)
      });
    } else {
      setCurrentCustomer(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentCustomer(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = currentCustomer
      ? await api.updateCustomer(currentCustomer.id, formData)
      : await api.createCustomer(formData);
    if (res && res.success) {
      fetchCustomers();
      handleCloseModal();
    } else {
      alert(res ? res.message : 'Hata');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu müşteri kaydını silmek istediğinize emin misiniz?')) {
      const res = await api.deleteCustomer(id);
      if (res && res.success) fetchCustomers();
      else alert(res ? res.message : 'Hata');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = !q ? customers : customers.filter(c =>
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.customer_phone && c.customer_phone.toLowerCase().includes(q)) ||
      (c.customer_email && c.customer_email.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.imei_number && c.imei_number.toLowerCase().includes(q)) ||
      (c.serial_number && c.serial_number.toLowerCase().includes(q))
    );

    return [...filtered].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Boş/Null/Undefined değerleri her zaman en sona at
      if ((valA === null || valA === undefined || valA === '') && (valB !== null && valB !== undefined && valB !== '')) return 1;
      if ((valB === null || valB === undefined || valB === '') && (valA !== null && valA !== undefined && valA !== '')) return -1;
      if ((valA === null || valA === undefined || valA === '') && (valB === null || valB === undefined || valB === '')) return 0;

      // Boolean tipi sıralama (Sadece CRM / use_mio için)
      if (sortField === 'use_mio') {
        const boolA = Boolean(valA) ? 1 : 0;
        const boolB = Boolean(valB) ? 1 : 0;
        return sortDirection === 'asc' ? boolA - boolB : boolB - boolA;
      }

      // Metin / Tarih / Kod sıralaması (MÜŞTERİ, FİRMA KODU, GİRİŞ TARİHİ)
      const strA = String(valA).trim();
      const strB = String(valB).trim();
      const cmp = strA.localeCompare(strB, 'tr', { numeric: true, sensitivity: 'base' });

      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [customers, searchTerm, sortField, sortDirection]);

  // ===================== Excel İşlemleri =====================

  const handleExportAll = async () => {
    if (customers.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      return;
    }
    const dataToExport = customers.map(c => ({
      "Müşteri Adı": c.customer_name || '',
      "Müşteri Telefon": c.customer_phone || '',
      "E-posta": c.customer_email || '',
      "Firma": c.company || '',
      "Cihaz Modeli": (c.brand || c.model) ? `${c.brand || ''} ${c.model || ''}`.trim() : '',
      "IMEI Numarası": c.imei_number || '',
      "Seri Numarası": c.serial_number || '',
      "Internal ID": c.internal_id || '',
      "Flow (İş Akışı)": c.flow || '',
      "Giriş Tarihi": c.intake_date || '',
      "Müşteri Şikayeti": c.customer_reported_complaint || ''
    }));
    await api.exportTableToExcel(dataToExport, 'musteriler.xlsx');
  };

  const handleDownloadTemplate = async () => {
    setTemplateDownloading(true);
    const res = await api.downloadCustomerBulkTemplate();
    setTemplateDownloading(false);
    if (!res.success) alert(res.message || 'Şablon indirilemedi.');
  };

  const handleOpenBulkModal = () => {
    setBulkFileName('');
    setBulkRows(null);
    setBulkErrors([]);
    setBulkSuccess(null);
    setShowBulkModal(true);
  };

  const findRawHeader = (rawHeaders, targetHeader) =>
    rawHeaders.find(h => String(h || '').replace(/\*/g, '').trim().toLowerCase() === targetHeader.toLowerCase());

  const handleBulkFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkErrors([]);
    setBulkSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawHeaders = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
        const rawRows = XLSX.utils.sheet_to_json(worksheet);

        const mapped = rawRows
          .map(row => {
            const obj = {};
            BULK_TEMPLATE_COLUMNS.forEach(col => {
              const rawKey = findRawHeader(rawHeaders, col.header);
              let val = rawKey !== undefined ? row[rawKey] : undefined;
              if (val === undefined || val === null) val = '';
              if (col.key === 'intake_date' && val instanceof Date) {
                val = val.toISOString().slice(0, 10);
              }
              obj[col.key] = String(val).trim();
            });
            return obj;
          })
          .filter(row => Object.values(row).some(v => v !== ''));

        if (mapped.length === 0) {
          setBulkRows(null);
          setBulkErrors([{ row: '-', field: '-', message: 'Dosyada içe aktarılacak satır bulunamadı.' }]);
          return;
        }

        const clientErrors = [];
        mapped.forEach((row, idx) => {
          const rowNum = idx + 2;
          BULK_TEMPLATE_COLUMNS.filter(c => c.required).forEach(col => {
            if (!row[col.key]) {
              clientErrors.push({ row: rowNum, field: col.header, message: `${col.header} boş olamaz.` });
            }
          });
        });

        setBulkRows(mapped);
        setBulkErrors(clientErrors);
      } catch (_err) {
        setBulkRows(null);
        setBulkErrors([{ row: '-', field: '-', message: 'Excel dosyası okunamadı. İndirdiğiniz şablonu kullandığınızdan emin olun.' }]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmBulkImport = async () => {
    if (!bulkRows || bulkRows.length === 0 || bulkErrors.length > 0) return;
    setBulkSaving(true);
    const res = await api.bulkImportCustomers(bulkRows);
    setBulkSaving(false);
    if (res.success) {
      setBulkSuccess({ imported: res.imported || bulkRows.length });
      setBulkRows(null);
      fetchCustomers();
    } else {
      setBulkErrors(res.errors && res.errors.length > 0 ? res.errors : [{ row: '-', field: '-', message: res.message || 'İçe aktarma başarısız oldu.' }]);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <Users className="text-indigo-400" size={28}/> Müşteriler
          </h1>
          <p className="text-slate-400 mt-1">Müşteri iletişim ve cihaz kabul (IMEI/Seri No/Flow) bilgilerini yönetin</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-white dark:bg-[#1e2330] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl transition-all font-medium text-sm focus:outline-none focus:border-indigo-500"
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'download_template') handleDownloadTemplate();
              if (val === 'import_excel') handleOpenBulkModal();
              if (val === 'export_all') handleExportAll();
              e.target.value = '';
            }}
          >
            <option value="">Excel İşlemleri</option>
            <option value="download_template">Boş Şablon İndir</option>
            <option value="import_excel">Excel'den İçe Aktar</option>
            <option value="export_all">Tümünü Dışa Aktar</option>
          </select>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-medium text-sm"
          >
            <Plus size={18} />
            <span>Yeni Ekle</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-500/20 shrink-0">
          <AlertCircle size={20} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-4 shrink-0">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="text-slate-400" size={18} />
          </div>
          <input
            type="text"
            placeholder="Ara (Müşteri Adı, Posta Kodu, E-posta, Firma)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase text-xs sticky top-0 z-10 select-none">
              <tr>
                <th
                  className={`px-6 py-4 cursor-pointer transition-colors select-none ${sortField === 'customer_name' ? 'text-indigo-400 font-semibold' : 'hover:text-slate-200'}`}
                  onClick={() => handleSort('customer_name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>MÜŞTERİ</span>
                    {sortField === 'customer_name' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />
                    ) : (
                      <ChevronUp size={14} className="text-slate-600 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th
                  className={`px-6 py-4 cursor-pointer transition-colors select-none ${sortField === 'code' ? 'text-indigo-400 font-semibold' : 'hover:text-slate-200'}`}
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>FİRMA KODU</span>
                    {sortField === 'code' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />
                    ) : (
                      <ChevronUp size={14} className="text-slate-600 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th
                  className={`px-6 py-4 cursor-pointer transition-colors select-none ${sortField === 'use_mio' ? 'text-indigo-400 font-semibold' : 'hover:text-slate-200'}`}
                  onClick={() => handleSort('use_mio')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>CRM</span>
                    {sortField === 'use_mio' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />
                    ) : (
                      <ChevronUp size={14} className="text-slate-600 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th
                  className={`px-6 py-4 cursor-pointer transition-colors select-none ${sortField === 'intake_date' ? 'text-indigo-400 font-semibold' : 'hover:text-slate-200'}`}
                  onClick={() => handleSort('intake_date')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>GİRİŞ TARİHİ</span>
                    {sortField === 'intake_date' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />
                    ) : (
                      <ChevronUp size={14} className="text-slate-600 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-right">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
                    <span className="font-medium">Yükleniyor...</span>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-700 dark:text-slate-300">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{customer.customer_name || '-'}</div>
                      <div className="text-xs text-slate-400">{customer.customer_phone}{(customer.company && customer.company !== customer.customer_name) ? ` · ${customer.company}` : ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.code || customer.currency ? (
                        <>
                          <div className="font-mono text-slate-800 dark:text-slate-200">{customer.code || '-'}</div>
                          <div className="text-xs text-slate-400">{customer.currency}</div>
                        </>
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        customer.use_mio
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {customer.use_mio ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{customer.intake_date || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(customer)}
                          className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                          title="Sil"
                        >
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
      </div>

      {/* Ekle/Düzenle Modalı */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-[#0f1219]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#242a38]">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users size={20} className="text-indigo-400"/>
                {currentCustomer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}
              </h2>
              <button type="button" onClick={handleCloseModal} className="text-slate-400 hover:text-slate-900 dark:text-white transition-colors bg-white dark:bg-[#1e2330] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">Müşteri Adı <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Örn. Jean Dupont"
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                  value={formData.customer_name}
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">Posta Kodu</label>
                  <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.customer_phone} onChange={e => setFormData({...formData, customer_phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">E-posta</label>
                  <input type="email" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.customer_email} onChange={e => setFormData({...formData, customer_email: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">Firma</label>
                <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Firma Master Verisi</p>
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Kod</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Kısa Ad</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.short_name} onChange={e => setFormData({...formData, short_name: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Para Birimi</label>
                    <Dropdown
                      value={formData.currency}
                      onChange={cur => setFormData({...formData, currency: cur})}
                      options={CURRENCY_VALUES.map(cur => ({ value: cur, label: cur }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Müşteri Dili</label>
                    <Dropdown
                      value={formData.customer_language}
                      onChange={lang => setFormData({...formData, customer_language: lang})}
                      options={LANGUAGE_VALUES}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600" checked={formData.use_mio} onChange={e => setFormData({...formData, use_mio: e.target.checked})} />
                  <span className="text-sm text-slate-600 dark:text-slate-300">CRM</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- TOPLU (EXCEL) YÜKLEME MODALI --- */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !bulkSaving && setShowBulkModal(false)}>
          <div
            className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#242a38]">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-teal-500" /> Toplu Müşteri / Cihaz Girişi
              </h2>
              <button onClick={() => !bulkSaving && setShowBulkModal(false)} className="text-slate-400 hover:text-slate-900 dark:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {bulkSuccess ? (
                <div className="flex flex-col items-center text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Check className="text-emerald-500" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">İçe Aktarma Tamamlandı</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{bulkSuccess.imported} müşteri kaydı başarıyla eklendi.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Önce <strong>Şablon İndir</strong> ile örnek dosyayı indirin, doldurun ve buradan yükleyin. IMEI/Seri Numarası/Internal ID/Cihaz Modeli/Flow/Müşteri Şikayeti/Giriş Tarihi alanları zorunludur; herhangi biri boş veya geçersizse dosyanın tamamı reddedilir.
                  </p>

                  <label className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-[#242a38]/50 cursor-pointer hover:border-teal-500 transition-colors">
                    <Upload size={28} className="text-slate-400 mb-3" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {bulkFileName || 'Doldurulmuş şablon dosyasını seçin (.xlsx)'}
                    </span>
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleBulkFileUpload} />
                  </label>

                  {bulkErrors.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-red-500 font-semibold text-sm mb-2">
                        <AlertCircle size={16} /> {bulkErrors.length} hata bulundu — hiçbir kayıt içe aktarılmadı
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-red-500/10 text-xs">
                        {bulkErrors.map((err, idx) => (
                          <div key={idx} className="py-1.5 text-red-500 dark:text-red-400">
                            <span className="font-mono font-semibold">Satır {err.row}</span>
                            {err.field && err.field !== '-' ? ` — ${err.field}: ` : ' — '}
                            {err.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bulkRows && bulkErrors.length === 0 && (
                    <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                      <Check size={16} /> {bulkRows.length} satır bulundu, içe aktarmaya hazır.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6">
              {bulkSuccess ? (
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20"
                >
                  Kapat
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    disabled={bulkSaving}
                    className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBulkImport}
                    disabled={!bulkRows || bulkErrors.length > 0 || bulkSaving}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-900/20 flex items-center gap-2"
                  >
                    <Upload size={16} /> {bulkSaving ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
