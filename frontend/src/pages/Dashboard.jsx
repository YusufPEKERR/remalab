import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, MapPin, 
  ChevronRight, RefreshCw, Activity, TrendingUp, Layers, FileText,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Zap
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalParts: '12,458',
    totalStock: '84,291',
    lowStock: '23',
    criticalStock: '0',
    todaysInbound: '0',
    todaysOutbound: '0',
    activeLocations: '0'
  });
  const [loading, setLoading] = useState(false);
  const [activeDetail, setActiveDetail] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);

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
        api.getRecentStockMovements(5)
      ]);
      if (statRes && statRes.success) {
        setStats(statRes.stats);
      }
      if (movRes && movRes.success) {
        setRecentMovements(movRes.movements || []);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCardClick = (cardId) => {
    if (activeDetail === cardId) {
      setActiveDetail(null);
      return;
    }
    setActiveDetail(cardId);
    if (cardId === 'parts') {
      setDetailData([
        { id: 1, name: "iPhone 15 Pro LCD Ekran", code: "PRT-1002", qty: "142 Adet", loc: "Depo A-12", status: "Stokta" },
        { id: 2, name: "Samsung S24 Batarya", code: "PRT-1005", qty: "88 Adet", loc: "Depo B-04", status: "Stokta" },
        { id: 3, name: "MacBook M3 Klavye Modülü", code: "PRT-1011", qty: "24 Adet", loc: "Depo C-01", status: "Azalıyor" }
      ]);
    } else if (cardId === 'low_stock') {
      setDetailData([
        { id: 1, name: "iPad Air 5 Dokunmatik", code: "PRT-0402", qty: "3 Adet", loc: "Depo A-02", status: "Kritik" },
        { id: 2, name: "Dell XPS 15 Fan Soğutucu", code: "PRT-0881", qty: "1 Adet", loc: "Depo B-12", status: "Tükendi" }
      ]);
    } else if (cardId === 'locations') {
      setDetailData([
        { id: 1, name: "Ana Depo A-Blok", code: "LOC-A12", qty: "4.250 Ürün", loc: "Merkez", status: "Aktif" },
        { id: 2, name: "Servis Deposu B-Blok", code: "LOC-B04", qty: "1.890 Ürün", loc: "Servis 1", status: "Aktif" }
      ]);
    } else {
      setDetailData([]);
    }
  };

  const cards = [
    { 
      id: 'parts', 
      title: 'Kayıtlı Parça Çeşidi', 
      value: stats.totalParts || '0', 
      change: '+12%', 
      isPositive: true, 
      color: '#4457A5', 
      bgColor: 'rgba(68, 87, 165,0.08)',
      icon: <Package size={22} color="#4457A5" /> 
    },
    { 
      id: 'low_stock', 
      title: 'Kritik Stok Uyarıları', 
      value: stats.criticalStock || '0', 
      change: '-3%', 
      isPositive: false, 
      color: '#EF4444', 
      bgColor: 'rgba(239,68,68,0.08)',
      icon: <AlertTriangle size={22} color="#EF4444" /> 
    },
    { 
      id: 'inbound', 
      title: 'Bugünkü Giriş', 
      value: stats.todaysInbound || '0', 
      change: 'Adet', 
      isPositive: true, 
      color: '#4FA890', 
      bgColor: 'rgba(79, 168, 144,0.08)',
      icon: <ArrowDownToLine size={22} color="#4FA890" /> 
    },
    { 
      id: 'outbound', 
      title: 'Bugünkü Çıkış', 
      value: stats.todaysOutbound || '0', 
      change: 'Adet', 
      isPositive: false, 
      color: '#4457A5', 
      bgColor: 'rgba(68, 87, 165,0.08)',
      icon: <ArrowUpFromLine size={22} color="#4457A5" /> 
    },
    { 
      id: 'locations', 
      title: 'Aktif Lokasyonlar', 
      value: stats.activeLocations || '0', 
      change: 'Sabit', 
      isPositive: true, 
      color: '#3A76B8', 
      bgColor: 'rgba(58, 118, 184,0.08)',
      icon: <MapPin size={22} color="#3A76B8" /> 
    }
  ];

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#16204A] dark:text-slate-100 max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER & SYSTEM OVERVIEW ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#16204A] via-[#DDE2F2] dark:via-[#1B2755] to-[#EEF1FB] dark:to-[#16204A] p-6 sm:p-8 text-[#1B2755] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#24326A]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(68, 87, 165,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(68, 87, 165,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/30 text-[#2E3F78] dark:text-blue-300 text-xs font-semibold tracking-wide">
              <Zap size={13} className="animate-pulse text-blue-400" /> CANLI DEPO CANVASI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2755] dark:text-white">
              Kontrol Paneline Hoş Geldiniz
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Depo operasyonlarınızı, stok hareketlerini ve kritik seviyeleri canlı olarak takip edin.
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/depo')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4457A5] hover:bg-[#2E3F78] text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Package size={15} /> Depo Yönetimi
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════ METRICS GRID (KPI CARDS) ════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
        {cards.map(card => {
          const isSelected = activeDetail === card.id;
          return (
            <div 
              key={card.id} 
              onClick={() => handleCardClick(card.id)}
              className={`
                group relative bg-white dark:bg-[#16204A] rounded-2xl p-5 border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md
                ${isSelected ? 'border-[#4457A5] ring-2 ring-[#4457A5]/20 bg-blue-50/20 dark:bg-blue-900/20' : 'border-[#DCE1F1] dark:border-[#24326A] hover:border-blue-400 dark:hover:border-blue-500'}
              `}
            >
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: card.bgColor }}
                >
                  {card.icon}
                </div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  card.isPositive ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' : 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                }`}>
                  {card.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {card.change}
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-[#5A6685] dark:text-slate-400 block mb-1">{card.title}</span>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-semibold text-[#16204A] dark:text-white tracking-tight">{card.value}</h3>
                  <span className="text-[11px] text-[#4457A5] dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Detay &rsaquo;
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ════════════════ CARD DETAIL MODAL / EXTENDED PANEL ════════════════ */}
      {activeDetail && (
        <div className="bg-white dark:bg-[#16204A] rounded-2xl p-6 border border-[#DCE1F1] dark:border-[#24326A] shadow-md animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between mb-4 border-b border-[#DCE1F1] dark:border-[#24326A] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#4457A5]" />
              <h3 className="text-base font-semibold text-[#16204A] dark:text-white">
                {cards.find(c => c.id === activeDetail)?.title} - Hızlı Detay Listesi
              </h3>
            </div>
            <button 
              onClick={() => setActiveDetail(null)}
              className="text-xs text-[#5A6685] dark:text-slate-400 hover:text-[#16204A] dark:hover:text-white font-semibold px-2.5 py-1 rounded-lg bg-[#EFF1FA] dark:bg-[#24326A] border border-[#DCE1F1] dark:border-[#3B4A85] transition-colors"
            >
              Kapat ✕
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#F5F7FC] dark:bg-[#1B2755] text-[#5A6685] dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#24326A]">
                <tr>
                  <th className="px-4 py-3">Parça / Kayıt</th>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Lokasyon</th>
                  <th className="px-4 py-3">Miktar</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">Eylem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#24326A]">
                {detailData.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-6 text-center text-[#5A6685] dark:text-slate-400">Detay verisi bulunamadı.</td></tr>
                ) : (
                  detailData.map((d, i) => (
                    <tr key={i} className="hover:bg-[#EEF1FB]/50 dark:hover:bg-[#24326A]/70 text-[#16204A] dark:text-slate-200 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#16204A] dark:text-white">{d.name}</td>
                      <td className="px-4 py-3 font-mono text-[#5A6685] dark:text-slate-400">{d.code || '-'}</td>
                      <td className="px-4 py-3 font-medium text-[#3B4A85] dark:text-slate-300">{d.loc || '-'}</td>
                      <td className="px-4 py-3 font-semibold">{d.qty || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wide ${
                          d.status === 'Stokta' || d.status === 'Aktif' 
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' 
                            : 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => navigate('/depo')} className="text-[#4457A5] dark:text-blue-400 hover:text-[#2E3F78] font-bold inline-flex items-center gap-1">
                          İncele <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════ MAIN CONTENT GRID: MOVEMENTS + QUICK SHORTCUTS ════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: RECENT STOCK MOVEMENTS TABLE (2 Cols) ── */}
        <div className="lg:col-span-2 bg-white dark:bg-[#16204A] rounded-2xl p-6 border border-[#DCE1F1] dark:border-[#24326A] shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#DCE1F1] dark:border-[#24326A]">
              <div>
                <h3 className="text-base font-semibold text-[#16204A] dark:text-white flex items-center gap-2">
                  <Activity size={18} className="text-[#4457A5] dark:text-blue-400" /> Son Stok Hareketleri
                </h3>
                <p className="text-xs text-[#5A6685] dark:text-slate-400 mt-0.5">Sistemde gerçekleşen son 6 malzeme transfer ve giriş-çıkış işlemi</p>
              </div>
              <button 
                onClick={() => navigate('/raporlar')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#4457A5] dark:text-blue-400 hover:text-[#2E3F78] bg-[#EEF1FB] dark:bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/60 transition-colors self-start sm:self-auto"
              >
                Tüm Raporlar <ChevronRight size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#F5F7FC] dark:bg-[#1B2755] text-[#5A6685] dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#24326A]">
                  <tr>
                    <th className="px-3.5 py-3 rounded-l-lg">ID</th>
                    <th className="px-3.5 py-3">Parça Adı</th>
                    <th className="px-3.5 py-3">Lokasyon Transferi</th>
                    <th className="px-3.5 py-3">İşlem Türü</th>
                    <th className="px-3.5 py-3">Miktar</th>
                    <th className="px-3.5 py-3">Tarih / Saat</th>
                    <th className="px-3.5 py-3 rounded-r-lg">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#24326A]">
                  {recentMovements.length > 0 ? (
                    recentMovements.map((mov, i) => {
                      const isGiris = mov.type && mov.type.includes('Giriş');
                      const isCikis = mov.type && mov.type.includes('Çıkış');
                      return (
                        <tr key={mov.id || i} className="hover:bg-[#EEF1FB]/60 dark:hover:bg-[#24326A]/70 text-[#16204A] dark:text-slate-200 transition-colors">
                          <td className="px-3.5 py-3.5 font-mono text-[#5A6685] dark:text-slate-400 font-semibold">#{mov.id}</td>
                          <td className="px-3.5 py-3.5 font-semibold text-[#16204A] dark:text-white max-w-[180px] truncate" title={mov.part_name}>{mov.part_name || '-'}</td>
                          <td className="px-3.5 py-3.5 text-[#3B4A85] dark:text-slate-300 font-medium">
                            {mov.source_location !== '-' && mov.target_location !== '-' 
                              ? `${mov.source_location} ➔ ${mov.target_location}` 
                              : (mov.source_location !== '-' ? mov.source_location : mov.target_location)}
                          </td>
                          <td className="px-3.5 py-3.5 font-semibold">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide inline-flex items-center gap-1 ${
                              isGiris 
                                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' 
                                : isCikis 
                                  ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30' 
                                  : 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                            }`}>
                              {isGiris && <ArrowDownToLine size={10} />}
                              {isCikis && <ArrowUpFromLine size={10} />}
                              {mov.type}
                            </span>
                          </td>
                          <td className="px-3.5 py-3.5 font-semibold text-[#16204A] dark:text-white">{mov.quantity}</td>
                          <td className="px-3.5 py-3.5 text-[#5A6685] dark:text-slate-400 font-mono text-[11px]">{mov.created_at}</td>
                          <td className="px-3.5 py-3.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30">
                              <CheckCircle2 size={11} /> Tamamlandı
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-[#5A6685] dark:text-slate-400">
                        Henüz kaydedilmiş stok hareketi bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#DCE1F1] dark:border-[#24326A] flex items-center justify-between text-xs text-[#5A6685] dark:text-slate-400">
            <span>Son 24 saatteki hareketler gösteriliyor</span>
            <span className="font-semibold text-[#4457A5] dark:text-blue-400">Otomatik Canlı Güncelleme Açık</span>
          </div>
        </div>

        {/* ── RIGHT: QUICK ACCESS & SYSTEM HEALTH (1 Col) ── */}
        <div className="flex flex-col space-y-6">

          {/* Quick Shortcuts Panel */}
          <div className="bg-white dark:bg-[#16204A] rounded-2xl p-6 border border-[#DCE1F1] dark:border-[#24326A] shadow-sm transition-colors">
            <h3 className="text-base font-semibold text-[#16204A] dark:text-white mb-1 flex items-center gap-2">
              <Zap size={18} className="text-[#4457A5] dark:text-blue-400" /> Hızlı Erişim Kısayolları
            </h3>
            <p className="text-xs text-[#5A6685] dark:text-slate-400 mb-4">Sık kullanılan modüllere doğrudan erişin</p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { title: 'Stok Listesi', path: '/depo', icon: Package, count: stats.totalParts || '0', color: '#4457A5' },
                { title: 'İş Emirleri', path: '/is-emirleri', icon: Layers, count: 'Aktif', color: '#3A76B8' },
                { title: 'Servis Kayıtları', path: '/servis', icon: Activity, count: 'Takip', color: '#4FA890' },
                { title: 'Raporlar', path: '/raporlar', icon: FileText, count: 'Analiz', color: '#7A54C0' }
              ].map((sc, i) => (
                <button
                  key={i}
                  onClick={() => navigate(sc.path)}
                  className="flex flex-col p-3.5 rounded-xl border border-[#DCE1F1] dark:border-[#24326A] hover:border-blue-300 dark:hover:border-blue-500 bg-[#F5F7FC] dark:bg-[#24326A] hover:bg-[#EEF1FB]/60 dark:hover:bg-blue-900/20 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#16204A] border border-[#DCE1F1] dark:border-[#3B4A85] flex items-center justify-center shadow-xs">
                      <sc.icon size={16} color={sc.color} />
                    </div>
                    <ChevronRight size={14} className="text-[#5A6685] dark:text-slate-400 group-hover:text-[#4457A5] dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <span className="text-xs font-bold text-[#16204A] dark:text-white">{sc.title}</span>
                  <span className="text-[10px] text-[#5A6685] dark:text-slate-400 font-medium mt-0.5">{sc.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* System Health / Status Card */}
          <div className="bg-white dark:bg-[#16204A] rounded-2xl p-6 border border-[#DCE1F1] dark:border-[#24326A] shadow-sm flex-1 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[#16204A] dark:text-white flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-500" /> Sistem Durumu
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
                  ● %100 Çalışıyor
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5A6685] dark:text-slate-400 font-medium">Veritabanı Senkronizasyonu</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Aktif</span>
                </div>
                <div className="w-full bg-[#EFF1FA] dark:bg-[#24326A] h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full w-full" />
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-[#5A6685] dark:text-slate-400 font-medium">Kritik Stok Doluluk Oranı</span>
                  <span className="font-bold text-[#4457A5] dark:text-blue-400">%98.4 Güvenli</span>
                </div>
                <div className="w-full bg-[#EFF1FA] dark:bg-[#24326A] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#4457A5] h-full rounded-full w-[98.4%]" />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#DCE1F1] dark:border-[#24326A] text-[11px] text-[#5A6685] dark:text-slate-400 flex items-center justify-between">
              <span>Remalab WMS v1.0</span>
              <span className="font-semibold text-[#16204A] dark:text-white">Kesintisiz Bağlantı</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
