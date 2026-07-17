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
  const itemsPerPage = 100;

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
      const res = await api.getProducts();
      if (res && res.success) {
        setProducts(res.products || []);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(() => fetchProducts(true), 60000);
    return () => clearInterval(interval);
  }, []);

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
    if (selectedRows.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredProducts.map(p => p.id));
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
      : filteredProducts;

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

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let result = products.filter(p =>
      (p.item_code && p.item_code.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q)) ||
      (p.memory && p.memory.toLowerCase().includes(q)) ||
      (p.color && p.color.toLowerCase().includes(q))
    );

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
  }, [products, searchTerm, sortConfig]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Telefon Modelleri (Ürünler)</h1>
          <p className="text-slate-400 mt-1">Marka, model ve hafıza bilgilerini yönetin.</p>
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
          
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium"
          >
            <Plus size={18} /> Yeni Model Ekle
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
            placeholder="Ara (ID, Marka, Model, Hafıza)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-semibold uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    checked={selectedRows.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('item_code')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    ÜRÜN KODU
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'item_code' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('brand')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    MARKA
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'brand' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('model')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    MODEL
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'model' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group hover:bg-slate-100/30 dark:hover:bg-slate-800/20 transition-colors" onClick={() => handleSort('memory')}>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    HAFIZA
                    <ArrowUpDown size={12} className={`transition-colors ${sortConfig.key === 'memory' ? 'text-blue-500' : 'text-slate-500 opacity-40 group-hover:opacity-100'}`} />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-slate-700 dark:text-slate-300">İşLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => {
                  const isChecked = selectedRows.includes(product.id);
                  return (
                  <tr key={product.id} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-700 dark:text-slate-300 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        checked={isChecked}
                        onChange={(e) => toggleRowSelect(product.id, e)}
                      />
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">{product.item_code || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{product.brand || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{product.model || '-'}</td>
                    <td className="px-6 py-4">{product.memory || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Düzenle">
                          <Edit size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Sil">
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
        
        <div className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-[#242a38] border-t border-slate-200 dark:border-slate-700/50 shrink-0">
          <span className="text-sm text-slate-500">
            Toplam {filteredProducts.length} kayıttan {filteredProducts.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredProducts.length)} arası gösteriliyor
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || filteredProducts.length === 0}
              className="px-3 py-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              Önceki
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || filteredProducts.length === 0}
              className="px-3 py-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
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
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.item_code} 
                  onChange={e => setFormData({...formData, item_code: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Marka</label>
                <input 
                  type="text" 
                  placeholder="örn. Apple"
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.brand} 
                  onChange={e => setFormData({...formData, brand: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Model</label>
                <input 
                  type="text" 
                  placeholder="örn. iPhone 15 Pro"
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
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
                      <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${isChecked ? 'bg-blue-600/10 border-blue-600 text-blue-500' : 'bg-slate-50 dark:bg-[#242a38] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'}`}>
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
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
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
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Sütun Seçimi</h2>
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
