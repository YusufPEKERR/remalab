import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, AlertTriangle, ArrowRightLeft, Info } from 'lucide-react';
import { api } from '../services/api';

export default function Depo() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const loadInventory = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getStockStatus();
      if (res.success) {
        // map backend response: s.id, part_name, location_name, quantity, critical_limit
        const mapped = res.stock.map(s => ({
          id: s.id,
          part_id: s.part_id,
          name: s.part_name,
          location: s.location_name,
          quantity: s.quantity,
          critical_limit: s.critical_limit
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
    const interval = setInterval(() => loadInventory(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const filteredInventory = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return inventory.filter(item => 
      String(item.id).includes(q) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q))
    );
  }, [inventory, searchTerm]);

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
      
      const limit = Number(selectedItem.critical_limit) || 10;
      maxCapacity = Math.max(50, limit * 2);
      isCritical = currentQty <= limit;
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
      </div>

      {/* Progress Bar Section */}
      <div className="bg-white dark:bg-[#1e2330] px-6 py-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-end">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Info size={16} className="text-blue-400"/>
            {occupancy.isCritical && selectedItem ? (
              <span className="flex items-center gap-2 text-red-500"><AlertTriangle size={24} /> {occupancy.title} Kritik Stok! ({occupancy.currentQty})</span>
            ) : (
              <span>{occupancy.title} {occupancy.currentQty} / {occupancy.maxCapacity}</span>
            )}
          </label>
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
            placeholder="Ara (ID, Parça Adı, Lokasyon)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">PARÇA ADI</th>
                <th className="px-6 py-4">LOKASYON</th>
                <th className="px-6 py-4">STOK MİKTARI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredInventory.map((item) => {
                const isSelected = selectedItem?.id === item.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-slate-100 dark:hover:bg-[#2a3142] border-l-2 border-transparent text-slate-700 dark:text-slate-300'}`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="px-6 py-4 text-slate-400">{item.location}</td>
                    <td className="px-6 py-4 font-mono font-medium">{item.quantity}</td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
