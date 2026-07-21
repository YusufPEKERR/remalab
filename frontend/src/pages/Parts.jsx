import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit, AlertCircle, RefreshCw, X, Download, Upload, FileSpreadsheet, ArrowUpDown } from 'lucide-react';
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
      const res = await api.getDepartments();
      if (res.success) {
        setDepartmentList((res.departments || []).map(d => d.name));
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
      const res = await api.getParts();
      if (res.success) {
        setParts(res.parts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
    fetchPartCategories();
    fetchDepartments();
    fetchProducts();
    fetchProductFamilies();
    // Başka bilgisayarlardan yapılan değişiklikleri yakalamak için periyodik, sessiz yenileme
    const interval = setInterval(() => fetchParts(true), 60000);
    return () => clearInterval(interval);
  }, []);

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
    if (selectedRows.length === filteredParts.length && filteredParts.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredParts.map(p => p.id));
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
      ? parts.filter(p => selectedRows.includes(p.id))
      : filteredParts;

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
  const filteredParts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let result = parts.filter(p => {
      const matchesSearch =
        (p.item_code && p.item_code.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.item_category && p.item_category.toLowerCase().includes(q));

      return matchesSearch;
    });

    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        const valA = (a[sortConfig.key] || '').toString().toLocaleLowerCase('tr-TR');
        const valB = (b[sortConfig.key] || '').toString().toLocaleLowerCase('tr-TR');
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [parts, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredParts.length / itemsPerPage) || 1;
  const paginatedParts = filteredParts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedOnCurrentPage = useMemo(() => {
    const currentPageIds = paginatedParts.map(p => p.id);
    return selectedRows.filter(id => currentPageIds.includes(id));
  }, [selectedRows, paginatedParts]);

  const categoryOptions = partCategories.filter(c => c.is_active !== false || String(c.id) === String(formData.part_category_id));

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Stok Kartları (Parçalar)</h1>
          <p className="text-slate-400 mt-1">Depodaki parçaların tanımlarını yönetin ve listeleyin.</p>
        </div>

        <div className="flex gap-3 items-center">
          <div className="relative">
            <select
              onChange={handleExcelAction}
              className="appearance-none bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="">Excel İşlemi Seç...</option>
              <option value="download_template">Boş Şablon İndir</option>
              <option value="export">{selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : 'Tümünü Dışa Aktar'}</option>
              <option value="import">Excel'den İçe Aktar</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
              <FileSpreadsheet size={16} />
            </div>
          </div>

          {selectedOnCurrentPage.length > 1 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-red-900/20 font-medium"
            >
              <Trash2 size={18} /> Seçilenleri Sil ({selectedOnCurrentPage.length})
            </button>
          )}

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium"
          >
            <Plus size={18} /> Yeni Parça Ekle
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="flex gap-4 shrink-0">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="text-slate-400" size={18} />
          </div>
          <input
            type="text"
            className="w-full bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 shadow-sm"
            placeholder="Parça Ara (Kod, Barkod, Ad, Kategori)..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg overflow-hidden flex flex-col">
        <div className="overflow-y-auto max-h-[480px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    checked={selectedRows.length === filteredParts.length && filteredParts.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    ID
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'id' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('item_code')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    PARÇA KODU
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'item_code' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    PARÇA ADI
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'name' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('item_category')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    ITEM CATEGORY
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'item_category' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('part_category')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    PARÇA KATEGORİSİ
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'part_category' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('part_type')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    PARÇA TİPİ
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'part_type' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    PARÇA STATÜSÜ
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'status' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : paginatedParts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedParts.map((part) => {
                  const isChecked = selectedRows.includes(part.id);
                  return (
                  <tr key={part.id} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-800 dark:text-slate-200 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        checked={isChecked}
                        onChange={(e) => toggleRowSelect(part.id, e)}
                      />
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">{part.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{part.item_code}</td>
                    <td className="px-6 py-4">{part.name}</td>

                    <td className="px-6 py-4">
                      {part.item_category && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                          {part.item_category}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">{part.part_category || '-'}</td>
                    <td className="px-6 py-4">{part.part_type || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        part.status === 'Pasif' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                        part.status === 'Beklemede' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        part.status === 'Hurda' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        {part.status || 'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(part); }} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Düzenle">
                          <Edit size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(part.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Sil">
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
        <div className="bg-slate-50 dark:bg-[#242a38] border-t border-slate-200 dark:border-slate-700/50 px-6 py-4 flex items-center justify-between text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <span>Sayfa Başına:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white dark:bg-[#1e2330] hover:bg-slate-100 dark:hover:bg-[#2a3142] disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 rounded-lg transition-colors text-slate-700 dark:text-slate-300"
            >
              ← Önceki
            </button>
            
            <div className="flex items-center gap-1.5 font-medium">
              <span>Sayfa:</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const pageNum = parseInt(pageInput, 10);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                      setCurrentPage(pageNum);
                    } else {
                      setPageInput(String(currentPage));
                    }
                  }
                }}
                onBlur={() => {
                  const pageNum = parseInt(pageInput, 10);
                  if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    setCurrentPage(pageNum);
                  } else {
                    setPageInput(String(currentPage));
                  }
                }}
                className="w-16 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-500 font-semibold"
              />
              <span>/ {totalPages}</span>
              <span className="text-xs text-slate-500 ml-1">({filteredParts.length} Kayıt)</span>
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-white dark:bg-[#1e2330] hover:bg-slate-100 dark:hover:bg-[#2a3142] disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 rounded-lg transition-colors text-slate-700 dark:text-slate-300"
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
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
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.part_category_id}
                  onChange={(e) => {
                    const selectedCatId = e.target.value;
                    const cat = partCategories.find(c => String(c.id) === selectedCatId);
                    setFormData({
                      ...formData, 
                      part_category_id: selectedCatId,
                      name: cat ? cat.name : '',
                      part_type: cat && cat.part_type ? cat.part_type : ''
                    });
                  }}
                >
                  <option value="">Seçiniz...</option>
                  {categoryOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>



              {currentPart && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Parça Statüsü</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
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
                  className={`mt-4 px-5 py-2.5 text-white rounded-lg transition-colors font-medium shadow-lg ${
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
