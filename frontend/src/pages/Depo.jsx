import { useState, useEffect } from 'react';
import { Search, RefreshCw, Info, Package, MapPin, AlertTriangle, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

export default function Depo() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const itemsPerPage = 30;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadInventory = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getStockStatusPaged(searchTerm, currentPage, itemsPerPage);
      if (res && res.success) {
        setInventory(res.stock || []);
        setTotalRecords(res.total || 0);
        setTotalQuantity(res.total_quantity || 0);
      }
    } catch (err) {
      console.error("Depo loading error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    const interval = setInterval(() => loadInventory(true), 60000);
    return () => clearInterval(interval);
  }, [searchTerm, currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));
  const indexOfFirstItem = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const indexOfLastItem = Math.min(currentPage * itemsPerPage, totalRecords);

  // Calculate Occupancy
  const calculateOccupancy = () => {
    let title = "Depo Genel Doluluk Oranı";
    let currentQty = 0;
    let maxCapacity = 1000;
    let isCritical = false;

    if (selectedItem) {
      title = `${selectedItem.part_name} (${selectedItem.location_name}) Stok Seviyesi`;
      currentQty = Number(selectedItem.quantity) || 0;
      const limit = Number(selectedItem.critical_limit) || 50;
      maxCapacity = Math.max(100, limit * 2);
      isCritical = currentQty < limit;
    } else {
      currentQty = totalQuantity;
      maxCapacity = Math.max(1000, currentQty * 1.4);
    }

    const percentage = Math.min(Math.round((currentQty / maxCapacity) * 100), 100);

    return { title, currentQty, maxCapacity, percentage, isCritical };
  };

  const occupancy = calculateOccupancy();

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#12141c] via-[#DDE2F2] dark:via-[#181a24] to-[#EEF1FB] dark:to-[#12141c] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(68, 87, 165,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(68, 87, 165,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/30 text-[#1e222d] dark:text-blue-300 text-xs font-semibold tracking-wide">
              <Package size={13} className="text-blue-400" /> DEPO YÖNETİM MODÜLÜ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Depo Stok
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Depo lokasyonlarındaki stok miktarlarını, parça hareketlerini ve kritik sınırı canlı takip edin.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md text-xs font-semibold text-[#181a24] dark:text-white">
              <Layers size={15} className="text-blue-400" />
              <span>Toplam <strong className="text-[#181a24] dark:text-white font-bold">{totalRecords.toLocaleString('tr-TR')}</strong> Kalem Kayıt</span>
            </div>

            <button
              onClick={() => loadInventory()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[#181a24] dark:text-white transition-all backdrop-blur-md cursor-pointer"
              title="Listeyi Yenile"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-blue-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════ STORAGE OCCUPANCY PROGRESS CARD ════════════════ */}
      <div className="glass-card p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-[#8894D8]" />
            <h3 className="text-sm font-semibold text-[#12141c] dark:text-[#F6F8FF]">
              {occupancy.title}
            </h3>
            {selectedItem && (
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-[11px] text-[#8894D8] hover:underline font-semibold ml-2"
              >
                (Seçimi Temizle)
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-[#5A6685] dark:text-[#8892B5]">
            <span>
              Miktar: <strong className="text-[#8894D8] font-mono text-sm">{occupancy.currentQty.toLocaleString('tr-TR')}</strong> / {occupancy.maxCapacity.toLocaleString('tr-TR')} Adet
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              occupancy.isCritical ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
            }`}>
              %{occupancy.percentage} Dolu {occupancy.isCritical && '⚠️ KRİTİK'}
            </span>
          </div>
        </div>

        <div className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] rounded-full h-3.5 border border-[#DCE1F1] dark:border-[#2e3545] overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out shadow-xs ${
              occupancy.isCritical 
                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                : 'bg-gradient-to-r from-[#00B2FF] to-blue-400'
            }`}
            style={{ width: `${occupancy.percentage}%` }}
          />
        </div>
      </div>

      {/* ════════════════ SEARCH & FILTER BAR ════════════════ */}
      <div className="glass-card rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6685] dark:text-[#8892B5]">
            <Search size={18} />
          </div>
          <input
            type="text"
            className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#00B2FF] transition-all shadow-xs"
            placeholder="Arama yapın (İtem Kodu, Parça Adı, Lokasyon)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="px-3 py-2 text-xs font-semibold text-[#5A6685] dark:text-[#8892B5] hover:text-[#12141c] dark:hover:text-[#F6F8FF] bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] transition-colors"
          >
            Aramayı Temizle
          </button>
        )}
      </div>

      {/* ════════════════ INVENTORY TABLE CONTAINER ════════════════ */}
      <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#1e222d]">
              <tr>
                <th className="px-6 py-4">SON HAREKET TARİHİ</th>
                <th className="px-6 py-4">İTEM KODU</th>
                <th className="px-6 py-4">PARÇA ADI</th>
                <th className="px-6 py-4">LOKASYON</th>
                <th className="px-6 py-4">STOK MİKTARI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#1e222d]">
              {inventory.length > 0 ? (
                inventory.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const qty = Number(item.quantity) || 0;
                  const crit = Number(item.critical_limit) || 20;
                  const isLow = qty <= crit;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(isSelected ? null : item)}
                      className={`cursor-pointer transition-colors duration-150
                        ${isSelected 
                          ? 'bg-blue-900/30 border-l-4 border-[#00B2FF]' 
                          : 'hover:bg-[#FFFFFF]/70 dark:hover:bg-[#1e222d]/70 border-l-4 border-transparent text-[#12141c] dark:text-[#F6F8FF]'
                        }`}
                    >
                      <td className="px-6 py-3.5 font-mono text-[#5A6685] dark:text-[#8892B5] text-[11px]">
                        {item.updated_at || '-'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#1e222d] dark:text-[#8894D8] border border-blue-200 dark:border-blue-800/60 font-mono font-bold text-[11px]">
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-[#12141c] dark:text-[#F6F8FF] text-sm">
                        {item.part_name}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#2e3545] dark:text-slate-200 font-semibold text-xs">
                          <MapPin size={13} className="text-[#00B2FF] dark:text-[#8894D8]" />
                          {item.location_name}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-semibold text-sm">
                        <div className="flex items-center gap-2">
                          <span>{qty.toLocaleString('tr-TR')}</span>
                          {isLow && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 inline-flex items-center gap-1">
                              <AlertTriangle size={10} /> Kritik
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[#5A6685] dark:text-[#8892B5]">
                    {loading ? 'Kayıtlar yükleniyor…' : 'Aradığınız kriterlere uygun stok bulunamadı.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-[#F5F7FC] dark:bg-[#181a24] border-t border-[#DCE1F1] dark:border-[#1e222d] gap-4 shrink-0">
          <span className="text-xs text-[#5A6685] dark:text-[#8892B5] font-medium">
            Toplam <strong className="text-[#12141c] dark:text-[#F6F8FF]">{totalRecords.toLocaleString('tr-TR')}</strong> kayıttan{' '}
            <strong className="text-[#12141c] dark:text-[#F6F8FF]">{totalRecords === 0 ? 0 : indexOfFirstItem + 1}-{indexOfLastItem}</strong> arası gösteriliyor
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || totalRecords === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] hover:border-blue-500 hover:text-[#8894D8] disabled:opacity-40 transition-all cursor-pointer"
            >
              <ChevronLeft size={14} /> Önceki
            </button>

            <span className="text-xs font-bold px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-[#8894D8]">
              Sayfa {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || totalRecords === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] hover:border-blue-500 hover:text-[#8894D8] disabled:opacity-40 transition-all cursor-pointer"
            >
              Sonraki <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
