import { useState, useEffect } from 'react';
import { Search, RefreshCw, Info } from 'lucide-react';
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

  // Arama kutusuna yazarken her tuş vuruşunda sunucuya istek atmamak için debounce
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
      if (res.success) {
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
    let title = "Depo Genel Doluluk Oranı:";
    let currentQty = 0;
    let maxCapacity = 1000;
    let isCritical = false;

    if (selectedItem) {
      // Calculate for selected part and specific location ONLY
      title = `${selectedItem.part_name} (${selectedItem.location_name}) Doluluk:`;

      currentQty = Number(selectedItem.quantity) || 0;

      const limit = Number(selectedItem.critical_limit) || 50;
      maxCapacity = Math.max(100, limit * 2);
      isCritical = currentQty < limit;
    } else {
      // General warehouse occupancy (aranan filtreye göre toplam)
      currentQty = totalQuantity;
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
              {inventory.map((item) => {
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
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{item.part_name}</td>
                    <td className="px-6 py-4 text-slate-400">{item.location_name}</td>
                    <td className="px-6 py-4 font-mono font-medium">{item.quantity}</td>
                  </tr>
                );
              })}
              {inventory.length === 0 && (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-[#242a38] border-t border-slate-200 dark:border-slate-700/50 shrink-0">
          <span className="text-sm text-slate-500">
            Toplam {totalRecords} kayıttan {totalRecords === 0 ? 0 : indexOfFirstItem + 1}-{indexOfLastItem} arası gösteriliyor
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || totalRecords === 0}
              className="px-3 py-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 disabled:opacity-50"
            >
              Önceki
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || totalRecords === 0}
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
