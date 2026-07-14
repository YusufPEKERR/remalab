import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, AlertTriangle, Upload, Download, ArrowRightLeft, FileSpreadsheet, Info } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

export default function Depo() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  
  // Modals
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState({
    "Parça Adı": true,
    "Lokasyon": true,
    "Stok Miktarı": true,
    "Kritik Limit": true
  });

  const dbColumns = ["name", "location", "quantity", "critical_limit"];
  const friendlyNames = {
    name: "Parça Adı",
    location: "Lokasyon",
    quantity: "Stok Miktarı",
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
    // Sadece seçili olanları veya hiçbiri seçili değilse filtredeki listeyi dışa aktar
    const dataToExport = selectedRows.length > 0 
      ? inventory.filter(item => selectedRows.includes(item.id))
      : filteredInventory;

    if (dataToExport.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      setIsExportModalOpen(false);
      return;
    }

    const exportReadyData = dataToExport.map(item => {
      const row = {};
      if (selectedExportColumns["Parça Adı"]) row["Parça Adı"] = item.name;
      if (selectedExportColumns["Lokasyon"]) row["Lokasyon"] = item.location;
      if (selectedExportColumns["Stok Miktarı"]) row["Stok Miktarı"] = item.quantity;
      if (selectedExportColumns["Kritik Limit"]) row["Kritik Limit"] = item.critical_limit;
      return row;
    });

    await api.exportTableToExcel(exportReadyData, "depo_stok.xlsx");
    setIsExportModalOpen(false);
  };

  const handleDownloadTemplate = async () => {
    const templateData = [{
      "Parça Adı": "Örn. Motor",
      "Lokasyon": "Raf-1",
      "Stok Miktarı": "50",
      "Kritik Limit": "10"
    }];
    await api.exportTableToExcel(templateData, "depo_sablon.xlsx");
  };

  useEffect(() => {
    loadInventory();
    const interval = setInterval(() => loadInventory(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleExcelImport = async (data) => {
    setIsExcelModalOpen(false);
    alert('Depo stoklarının Excel üzerinden toplu olarak içeri aktarımı işlemi henüz backend tarafında geliştirilme aşamasındadır. Lütfen stok ekleme işlemlerini Parçalar sayfasından veya manuel yapınız.');
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

  const toggleSelectAll = () => {
    if (selectedRows.length === filteredInventory.length && filteredInventory.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredInventory.map(item => item.id));
    }
  };

  const toggleRowSelect = (id, e) => {
    e.stopPropagation();
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

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
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Depo Stok Durumu</h1>
          <p className="text-slate-400 mt-1">Depo lokasyonlarındaki stokları takip edin ve transfer edin</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadTemplate}
            className="px-4 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-blue-400 border border-slate-300 dark:border-slate-600 rounded-xl transition-colors font-medium flex items-center gap-2 shadow-sm"
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
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-medium flex items-center gap-2 shadow-sm shadow-emerald-900/20"
          >
            <Upload size={18} /> {selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : 'Tümünü Dışa Aktar'}
          </button>
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="bg-white dark:bg-[#1e2330] px-6 py-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-end">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Info size={16} className="text-blue-400"/>
            {occupancy.title}
          </label>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium mr-2">
              {selectedItem ? `Kritik Limit: ${selectedItem.critical_limit || 10}` : `Kapasite: ${occupancy.maxCapacity}`}
            </span>
            <span className={`text-sm font-bold ${occupancy.isCritical ? 'text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {occupancy.currentQty} / {occupancy.maxCapacity} {selectedItem && occupancy.isCritical && "(⚠️ Kritik Stok)"}
            </span>
          </div>
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
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    checked={selectedRows.length === filteredInventory.length && filteredInventory.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">PARÇA ADI</th>
                <th className="px-6 py-4">LOKASYON</th>
                <th className="px-6 py-4">STOK MİKTARI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredInventory.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const isChecked = selectedRows.includes(item.id);

                return (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-slate-100 dark:hover:bg-[#2a3142] border-l-2 border-transparent text-slate-700 dark:text-slate-300'}
                      ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        checked={isChecked}
                        onChange={(e) => toggleRowSelect(item.id, e)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="px-6 py-4 text-slate-400">{item.location}</td>
                    <td className="px-6 py-4 font-mono font-medium">{item.quantity}</td>
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

      {/* Dışa Aktar Sütun Seçimi Modalı */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Sütun Seçimi</h2>
            <p className="text-sm text-slate-500 mb-4">Dışa aktarılacak Excel dosyasında hangi sütunların bulunmasını istediğinizi seçin.</p>
            
            <div className="space-y-3 mb-6">
              {Object.keys(selectedExportColumns).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedExportColumns[col]}
                    onChange={(e) => setSelectedExportColumns(prev => ({...prev, [col]: e.target.checked}))}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{col}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium"
              >
                İptal
              </button>
              <button 
                onClick={handleExport}
                disabled={!Object.values(selectedExportColumns).some(Boolean)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                Dışa Aktar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
