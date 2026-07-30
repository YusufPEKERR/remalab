import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit, RefreshCw, X, FileSpreadsheet, ArrowUpDown } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

const MEMORY_OPTIONS = ["", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  
  const [selectedRows, setSelectedRows] = useState([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedExportColumns, setSelectedExportColumns] = useState({
    "Ürün Kodu": true,
    "Marka": true,
    "Model": true,
    "Hafıza": true,
    "Renk": true
  });
  
  const [formData, setFormData] = useState({
    item_code: '', brand: '', model: '', memory: '', color: ''
  });

  const dbColumns = ["item_code", "brand", "model", "memory", "color"];
  const friendlyNames = {
    item_code: "Ürün Kodu (item_code)",
    brand: "Marka (brand)",
    model: "Model (model)",
    memory: "Hafıza (memory)",
    color: "Renk (color)"
  };

  const fetchProducts = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getProducts(currentPage, itemsPerPage, searchTerm, '', sortConfig.key || '', sortConfig.direction);
      if (res && res.success) {
        setProducts(res.data || []);
        setTotalCount(res.total || 0);
        setTotalPages(Math.ceil((res.total || 0) / itemsPerPage) || 1);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentPage, searchTerm, sortConfig]);

  const handleOpenModal = (product = null) => {
    if (product) {
      setCurrentProduct(product);
      setFormData({
        item_code: product.item_code || '',
        brand: product.brand || '',
        model: product.model || '',
        memory: product.memory || '',
        color: product.color || ''
      });
    } else {
      setCurrentProduct(null);
      setFormData({ item_code: '', brand: '', model: '', memory: '', color: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = currentProduct
        ? await api.updateProduct(currentProduct.id, formData)
        : await api.createProduct(formData);
      if (res.success) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        alert(res.message || 'İşlem başarısız oldu.');
      }
    } catch (err) {
      console.error(err);
      alert('Bir hata oluştu.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu telefonu/modeli silmek istediğinize emin misiniz?')) {
      console.log("Deleting product:", id);
      try {
        const res = await api.deleteProduct(id);
        if (res.success) {
          fetchProducts();
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
      const templateData = [{ item_code: 'ORNEK-001', brand: 'Örnek Marka', model: 'Örnek Model', memory: '128 GB', color: 'Siyah' }];
      await api.exportTableToExcel(templateData, "urunler_sablonu.xlsx");
    } else if (action === 'export') {
      setIsExportModalOpen(true);
    } else if (action === 'import') {
      setIsExcelModalOpen(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(paginatedProducts.map(p => p.id));
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
      ? products.filter(p => selectedRows.includes(p.id))
      : paginatedProducts;

    if (dataToExport.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      setIsExportModalOpen(false);
      return;
    }

    const exportReadyData = dataToExport.map(p => {
      const row = {};
      if (selectedExportColumns["Ürün Kodu"]) row["Ürün Kodu"] = p.item_code;
      if (selectedExportColumns["Marka"]) row["Marka"] = p.brand;
      if (selectedExportColumns["Model"]) row["Model"] = p.model;
      if (selectedExportColumns["Hafıza"]) row["Hafıza"] = p.memory;
      if (selectedExportColumns["Renk"]) row["Renk"] = p.color;
      return row;
    });

    await api.exportTableToExcel(exportReadyData, 'urunler_listesi.xlsx');
    setIsExportModalOpen(false);
  };

  const handleExcelImport = async (data) => {
    console.log("Mapped Excel Data to Import:", data);
    for (const item of data) {
      if (api.createProduct) {
        await api.createProduct(item);
      } else {
        console.log("Creating product via API is not yet implemented, item:", item);
      }
    }
    setIsExcelModalOpen(false);
    fetchProducts();
  };

  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const paginatedProducts = products;

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#16204A] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#101935] via-[#DDE2F2] dark:via-[#16204A] to-[#FFFFFF] dark:to-[#24326A] p-6 sm:p-8 text-[#1B2755] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#24326A]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(44, 140, 168,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(44, 140, 168,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-400/30 text-cyan-700 dark:text-cyan-300 text-xs font-semibold tracking-wide">
              <FileSpreadsheet size={13} className="text-cyan-400" /> ÜRÜN VE MODEL YÖNETİMİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2755] dark:text-white">
              Telefon Modelleri (Ürünler)
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Sistemdeki tüm cihaz markaları, modelleri, renk ve hafıza parametrelerini yönetin.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="relative">
              <select 
                onChange={handleExcelAction}
                className="appearance-none bg-[#FFFFFF] dark:bg-[#24326A] hover:bg-[#EFF1FA] dark:hover:bg-[#3B4A85] text-[#16204A] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#3B4A85] rounded-xl px-4 py-2.5 pr-9 text-xs font-bold transition-all cursor-pointer focus:outline-none focus:border-[#4457A5]"
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
            
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-[#4457A5] hover:bg-[#2E3F78] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus size={16} /> Yeni Model Ekle
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
            className="w-full bg-[#FFFFFF] dark:bg-[#24326A] border border-[#DCE1F1] dark:border-[#3B4A85] text-[#16204A] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#4457A5] transition-all shadow-xs"
            placeholder="Ürün Ara (ID, Marka, Model, Hafıza)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#F5F7FC] dark:bg-[#1B2755] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#24326A] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#3B4A85] text-[#4457A5] focus:ring-[#4457A5] bg-[#FFFFFF] dark:bg-[#24326A]"
                    checked={selectedRows.length === paginatedProducts.length && paginatedProducts.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#24326A]/60 transition-colors" onClick={() => handleSort('item_code')}>
                  <div className="flex items-center gap-1.5 text-[#16204A] dark:text-[#F6F8FF]">
                    ÜRÜN KODU
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'item_code' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#24326A]/60 transition-colors" onClick={() => handleSort('brand')}>
                  <div className="flex items-center gap-1.5 text-[#16204A] dark:text-[#F6F8FF]">
                    MARKA
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'brand' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#24326A]/60 transition-colors" onClick={() => handleSort('model')}>
                  <div className="flex items-center gap-1.5 text-[#16204A] dark:text-[#F6F8FF]">
                    MODEL
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'model' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-[#FFFFFF]/60 dark:hover:bg-[#24326A]/60 transition-colors" onClick={() => handleSort('memory')}>
                  <div className="flex items-center gap-1.5 text-[#16204A] dark:text-[#F6F8FF]">
                    HAFIZA
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'memory' ? 'text-[#8894D8]' : 'text-[#5A6685] opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#24326A]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8894D8]" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => {
                  const isChecked = selectedRows.includes(product.id);
                  return (
                  <tr key={product.id} className={`hover:bg-[#FFFFFF]/70 dark:hover:bg-[#24326A]/70 transition-colors text-[#16204A] dark:text-[#F6F8FF] ${isChecked ? 'bg-blue-900/30 border-l-4 border-[#4457A5]' : ''}`}>
                    <td className="px-6 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#3B4A85] text-[#4457A5] focus:ring-[#4457A5] bg-[#FFFFFF] dark:bg-[#24326A]"
                        checked={isChecked}
                        onChange={(e) => toggleRowSelect(product.id, e)}
                      />
                    </td>
                    <td className="px-6 py-3.5 font-mono">
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#2E3F78] dark:text-[#8894D8] border border-blue-200 dark:border-blue-800/60 font-mono font-bold text-[11px]">
                        {product.item_code || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-[#16204A] dark:text-[#F6F8FF]">{product.brand || '-'}</td>
                    <td className="px-6 py-3.5 text-[#4A5A9E] dark:text-slate-300">{product.model || '-'}</td>
                    <td className="px-6 py-3.5 font-mono text-[#5A6685] dark:text-[#8892B5]">{product.memory || '-'}</td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }} className="p-1.5 text-[#5A6685] dark:text-[#8892B5] hover:text-[#8894D8] hover:bg-[#FFFFFF] dark:hover:bg-[#24326A] rounded-lg transition-colors cursor-pointer" title="Düzenle">
                          <Edit size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} className="p-1.5 text-[#5A6685] dark:text-[#8892B5] hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer" title="Sil">
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
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-[#F5F7FC] dark:bg-[#1B2755] border-t border-[#DCE1F1] dark:border-[#24326A] gap-4 shrink-0 text-xs text-[#5A6685] dark:text-[#8892B5]">
          <span>
            Toplam <strong className="text-[#16204A] dark:text-[#F6F8FF]">{totalCount.toLocaleString('tr-TR')}</strong> kayıttan <strong className="text-[#16204A] dark:text-[#F6F8FF]">{products.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalCount)}</strong> arası gösteriliyor
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || products.length === 0}
              className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#16204A] border border-[#DCE1F1] dark:border-[#3B4A85] rounded-xl text-xs font-bold text-[#16204A] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#24326A] disabled:opacity-40 transition-all cursor-pointer"
            >
              Önceki
            </button>
            <span className="text-xs font-bold px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#16204A] border border-[#DCE1F1] dark:border-[#3B4A85] rounded-xl text-[#8894D8]">
              Sayfa {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || products.length === 0}
              className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#16204A] border border-[#DCE1F1] dark:border-[#3B4A85] rounded-xl text-xs font-bold text-[#16204A] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#24326A] disabled:opacity-40 transition-all cursor-pointer"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {currentProduct ? 'Telefon Modelini Düzenle' : 'Yeni Telefon Modeli Ekle'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Ürün Kodu</label>
                <input 
                  type="text" 
                  placeholder="örn. IC-IP15-004"
                  className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.item_code} 
                  onChange={e => setFormData({...formData, item_code: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Marka</label>
                <input 
                  type="text" 
                  placeholder="örn. Apple"
                  className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.brand} 
                  onChange={e => setFormData({...formData, brand: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Model</label>
                <input 
                  type="text" 
                  placeholder="örn. iPhone 15 Pro"
                  className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.model} 
                  onChange={e => setFormData({...formData, model: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Hafıza Seçenekleri</label>
                <div className="flex flex-wrap gap-2">
                  {MEMORY_OPTIONS.filter(m => m !== "").map(m => {
                    const currentMemories = formData.memory ? formData.memory.split(',').map(s => s.trim()).filter(Boolean) : [];
                    const isChecked = currentMemories.includes(m);
                    return (
                      <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${isChecked ? 'bg-blue-600/10 border-blue-600 text-blue-500' : 'bg-slate-50 dark:bg-[#232F63] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setFormData({ ...formData, memory: currentMemories.filter(x => x !== m).join(', ') });
                            } else {
                              setFormData({ ...formData, memory: [...currentMemories, m].join(', ') });
                            }
                          }}
                        />
                        <span className="text-sm font-medium">{m}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Renk</label>
                <input 
                  type="text" 
                  placeholder="örn. Siyah"
                  className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.color} 
                  onChange={e => setFormData({...formData, color: e.target.value})} 
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-700/50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="mt-4 px-5 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors font-medium">İptal</button>
                <button type="submit" className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20">Kaydet</button>
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

      {/* Dışa Aktar Sütun Seçimi Modalı */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Sütun Seçimi</h2>
            <p className="text-sm text-slate-500 mb-4">Dışa aktarılacak Excel dosyasında hangi sütunların bulunmasını istediğinizi seçin.</p>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {Object.keys(selectedExportColumns).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedExportColumns[col]}
                    onChange={(e) => setSelectedExportColumns(prev => ({...prev, [col]: e.target.checked}))}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{col}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium"
              >
                İptal
              </button>
              <button 
                onClick={executeExport}
                disabled={!Object.values(selectedExportColumns).some(Boolean)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                Dışa Aktar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
