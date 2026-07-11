import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, LayoutDashboard, Users, Package, Settings, Bell,
  Warehouse, FileText, BarChart2, Box, Truck, MapPin,
  CheckCircle, Search, AlertTriangle, Zap, RefreshCw
} from 'lucide-react';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    <div className="flex h-screen bg-[#0f1219] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#161B22] text-slate-300 flex flex-col border-r border-[#30363D] z-20">
        <div className="py-6 flex items-center justify-center px-4 border-b border-[#30363D]">
          <h1 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            REMALAB
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-thin scrollbar-thumb-[#30363D] scrollbar-track-transparent">
          {filteredGroups.map((group, idx) => (
            <div key={idx} className="px-4">
              <h3 className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
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
                          : 'text-slate-400 hover:bg-[#1e2330] hover:text-slate-200'
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
        
        <div className="p-4 border-t border-[#30363D]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              {currentPage ? currentPage.name : 'Depo Yönetim Sistemi'}
            </h2>
            <p className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
              Ana Sayfa &rsaquo; {currentPage ? currentPage.name : 'Genel'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#1e2330] rounded-lg border border-slate-700/50">
              <span className="text-[11px] font-medium text-slate-400">⏱ SON GÜNCELLEME:</span>
              <span className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                {currentTime.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })} - {currentTime.toLocaleTimeString('tr-TR')}
              </span>
            </div>
            
            <button className="p-2 text-slate-400 hover:text-slate-200 transition-colors relative bg-[#1e2330] rounded-xl border border-slate-700/50" title="Bildirimler">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#1e2330]"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-[#30363D] pl-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold uppercase shadow-sm">
                {user && user.username ? user.username.charAt(0) : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-slate-200 leading-none">{(user && user.username) ? user.username : 'Misafir'}</p>
                <p className="text-xs text-slate-400 mt-1">{(user && user.role) ? user.role : 'Guest'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content (Outlet renders child routes) */}
        <main className="flex-1 overflow-hidden p-6 bg-[#0f1219]">
          <div className="h-full max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
