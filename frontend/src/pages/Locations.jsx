import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Edit, AlertCircle, RefreshCw, MapPin, X } from 'lucide-react';
import { api } from '../services/api';

const KNOWN_SYSTEM_KINDS = ['good_stock', 'doa_stock', 'repair_stock', 'scrap_stock', 'out_stock'];

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDesc, setNewLocationDesc] = useState('');

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
    const interval = setInterval(() => fetchLocations(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createLocation(newLocationName, newLocationDesc);
      if (res && res.success) {
        setNewLocationName('');
        setNewLocationDesc('');
        setIsModalOpen(false);
        fetchLocations();
      } else {
        alert(res ? res.message : "Hata");
      }
    } catch (err) {
      alert("Hata oluştu.");
    }
  };

  const uniqueLocations = useMemo(() => {
    const seen = new Set();
    return locations.filter(l => {
      if (l.kind && !KNOWN_SYSTEM_KINDS.includes(l.kind)) return false;
      const key = (l.name || '').trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [locations]);

  const filteredLocations = useMemo(() => {
    return uniqueLocations.filter(l =>
      (l.name && l.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(l.id).includes(searchTerm)
    );
  }, [uniqueLocations, searchTerm]);

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#0F172A] dark:text-[#FAFAFA] max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F1F5F9] dark:from-[#050A18] via-[#E2E9F5] dark:via-[#0F172A] to-[#FFFFFF] dark:to-[#1E293B] p-6 sm:p-8 text-[#0D1B3E] dark:text-white shadow-xl border border-[#E2E8F0] dark:border-[#1E293B]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/30 text-[#1D4ED8] dark:text-blue-300 text-xs font-semibold tracking-wide">
              <MapPin size={13} className="text-blue-400" /> DEPO VE LOKASYON YÖNETİMİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D1B3E] dark:text-white">
              Depolar & Lokasyon Tanımları
            </h1>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Depo raf ve depolama lokasyonlarını ekleyin, gruplayın ve yetkili alanları yapılandırın.
            </p>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
          >
            <Plus size={16} /> Yeni Lokasyon Ekle
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 border border-red-200 dark:border-red-500/30 text-xs font-bold">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E293B] shadow-md flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B] dark:text-[#94A3B8]">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Lokasyon Ara (ID veya Lokasyon Adı)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#2563EB] transition-all shadow-xs"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl shadow-md overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#F8FAFC] dark:bg-[#162032] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-32">LOKASYON ID</th>
                <th className="px-6 py-4">LOKASYON ADI</th>
                <th className="px-6 py-4">AÇIKLAMA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-[#64748B] dark:text-[#94A3B8]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#60A5FA]" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-[#64748B] dark:text-[#94A3B8]">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-[#FFFFFF]/70 dark:hover:bg-[#1E293B]/70 transition-colors text-[#0F172A] dark:text-[#FAFAFA]">
                    <td className="px-6 py-3.5 font-mono text-[#64748B] dark:text-[#94A3B8] text-[11px]">{loc.id}</td>
                    <td className="px-6 py-3.5 font-bold">
                      <div className="flex items-center gap-2">
                        {loc.name}
                        {loc.kind && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                            loc.kind === 'good_stock' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' :
                            loc.kind === 'doa_stock' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30' :
                            loc.kind === 'repair_stock' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' :
                            loc.kind === 'scrap_stock' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30' :
                            loc.kind === 'out_stock' ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30' :
                            'bg-slate-100 dark:bg-slate-500/20 text-slate-400 border-slate-500/30'
                          }`}>
                            {loc.kind === 'good_stock' ? 'İyi Stok' : 
                             loc.kind === 'doa_stock' ? 'DOA' : 
                             loc.kind === 'repair_stock' ? 'Tamir' : 
                             loc.kind === 'scrap_stock' ? 'Hurda' : 
                             loc.kind === 'out_stock' ? 'Çıkış' : 'Sistem'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-[#64748B] dark:text-[#94A3B8]">{loc.description || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1E293B] shadow-2xl rounded-2xl w-full max-w-md overflow-hidden text-[#0F172A] dark:text-[#FAFAFA]">
            <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex justify-between items-center bg-[#F8FAFC] dark:bg-[#162032]">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA]">Yeni Lokasyon Ekle</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">Lokasyon Adı <span className="text-red-400">*</span></label>
                <input
                  type="text" required
                  placeholder="Örn: A-01-01"
                  className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] focus:outline-none focus:border-[#2563EB]"
                  value={newLocationName}
                  onChange={e => setNewLocationName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">Açıklama (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: Yedek parçalar için raf"
                  className="w-full px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] focus:outline-none focus:border-[#2563EB]"
                  value={newLocationDesc}
                  onChange={e => setNewLocationDesc(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-[#E2E8F0] dark:border-[#1E293B] mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-[#FFFFFF] dark:bg-[#1E293B] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#FAFAFA] rounded-xl text-xs font-bold transition-all cursor-pointer">İptal</button>
                <button type="submit" className="px-4 py-2 text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
