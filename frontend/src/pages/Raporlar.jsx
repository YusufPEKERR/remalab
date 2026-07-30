import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Download, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export default function Raporlar() {
  const [stockReports, setStockReports] = useState([]);
  const [transferReports, setTransferReports] = useState([]);
  const [criticalReports, setCriticalReports] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Selection and Export States
  const [selectedRows, setSelectedRows] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedStockCols, setSelectedStockCols] = useState({
    "Son Hareket Tarihi": true,
    "İtem Kodu": true,
    "Parça Adı": true,
    "Lokasyon": true,
    "Stok Miktarı": true,
    "Kritik Durumu": true
  });
  const [selectedTransferCols, setSelectedTransferCols] = useState({
    "Tarih": true,
    "İtem Kodu": true,
    "Parça Adı": true,
    "Miktar": true,
    "Kaynak Depo": true,
    "Hedef Depo": true,
    "İşlemi Yapan": true,
    "Açıklama": true
  });
  const [selectedCriticalCols, setSelectedCriticalCols] = useState({
    "İtem Kodu": true,
    "Parça Adı": true,
    "Lokasyon": true,
    "Mevcut Stok": true,
    "Kritik Limit": true
  });
  
  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0); 
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().slice(0, 16);
  });
  
  const setQuickFilter = (type) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    let start = new Date(now);
    if (type === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (type === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'week') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (type === 'month') {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    const offset = start.getTimezoneOffset() * 60000;
    setStartDate(new Date(start - offset).toISOString().slice(0, 16));
    setEndDate(new Date(end - offset).toISOString().slice(0, 16));
  };
  
  const [activeTab, setActiveTab] = useState('stok');

  useEffect(() => {
    setSelectedRows([]);
  }, [activeTab]);

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (activeTab === 'stok') {
        const res = await api.getStockStatus();
        if (res.success) {
          setStockReports(res.stock || []);
        } else {
          alert("Stok raporları alınamadı: " + (res.message || "Bilinmeyen hata"));
        }
      } else if (activeTab === 'transfers') {
        const res = await api.getReports(startDate, endDate);
        if (res.success) {
          setTransferReports(res.reports || []);
        } else {
          alert("Transfer hareketleri alınamadı: " + (res.message || "Bilinmeyen hata"));
        }
      } else {
        const res = await api.getCriticalStock();
        if (res.success) {
          setCriticalReports(res.critical_stock || []);
        } else {
          alert("Kritik raporlar alınamadı: " + (res.message || "Bilinmeyen hata"));
        }
      }
    } catch (err) {
      console.error("Reports error:", err);
      alert("Bir hata oluştu: " + err.message);
    } finally {
      if (silent !== true) setLoading(false);
    }
  }, [activeTab, startDate, endDate]);

  const fetchReportsRef = useRef(fetchReports);
  useEffect(() => {
    fetchReportsRef.current = fetchReports;
  }, [fetchReports]);

  useEffect(() => {
    const loadLocations = async () => {
      const res = await api.getLocations();
      if (res.success) setLocations(res.locations);
    };
    loadLocations();
  }, []);

  const filteredStockReports = useMemo(() => stockReports.filter(r => selectedLocation === '' || r.location_name === selectedLocation), [stockReports, selectedLocation]);
  const filteredTransferReports = useMemo(() => transferReports.filter(r => selectedLocation === '' || r.source_location === selectedLocation || r.target_location === selectedLocation), [transferReports, selectedLocation]);
  const filteredCriticalReports = useMemo(() => criticalReports.filter(r => selectedLocation === '' || r.location_name === selectedLocation), [criticalReports, selectedLocation]);

  useEffect(() => { setCurrentPage(1); }, [activeTab, selectedLocation, startDate, endDate]);

  const activeDataList = activeTab === 'stok' ? filteredStockReports : (activeTab === 'transfers' ? filteredTransferReports : filteredCriticalReports);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedReports = activeDataList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(activeDataList.length / itemsPerPage);

  const toggleSelectAll = () => {
    const dataList = activeTab === 'stok' ? filteredStockReports : (activeTab === 'transfers' ? filteredTransferReports : filteredCriticalReports);
    if (selectedRows.length === dataList.length && dataList.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(dataList.map(item => item.id));
    }
  };

  const toggleRowSelect = (id, e) => {
    e.stopPropagation();
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const executeExport = async () => {
    const dataList = activeTab === 'stok' ? filteredStockReports : (activeTab === 'transfers' ? filteredTransferReports : filteredCriticalReports);
    const baseReports = activeTab === 'stok' ? stockReports : (activeTab === 'transfers' ? transferReports : criticalReports);
    
    const dataToExport = selectedRows.length > 0 
      ? baseReports.filter(r => selectedRows.includes(r.id))
      : dataList;

    if (dataToExport.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      setIsExportModalOpen(false);
      return;
    }

    let exportReadyData = [];

    if (activeTab === 'stok') {
      exportReadyData = dataToExport.map(r => {
        const row = {};
        if (selectedStockCols["Son Hareket Tarihi"]) row["Son Hareket Tarihi"] = r.updated_at || r.date || '-';
        if (selectedStockCols["İtem Kodu"]) row["İtem Kodu"] = r.item_code;
        if (selectedStockCols["Parça Adı"]) row["Parça Adı"] = r.part_name;
        if (selectedStockCols["Lokasyon"]) row["Lokasyon"] = r.location_name;
        if (selectedStockCols["Stok Miktarı"]) row["Stok Miktarı"] = r.quantity;
        if (selectedStockCols["Kritik Durumu"]) row["Kritik Durumu"] = (r.location_kind === 'good_stock' && r.quantity <= r.critical_limit) ? 'Kritik' : 'Normal';
        return row;
      });
      await api.exportTableToExcel(exportReadyData, 'stok_raporu.xlsx');
    } else if (activeTab === 'transfers') {
      exportReadyData = dataToExport.map(r => {
        const row = {};
        if (selectedTransferCols["Tarih"]) row["Tarih"] = r.date;
        if (selectedTransferCols["İtem Kodu"]) row["İtem Kodu"] = r.item_code;
        if (selectedTransferCols["Parça Adı"]) row["Parça Adı"] = r.part_name;
        if (selectedTransferCols["Miktar"]) {
          const isOut = (r.type || '').includes('Çıkış') || (r.type || '').includes('Satış') || (r.type || '').includes('Servis Kullanımı') || (r.type || '').includes('Outbound') || (r.type || '').includes('Fire') || (r.type || '').includes('Teknik Servis');
          const isIn = (r.type || '').includes('Giriş') || (r.type || '').includes('Yeni Alım') || (r.type || '').includes('İade') || (r.type || '').includes('Return') || (r.type || '').includes('İptal') || (r.type || '').includes('Inbound');
          row["Miktar"] = (isOut ? '-' : (isIn ? '+' : '')) + r.quantity;
        }
        if (selectedTransferCols["Kaynak Depo"]) row["Kaynak Depo"] = r.source_location;
        if (selectedTransferCols["Hedef Depo"]) row["Hedef Depo"] = r.target_location;
        if (selectedTransferCols["İşlemi Yapan"]) row["İşlemi Yapan"] = r.user;
        if (selectedTransferCols["Açıklama"]) row["Açıklama"] = r.type;
        return row;
      });
      await api.exportTableToExcel(exportReadyData, 'transfer_hareketleri.xlsx');
    } else {
      exportReadyData = dataToExport.map(r => {
        const row = {};
        if (selectedCriticalCols["İtem Kodu"]) row["İtem Kodu"] = r.item_code;
        if (selectedCriticalCols["Parça Adı"]) row["Parça Adı"] = r.part_name;
        if (selectedCriticalCols["Lokasyon"]) row["Lokasyon"] = r.location_name;
        if (selectedCriticalCols["Mevcut Stok"]) row["Mevcut Stok"] = r.quantity;
        if (selectedCriticalCols["Kritik Limit"]) row["Kritik Limit"] = r.critical_limit;
        return row;
      });
      await api.exportTableToExcel(exportReadyData, 'kritik_raporlar.xlsx');
    }
    
    setIsExportModalOpen(false);
  };

  useEffect(() => {
    fetchReportsRef.current();
    const interval = setInterval(() => {
      if (fetchReportsRef.current) fetchReportsRef.current(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  useEffect(() => {
    if (activeTab === 'critical') {
      const goodStock = locations.find(l => l.kind === 'good_stock');
      if (goodStock && selectedLocation !== goodStock.name) {
        setSelectedLocation(goodStock.name);
      }
    }
  }, [activeTab, locations, selectedLocation]);

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(185, 62, 134,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(185, 62, 134,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-400/30 text-pink-300 text-xs font-semibold tracking-wide">
              <Download size={13} className="text-pink-400" /> RAPORLAMA VE ANALİZ MODÜLÜ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Sistem Raporları
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Stok seviyelerini, kritik stok durumlarını ve transfer hareketlerini tarih aralığına ve depoya göre raporlayın.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">
              <span>Depo:</span>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-transparent text-[#12141c] dark:text-[#F6F8FF] font-bold focus:outline-none cursor-pointer"
              >
                {activeTab !== 'critical' && <option value="" className="bg-[#F5F7FC] dark:bg-[#12141c]">Tüm Depolar</option>}
                {locations.filter(loc => activeTab === 'critical' ? loc.kind === 'good_stock' : true).map(loc => (
                  <option key={loc.id} value={loc.name} className="bg-[#F5F7FC] dark:bg-[#12141c]">{loc.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#00B2FF] hover:bg-[#1e222d] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Download size={16} /> {selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : "Excel Dışa Aktar"}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════ TAB BUTTONS ════════════════ */}
      <div className="glass-card flex space-x-2 p-1.5 rounded-2xl shadow-md shrink-0 self-start overflow-x-auto">
        <button
          onClick={() => setActiveTab('stok')}
          className={`whitespace-nowrap px-6 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'stok' 
              ? 'bg-[#00B2FF] text-white shadow-md' 
              : 'text-[#5A6685] dark:text-[#8892B5] hover:text-[#12141c] dark:hover:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d]'
          }`}
        >
          Stok Raporu
        </button>
        <button
          onClick={() => setActiveTab('critical')}
          className={`whitespace-nowrap px-6 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'critical' 
              ? 'bg-red-600 text-white shadow-md' 
              : 'text-[#5A6685] dark:text-[#8892B5] hover:text-[#12141c] dark:hover:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d]'
          }`}
        >
          Kritik Stok Raporu
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`whitespace-nowrap px-6 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'transfers' 
              ? 'bg-amber-600 text-white shadow-md' 
              : 'text-[#5A6685] dark:text-[#8892B5] hover:text-[#12141c] dark:hover:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d]'
          }`}
        >
          Transfer Hareketleri
        </button>
      </div>

      {activeTab === 'stok' && (
        /* Table Stok */
        <div className="glass-card rounded-2xl shadow-md flex-1 flex flex-col overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#1e222d] sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#00B2FF] focus:ring-[#00B2FF] bg-[#FFFFFF] dark:bg-[#1e222d]"
                        checked={selectedRows.length === filteredStockReports.length && filteredStockReports.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4">SON HAREKET TARİHİ</th>
                    <th className="px-6 py-4">İTEM KODU</th>
                    <th className="px-6 py-4">PARÇA ADI</th>
                    <th className="px-6 py-4">LOKASYON</th>
                    <th className="px-6 py-4">STOK MİKTARI</th>
                    <th className="px-6 py-4">KRİTİK DURUMU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#1e222d]">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8894D8]" />
                        Yükleniyor...
                      </td>
                    </tr>
                  ) : filteredStockReports.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                        Kayıt bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((r) => {
                      const isChecked = selectedRows.includes(r.id);
                      const isCritical = r.location_kind === 'good_stock' && r.quantity <= r.critical_limit;
                      return (
                      <tr key={r.id} className={`hover:bg-[#FFFFFF]/70 dark:hover:bg-[#1e222d]/70 transition-colors text-[#12141c] dark:text-[#F6F8FF] ${isChecked ? 'bg-blue-900/30 border-l-4 border-[#00B2FF]' : ''}`}>
                        <td className="px-6 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#00B2FF] focus:ring-[#00B2FF] bg-[#FFFFFF] dark:bg-[#1e222d]"
                            checked={isChecked}
                            onChange={(e) => toggleRowSelect(r.id, e)}
                          />
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[#5A6685] dark:text-[#8892B5] text-[11px]">{r.updated_at || r.date || '-'}</td>
                        <td className="px-6 py-3.5">
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#1e222d] dark:text-[#8894D8] border border-blue-200 dark:border-blue-800/60 font-mono font-bold text-[11px]">
                            {r.item_code}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-[#12141c] dark:text-[#F6F8FF]">{r.part_name}</td>
                        <td className="px-6 py-3.5">{r.location_name}</td>
                        <td className="px-6 py-3.5 font-mono font-semibold text-sm">{r.quantity}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isCritical ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                          }`}>
                            {isCritical ? '⚠️ KRİTİK' : 'NORMAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex justify-between items-center px-6 py-4 bg-[#F5F7FC] dark:bg-[#181a24] border-t border-[#DCE1F1] dark:border-[#1e222d] shrink-0 text-xs text-[#5A6685] dark:text-[#8892B5]">
              <span>
                Toplam <strong className="text-[#12141c] dark:text-[#F6F8FF]">{activeDataList.length}</strong> kayıttan <strong className="text-[#12141c] dark:text-[#F6F8FF]">{activeDataList.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, activeDataList.length)}</strong> arası gösteriliyor
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || activeDataList.length === 0}
                  className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
                >
                  Önceki
                </button>
                <span className="text-xs font-bold px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-[#8894D8]">
                  Sayfa {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || activeDataList.length === 0}
                  className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        )}
      {activeTab === 'critical' && (
        <div className="glass-card rounded-2xl shadow-md flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#1e222d] sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#00B2FF] focus:ring-[#00B2FF] bg-[#FFFFFF] dark:bg-[#1e222d]"
                      checked={selectedRows.length === filteredCriticalReports.length && filteredCriticalReports.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4">İTEM KODU</th>
                  <th className="px-6 py-4">PARÇA ADI</th>
                  <th className="px-6 py-4">LOKASYON</th>
                  <th className="px-6 py-4">MEVCUT STOK</th>
                  <th className="px-6 py-4">KRİTİK LİMİT</th>
                  <th className="px-6 py-4">DURUM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#1e222d]">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8894D8]" />
                      Yükleniyor...
                    </td>
                  </tr>
                ) : filteredCriticalReports.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                      Kritik stok seviyesinde parça bulunamadı.
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((r) => {
                    const isChecked = selectedRows.includes(r.id);
                    return (
                    <tr key={r.id} className={`hover:bg-[#FFFFFF]/70 dark:hover:bg-[#1e222d]/70 transition-colors text-[#12141c] dark:text-[#F6F8FF] ${isChecked ? 'bg-blue-900/30 border-l-4 border-[#00B2FF]' : ''}`}>
                      <td className="px-6 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#00B2FF] focus:ring-[#00B2FF] bg-[#FFFFFF] dark:bg-[#1e222d]"
                          checked={isChecked}
                          onChange={(e) => toggleRowSelect(r.id, e)}
                        />
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#1e222d] dark:text-[#8894D8] border border-blue-200 dark:border-blue-800/60 font-mono font-bold text-[11px]">
                          {r.item_code}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-[#12141c] dark:text-[#F6F8FF]">{r.part_name}</td>
                      <td className="px-6 py-3.5">{r.location_name}</td>
                      <td className="px-6 py-3.5 font-mono font-semibold text-sm text-red-400">{r.quantity}</td>
                      <td className="px-6 py-3.5 font-mono text-[#5A6685] dark:text-[#8892B5]">{r.critical_limit}</td>
                      <td className="px-6 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 flex items-center gap-1.5 w-fit">
                          <AlertTriangle size={12} /> KRİTİK SEVİYE
                        </span>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center px-6 py-4 bg-[#F5F7FC] dark:bg-[#181a24] border-t border-[#DCE1F1] dark:border-[#1e222d] shrink-0 text-xs text-[#5A6685] dark:text-[#8892B5]">
            <span>
              Toplam <strong className="text-[#12141c] dark:text-[#F6F8FF]">{activeDataList.length}</strong> kayıttan <strong className="text-[#12141c] dark:text-[#F6F8FF]">{activeDataList.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, activeDataList.length)}</strong> arası gösteriliyor
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || activeDataList.length === 0}
                className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
              >
                Önceki
              </button>
              <span className="text-xs font-bold px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-[#8894D8]">
                Sayfa {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || activeDataList.length === 0}
                className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
              >
                Sonraki
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Toolbar Transfers */}
          <div className="glass-card p-4 rounded-2xl shadow-md flex flex-col gap-4">
            <div className="flex gap-2 border-b border-[#DCE1F1] dark:border-[#1e222d] pb-3">
               <span className="text-xs font-bold text-[#5A6685] dark:text-[#8892B5] self-center mr-2">Hızlı Filtre:</span>
               <button onClick={() => setQuickFilter('today')} className="text-xs px-3 py-1.5 bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] transition-colors font-semibold cursor-pointer">Bugün</button>
               <button onClick={() => setQuickFilter('yesterday')} className="text-xs px-3 py-1.5 bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] transition-colors font-semibold cursor-pointer">Dün</button>
               <button onClick={() => setQuickFilter('week')} className="text-xs px-3 py-1.5 bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] transition-colors font-semibold cursor-pointer">Son 1 Hafta</button>
               <button onClick={() => setQuickFilter('month')} className="text-xs px-3 py-1.5 bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] transition-colors font-semibold cursor-pointer">Son 1 Ay</button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">Başlangıç:</span>
                  <input 
                    type="date" 
                    style={{ colorScheme: 'dark' }}
                    className="bg-[#FFFFFF] dark:bg-[#1e222d] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00B2FF]"
                    value={startDate.split('T')[0] || ''}
                    onChange={(e) => setStartDate(`${e.target.value}T${startDate.split('T')[1] || '00:00'}`)}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">Bitiş:</span>
                  <input 
                    type="date" 
                    style={{ colorScheme: 'dark' }}
                    className="bg-[#FFFFFF] dark:bg-[#1e222d] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00B2FF]"
                    value={endDate.split('T')[0] || ''}
                    onChange={(e) => setEndDate(`${e.target.value}T${endDate.split('T')[1] || '23:59'}`)}
                  />
                </div>

                <button 
                  onClick={() => fetchReports(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00B2FF] hover:bg-[#1e222d] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Filter size={15} /> Filtrele
                </button>
              </div>
            </div>
          </div>

          {/* Table Transfers */}
          <div className="glass-card rounded-2xl shadow-md flex-1 flex flex-col overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#1e222d] sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#00B2FF] focus:ring-[#00B2FF] bg-[#FFFFFF] dark:bg-[#1e222d]"
                        checked={selectedRows.length === filteredTransferReports.length && filteredTransferReports.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4">TARİH</th>
                    <th className="px-6 py-4">İTEM KODU</th>
                    <th className="px-6 py-4">PARÇA ADI</th>
                    <th className="px-6 py-4">MİKTAR</th>
                    <th className="px-6 py-4">KAYNAK DEPO</th>
                    <th className="px-6 py-4">HEDEF DEPO</th>
                    <th className="px-6 py-4">İŞLEMİ YAPAN</th>
                    <th className="px-6 py-4">TÜR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#1e222d]">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8894D8]" />
                        Yükleniyor...
                      </td>
                    </tr>
                  ) : filteredTransferReports.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                        Transfer hareketi bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((r) => {
                      const isChecked = selectedRows.includes(r.id);
                      const isOut = (r.type || '').includes('Çıkış') || (r.type || '').includes('Satış') || (r.type || '').includes('Servis Kullanımı') || (r.type || '').includes('Outbound') || (r.type || '').includes('Fire') || (r.type || '').includes('Teknik Servis');
                      const isIn = (r.type || '').includes('Giriş') || (r.type || '').includes('Yeni Alım') || (r.type || '').includes('İade') || (r.type || '').includes('Return') || (r.type || '').includes('İptal') || (r.type || '').includes('Inbound');
                      return (
                      <tr key={r.id} className={`hover:bg-[#FFFFFF]/70 dark:hover:bg-[#1e222d]/70 transition-colors text-[#12141c] dark:text-[#F6F8FF] ${isChecked ? 'bg-blue-900/30 border-l-4 border-[#00B2FF]' : ''}`}>
                        <td className="px-6 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#00B2FF] focus:ring-[#00B2FF] bg-[#FFFFFF] dark:bg-[#1e222d]"
                            checked={isChecked}
                            onChange={(e) => toggleRowSelect(r.id, e)}
                          />
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[#5A6685] dark:text-[#8892B5] text-[11px]">{r.date || '-'}</td>
                        <td className="px-6 py-3.5">
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#1e222d] dark:text-[#8894D8] border border-blue-200 dark:border-blue-800/60 font-mono font-bold text-[11px]">
                            {r.item_code}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-[#12141c] dark:text-[#F6F8FF]">{r.part_name}</td>
                        <td className={`px-6 py-3.5 font-mono font-semibold text-sm ${isOut ? 'text-red-400' : (isIn ? 'text-emerald-400' : 'text-blue-400')}`}>
                          {isOut ? '-' : (isIn ? '+' : '')}{r.quantity}
                        </td>
                        <td className="px-6 py-3.5">{r.source_location || '-'}</td>
                        <td className="px-6 py-3.5">{r.target_location || '-'}</td>
                        <td className="px-6 py-3.5">{r.user || '-'}</td>
                        <td className="px-6 py-3.5 text-[#5A6685] dark:text-[#8892B5]">{r.type || '-'}</td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center px-6 py-4 bg-[#F5F7FC] dark:bg-[#181a24] border-t border-[#DCE1F1] dark:border-[#1e222d] shrink-0 text-xs text-[#5A6685] dark:text-[#8892B5]">
              <span>
                Toplam <strong className="text-[#12141c] dark:text-[#F6F8FF]">{activeDataList.length}</strong> kayıttan <strong className="text-[#12141c] dark:text-[#F6F8FF]">{activeDataList.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, activeDataList.length)}</strong> arası gösteriliyor
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || activeDataList.length === 0}
                  className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
                >
                  Önceki
                </button>
                <span className="text-xs font-bold px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-[#8894D8]">
                  Sayfa {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || activeDataList.length === 0}
                  className="px-3 py-1.5 bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-bold text-[#12141c] dark:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#1e222d] disabled:opacity-40 transition-all cursor-pointer"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dışa Aktar Sütun Seçimi Modalı */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="glass-modal shadow-2xl rounded-2xl w-full max-w-sm p-6 text-[#12141c] dark:text-[#F6F8FF]">
            <h2 className="text-lg font-semibold text-[#12141c] dark:text-[#F6F8FF] mb-2">Excel Sütun Seçimi</h2>
            <p className="text-xs text-[#5A6685] dark:text-[#8892B5] mb-4">Dışa aktarılacak raporda yer almasını istediğiniz sütunları işaretleyin.</p>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {Object.keys(activeTab === 'stok' ? selectedStockCols : (activeTab === 'transfers' ? selectedTransferCols : selectedCriticalCols)).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer text-xs font-medium text-[#12141c] dark:text-[#F6F8FF]">
                  <input 
                    type="checkbox" 
                    checked={activeTab === 'stok' ? selectedStockCols[col] : (activeTab === 'transfers' ? selectedTransferCols[col] : selectedCriticalCols[col])}
                    onChange={(e) => {
                      if (activeTab === 'stok') {
                        setSelectedStockCols(prev => ({...prev, [col]: e.target.checked}));
                      } else if (activeTab === 'transfers') {
                        setSelectedTransferCols(prev => ({...prev, [col]: e.target.checked}));
                      } else {
                        setSelectedCriticalCols(prev => ({...prev, [col]: e.target.checked}));
                      }
                    }}
                    className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] text-[#00B2FF] focus:ring-[#00B2FF] bg-[#FFFFFF] dark:bg-[#1e222d]"
                  />
                  <span>{col}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                İptal
              </button>
              <button 
                onClick={executeExport}
                disabled={!Object.values(activeTab === 'stok' ? selectedStockCols : (activeTab === 'transfers' ? selectedTransferCols : selectedCriticalCols)).some(Boolean)}
                className="px-4 py-2 bg-[#00B2FF] hover:bg-[#1e222d] text-white rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
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
