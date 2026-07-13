import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Edit, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const fetchLocations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getLocations();
      if (res && res.success) {
        setLocations(res.locations || []);
        setError('');
      } else {
        setError(res ? res.message : 'Hata');
      }
    } catch (err) {
      setError('Bağlantı hatası.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(() => fetchLocations(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createLocation(newLocationName);
      if (res && res.success) {
        setNewLocationName('');
        setIsModalOpen(false);
        fetchLocations();
      } else {
        alert(res ? res.message : "Hata");
      }
    } catch (err) {
      alert("Hata oluştu.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu lokasyonu silmek istediğinize emin misiniz?')) {
      const res = await api.deleteLocation(id);
      if (res && res.success) fetchLocations();
      else alert(res ? res.message : "Hata");
    }
  };

  const filteredLocations = useMemo(() => {
    return locations.filter(l => 
      (l.name && l.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(l.id).includes(searchTerm)
    );
  }, [locations, searchTerm]);

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Lokasyonlar</h1>
          <p className="text-slate-500 mt-1">Depo raf ve depolama lokasyonlarını ekleyin, güncelleyin veya silin</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg transition-all shadow-sm font-medium text-sm"
        >
          <Plus size={18} />
          <span>Lokasyon Ekle</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100">
          <AlertCircle size={20} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="relative z-10">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Lokasyon ara..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-t-xl focus:outline-none text-slate-800 dark:text-slate-200 transition-all text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-b-xl shadow-lg flex-1 overflow-hidden flex flex-col -mt-6">
        <div className="overflow-y-auto flex-1 mt-2">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/50 sticky top-0 uppercase tracking-wider text-xs z-10">
              <tr>
                <th className="px-6 py-4 w-32">LOKASYON ID</th>
                <th className="px-6 py-4">LOKASYON ADI</th>
                <th className="px-6 py-4 text-right w-24">SİL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-400">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-800 dark:text-slate-200">
                    <td className="px-6 py-3 font-mono">{loc.id}</td>
                    <td className="px-6 py-3">{loc.name}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => alert('Düzenleme işlevi eklenebilir')}
                          className="p-1.5 text-orange-400 hover:bg-orange-400/10 rounded transition-colors"
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(loc.id)}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Yeni Lokasyon Ekle</h2>
            </div>
            
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Lokasyon Adı</label>
                <input 
                  type="text" required 
                  placeholder="Örn: A-01-01"
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500" 
                  value={newLocationName} 
                  onChange={e => setNewLocationName(e.target.value)} 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">İptal</button>
                <button type="submit" className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium shadow-sm">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
