import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit, AlertCircle, RefreshCw, X, Download, Upload, FileSpreadsheet, ArrowUpDown, Package } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';
import TextCombobox from '../components/TextCombobox';

// MioCreate.xlsx -> ItemType sayfasındaki kanonik kodların bir alt kümesi.
// "Labour" seçilirse backend (core/web_bridge.py) stok takibini otomatik "Stok Takipsiz" yapar.
const PART_TYPE_OPTIONS = [
  { value: 'SparePart', label: 'SparePart (Yedek Parça)' },
  { value: 'Labour', label: 'Labour (İşçilik)' },
  { value: 'ScrapPart', label: 'ScrapPart (Çıkma Parça)' }
];

const EMPTY_FORM = {
  item_code: '', barcode: '', name: '', model: '', brand: '',
  item_category: '', part_category_id: '',
  department: [], stock_tracking_type: 'Stok Takipli', status: 'Aktif', critical_limit: '',
  memory: [], part_type: ''
};

export default function Parts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPart, setCurrentPart] = useState(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Selection and Export States
  const [selectedRows, setSelectedRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState({
    "ID": true,
    "Parça Kodu": true,
    "Barkod": true,
    "Parça Adı": true,
    "Item Category": true,
    "Parça Kategorisi": true,
    "Parça Tipi": true,
    "Parça Statüsü": true
  });

  const [formData, setFormData] = useState(EMPTY_FORM);

  const [partCategories, setPartCategories] = useState([]);
  const [departmentList, setDepartmentList] = useState([]);
  const [products, setProducts] = useState([]);
  const [productFamilyNames, setProductFamilyNames] = useState([]);

  const PART_STATUSES = ['Aktif', 'Pasif', 'Beklemede', 'Hurda'];

  const dbColumns = ["item_code", "barcode", "name", "item_category", "part_category", "status", "part_type"];
  const friendlyNames = {
    item_code: "Parça Kodu (item_code) *",
    barcode: "Barkod (barcode)",
    name: "Parça Adı (name)",
    item_category: "Item Category (item_category)",
    part_category: "Parça Kategorisi (part_category)",
    status: "Parça Statüsü (status)",
    part_type: "Parça Tipi (part_type)"
  };

  const fetchPartCategories = async () => {
    try {
      const res = await api.getPartCategories();
      if (res.success) {
        setPartCategories(res.categories || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.getMissions('Üretim');
      if (res.success) {
        setDepartmentList((res.missions || []).map(m => m.code));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.getProducts();
      if (res.success) {
        setProducts(res.products || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProductFamilies = async () => {
    try {
      const res = await api.getProductFamilies();
      if (res.success) {
        setProductFamilyNames((res.product_families || []).map(f => f.name));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchParts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getPartsPaginated(currentPage, itemsPerPage, searchTerm, filterDepartment, sortConfig.key || "", sortConfig.direction);
      if (res.success) {
        setParts(res.parts || []);
        setTotalCount(res.total_count || 0);
        setTotalPages(res.total_pages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartCategories();
    fetchDepartments();
    fetchProducts();
    fetchProductFamilies();
  }, []);

  useEffect(() => {
    fetchParts();
  }, [currentPage, itemsPerPage, searchTerm, filterDepartment, sortConfig]);

  useEffect(() => {
    // Başka bilgisayarlardan yapılan değişiklikleri yakalamak için periyodik, sessiz yenileme
    const interval = setInterval(() => fetchParts(true), 60000);
    return () => clearInterval(interval);
  }, [currentPage, itemsPerPage, searchTerm, filterDepartment, sortConfig]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const selectedCategory = useMemo(
    () => partCategories.find(c => String(c.id) === String(formData.part_category_id)) || null,
    [partCategories, formData.part_category_id]
  );

  const handleOpenModal = (part = null) => {
    if (part) {
      setCurrentPart(part);
      setFormData({
        item_code: part.item_code || '',
        barcode: part.barcode || '',
        name: part.name || '',
        model: part.model || '',
        brand: part.brand || '',
        item_category: part.item_category || '',
        part_category_id: part.part_category_id || '',
        department: part.department ? String(part.department).split(',').map(d => d.trim()).filter(Boolean) : [],
        stock_tracking_type: part.stock_tracking_type || 'Stok Takipli',
        status: part.status || 'Aktif',
        critical_limit: part.critical_limit || '',
        memory: part.memory ? String(part.memory).split(',').map(m => m.trim()).filter(Boolean) : [],
        part_type: part.part_type || ''
      });
    } else {
      setCurrentPart(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleSearchBarcode = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.item_code) return;
    const existing = parts.find(p => p.item_code === formData.item_code || p.barcode === formData.item_code);
    if (existing) {
      setFormData(prev => ({
        ...prev,
        item_code: existing.item_code || '',
        barcode: existing.barcode || '',
        name: existing.name || '',
        model: existing.model || '',
        brand: existing.brand || '',
        item_category: existing.item_category || '',
        part_category_id: existing.part_category_id || '',
        department: existing.department ? String(existing.department).split(',').map(d => d.trim()).filter(Boolean) : [],
        stock_tracking_type: existing.stock_tracking_type || 'Stok Takipli',
        status: existing.status || 'Aktif',
        part_type: existing.part_type || ''
      }));
    } else {
      alert("Bu parça koduna ait mevcut bir kayıt bulunamadı.");
    }
  };

  // Parça Kodu girilince Marka ve Model bilgisini ProductFamily eşleşmesinden (warehouse.item_models) otomatik getirir.
  const handleFetchModel = async (code) => {
    if (!code) return;
    try {
      const res = await api.getItemModel(code);
      if (res.success) {
        setFormData(prev => ({
          ...prev,
          model: res.model || prev.model,
          brand: res.brand || prev.brand
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        department: selectedCategory ? selectedCategory.departments : formData.department,
        stock_tracking_type: selectedCategory ? selectedCategory.stock_tracking_type : formData.stock_tracking_type,
        part_category: selectedCategory ? selectedCategory.name : formData.part_category,
        part_type: formData.part_type,
        memory: Array.isArray(formData.memory) ? formData.memory.join(', ') : (formData.memory || '')
      };
      const res = currentPart
        ? await api.updatePart(currentPart.id, payload)
        : await api.createPart(payload);
      if (res.success) {
        setIsModalOpen(false);
        fetchParts();
      } else {
        alert(res.message || 'İşlem başarısız oldu.');
      }
    } catch (err) {
      console.error(err);
      alert('Bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu parçayı silmek istediğinize emin misiniz?')) {
      try {
        const res = await api.deletePart(id);
        if (res.success) {
          fetchParts();
        } else {
          alert(res.message || 'Silme işlemi başarısız oldu.');
        }
      } catch (err) {
        console.error(err);
        alert('Bir hata oluştu.');
      }
    }
  };
  const handleBulkDelete = async () => {
    if (selectedOnCurrentPage.length === 0) return;
    if (window.confirm(`Mevcut sayfada seçilen ${selectedOnCurrentPage.length} parçayı silmek istediğinize emin misiniz?`)) {
      try {
        const res = await api.deletePartsBulk(selectedOnCurrentPage);
        if (res.success) {
          alert(res.message || 'Seçilen parçalar silindi.');
          setSelectedRows(prev => prev.filter(id => !selectedOnCurrentPage.includes(id)));
          fetchParts();
        } else {
          alert(res.message || 'Silme işlemi başarısız oldu.');
        }
      } catch (err) {
        console.error(err);
        alert('Bir hata oluştu.');
      }
    }
  };

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';

    if (action === 'download_template') {
      const templateData = [{ item_code: 'ORNEK-KOD-001', barcode: '', name: 'Örnek Parça', item_category: 'Orijinal', part_category: 'Ekran', part_type: 'Yedek Parça', stock_tracking_type: 'Stok Takipli', department: 'Servis, Kalite', status: 'Aktif' }];
      await api.exportTableToExcel(templateData, "stok_karti_sablonu.xlsx");
    } else if (action === 'export') {
      setIsExportModalOpen(true);
    } else if (action === 'import') {
      setIsExcelModalOpen(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === (parts?.length || 0) && (parts?.length || 0) > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows((parts || []).map(p => p.id));
    }
  };

  const toggleRowSelect = (id, e) => {
    e.stopPropagation();
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const executeExport = async () => {
    const dataToExport = selectedRows.length > 0
      ? (parts || []).filter(p => selectedRows.includes(p.id))
      : (parts || []);

    if (dataToExport.length === 0) {
      alert("Dışa aktarılacak parça kaydı bulunamadı.");
      setIsExportModalOpen(false);
      return;
    }

    const exportReadyData = dataToExport.map(p => {
      const row = {};
      if (selectedExportColumns["ID"]) row["ID"] = p.id;
      if (selectedExportColumns["Parça Kodu"]) row["Parça Kodu"] = p.item_code || '';
      if (selectedExportColumns["Barkod"]) row["Barkod"] = p.barcode || '';
      if (selectedExportColumns["Parça Adı"]) row["Parça Adı"] = p.name || '';
      if (selectedExportColumns["Parça Kategorisi"]) row["Parça Kategorisi"] = p.item_category || '';
      if (selectedExportColumns["Item Code"]) row["Item Code"] = p.part_category || '';
      if (selectedExportColumns["Parça Tipi"]) row["Parça Tipi"] = p.part_type || '';
      if (selectedExportColumns["Parça Statüsü"]) row["Parça Statüsü"] = p.status || '';
      return row;
    });

    await api.exportTableToExcel(exportReadyData, 'stok_kartlari.xlsx');
    setIsExportModalOpen(false);
  };

  const handleExcelImport = async (data) => {
    for (const item of data) {
      await api.createPart(item);
    }
    setIsExcelModalOpen(false);
    fetchParts();
  };

  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  // Filter and Pagination Logic
  const selectedOnCurrentPage = useMemo(() => {
    const currentPageIds = (parts || []).map(p => p.id);
    return selectedRows.filter(id => currentPageIds.includes(id));
  }, [selectedRows, parts]);

  const categoryOptions = partCategories.filter(c => c.is_active !== false || String(c.id) === String(formData.part_category_id));

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(91, 110, 196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(91, 110, 196,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-400/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold tracking-wide">
              <Package size={13} className="text-indigo-400" /> ENVANTER VE PARÇA KARTLARI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Stok Kartları (Parçalar)
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Depodaki tüm parça tanımlarını, kategorilerini ve stok takip parametrelerini listeleyin ve yönetin.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="relative">
              <select
                onChange={handleExcelAction}
                className="appearance-none bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl px-4 py-2.5 pr-9 text-xs font-bold transition-all cursor-pointer focus:outline-none focus:border-[#4457A5]"
              >
                <option value="">Excel İşlemleri...</option>
                <option value="download_template">Boş Şablon İndir</option>
                <option value="export">{selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : 'Tümünü Dışa Aktar'}</option>
                <option value="import">Excel'den İçe Aktar</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2.5 pointer-events-none text-[#5A6685] dark:text-[#8892B5]">
                <FileSpreadsheet size={15} />
              </div>
            </div>

            {selectedOnCurrentPage.length > 1 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                <Trash2 size={16} /> Seçilenleri Sil ({selectedOnCurrentPage.length})
              </button>
            )}

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-[#4457A5] hover:bg-[#1e222d] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus size={16} /> Yeni Parça Ekle
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="glass-card rounded-2xl p-4 shadow-md flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6685] dark:text-[#8892B5]">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#4457A5] transition-all shadow-xs"
            placeholder="Parça Ara (Kod, Barkod, Ad, Kategori)..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#1e222d] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#4457A5] focus:ring-[#4457A5] bg-[#FFFFFF] dark:bg-[#1e222d]"
                    checked={selectedRows.length === (parts?.length || 0) && (parts?.length || 0) > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 transition-colors" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1.5 text-[#12141c] dark:text-[#F6F8FF]">
                    ID
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'id' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 transition-colors" onClick={() => handleSort('item_code')}>
                  <div className="flex items-center gap-1.5 text-[#12141c] dark:text-[#F6F8FF]">
                    PARÇA KODU
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'item_code' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 transition-colors" onClick={() => handleSort('brand')}>
                  <div className="flex items-center gap-1.5 text-[#12141c] dark:text-[#F6F8FF]">
                    MARKA
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'brand' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 transition-colors" onClick={() => handleSort('model')}>
                  <div className="flex items-center gap-1.5 text-[#12141c] dark:text-[#F6F8FF]">
                    MODEL
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'model' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 transition-colors" onClick={() => handleSort('item_category')}>
                  <div className="flex items-center gap-1.5 text-[#12141c] dark:text-[#F6F8FF]">
                    PARÇA KATEGORİSİ
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'item_category' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 transition-colors" onClick={() => handleSort('part_type')}>
                  <div className="flex items-center gap-1.5 text-[#12141c] dark:text-[#F6F8FF]">
                    PARÇA TİPİ
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'part_type' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5 text-[#12141c] dark:text-[#F6F8FF]">
                    PARÇA STATÜSÜ
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'status' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#1e222d]">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8894D8]" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : (!parts || parts.length === 0) ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                (parts || []).map((part) => {
                  const isChecked = selectedRows.includes(part.id);
                  return (
                  <tr key={part.id} className={`hover:bg-[#FFFFFF]/70 dark:hover:bg-[#1e222d]/70 transition-colors text-[#12141c] dark:text-[#F6F8FF] ${isChecked ? 'bg-blue-900/30 border-l-4 border-[#4457A5]' : ''}`}>
                    <td className="px-6 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#4457A5] focus:ring-[#4457A5] bg-[#FFFFFF] dark:bg-[#1e222d]"
                        checked={isChecked}
                        onChange={(e) => toggleRowSelect(part.id, e)}
                      />
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[#5A6685] dark:text-[#8892B5] text-[11px]">{part.id}</td>
                    <td className="px-6 py-3.5 font-semibold text-[#12141c] dark:text-[#F6F8FF]">
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#1e222d] dark:text-[#8894D8] border border-blue-200 dark:border-blue-800/60 font-mono font-bold text-[11px]">
                        {part.item_code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-[#12141c] dark:text-[#F6F8FF]">{part.brand || '-'}</td>
                    <td className="px-6 py-3.5 text-[#4A5A9E] dark:text-slate-300">{part.model || '-'}</td>
                    <td className="px-6 py-3.5">
                      {part.item_category && (
                        <span className="px-2.5 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-blue-700 dark:text-blue-300 font-semibold text-xs">
                          {part.item_category}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-[#5A6685] dark:text-[#8892B5]">{part.part_type || '-'}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        part.status === 'Pasif' ? 'bg-slate-100 dark:bg-slate-500/20 text-slate-400 border-slate-500/30' :
                        part.status === 'Beklemede' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' :
                        part.status === 'Hurda' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30' :
                        'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      }`}>
                        {part.status || 'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(part); }} className="p-1.5 text-[#5A6685] dark:text-[#8892B5] hover:text-[#8894D8] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] rounded-lg transition-colors cursor-pointer" title="Düzenle">
                          <Edit size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(part.id); }} className="p-1.5 text-[#5A6685] dark:text-[#8892B5] hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer" title="Sil">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-[#F5F7FC] dark:bg-[#181a24] border-t border-[#DCE1F1] dark:border-[#1e222d] gap-4 shrink-0 text-xs text-[#5A6685] dark:text-[#8892B5]">
          <span>
            Toplam <strong className="text-[#12141c] dark:text-[#F6F8FF]">{totalCount.toLocaleString('tr-TR')}</strong> kayıttan <strong className="text-[#12141c] dark:text-[#F6F8FF]">{parts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalCount)}</strong> arası gösteriliyor
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || parts.length === 0}
              className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
            >
              Önceki
            </button>
            <span className="text-xs font-bold px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-[#8894D8]">
              Sayfa {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || parts.length === 0}
              className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {currentPart ? 'Parçayı Düzenle' : 'Yeni Stok Kartı Ekle'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Parça Kodu <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type="text" required
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.item_code}
                    onChange={e => setFormData({...formData, item_code: e.target.value})}
                    onBlur={e => handleFetchModel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchBarcode();
                        handleFetchModel(formData.item_code);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSearchBarcode}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-blue-500 transition-colors"
                    title="Bilgileri Getir"
                  >
                    <Search size={18} />
                  </button>
                </div>
              </div>



              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Parça Kategorisi <span className="text-red-400">*</span></label>
                <select
                  required
                  className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.part_category_id}
                  onChange={(e) => {
                    const selectedCatId = e.target.value;
                    const cat = partCategories.find(c => String(c.id) === selectedCatId);
                    setFormData({
                      ...formData, 
                      part_category_id: selectedCatId,
                      part_category: cat ? cat.name : '',
                      name: cat ? cat.name : ''
                    });
                  }}
                >
                  <option value="">Seçiniz...</option>
                  {categoryOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Parça Tipi <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.part_type}
                  onChange={e => setFormData({...formData, part_type: e.target.value})}
                >
                  <option value="">Seçiniz...</option>
                  {PART_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>



              {currentPart && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Parça Statüsü</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    {PART_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Kritik Stok Limiti</label>
                <input
                  type="number" min="0"
                  className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.critical_limit}
                  onChange={e => setFormData({...formData, critical_limit: e.target.value})}
                  placeholder="Opsiyonel (Varsayılan: 50)"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-700/50">
                <button
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="mt-4 px-5 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`mt-4 px-5 py-2.5 text-[#181a24] dark:text-white rounded-lg transition-colors font-medium shadow-lg ${
                    isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                  }`}
                >
                  {isSubmitting ? 'Kaydediliyor...' : (currentPart ? 'Güncelle' : 'Kaydet')}
                </button>
              </div>
            </form>
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
