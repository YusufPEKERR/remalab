import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, LayoutDashboard, Users, Package, Settings, Bell,
  Warehouse, FileText, BarChart2, Box, Truck, MapPin,
  CheckCircle, Search, AlertTriangle, Zap, RefreshCw, Sun, Moon
} from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Saniye saniye artmasını istemediğiniz için timer kaldırıldı
    // const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    // return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const notifTimer = setInterval(fetchNotifications, 60000); // 1 minute
    return () => clearInterval(notifTimer);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.getCriticalStock();
      if (res && res.success) {
        setNotifications(res.critical_stock || []);
      }
    } catch (err) {
      console.error('Bildirimler alınamadı', err);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("User parsing error", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  const userRole = (user?.role || 'Admin').toLowerCase();

  // Permission maps based on Python code:
  const allowedPaths = {
    'admin': ['/dashboard', '/depo', '/irsaliye', '/raporlar', '/parts', '/products', '/suppliers', '/locations', '/users', '/settings', '/quality', '/refurbishment', '/priority'],
    'depo': ['/dashboard', '/depo', '/irsaliye', '/locations'],
    'depo müdürü': ['/dashboard', '/depo', '/irsaliye', '/locations', '/parts', '/products', '/suppliers'],
    'teknisyen': ['/dashboard', '/quality', '/refurbishment', '/priority']
  };

  const allowed = allowedPaths[userRole] || allowedPaths['admin'];

  const menuGroups = [
    {
      title: 'GENEL BAKIŞ',
      items: [
        { name: 'Kontrol Paneli', icon: LayoutDashboard, path: '/dashboard' }
      ]
    },
    {
      title: 'DEPO',
      items: [
        { name: 'Depo', icon: Warehouse, path: '/depo' },
        { name: 'İrsaliye', icon: FileText, path: '/irsaliye' },
        { name: 'Raporlar', icon: BarChart2, path: '/raporlar' }
      ]
    },
    {
      title: 'ENVANTER',
      items: [
        { name: 'Parçalar', icon: Package, path: '/parts' },
        { name: 'Ürün Listesi', icon: Box, path: '/products' },
        { name: 'Tedarikçiler', icon: Truck, path: '/suppliers' },
        { name: 'Lokasyonlar', icon: MapPin, path: '/locations' }
      ]
    },
    {
      title: 'KULLANICI & AYARLAR',
      items: [
        { name: 'Kullanıcılar', icon: Users, path: '/users' },
        { name: 'Ayarlar', icon: Settings, path: '/settings' }
      ]
    }
  ];

  // Filter groups based on role
  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => allowed.includes(item.path))
  })).filter(group => group.items.length > 0);

  const currentPage = menuGroups.flatMap(g => g.items).find(i => 
    location.pathname === i.path || (i.path !== '/' && location.pathname.startsWith(i.path))
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0f1219] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-[#161B22] text-slate-700 dark:text-slate-300 flex flex-col border-r border-slate-200 dark:border-[#30363D] z-20">
        <div className="flex items-center justify-center pb-6 pt-10 border-b border-slate-200 dark:border-[#30363D]">
          <img src="/logo.png" alt="Remalab Logo" className="h-36 w-full object-contain drop-shadow-md scale-110 dark:hidden" />
          <img src="/karanlik-mod.png" alt="Remalab Logo" className="h-36 w-full object-contain drop-shadow-md scale-110 hidden dark:block" />
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-thin scrollbar-thumb-[#30363D] scrollbar-track-transparent">
          {filteredGroups.map((group, idx) => (
            <div key={idx} className="px-4">
              <h3 className="px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                {group.title}
              </h3>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <a
                      key={item.name}
                      href={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a3142]'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(item.path);
                      }}
                    >
                      <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                      {item.name}
                    </a>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-[#30363D]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors"
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-[#161B22] border-b border-slate-200 dark:border-[#30363D] flex items-center justify-between px-6 shadow-sm z-50 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {currentPage ? currentPage.name : 'Depo Yönetim Sistemi'}
            </h2>
            <p className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
              Ana Sayfa &rsaquo; {currentPage ? currentPage.name : 'Genel'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1e2330] rounded-lg border border-slate-200 dark:border-slate-700/50">
              <span className="text-[11px] font-medium text-slate-400">⏱ SON GÜNCELLEME:</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono tracking-wider">
                {currentTime.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })} - {currentTime.toLocaleTimeString('tr-TR')}
              </span>
            </div>

            <button
              onClick={() => {
                setCurrentTime(new Date());
                window.dispatchEvent(new CustomEvent('app:refresh'));
              }}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors bg-slate-100 dark:bg-[#1e2330] rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-500/50"
              title="Sayfayı Yenile"
            >
              <RefreshCw size={18} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors bg-slate-100 dark:bg-[#1e2330] rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-amber-300 dark:hover:border-amber-500/50"
              title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-800 dark:text-slate-200 transition-colors relative bg-slate-100 dark:bg-[#1e2330] rounded-xl border border-slate-200 dark:border-slate-700/50" 
                title="Bildirimler"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#1e2330] animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-[360px] bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#242a38] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Kritik Stok Bildirimleri</h3>
                      {notifications.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-md">{notifications.length} Uyarı</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setNotifications([]); }}
                            className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded-md transition-colors"
                          >
                            Tümünü Sil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-[#30363D] scrollbar-track-transparent">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {notifications.map((notif, idx) => (
                          <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-100 dark:bg-[#2a3142] transition-colors cursor-pointer" onClick={() => {setShowNotifications(false); navigate('/depo');}}>
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0">
                                <AlertTriangle size={18} className={notif.status === 'Tükendi' ? "text-red-400" : "text-amber-400"} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1 leading-snug line-clamp-2" title={notif.part_name}>{notif.part_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Lokasyon: <strong className="text-slate-700 dark:text-slate-300">{notif.location_name}</strong></p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Stok: {notif.quantity}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${notif.status === 'Tükendi' ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
                                    {notif.status === 'Tükendi' ? 'STOK TÜKENDİ' : 'KRİTİK SEVİYE'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
                        <CheckCircle size={36} className="mb-3 text-emerald-500/60" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Harika! Tüm stoklar güvende.</p>
                        <p className="text-xs mt-1">Şu an için kritik seviyede ürün yok.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 border-l border-slate-200 dark:border-[#30363D] pl-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold uppercase shadow-sm">
                {user && user.username ? user.username.charAt(0) : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">{(user && user.username) ? user.username : 'Misafir'}</p>
                <p className="text-xs text-slate-400 mt-1">{(user && user.role) ? user.role : 'Guest'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content (Outlet renders child routes) */}
        <main className="flex-1 overflow-hidden p-6 bg-slate-50 dark:bg-[#0f1219]">
          <div className="h-full max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
