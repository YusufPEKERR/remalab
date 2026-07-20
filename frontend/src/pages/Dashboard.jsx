import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
// eslint-disable-next-line no-unused-vars
import { 
  Wrench, Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, MapPin, 
  ChevronRight, RefreshCw, Server, Database, HardDrive, FileText
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalParts: '12,458',
    totalStock: '84,291',
    lowStock: '23',
    _unusedStats: '0',
    criticalStock: '0',
    todaysInbound: '0',
    todaysOutbound: '0',
    activeLocations: '0'
  });
  const [loading, setLoading] = useState(false);
  const [activeDetail, setActiveDetail] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);

  // Local DB mock stats
  const localDbStats = {
    totalDbFiles: 3,
    totalSqlFiles: 12,
    totalDbSize: '1.4 MB',
    activeDb: 'warehouse_v2.db'
  };

  const cards = [
    { id: 'parts', title: 'Kayıtlı Parça Çeşidi', value: stats.totalParts || '0', change: '+12%', isPositive: true, color: '#58A6FF', icon: <Package size={24}/> },
    { id: 'low_stock', title: 'Kritik Stok', value: stats.criticalStock || '0', change: '-3%', isPositive: false, color: '#F85149', icon: <AlertTriangle size={24}/> },
    { id: 'inbound', title: 'Bugünkü Giriş', value: stats.todaysInbound || '0', change: 'Adet', isPositive: true, color: '#3FB950', icon: <ArrowDownToLine size={24}/> },
    { id: 'outbound', title: 'Bugünkü Çıkış', value: stats.todaysOutbound || '0', change: 'Adet', isPositive: false, color: '#D2A828', icon: <ArrowUpFromLine size={24}/> },
    { id: 'locations', title: 'Aktif Lokasyonlar', value: stats.activeLocations || '0', change: 'Sabit', isPositive: true, color: '#8957E5', icon: <MapPin size={24}/> }
  ];

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => loadDashboardData(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statRes, movRes] = await Promise.all([
        api.getDashboardStats(),
        api.getStockMovements('all')
      ]);
      if (statRes.success) {
        setStats(statRes.stats);
      }
      if (movRes.success) {
        setRecentMovements(movRes.movements.slice(0, 5)); // show top 5
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };



  const handleCardClick = (cardId) => {
    setActiveDetail(cardId);
    if(cardId === 'parts') {
      setDetailData([{ id: 1, name: "iPhone 15 Pro LCD" }, { id: 2, name: "Samsung S24 Battery" }]);
    } else if (cardId === 'stock' || cardId === 'low_stock') {
      setDetailData([{ name: "iPhone 15 Pro LCD", loc: "A-12-03", qty: 4, status: "Kritik" }]);
    } else if (cardId === 'locations') {
      setDetailData([{ id: 1, name: "A-12-03" }]);
    } else {
      setDetailData([]);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-2 pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Kontrol Paneli</h1>
          <p className="text-slate-400 mt-1">Hoş geldiniz, sistemin güncel durumunu buradan takip edebilirsiniz.</p>
        </div>
        <button
          type="button"
          onClick={() => loadDashboardData()}
          className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors"
          title="Yenile"
        >
          <RefreshCw size={18} className={loading ? "animate-spin text-blue-500" : ""} />
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards.map(card => (
          <div 
            key={card.id} 
            onClick={() => handleCardClick(card.id)}
            className={`bg-white dark:bg-[#1e2330] rounded-2xl p-5 border border-slate-200 dark:border-slate-700/50 shadow-lg cursor-pointer transition-all hover:scale-[1.02] hover:border-[${card.color}]/50`}
            style={{ borderLeftWidth: activeDetail === card.id ? '4px' : '1px', borderLeftColor: activeDetail === card.id ? card.color : 'rgba(51, 65, 85, 0.5)' }}
          >
            <div className="flex justify-between items-start mb-4">
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center" 
                style={{ backgroundColor: `${card.color}1A`, color: card.color }}
              >
                {card.icon}
              </div>
              <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${card.isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {card.change}
              </span>
            </div>
            <div>
              <h3 className="text-slate-400 font-medium mb-1">{card.title}</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Local DB Section */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
          <Server size={18} className="text-indigo-400"/> Lokal Veritabanı Durumu
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-slate-500 text-sm mb-1 flex items-center gap-1"><Database size={14}/> Toplam DB Dosyası:</p>
            <p className="text-slate-800 dark:text-slate-200 font-medium">{localDbStats.totalDbFiles}</p>
          </div>
          <div>
            <p className="text-slate-500 text-sm mb-1 flex items-center gap-1"><FileText size={14}/> Toplam SQL Dosyası:</p>
            <p className="text-slate-800 dark:text-slate-200 font-medium">{localDbStats.totalSqlFiles}</p>
          </div>
          <div>
            <p className="text-slate-500 text-sm mb-1 flex items-center gap-1"><HardDrive size={14}/> Toplam Boyut:</p>
            <p className="text-slate-800 dark:text-slate-200 font-medium">{localDbStats.totalDbSize}</p>
          </div>
          <div>
            <p className="text-slate-500 text-sm mb-1 flex items-center gap-1"><Database size={14}/> Aktif DB:</p>
            <p className="text-indigo-400 font-medium">{localDbStats.activeDb}</p>
          </div>
        </div>
      </div>

      {/* Details Table (Shows when card clicked) */}
      {activeDetail && (
        <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 capitalize">
            Detaylar: {cards.find(c => c.id === activeDetail)?.title}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">ID / Parça</th>
                  <th className="px-4 py-3">Lokasyon</th>
                  <th className="px-4 py-3">Miktar / Durum</th>
                  <th className="px-4 py-3 rounded-r-lg">Eylem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {detailData.length === 0 ? (
                  <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-500">Veri bulunamadı.</td></tr>
                ) : (
                  detailData.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300">
                      <td className="px-4 py-3 font-medium">{d.name}</td>
                      <td className="px-4 py-3">{d.loc || '-'}</td>
                      <td className="px-4 py-3">{d.qty || '-'} {d.status && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">{d.status}</span>}</td>
                      <td className="px-4 py-3"><button onClick={() => navigate('/parts')} className="text-blue-400 hover:text-blue-300 transition-colors">Düzenle</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Movements */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              📋 Son Stok Hareketleri
            </h3>
            <p className="text-sm text-slate-500 mt-1">Sistemdeki en son giriş, çıkış ve transfer işlemleri</p>
          </div>
          <button onClick={() => navigate('/raporlar')} className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center transition-colors">
            Tümünü Gör <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase text-xs">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Hareket ID</th>
                <th className="px-4 py-3">Parça Adı</th>
                <th className="px-4 py-3">Lokasyon</th>
                <th className="px-4 py-3">Tür</th>
                <th className="px-4 py-3">Miktar</th>
                <th className="px-4 py-3">Zaman</th>
                <th className="px-4 py-3 rounded-r-lg">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {recentMovements.length > 0 ? recentMovements.map((mov, i) => (
                <tr key={mov.id || i} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 transition-colors">
                  <td className="px-4 py-4 font-mono text-slate-400">{mov.id}</td>
                  <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-200">{mov.part_name || '-'}</td>
                  <td className="px-4 py-4">{mov.type === 'Giriş' ? mov.target_location : mov.source_location}</td>
                  <td className="px-4 py-4">
                    <span style={{color: mov.type && mov.type.includes('Giriş') ? '#58A6FF' : mov.type && mov.type.includes('Çıkış') ? '#F85149' : '#D2A828'}}>
                      {mov.type}
                    </span>
                  </td>
                  <td className="px-4 py-4">{mov.quantity}</td>
                  <td className="px-4 py-4 text-slate-400">{mov.created_at}</td>
                  <td className="px-4 py-4">
                    <span style={{color: '#3FB950'}}>Tamamlandı</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                    Henüz stok hareketi bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
