import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, AlertTriangle, ArrowRightLeft, Info } from 'lucide-react';
import { api } from '../services/api';

export default function Depo() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const loadInventory = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getStockStatus();
      if (res.success) {
        const mapped = res.stock
          .filter(s => s.location_kind === 'good_stock')
          .map(s => ({
            id: s.id,
            part_id: s.part_id,
            item_code: s.item_code || '-',
            name: s.part_name || s.item_code || 'İsimsiz Parça',
            location: s.location_name,
            quantity: s.quantity,
            critical_limit: s.critical_limit,
            updated_at: s.updated_at || s.date || '-'
          }));
        setInventory(mapped);
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
  }, []);

  const filteredInventory = inventory.filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return String(item.id).includes(s) || 
           (item.item_code && item.item_code.toLowerCase().includes(s)) ||
           (item.name && item.name.toLowerCase().includes(s)) ||
           (item.location && item.location.toLowerCase().includes(s));
  });

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedInventory = filteredInventory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

  // Calculate Occupancy
  const calculateOccupancy = () => {
    let title = "Depo Genel Doluluk Oranı:";
    let currentQty = 0;
    let maxCapacity = 1000;
    let isCritical = false;

    if (selectedItem) {
      // Calculate for selected part and specific location ONLY
      title = `${selectedItem.name} (${selectedItem.location}) Doluluk:`;
      
      currentQty = Number(selectedItem.quantity) || 0;
      
      const limit = Number(selectedItem.critical_limit) || 50;
      maxCapacity = Math.max(100, limit * 2);
      isCritical = currentQty < limit;
    } else {
      // General warehouse occupancy
      currentQty = inventory.reduce((acc, curr) => acc + Number(curr.quantity), 0);
      maxCapacity = Math.max(1000, currentQty * 1.5);
    }

    const percentage = Math.min(Math.round((currentQty / maxCapacity) * 100), 100);

    return { title, currentQty, maxCapacity, percentage, isCritical };
  };

  const occupancy = calculateOccupancy();

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Depo Stok Durumu</h1>
          <p className="text-slate-400 mt-1">Depo lokasyonlarındaki stokları takip edin ve transfer edin</p>
        </div>
        <button
          type="button"
          onClick={() => loadInventory()}
          className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors"
          title="Yenile"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Progress Card */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0 space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Info size={16} className="text-blue-500" />
            {selectedItem ? (
              <span className="flex items-center gap-2">
                {occupancy.title} <span className="font-mono text-blue-500 font-bold">{occupancy.currentQty} adet</span>
                {occupancy.isCritical && <span className="text-red-500 text-xs ml-1">(⚠️ Kritik Stok)</span>}
              </span>
            ) : (
              <span>{occupancy.title} {occupancy.currentQty} / {occupancy.maxCapacity}</span>
            )}
          </label>
          
          {selectedItem && (
            <div className="text-xs text-slate-400 font-medium">
              Kritik Sınır: {Number(selectedItem.critical_limit) || 50}
            </div>
          )}
        </div>
        
        <div className="w-full bg-slate-50 dark:bg-[#0f1219] rounded-full h-3.5 border border-slate-200 dark:border-slate-700/50 overflow-hidden relative">
          <div 
            className={`h-full rounded-full transition-all duration-500 ease-out ${occupancy.isCritical ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${occupancy.percentage}%` }}
          />
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
            placeholder="Ara (İtem Kodu, Parça Adı, Lokasyon)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg overflow-hidden flex flex-col">
        <div className="overflow-y-auto max-h-[480px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">SON HAREKET TARİHİ</th>
                <th className="px-6 py-4">İTEM KODU</th>
                <th className="px-6 py-4">PARÇA ADI</th>
                <th className="px-6 py-4">LOKASYON</th>
                <th className="px-6 py-4">STOK MİKTARI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {paginatedInventory.map((item) => {
                const isSelected = selectedItem?.id === item.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-slate-100 dark:hover:bg-[#2a3142] border-l-2 border-transparent text-slate-700 dark:text-slate-300'}`}
                  >
                    <td className="px-6 py-4 font-mono text-slate-400 text-xs">{item.updated_at}</td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-500 dark:text-slate-400">{item.item_code}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="px-6 py-4 text-slate-400">{item.location}</td>
                    <td className="px-6 py-4 font-mono font-medium">{item.quantity}</td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-[#242a38] border-t border-slate-200 dark:border-slate-700/50 shrink-0">
          <span className="text-sm text-slate-500">
            Toplam {filteredInventory.length} kayıttan {filteredInventory.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredInventory.length)} arası gösteriliyor
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || filteredInventory.length === 0}
              className="px-3 py-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              Önceki
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || filteredInventory.length === 0}
              className="px-3 py-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
