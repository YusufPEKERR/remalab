import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit, RefreshCw, X, FileSpreadsheet } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

const MEMORY_OPTIONS = ["", "16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  
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
    const interval = setInterval(() => fetchProducts(true), 8000);
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
    console.log("Submitting:", formData);
    setIsModalOpen(false);
    fetchProducts();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu telefonu/modeli silmek istediğinize emin misiniz?')) {
      console.log("Deleting product:", id);
      fetchProducts();
    }
  };

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';
    
    if (action === 'download_template') {
      const templateData = [{ item_code: 'ORNEK-001', brand: 'Örnek Marka', model: 'Örnek Model', memory: '128 GB', color: 'Siyah' }];
      await api.exportTableToExcel(templateData, "urunler_sablonu.xlsx");
    } else if (action === 'export') {
      await api.exportTableToExcel(products, "urunler_listesi.xlsx");
    } else if (action === 'import') {
      setIsExcelModalOpen(true);
    }
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

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return products.filter(p => 
      (p.item_code && p.item_code.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q)) ||
      (p.memory && p.memory.toLowerCase().includes(q)) ||
      (p.color && p.color.toLowerCase().includes(q))
    );
  }, [products, searchTerm]);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Telefon Modelleri (Ürünler)</h1>
          <p className="text-slate-400 mt-1">Marka, model, hafıza ve renk bilgilerini yönetin.</p>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="relative">
            <select 
              onChange={handleExcelAction}
              className="appearance-none bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:bg-[#2a3142] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="">Excel İşlemi Seç...</option>
              <option value="download_template">Boş Şablon İndir</option>
              <option value="export">Excel'e Dışa Aktar</option>
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
            placeholder="Ara (ID, Marka, Model, Hafıza, Renk)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Ürün Kodu</th>
                <th className="px-6 py-4">Marka</th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Hafıza</th>
                <th className="px-6 py-4">Renk</th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                    <td className="px-6 py-4 font-mono text-slate-400">{product.item_code || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{product.brand || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{product.model || '-'}</td>
                    <td className="px-6 py-4">{product.memory || '-'}</td>
                    <td className="px-6 py-4">{product.color || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button 
                          onClick={() => handleOpenModal(product)}
                          className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
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
                <label className="block text-sm font-medium text-slate-400 mb-1">Hafıza</label>
                <input 
                  type="text"
                  list="memory-options"
                  placeholder="Seçiniz veya yazınız..."
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.memory} 
                  onChange={e => setFormData({...formData, memory: e.target.value})} 
                />
                <datalist id="memory-options">
                  {MEMORY_OPTIONS.filter(m => m !== "").map(m => <option key={m} value={m} />)}
                </datalist>
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
    </div>
  );
}
