import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Edit, AlertCircle, RefreshCw, X, Truck, Package, Box, Hash, Barcode } from 'lucide-react';
import { api } from '../services/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);
  
  const [formData, setFormData] = useState({
    supplier: '', brand: '', model: '', item_code: '', barcode: ''
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.getSuppliers();
      if (res && res.success) {
        setSuppliers(res.suppliers || []);
        setError('');
      } else {
        setError(res ? res.message : 'Hata');
      }
    } catch (err) {
      setError('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();

    const handleRefresh = () => fetchSuppliers();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, []);

  const handleOpenModal = (supplier = null) => {
    if (supplier) {
      setCurrentSupplier(supplier);
      setFormData({
        supplier: supplier.supplier || '',
        brand: supplier.brand || '',
        model: supplier.model || '',
        item_code: supplier.item_code || '',
        barcode: supplier.barcode || ''
      });
    } else {
      setCurrentSupplier(null);
      setFormData({ supplier: '', brand: '', model: '', item_code: '', barcode: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentSupplier(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createSupplier(formData);
      if (res && res.success) fetchSuppliers();
      else alert(res ? res.message : "Hata");
    } catch (err) {}
    handleCloseModal();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Silmek istediğinize emin misiniz?')) {
      const res = await api.deletePart(id);
      if (res && res.success) fetchSuppliers();
      else alert(res ? res.message : "Hata");
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      (s.supplier && s.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.brand && s.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.model && s.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.item_code && s.item_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.barcode && s.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [suppliers, searchTerm]);

  // Extract distinct values for autocomplete
  const distinctBrands = useMemo(() => [...new Set(suppliers.map(s => s.brand).filter(Boolean))], [suppliers]);
  const distinctModels = useMemo(() => [...new Set(suppliers.map(s => s.model).filter(Boolean))], [suppliers]);
  const distinctItemCodes = useMemo(() => [...new Set(suppliers.map(s => s.item_code).filter(Boolean))], [suppliers]);
  const distinctBarcodes = useMemo(() => [...new Set(suppliers.map(s => s.barcode).filter(Boolean))], [suppliers]);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1e2330] p-6 rounded-2xl border border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            <Truck className="text-indigo-400" size={28}/> Tedarikçiler
          </h1>
          <p className="text-slate-400 mt-1">Tedarikçi, marka, model, ürün kodu ve barkod bilgilerini yönetin</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-medium text-sm"
        >
          <Plus size={18} />
          <span>Yeni Ekle</span>
        </button>
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
            placeholder="Ara (ID, Tedarikçi, Marka, Model, Ürün Kodu, Barkod)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e2330] border border-slate-700 text-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e2330] border border-slate-700/50 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#242a38] text-slate-400 font-medium uppercase text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">TEDARİKÇİ</th>
                <th className="px-6 py-4">MARKA</th>
                <th className="px-6 py-4">MODEL</th>
                <th className="px-6 py-4">ÜRÜN KODU</th>
                <th className="px-6 py-4">BARKOD</th>
                <th className="px-6 py-4 text-right">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
                    <span className="font-medium">Yükleniyor...</span>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-[#2a3142] transition-colors group text-slate-300">
                    <td className="px-6 py-4 font-medium text-slate-200">{supplier.supplier || '-'}</td>
                    <td className="px-6 py-4">{supplier.brand || '-'}</td>
                    <td className="px-6 py-4">{supplier.model || '-'}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{supplier.item_code || '-'}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{supplier.barcode || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(supplier)}
                          className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(supplier.id)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0f1219]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2330] border border-slate-700 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-[#242a38]">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Truck size={20} className="text-indigo-400"/>
                {currentSupplier ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi Ekle'}
              </h2>
              <button type="button" onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors bg-[#1e2330] p-1.5 rounded-lg border border-slate-700">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Truck size={14}/> Tedarikçi Adı
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="Örn. XYZ Elektronik"
                  className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500" 
                  value={formData.supplier} 
                  onChange={e => setFormData({...formData, supplier: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Package size={14}/> Marka
                  </label>
                  <input 
                    type="text" 
                    list="brand-list"
                    placeholder="Marka seçin/yazın"
                    className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500" 
                    value={formData.brand} 
                    onChange={e => setFormData({...formData, brand: e.target.value})} 
                  />
                  <datalist id="brand-list">
                    {distinctBrands.map((b, idx) => <option key={idx} value={b} />)}
                  </datalist>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Box size={14}/> Model
                  </label>
                  <input 
                    type="text" 
                    list="model-list"
                    placeholder="Model seçin/yazın"
                    className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500" 
                    value={formData.model} 
                    onChange={e => setFormData({...formData, model: e.target.value})} 
                  />
                  <datalist id="model-list">
                    {distinctModels.map((m, idx) => <option key={idx} value={m} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Hash size={14}/> Ürün Kodu
                  </label>
                  <input 
                    type="text" 
                    list="itemcode-list"
                    placeholder="Ürün kodu seçin/yazın"
                    className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500 font-mono" 
                    value={formData.item_code} 
                    onChange={e => setFormData({...formData, item_code: e.target.value})} 
                  />
                  <datalist id="itemcode-list">
                    {distinctItemCodes.map((c, idx) => <option key={idx} value={c} />)}
                  </datalist>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Barcode size={14}/> Barkod
                  </label>
                  <input 
                    type="text" 
                    list="barcode-list"
                    placeholder="Barkod seçin/yazın"
                    className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500 font-mono" 
                    value={formData.barcode} 
                    onChange={e => setFormData({...formData, barcode: e.target.value})} 
                  />
                  <datalist id="barcode-list">
                    {distinctBarcodes.map((b, idx) => <option key={idx} value={b} />)}
                  </datalist>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-700/50 mt-6">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 bg-[#242a38] hover:bg-[#2a3142] text-slate-300 rounded-xl font-medium transition-colors border border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
