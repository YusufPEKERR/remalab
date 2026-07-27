import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, X, FileSpreadsheet, Edit2, Search, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';
import ModelSelectCombobox from '../components/ModelSelectCombobox';

export default function ItemBOM() {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBom, setCurrentBom] = useState(null);
  const [formData, setFormData] = useState({ product_model: '', child_item_code: '', quantity: 1 });
  const [productFamilies, setProductFamilies] = useState([]);
  const [allItemCodes, setAllItemCodes] = useState([]);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState('1');
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Tümü');

  const dbColumns = ["product_model", "child_item_code", "quantity"];
  const friendlyNames = {
    product_model: "Cihaz Modeli (product_model) *",
    child_item_code: "Alt Parça Kodu (child_item_code) *",
    quantity: "Miktar (quantity) *"
  };

  const fetchBOMs = async (
    page = currentPage, 
    pageSize = itemsPerPage, 
    search = searchTerm, 
    model = selectedModel, 
    status = selectedStatus
  ) => {
    setLoading(true);
    const res = await api.getProductBOMs(page, pageSize, search, model, status);
    if (res.success) {
      setBoms(res.boms || []);
      setTotalCount(res.total || 0);
    }
    setLoading(false);
  };

  const fetchProductFamilies = async () => {
    const res = await api.getProductFamilies();
    if (res.success) setProductFamilies(res.product_families || []);
  };

  const fetchAllParts = async () => {
    // Tüm stok kartlarını listelemek için getParts servisi çağrılabilir, 
    // ama sadece kodlar gerekiyorsa getItemCodesByModel("") vs gibi bir şey.
    // Şimdilik ürün kartlarını çekip item_code'larını alalım.
    const res = await api.getParts();
    if (res.success) {
      const codes = (res.parts || []).map(p => p.item_code).filter(Boolean);
      setAllItemCodes([...new Set(codes)]);
    }
  };

  useEffect(() => {
    fetchProductFamilies();
    fetchAllParts();
  }, []);

  useEffect(() => {
    fetchBOMs(currentPage, itemsPerPage, searchTerm, selectedModel, selectedStatus);
  }, [currentPage, itemsPerPage, searchTerm, selectedModel, selectedStatus]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

  const handleOpenModal = (bom = null) => {
    if (bom && bom.id) {
      setCurrentBom(bom);
      setFormData({ 
        product_model: bom.product_model, 
        child_item_code: bom.child_item_code, 
        quantity: bom.quantity 
      });
    } else {
      setCurrentBom(null);
      setFormData({ product_model: '', child_item_code: '', quantity: 1 });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.product_model || !formData.child_item_code || !formData.quantity) {
      alert("Lütfen tüm alanların (Cihaz Modeli, Alt Parça Kodu, Miktar) doldurulduğundan emin olun.");
      return;
    }

    let res;
    if (currentBom) {
      res = await api.updateProductBOM(currentBom.id, formData.product_model, formData.child_item_code, formData.quantity);
    } else {
      res = await api.createProductBOM(formData.product_model, formData.child_item_code, formData.quantity);
    }
    
    if (res.success) {
      setIsModalOpen(false);
      fetchBOMs();
    } else {
      alert("Hata: " + (res.message || "Bilinmeyen hata"));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("BOM kaydını silmek istediğinize emin misiniz?")) {
      const res = await api.deleteProductBOM(id);
      if (res.success) {
        fetchBOMs();
      } else {
        alert("Silme başarısız.");
      }
    }
  };

  const handleToggleStatus = async (id) => {
    const res = await api.toggleProductBomStatus(id);
    if (res.success) {
      fetchBOMs();
    } else {
      alert("Durum güncellenemedi: " + (res.message || ""));
    }
  };

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';

    if (action === 'download_template') {
      const templateData = [{ product_model: 'iPhone 13', child_item_code: 'ORNEK-KOD-001', quantity: 1 }];
      await api.exportTableToExcel(templateData, "bom_sablonu.xlsx");
    } else if (action === 'export') {
      setLoading(true);
      const allBoms = [];
      let page = 1;
      const batchSize = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await api.getProductBOMs(page, batchSize);
        if (!res.success || !res.boms || res.boms.length === 0) break;
        allBoms.push(...res.boms);
        if (allBoms.length >= res.total) break;
        page += 1;
      }
      setLoading(false);
      const exportData = allBoms.map(b => ({
        "Cihaz Modeli": b.product_model,
        "Alt Parça Kodu": b.child_item_code,
        "Bileşen Adı": b.child_name,
        "Miktar": b.quantity,
        "Durum": b.status,
        "Eklenme Tarihi": b.created_at,
        "Düzenlenme Tarihi": b.updated_at
      }));
      await api.exportTableToExcel(exportData, "bom_listesi.xlsx");
    } else if (action === 'import') {
      setIsExcelModalOpen(true);
    }
  };

  const handleExcelImport = async (data) => {
    for (const item of data) {
      await api.createProductBOM(item.product_model, item.child_item_code, item.quantity || 1);
    }
    setIsExcelModalOpen(false);
    fetchBOMs();
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Product Bom Yönetimi</h1>
          <p className="text-slate-400 mt-1">Cihaz modellerine ait Product Bom kayıtlarını buradan yönetin.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              onChange={handleExcelAction}
              className="appearance-none bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500"
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
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/30"
          >
            <Plus size={18} />
            Yeni Bileşen Ekle
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#1a1f2b] flex flex-wrap items-center gap-3">
          {/* General Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Model, bileşen kodu veya adı ile ara..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 shadow-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Model Filter Combobox */}
          <div className="w-64">
            <ModelSelectCombobox
              models={productFamilies}
              value={selectedModel}
              onChange={(val) => { setSelectedModel(val); setCurrentPage(1); }}
              placeholder="Tüm Modeller"
              searchPlaceholder="Model ara..."
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-36">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 shadow-sm cursor-pointer"
            >
              <option value="Tümü">Durum: Tümü</option>
              <option value="Aktif">Aktif</option>
              <option value="Pasif">Pasif</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {(searchTerm || selectedModel || selectedStatus !== 'Tümü') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedModel('');
                setSelectedStatus('Tümü');
                setCurrentPage(1);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-xl transition-colors font-medium"
              title="Filtreleri Temizle"
            >
              <RotateCcw size={14} />
              Temizle
            </button>
          )}
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0">
              <tr>
                <th className="px-6 py-4">Cihaz Modeli</th>
                <th className="px-6 py-4">Alt Parça Kodu (Bileşen)</th>
                <th className="px-6 py-4">Bileşen Adı</th>
                <th className="px-6 py-4">Miktar</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-xs">Eklenme / Düzenlenme</th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-400" /></td></tr>
              ) : boms.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              ) : (
                boms.map(bom => (
                  <tr key={bom.id} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 transition-colors">
                    <td className="px-6 py-4 font-bold text-blue-400">{bom.product_model}</td>
                    <td className="px-6 py-4 font-mono">{bom.child_item_code}</td>
                    <td className="px-6 py-4 font-medium">{bom.child_name}</td>
                    <td className="px-6 py-4">{bom.quantity}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                        bom.status === 'Pasif' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                        'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        {bom.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                      <div><span className="font-semibold text-slate-700 dark:text-slate-300">Eklenme:</span> {bom.created_at}</div>
                      <div><span className="font-semibold text-slate-700 dark:text-slate-300">Düzenlenme:</span> {bom.updated_at}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => handleOpenModal(bom)} className="text-slate-400 hover:text-green-400 transition-colors" title="Düzenle">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleToggleStatus(bom.id)} className="text-slate-400 hover:text-blue-400 transition-colors" title="Durumu Değiştir">
                          <RefreshCw size={16} />
                        </button>
                        <button onClick={() => handleDelete(bom.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Sil"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
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
              <span className="text-xs text-slate-500 ml-1">({boms.length} Kayıt)</span>
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentBom ? 'BOM Bileşenini Düzenle' : 'BOM Bileşeni Ekle'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cihaz Modeli</label>
                <ModelSelectCombobox
                  models={productFamilies}
                  value={formData.product_model}
                  onChange={val => setFormData({...formData, product_model: val})}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Alt Parça Kodu</label>
                <ModelSelectCombobox
                  models={allItemCodes.map(c => ({ name: c }))}
                  value={formData.child_item_code}
                  onChange={val => setFormData({...formData, child_item_code: val})}
                  placeholder="Bileşen kodunu ara veya seç..."
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Miktar</label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white" 
                  value={formData.quantity} 
                  onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} 
                />
              </div>
              <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg mt-4">Kaydet</button>
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
