import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Filter, RefreshCw, AlertTriangle, Trash2, TrendingUp } from 'lucide-react';
import { api } from '../services/api';

export default function Raporlar() {
  const [generalReports, setGeneralReports] = useState([]);
  const [criticalReports, setCriticalReports] = useState([]);
  const [productionReports, setProductionReports] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Selection and Export States
  const [selectedRows, setSelectedRows] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedGeneralCols, setSelectedGeneralCols] = useState({
    "Tarih": true,
    "Hareket Tipi": true,
    "Parça Adı": true,
    "Lokasyon": true,
    "Miktar": true,
    "İşlemi Yapan": true
  });
  const [selectedCriticalCols, setSelectedCriticalCols] = useState({
    "Parça Adı": true,
    "Lokasyon": true,
    "Mevcut Stok": true,
    "Kritik Limit": true
  });
  const [selectedProductionCols, setSelectedProductionCols] = useState({
    "Cihaz Kimlik ID": true,
    "Üretilen Parça": true,
    "Miktar": true,
    "Kaynak Lokasyon": true,
    "Hedef Lokasyon": true,
    "Tüketilen Malzemeler": true,
    "Üretici": true,
    "Tarih": true
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
  
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    setSelectedRows([]);
  }, [activeTab]);

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (activeTab === 'general') {
        const res = await api.getReports(startDate, endDate);
        if (res.success) {
          setGeneralReports(res.reports);
        } else {
          alert("Genel raporlar alınamadı: " + (res.message || "Bilinmeyen hata"));
        }
      } else if (activeTab === 'critical') {
        const res = await api.getCriticalStock();
        if (res.success) {
          setCriticalReports(res.critical_stock);
        } else {
          alert("Kritik raporlar alınamadı: " + (res.message || "Bilinmeyen hata"));
        }
      } else if (activeTab === 'production') {
        const res = await api.getProductionRuns();
        if (res.success) {
          setProductionReports(res.production_runs);
        } else {
          alert("Üretim raporları alınamadı: " + (res.message || "Bilinmeyen hata"));
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

  const handleDeleteProduction = async (id) => {
    if (!window.confirm("Bu cihazı içeren üretimi (tüm grup üretimini ve hammadde iadelerini) geri çekmek ve silmek istediğinize emin misiniz?")) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.deleteProductionRun(id);
      if (res.success) {
        alert("Üretim kaydı başarıyla silindi ve stoklar geri alındı.");
        fetchReports();
      } else {
        alert(res.message || "İşlem başarısız oldu.");
      }
    } catch (err) {
      console.error("Delete run error:", err);
      alert("Hata oluştu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredGeneralReports = generalReports.filter(r => selectedLocation === '' || r.location === selectedLocation);
  const filteredCriticalReports = criticalReports.filter(r => selectedLocation === '' || r.location === selectedLocation);
  const filteredProductionReports = productionReports.filter(r => selectedLocation === '' || r.location_name === selectedLocation);

  useEffect(() => { setCurrentPage(1); }, [activeTab, selectedLocation, startDate, endDate]);

  const activeDataList = activeTab === 'general' 
    ? filteredGeneralReports 
    : (activeTab === 'critical' ? filteredCriticalReports : filteredProductionReports);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedReports = activeDataList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(activeDataList.length / itemsPerPage);

  const toggleSelectAll = () => {
    const dataList = activeTab === 'general' 
      ? filteredGeneralReports 
      : (activeTab === 'critical' ? filteredCriticalReports : filteredProductionReports);
    if (selectedRows.length === dataList.length && dataList.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(dataList.map(item => activeTab === 'production' ? item.unit_id : item.id));
    }
  };

  const toggleRowSelect = (id, e) => {
    e.stopPropagation();
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const executeExport = async () => {
    const dataList = activeTab === 'general' 
      ? filteredGeneralReports 
      : (activeTab === 'critical' ? filteredCriticalReports : filteredProductionReports);
    const baseReports = activeTab === 'general' 
      ? generalReports 
      : (activeTab === 'critical' ? criticalReports : productionReports);
    
    const dataToExport = selectedRows.length > 0 
      ? baseReports.filter(r => selectedRows.includes(activeTab === 'production' ? r.unit_id : r.id))
      : dataList;

    if (dataToExport.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      setIsExportModalOpen(false);
      return;
    }

    let exportReadyData = [];

    if (activeTab === 'general') {
      exportReadyData = dataToExport.map(r => {
        const row = {};
        if (selectedGeneralCols["Tarih"]) row["Tarih"] = r.date;
        if (selectedGeneralCols["Hareket Tipi"]) row["Hareket Tipi"] = r.type;
        if (selectedGeneralCols["Parça Adı"]) row["Parça Adı"] = r.part_name;
        if (selectedGeneralCols["Lokasyon"]) row["Lokasyon"] = r.location;
        if (selectedGeneralCols["Miktar"]) row["Miktar"] = r.quantity;
        if (selectedGeneralCols["İşlemi Yapan"]) row["İşlemi Yapan"] = r.user;
        return row;
      });
      await api.exportTableToExcel(exportReadyData, 'genel_raporlar.xlsx');
    } else if (activeTab === 'critical') {
      exportReadyData = dataToExport.map(r => {
        const row = {};
        if (selectedCriticalCols["Parça Adı"]) row["Parça Adı"] = r.part_name;
        if (selectedCriticalCols["Lokasyon"]) row["Lokasyon"] = r.location;
        if (selectedCriticalCols["Mevcut Stok"]) row["Mevcut Stok"] = r.quantity;
        if (selectedCriticalCols["Kritik Limit"]) row["Kritik Limit"] = r.critical_limit;
        return row;
      });
      await api.exportTableToExcel(exportReadyData, 'kritik_raporlar.xlsx');
    } else {
      exportReadyData = dataToExport.map(r => {
        const row = {};
        if (selectedProductionCols["Cihaz Kimlik ID"]) row["Cihaz Kimlik ID"] = r.serial_number;
        if (selectedProductionCols["Üretilen Parça"]) row["Üretilen Parça"] = r.target_part_name;
        if (selectedProductionCols["Miktar"]) row["Miktar"] = r.quantity_produced;
        if (selectedProductionCols["Kaynak Lokasyon"]) row["Kaynak Lokasyon"] = r.source_location_name || '-';
        if (selectedProductionCols["Hedef Lokasyon"]) row["Hedef Lokasyon"] = r.location_name || '-';
        if (selectedProductionCols["Tüketilen Malzemeler"]) row["Tüketilen Malzemeler"] = (r.materials || []).map(m => `${m.part_name} [${m.item_code}] (${m.quantity_consumed})`).join(', ');
        if (selectedProductionCols["Üretici"]) row["Üretici"] = r.produced_by || '-';
        if (selectedProductionCols["Tarih"]) row["Tarih"] = r.created_at || '-';
        return row;
      });
      await api.exportTableToExcel(exportReadyData, 'uretim_raporlari.xlsx');
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

  return (
    <div className="flex flex-col space-y-6 min-h-full pb-8">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Raporlar</h1>
          <p className="text-slate-400 mt-1">Tüm hareketleri ve kritik stok durumlarını raporlayın.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-500">Depo Filtresi:</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="bg-slate-50 dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Tüm Depolar</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.name}>{loc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-white dark:bg-[#1e2330] p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 shrink-0 self-start">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'general' 
              ? 'bg-blue-600 text-slate-900 dark:text-white shadow-lg shadow-blue-900/20' 
              : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a3142]'
          }`}
        >
          Genel Raporlar
        </button>
        <button
          onClick={() => setActiveTab('critical')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'critical' 
              ? 'bg-red-600 text-slate-900 dark:text-white shadow-lg shadow-red-900/20' 
              : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a3142]'
          }`}
        >
          Kritik Raporlar
        </button>
        <button
          onClick={() => setActiveTab('production')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'production' 
              ? 'bg-purple-600 text-slate-900 dark:text-white shadow-lg shadow-purple-900/20' 
              : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a3142]'
          }`}
        >
          Üretim Raporu
        </button>
      </div>

      {activeTab === 'general' && (
        <>
          {/* Toolbar General */}
          <div className="bg-white dark:bg-[#1e2330] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 shrink-0">
            {/* Quick Filters */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700/50 pb-3">
               <span className="text-sm font-medium text-slate-400 self-center mr-2">Hızlı Filtre:</span>
               <button onClick={() => setQuickFilter('today')} className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-[#2a3142] hover:bg-[#323a4d] text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors">Bugün</button>
               <button onClick={() => setQuickFilter('yesterday')} className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-[#2a3142] hover:bg-[#323a4d] text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors">Dün</button>
               <button onClick={() => setQuickFilter('week')} className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-[#2a3142] hover:bg-[#323a4d] text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors">Son 1 Hafta</button>
               <button onClick={() => setQuickFilter('month')} className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-[#2a3142] hover:bg-[#323a4d] text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors">Son 1 Ay</button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-400">Başlangıç:</span>
                <input 
                  type="date" 
                  style={{ colorScheme: 'dark' }}
                  className="bg-slate-50 dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  value={startDate.split('T')[0] || ''}
                  onChange={(e) => setStartDate(`${e.target.value}T${startDate.split('T')[1] || '00:00'}`)}
                />
                <input 
                  type="time" 
                  style={{ colorScheme: 'dark' }}
                  className="bg-slate-50 dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border-y border-r border-slate-200 dark:border-slate-700 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 -ml-2"
                  value={startDate.split('T')[1] || '00:00'}
                  onChange={(e) => setStartDate(`${startDate.split('T')[0] || ''}T${e.target.value}`)}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-400">Bitiş:</span>
                <input 
                  type="date" 
                  style={{ colorScheme: 'dark' }}
                  className="bg-slate-50 dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  value={endDate.split('T')[0] || ''}
                  onChange={(e) => setEndDate(`${e.target.value}T${endDate.split('T')[1] || '23:59'}`)}
                />
                <input 
                  type="time" 
                  style={{ colorScheme: 'dark' }}
                  className="bg-slate-50 dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border-y border-r border-slate-200 dark:border-slate-700 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 -ml-2"
                  value={endDate.split('T')[1] || '23:59'}
                  onChange={(e) => setEndDate(`${endDate.split('T')[0] || ''}T${e.target.value}`)}
                />
              </div>

              <button 
                onClick={() => fetchReports(false)}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Filter size={16} /> Filtrele
              </button>

              <button 
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2 bg-slate-100 dark:bg-[#2a3142] hover:bg-[#323a4d] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors ml-auto"
              >
                <Download size={16} /> {selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : "Tümünü Dışa Aktar"}
              </button>
            </div>
          </div>

          {/* Table General */}
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-lg flex-1 flex flex-col">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-base whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-sm sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        checked={selectedRows.length === filteredGeneralReports.length && filteredGeneralReports.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4">TARİH</th>
                    <th className="px-6 py-4">HAREKET TİPİ</th>
                    <th className="px-6 py-4 min-w-[300px]">PARÇA ADI</th>
                    <th className="px-6 py-4">LOKASYON</th>
                    <th className="px-6 py-4">MİKTAR</th>
                    <th className="px-6 py-4">İŞLEMİ YAPAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                        Yükleniyor...
                      </td>
                    </tr>
                  ) : filteredGeneralReports.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                        Kayıt bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((r) => {
                      const isChecked = selectedRows.includes(r.id);
                      return (
                      <tr key={r.id} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-700 dark:text-slate-300 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                        <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                            checked={isChecked}
                            onChange={(e) => toggleRowSelect(r.id, e)}
                          />
                        </td>
                        <td className="px-6 py-5 font-mono text-slate-400">{r.date}</td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                            r.type.includes('Giriş') 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                              : r.type.includes('Çıkış') 
                                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                          }`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-medium text-slate-800 dark:text-slate-200">{r.part_name}</td>
                        <td className="px-6 py-5 text-slate-400">{r.location}</td>
                        <td className="px-6 py-5 font-mono text-slate-800 dark:text-slate-200">{r.quantity}</td>
                        <td className="px-6 py-5">{r.user}</td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'critical' && (
        <>
          {/* Toolbar Critical */}
          <div className="bg-white dark:bg-[#1e2330] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center shrink-0">
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-100 dark:bg-[#2a3142] hover:bg-[#323a4d] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Download size={16} /> {selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : "Tümünü Dışa Aktar"}
            </button>
          </div>

          {/* Table Critical */}
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-lg flex-1 flex flex-col">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-base whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-sm sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        checked={selectedRows.length === filteredCriticalReports.length && filteredCriticalReports.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4 min-w-[300px]">PARÇA ADI</th>
                    <th className="px-6 py-4">LOKASYON</th>
                    <th className="px-6 py-4">MEVCUT STOK</th>
                    <th className="px-6 py-4">KRİTİK LİMİT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-400" />
                        Yükleniyor...
                      </td>
                    </tr>
                  ) : filteredCriticalReports.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                        Kritik stok uyarısı bulunmamaktadır.
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((r) => {
                      const isChecked = selectedRows.includes(r.id);
                      return (
                      <tr key={r.id} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-700 dark:text-slate-300 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                        <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                            checked={isChecked}
                            onChange={(e) => toggleRowSelect(r.id, e)}
                          />
                        </td>
                        <td className="px-6 py-5 font-medium text-slate-800 dark:text-slate-200">{r.part_name}</td>
                        <td className="px-6 py-5 text-slate-400">{r.location}</td>
                        <td className="px-6 py-5 font-mono">
                          <span className="text-red-500 font-bold flex items-center gap-1.5">
                            <AlertTriangle size={18} /> {r.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-mono text-slate-400">{r.critical_limit}</td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'production' && (
        <>
          {/* Toolbar Production */}
          <div className="bg-white dark:bg-[#1e2330] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center shrink-0">
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-100 dark:bg-[#2a3142] hover:bg-[#323a4d] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Download size={16} /> {selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : "Tümünü Dışa Aktar"}
            </button>
          </div>

          {/* Table Production */}
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-lg flex-1 flex flex-col">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-base whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-sm sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        checked={selectedRows.length === filteredProductionReports.length && filteredProductionReports.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4">KİMLİK ID</th>
                    <th className="px-6 py-4 min-w-[250px]">ÜRETİLEN PARÇA</th>
                    <th className="px-6 py-4 text-center">MİKTAR</th>
                    <th className="px-6 py-4">KAYNAK LOKASYON</th>
                    <th className="px-6 py-4">HEDEF LOKASYON</th>
                    <th className="px-6 py-4 min-w-[300px]">TÜKETİLEN MALZEMELER</th>
                    <th className="px-6 py-4">ÜRETİCİ</th>
                    <th className="px-6 py-4">TARİH</th>
                    <th className="px-6 py-4 text-center">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                        Yükleniyor...
                      </td>
                    </tr>
                  ) : filteredProductionReports.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-8 text-center text-slate-500">
                        Üretim kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((r) => {
                      const isChecked = selectedRows.includes(r.unit_id);
                      return (
                      <tr key={r.unit_id} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-700 dark:text-slate-300 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                        <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                            checked={isChecked}
                            onChange={(e) => toggleRowSelect(r.unit_id, e)}
                          />
                        </td>
                        <td className="px-6 py-5 font-mono font-bold text-slate-900 dark:text-slate-200">{r.serial_number}</td>
                        <td className="px-6 py-5 font-medium text-slate-800 dark:text-slate-200">
                          <div>{r.target_part_name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{r.target_item_code}</div>
                        </td>
                        <td className="px-6 py-5 font-mono text-center">{r.quantity_produced}</td>
                        <td className="px-6 py-5 text-slate-400">{r.source_location_name || '-'}</td>
                        <td className="px-6 py-5 text-slate-400">{r.location_name || '-'}</td>
                        <td className="px-6 py-5 text-xs text-slate-400 whitespace-normal min-w-[300px]">
                          {(r.materials || []).length > 0
                            ? r.materials.map(m => `${m.part_name}${m.item_code ? ` [${m.item_code}]` : ''} (${m.quantity_consumed})`).join(', ')
                            : '-'}
                        </td>
                        <td className="px-6 py-5 text-slate-400">{r.produced_by || '-'}</td>
                        <td className="px-6 py-5 text-slate-400 font-mono text-xs">{r.created_at}</td>
                        <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleDeleteProduction(r.id)} 
                            className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Geri Çek / Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-[#242a38] border-t border-slate-200 dark:border-slate-700/50 shrink-0">
        <span className="text-sm text-slate-500">
          Toplam {activeDataList.length} kayıttan {activeDataList.length === 0 ? 0 : indexOfFirstItem + 1}-{Math.min(indexOfLastItem, activeDataList.length)} arası gösteriliyor
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || activeDataList.length === 0}
            className="px-3 py-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 disabled:opacity-50"
          >
            Önceki
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || activeDataList.length === 0}
            className="px-3 py-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 disabled:opacity-50"
          >
            Sonraki
          </button>
        </div>
      </div>

      {/* Dışa Aktar Sütun Seçimi Modalı */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Sütun Seçimi</h2>
            <p className="text-sm text-slate-500 mb-4">Dışa aktarılacak Excel dosyasında hangi sütunların bulunmasını istediğinizi seçin.</p>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {Object.keys(activeTab === 'general' ? selectedGeneralCols : (activeTab === 'critical' ? selectedCriticalCols : selectedProductionCols)).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={activeTab === 'general' ? selectedGeneralCols[col] : (activeTab === 'critical' ? selectedCriticalCols[col] : selectedProductionCols[col])}
                    onChange={(e) => {
                      if (activeTab === 'general') {
                        setSelectedGeneralCols(prev => ({...prev, [col]: e.target.checked}));
                      } else if (activeTab === 'critical') {
                        setSelectedCriticalCols(prev => ({...prev, [col]: e.target.checked}));
                      } else {
                        setSelectedProductionCols(prev => ({...prev, [col]: e.target.checked}));
                      }
                    }}
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
                onClick={executeExport}
                disabled={!Object.values(activeTab === 'general' ? selectedGeneralCols : (activeTab === 'critical' ? selectedCriticalCols : selectedProductionCols)).some(Boolean)}
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
