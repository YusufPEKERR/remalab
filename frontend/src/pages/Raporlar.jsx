import { useState, useEffect } from 'react';
import { Download, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export default function Raporlar() {
  const [generalReports, setGeneralReports] = useState([]);
  const [criticalReports, setCriticalReports] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  const [activeTab, setActiveTab] = useState('general');

  const fetchReports = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (activeTab === 'general') {
        const res = await api.getReports(startDate, endDate);
        if (res.success) {
          setGeneralReports(res.reports);
        }
      } else {
        const res = await api.getCriticalStock();
        if (res.success) {
          setCriticalReports(res.critical_stock);
        }
      }
    } catch (err) {
      console.error("Reports error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleExportGeneral = async () => {
    await api.exportTableToExcel(generalReports, "genel_raporlar.xlsx");
  };

  const handleExportCritical = async () => {
    await api.exportTableToExcel(criticalReports, "kritik_raporlar.xlsx");
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(() => fetchReports(true), 8000);
    return () => clearInterval(interval);
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1e2330] p-6 rounded-2xl border border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Raporlar</h1>
          <p className="text-slate-400 mt-1">Tüm hareketleri ve kritik stok durumlarını raporlayın.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-[#1e2330] p-1 rounded-xl border border-slate-700/50 shrink-0 self-start">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'general' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#2a3142]'
          }`}
        >
          Genel Raporlar
        </button>
        <button
          onClick={() => setActiveTab('critical')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'critical' 
              ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#2a3142]'
          }`}
        >
          Kritik Raporlar
        </button>
      </div>

      {activeTab === 'general' && (
        <>
          {/* Toolbar General */}
          <div className="bg-[#1e2330] p-4 rounded-xl border border-slate-700/50 shadow-sm flex flex-col md:flex-row gap-4 items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-400">Başlangıç:</span>
              <input 
                type="date" 
                className="bg-[#242a38] text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-400">Bitiş:</span>
              <input 
                type="date" 
                className="bg-[#242a38] text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <button 
              onClick={fetchReports}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Filter size={16} /> Filtrele
            </button>

            <button 
              onClick={handleExportGeneral}
              className="flex items-center gap-2 px-5 py-2 bg-[#2a3142] hover:bg-[#323a4d] border border-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Download size={16} /> 📊 Excel'e Aktar
            </button>
          </div>

          {/* Table General */}
          <div className="bg-[#1e2330] border border-slate-700/50 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">TARİH</th>
                    <th className="px-6 py-4">HAREKET TİPİ</th>
                    <th className="px-6 py-4">PARÇA ADI</th>
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
                  ) : generalReports.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                        Kayıt bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    generalReports.map((r) => (
                      <tr key={r.id} className="hover:bg-[#2a3142] transition-colors group text-slate-300">
                        <td className="px-6 py-4 font-mono text-slate-400">{r.date}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                            r.type.includes('Giriş') 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : r.type.includes('Çıkış') 
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-slate-800 text-slate-300 border-slate-600'
                          }`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-200">{r.part_name}</td>
                        <td className="px-6 py-4 text-slate-400">{r.location}</td>
                        <td className="px-6 py-4 font-mono text-slate-200">{r.quantity}</td>
                        <td className="px-6 py-4">{r.user}</td>
                      </tr>
                    ))
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
          <div className="bg-[#1e2330] p-4 rounded-xl border border-slate-700/50 shadow-sm flex items-center shrink-0">
            <button 
              onClick={handleExportCritical}
              className="flex items-center gap-2 px-5 py-2 bg-[#2a3142] hover:bg-[#323a4d] border border-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={16} /> 📊 Excel'e Aktar
            </button>
          </div>

          {/* Table Critical */}
          <div className="bg-[#1e2330] border border-slate-700/50 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">PARÇA ADI</th>
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
                  ) : criticalReports.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                        Kritik stok uyarısı bulunmamaktadır.
                      </td>
                    </tr>
                  ) : (
                    criticalReports.map((r) => (
                      <tr key={r.id} className="hover:bg-[#2a3142] transition-colors group text-slate-300">
                        <td className="px-6 py-4 font-medium text-slate-200">{r.part_name}</td>
                        <td className="px-6 py-4 text-slate-400">{r.location}</td>
                        <td className="px-6 py-4 font-mono">
                          <span className="text-red-500 font-bold flex items-center gap-1.5">
                            <AlertTriangle size={14} /> {r.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400">{r.critical_limit}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
