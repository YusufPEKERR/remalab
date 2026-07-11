import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, AlertTriangle, Upload, Download, ArrowRightLeft, FileSpreadsheet, Info } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';
import StockTransferModal from '../components/StockTransferModal';

export default function Depo() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Modals
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Transfer State
  const [locations, setLocations] = useState([{id: 1, name: 'Ana Depo'}, {id: 2, name: 'Şube Depo'}]);
  
  const dbColumns = ["name", "barcode", "critical_limit"];
  const friendlyNames = {
    name: "Parça Adı",
    barcode: "Barkod",
    critical_limit: "Kritik Limit"
  };

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

  const handleExport = async () => {
    await api.exportTableToExcel(inventory, "depo_stok.xlsx");
  };

  useEffect(() => {
    loadInventory();
    const interval = setInterval(() => loadInventory(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleExcelImport = async (data) => {
    setIsExcelModalOpen(false);
    loadInventory();
  };

  const handleTransferSubmit = (transferData) => {
    setIsTransferModalOpen(false);
    loadInventory();
  };

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
      // Calculate for selected part
      title = `Seçili Parça (${selectedItem.name}) Doluluk:`;
      
      const relatedItems = inventory.filter(x => x.part_id === selectedItem.part_id);
      currentQty = relatedItems.reduce((acc, curr) => acc + curr.quantity, 0);
      
      const limit = selectedItem.critical_limit || 10;
      maxCapacity = Math.max(50, limit * 2);
      isCritical = currentQty <= limit;
    } else {
      // General warehouse occupancy
      currentQty = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
    }

    const percentage = Math.min(Math.round((currentQty / maxCapacity) * 100), 100);

    return { title, currentQty, maxCapacity, percentage, isCritical };
  };

  const occupancy = calculateOccupancy();

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1e2330] p-6 rounded-2xl border border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Depo Stok Durumu</h1>
          <p className="text-slate-400 mt-1">Depo lokasyonlarındaki stokları takip edin ve transfer edin</p>
        </div>
        <div className="flex gap-3">
          <button 
            className="px-4 py-2.5 bg-[#242a38] hover:bg-[#2a3142] text-blue-400 border border-slate-600 rounded-xl transition-colors font-medium flex items-center gap-2 shadow-sm"
          >
            <Download size={18} /> Şablon
          </button>
          <button 
            onClick={() => setIsExcelModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium flex items-center gap-2 shadow-sm shadow-blue-900/20"
          >
            <FileSpreadsheet size={18} /> İçe Aktar
          </button>
          <button 
            onClick={handleExport}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-medium flex items-center gap-2 shadow-sm shadow-emerald-900/20"
          >
            <Upload size={18} /> Dışa Aktar
          </button>
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-slate-900 rounded-xl transition-colors font-bold flex items-center gap-2 shadow-lg shadow-yellow-900/20 ml-2"
          >
            <ArrowRightLeft size={18} /> Stok Transferi
          </button>
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="bg-[#1e2330] px-6 py-5 rounded-2xl border border-slate-700/50 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-end">
          <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Info size={16} className="text-blue-400"/>
            {occupancy.title}
          </label>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium mr-2">
              {selectedItem ? `Kritik Limit: ${selectedItem.critical_limit || 10}` : `Kapasite: ${occupancy.maxCapacity}`}
            </span>
            <span className={`text-sm font-bold ${occupancy.isCritical ? 'text-red-400' : 'text-slate-200'}`}>
              {occupancy.currentQty} / {occupancy.maxCapacity} {selectedItem && occupancy.isCritical && "(⚠️ Kritik Stok)"}
            </span>
          </div>
        </div>
        
        <div className="w-full bg-[#0f1219] rounded-full h-3.5 border border-slate-700/50 overflow-hidden relative">
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
            className="w-full bg-[#1e2330] border border-slate-700 text-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 shadow-sm"
            placeholder="Ara (ID, Parça Adı, Lokasyon)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-[#1e2330] rounded-2xl border border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#242a38] text-slate-400 font-medium uppercase text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">PARÇA ADI</th>
                <th className="px-6 py-4">LOKASYON</th>
                <th className="px-6 py-4">STOK MİKTARI</th>
                <th className="px-6 py-4">DURUM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredInventory.map((item) => {
                const limit = item.critical_limit || 10;
                const isCritical = item.quantity <= limit;
                const isSelected = selectedItem?.id === item.id;

                return (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-[#2a3142] border-l-2 border-transparent text-slate-300'}`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-200">{item.name}</td>
                    <td className="px-6 py-4 text-slate-400">{item.location}</td>
                    <td className="px-6 py-4 font-mono font-medium">{item.quantity}</td>
                    <td className="px-6 py-4">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertTriangle size={14}/> Kritik Stok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Yeterli
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExcelMappingModal 
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        dbColumns={dbColumns}
        friendlyNames={friendlyNames}
      />

      <StockTransferModal 
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransfer={handleTransferSubmit}
        locations={locations}
      />

    </div>
  );
}
