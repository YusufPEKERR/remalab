import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit, AlertCircle, RefreshCw, X, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

export default function Parts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPart, setCurrentPart] = useState(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    item_code: '', brand: '', model: '', color: '', part_category: '', item_category: '', stock_tracking_type: 'Stok Takipli', department: [], status: 'Aktif'
  });

  const [categories, setCategories] = useState(['Orijinal', 'Muadil', 'Çıkma']); // Mock

  const DEPARTMENTS = ['Servis', 'Teknik Servis', 'Üretim', 'Kalite'];

  const PART_STATUSES = ['Aktif', 'Pasif', 'Beklemede', 'Hurda'];

  // Parça Tipine göre ilgili departmanların otomatik işaretlenmesi için varsayılan eşleştirme.
  const PART_CATEGORY_DEPARTMENTS = {
    'Ekran': ['Teknik Servis'],
    'Batarya': ['Teknik Servis'],
    'Kasa': ['Teknik Servis'],
    'Anakart': ['Teknik Servis'],
    'Kamera': ['Teknik Servis'],
    'Şarj Soketi': ['Teknik Servis'],
    'Hoparlör': ['Teknik Servis'],
    'Mikrofon': ['Teknik Servis'],
    'Ön Cam': ['Teknik Servis'],
    'Arka Cam': ['Teknik Servis'],
    'Buton': ['Teknik Servis'],
    'Titreşim Motoru': ['Teknik Servis'],
    'Sim Tepsi': ['Teknik Servis'],
    'Flex Kablo': ['Teknik Servis'],
    'Kılıf': ['Servis'],
    'Ekran Koruyucu': ['Servis'],
    'Şarj Aleti': ['Servis'],
    'Kablo': ['Servis'],
    'Kulaklık': ['Servis'],
    'Ambalaj': ['Servis'],
    'Hammadde': ['Üretim'],
    'Yarı Mamül': ['Üretim'],
    'OCA Film': ['Üretim'],
    'Polarizer': ['Üretim'],
    'Çerçeve': ['Üretim'],
    'Lens': ['Üretim'],
    'Test Cihazı': ['Kalite'],
    'Kalibrasyon Malzemesi': ['Kalite'],
    'Ölçüm Aleti': ['Kalite'],
    'Numune': ['Kalite'],
  };

  const dbColumns = ["item_code", "brand", "model", "color", "part_category", "item_category", "stock_tracking_type", "department", "status"];
  const friendlyNames = {
    item_code: "Parça Kodu (item_code) *",
    brand: "Marka (brand)",
    model: "Model (model)",
    color: "Renk (color)",
    part_category: "Parça Tipi (part_category)",
    item_category: "Parça Kalitesi (item_category)",
    stock_tracking_type: "Stok Takip Tipi (stock_tracking_type)",
    department: "Departman (department)",
    status: "Parça Statüsü (status)"
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
    // Başka bilgisayarlardan yapılan değişiklikleri yakalamak için periyodik, sessiz yenileme
    const interval = setInterval(() => fetchParts(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenModal = (part = null) => {
    if (part) {
      setCurrentPart(part);
      setFormData({
        item_code: part.item_code || '',
        brand: part.brand || '',
        model: part.model || '',
        color: part.color || '',
        part_category: part.part_category || '',
        item_category: part.item_category || '',
        stock_tracking_type: part.stock_tracking_type || 'Stok Takipli',
        department: part.department ? part.department.split(',').map(d => d.trim()).filter(Boolean) : [],
        status: part.status || 'Aktif'
      });
    } else {
      setCurrentPart(null);
      setFormData({ item_code: '', brand: '', model: '', color: '', part_category: '', item_category: '', stock_tracking_type: 'Stok Takipli', department: [], status: 'Aktif' });
    }
    setIsModalOpen(true);
  };

  const toggleDepartment = (dept) => {
    setFormData(prev => ({
      ...prev,
      department: prev.department.includes(dept)
        ? prev.department.filter(d => d !== dept)
        : [...prev.department, dept]
    }));
  };

  const handlePartCategoryChange = (value) => {
    const mapped = PART_CATEGORY_DEPARTMENTS[value.trim()] || [];
    setFormData(prev => ({
      ...prev,
      part_category: value,
      department: Array.from(new Set([...prev.department, ...mapped]))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = currentPart
        ? await api.updatePart(currentPart.id, formData)
        : await api.createPart(formData);
      if (res.success) {
        setIsModalOpen(false);
        fetchParts();
      } else {
        alert(res.message || 'İşlem başarısız oldu.');
      }
    } catch (err) {
      console.error(err);
      alert('Bir hata oluştu.');
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

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';
    
    if (action === 'download_template') {
      const templateData = [{ item_code: 'ORNEK-KOD-001', brand: 'Örnek Marka', model: 'Örnek Model', color: 'Örnek Renk', part_category: 'Ekran', item_category: 'Orijinal', stock_tracking_type: 'Stok Takipli', department: 'Servis, Kalite', status: 'Aktif' }];
      await api.exportTableToExcel(templateData, "stok_karti_sablonu.xlsx");
    } else if (action === 'export') {
      await api.exportTableToExcel(parts, "stok_kartlari.xlsx");
    } else if (action === 'import') {
      setIsExcelModalOpen(true);
    }
  };

  const handleExcelImport = async (data) => {
    console.log("Mapped Excel Data to Import:", data);
    for (const item of data) {
      await api.createPart(item);
    }
    setIsExcelModalOpen(false);
    fetchParts();
  };

  // Filter and Pagination Logic
  const filteredParts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return parts.filter(p => 
      (p.item_code && p.item_code.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q)) ||
      (p.part_category && p.part_category.toLowerCase().includes(q))
    );
  }, [parts, searchTerm]);

  const totalPages = Math.ceil(filteredParts.length / itemsPerPage) || 1;
  const paginatedParts = filteredParts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1e2330] p-6 rounded-2xl border border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Stok Kartları (Parçalar)</h1>
          <p className="text-slate-400 mt-1">Depodaki parçaların tanımlarını yönetin ve listeleyin.</p>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="relative">
            <select 
              onChange={handleExcelAction}
              className="appearance-none bg-[#242a38] hover:bg-[#2a3142] text-slate-300 border border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500"
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
            className="w-full bg-[#1e2330] border border-slate-700 text-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 shadow-sm"
            placeholder="Parça Ara (Kod, Marka, Model, Tip)..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-[#1e2330] rounded-2xl border border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Parça Kodu</th>
                <th className="px-6 py-4">Marka</th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Renk</th>
                <th className="px-6 py-4">Parça Tipi</th>
                <th className="px-6 py-4">Kalite</th>
                <th className="px-6 py-4">Stok Takibi</th>
                <th className="px-6 py-4">Departman</th>
                <th className="px-6 py-4">Parça Statüsü</th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : paginatedParts.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-8 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                paginatedParts.map(part => (
                  <tr key={part.id} className="hover:bg-[#2a3142] transition-colors text-slate-300">
                    <td className="px-6 py-4 font-mono text-slate-500">{part.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-200">{part.item_code}</td>
                    <td className="px-6 py-4">{part.brand}</td>
                    <td className="px-6 py-4">{part.model}</td>
                    <td className="px-6 py-4">{part.color}</td>
                    <td className="px-6 py-4">{part.part_category}</td>
                    <td className="px-6 py-4">
                      {part.item_category && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                          {part.item_category}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        part.stock_tracking_type === 'Stok Takipsiz'
                          ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        {part.stock_tracking_type || 'Stok Takipli'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {part.department && part.department.split(',').map(d => d.trim()).filter(Boolean).map(d => (
                          <span key={d} className="px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-500/10 text-purple-400 border-purple-500/20">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
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
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => handleOpenModal(part)}
                          className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(part.id)}
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
        
        {/* Pagination Footer */}
        <div className="bg-[#242a38] border-t border-slate-700/50 px-6 py-4 flex items-center justify-between text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <span>Sayfa Başına:</span>
            <select 
              value={itemsPerPage} 
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-[#1e2330] border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-slate-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-[#1e2330] hover:bg-[#2a3142] disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg transition-colors text-slate-300"
            >
              ← Önceki
            </button>
            <span className="font-medium">
              Sayfa {currentPage} / {totalPages} ({filteredParts.length} Kayıt)
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-[#1e2330] hover:bg-[#2a3142] disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg transition-colors text-slate-300"
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[99] p-4">
          <div className="bg-[#1e2330] border border-slate-700 shadow-2xl rounded-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {currentPart ? 'Parçayı Düzenle' : 'Yeni Stok Kartı Ekle'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Parça Kodu <span className="text-red-400">*</span></label>
                <input 
                  type="text" required
                  className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.item_code}
                  onChange={e => setFormData({...formData, item_code: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Marka</label>
                  <input 
                    type="text"
                    className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.brand}
                    onChange={e => setFormData({...formData, brand: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Model</label>
                  <input 
                    type="text"
                    className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.model}
                    onChange={e => setFormData({...formData, model: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Renk</label>
                  <input 
                    type="text"
                    className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.color}
                    onChange={e => setFormData({...formData, color: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Parça Tipi</label>
                  <input
                    type="text"
                    list="part-categories-list"
                    placeholder="Parça tipi seçin veya yazın..."
                    className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.part_category}
                    onChange={e => handlePartCategoryChange(e.target.value)}
                  />
                  <datalist id="part-categories-list">
                    {Object.keys(PART_CATEGORY_DEPARTMENTS).map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Parça Kalitesi</label>
                <input
                  type="text"
                  list="categories-list"
                  placeholder="Kalite seçin veya yazın..."
                  className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.item_category}
                  onChange={e => setFormData({...formData, item_category: e.target.value})}
                />
                <datalist id="categories-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Departman</label>
                <div className="grid grid-cols-2 gap-2">
                  {DEPARTMENTS.map(dept => (
                    <label key={dept} className="flex items-center gap-2 bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-500 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.department.includes(dept)}
                        onChange={() => toggleDepartment(dept)}
                        className="accent-blue-600"
                      />
                      <span className="text-slate-200 text-sm">{dept}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Stok Takip Tipi</label>
                  <select
                    className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.stock_tracking_type}
                    onChange={e => setFormData({...formData, stock_tracking_type: e.target.value})}
                  >
                    <option value="Stok Takipli">Stok Takipli</option>
                    <option value="Stok Takipsiz">Stok Takipsiz</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Parça Statüsü</label>
                  <select
                    className="w-full bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    {PART_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 mt-6 border-t border-slate-700/50">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="mt-4 px-5 py-2.5 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
                >
                  {currentPart ? 'Güncelle' : 'Kaydet'}
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
