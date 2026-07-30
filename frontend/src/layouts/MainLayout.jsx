import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut, LayoutDashboard, Users, Package, Settings, Bell,
  Warehouse, FileText, BarChart2, Box, Truck, MapPin,
  CheckCircle, Search, AlertTriangle, Zap, RefreshCw, Sun, Moon, Database, Building2, Wrench, ClipboardList, PackageSearch, PackagePlus, Tags, ChevronDown, ChevronRight, Menu, X, Layers, FileSpreadsheet,
  Boxes, ClipboardCheck, Cog, Repeat
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const DEFAULT_OPEN_GROUPS = {
    'GENEL BAKIŞ': true,
    'DEPO': true,
    'ENVANTER': true,
    'YEDEK PARÇA PERSONELİ': true,
    'TEST PERSONELİ': true,
    'DEMONTAJ TEKNİSYENİ': true,
    'ARA TEST': true,
    'KULLANICI & AYARLAR': true
  };

  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarOpenGroups');
      return saved ? { ...DEFAULT_OPEN_GROUPS, ...JSON.parse(saved) } : DEFAULT_OPEN_GROUPS;
    } catch (e) {
      return DEFAULT_OPEN_GROUPS;
    }
  });

  const toggleGroup = (title) => {
    setOpenGroups(prev => {
      const next = { ...prev, [title]: !prev[title] };
      localStorage.setItem('sidebarOpenGroups', JSON.stringify(next));
      return next;
    });
  };

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
        const stock = res.critical_stock || [];
        const saved = JSON.parse(localStorage.getItem('readNotifications') || '[]');
        // Benzersiz ID ile filtrele — aynı part_name/location_name'e sahip
        // farklı stok kayıtlarının birbirini silmesini önler
        setNotifications(stock.filter(n => !saved.includes(String(n.id))));
      }
    } catch (err) {
      console.error('Bildirimler alınamadı', err);
    }
  };

  useEffect(() => {
    const fetchUser = () => {
      const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error("User parsing error", e);
        }
      }
    };

    fetchUser();
    window.addEventListener('user:updated', fetchUser);
    return () => window.removeEventListener('user:updated', fetchUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  const menuGroups = [
    {
      title: 'GENEL BAKIŞ',
      colorTheme: 'blue',
      items: [
        { name: 'Kontrol Paneli', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Statü Kontrol', icon: Zap, path: '/statu-kontrol' }
      ]
    },
    {
      title: 'DEPO',
      colorTheme: 'orange',
      items: [
        { name: 'Depo', icon: Warehouse, path: '/depo' },
        { name: 'Servis', icon: Search, path: '/servis' },
        { name: 'İrsaliye', icon: FileText, path: '/irsaliye' },
        { name: 'İş Emirleri', icon: ClipboardList, path: '/work-orders' },
        { name: 'Servis Onarımları', icon: Wrench, path: '/technician-repair' },

        { name: 'Raporlar', icon: BarChart2, path: '/raporlar' }
      ]
    },
    {
      title: 'ENVANTER',
      colorTheme: 'purple',
      items: [
        { name: 'Parçalar', icon: Package, path: '/parts' },
        { name: 'Ürün Listesi', icon: Box, path: '/products' },
        { name: 'Müşteriler', icon: Truck, path: '/suppliers' },
        { name: 'Lokasyonlar', icon: MapPin, path: '/locations' }
      ]
    },
    {
      title: 'YEDEK PARÇA PERSONELİ',
      colorTheme: 'orange',
      items: [
        { name: 'Kayıt kabul yap (100>101)', icon: Boxes, path: '/statu-gecis/SPA_P/100_101' },
        { name: 'İlk teste aktar (101>102)', icon: Boxes, path: '/statu-gecis/SPA_P/101_102' },
        { name: 'Müşteri için sevket (126>127)', icon: Boxes, path: '/statu-gecis/SPA_P/126_127' }
      ]
    },
    {
      title: 'TEST PERSONELİ',
      colorTheme: 'blue',
      items: [
        { name: 'İlk teste kabul (102>103)', icon: ClipboardCheck, path: '/statu-gecis/QAC/102_103' },
        { name: 'Üretime teslim edilecek (103>104)', icon: ClipboardCheck, path: '/statu-gecis/QAC/103_104' },
        { name: 'Son teste kabul (124>125)', icon: ClipboardCheck, path: '/statu-gecis/QAC/124_125' },
        { name: 'Son Test Sonuç (125>126/109)', icon: ClipboardCheck, path: '/statu-gecis/QAC/125_126' }
      ]
    },
    {
      title: 'DEMONTAJ TEKNİSYENİ',
      colorTheme: 'emerald',
      items: [
        { name: 'Servis Onarımları (Demontaj)', icon: Wrench, path: '/servis-onarimlari-demontaj' },
        { name: 'Teknik departmana kabul et (104>105)', icon: Cog, path: '/statu-gecis/TEC_DISMANTLE/104_105' },
        { name: 'Müşteri onayına gönder (105>106)', icon: Cog, path: '/statu-gecis/TEC_DISMANTLE/105_106' },
        { name: 'Üretime Aktar (105>109)', icon: Cog, path: '/statu-gecis/TEC_DISMANTLE/105_109' }
      ]
    },
    {
      title: 'ARA TEST',
      colorTheme: 'purple',
      items: [
        { name: 'Müşteri onayı bekleyecek', icon: Repeat, path: '/musteri-onayi' },
        { name: 'Üretim Kaydını Görüntüle (107>136)', icon: Repeat, path: '/statu-gecis/MNG1_AS/107_136' },
        { name: 'Ara Test Yap (138>124)', icon: Repeat, path: '/statu-gecis/MNG1_AS/138_124' }
      ]
    },
    {
      title: 'KULLANICI & AYARLAR',
      colorTheme: 'emerald',
      items: [
        { name: 'Kullanıcılar', icon: Users, path: '/users' },
        { name: 'Batch Girişi', icon: FileSpreadsheet, path: '/batch-entry' },
        { name: 'Parça Kategorileri', icon: Tags, path: '/part-categories' },
        { name: 'Product Bom', icon: Layers, path: '/item-bom' },
        { name: 'Ayarlar', icon: Settings, path: '/settings' },
        { name: 'Veri Yönetimi', icon: Database, path: '/data-management' },
        { name: 'Departman Yönetimi', icon: Building2, path: '/departments' },
        { name: 'Schema Mapper', icon: Database, path: '/schema-mapper' }
      ]
    }
  ];

  // Rol filtresi kaldırıldı — tüm kullanıcılar tüm menüleri görebilir
  const filteredGroups = menuGroups;

  // Department & Module Specific Unique Color Palette Configurations (Richer, Slightly Darker Tones)
  const getGroupTitleColor = (title) => {
    switch (title) {
      case 'GENEL BAKIŞ': return '#3B82F6';
      case 'DEPO': return '#D97706'; // Rich Darker Amber/Yellow for Depo!
      case 'ENVANTER': return '#9333EA';
      case 'YEDEK PARÇA PERSONELİ': return '#EA580C';
      case 'TEST PERSONELİ': return '#0284C7';
      case 'DEMONTAJ TEKNİSYENİ': return '#059669';
      case 'ARA TEST': return '#C026D3';
      case 'KULLANICI & AYARLAR': return '#E11D48';
      default: return '#3B82F6';
    }
  };

  const getItemColorConfig = (itemPath) => {
    switch (itemPath) {
      // GENEL BAKIŞ
      case '/dashboard':
        return { color: '#2563EB' }; // Rich Royal Blue
      case '/statu-kontrol':
        return { color: '#0891B2' }; // Darker Cyan
      
      // DEPO - Unique Rich Dark Amber/Yellow for Depo!
      case '/depo':
        return { color: '#D97706' }; // Rich Amber Yellow
      case '/servis':
        return { color: '#E11D48' }; // Darker Rose
      case '/irsaliye':
        return { color: '#059669' }; // Darker Emerald Green
      case '/work-orders':
        return { color: '#0284C7' }; // Darker Sky Blue
      case '/technician-repair':
        return { color: '#DC2626' }; // Darker Crimson Red
      case '/raporlar':
        return { color: '#DB2777' }; // Darker Magenta

      // ENVANTER
      case '/parts':
        return { color: '#4F46E5' }; // Darker Indigo
      case '/products':
        return { color: '#7C3AED' }; // Darker Violet
      case '/suppliers':
        return { color: '#0D9488' }; // Darker Teal
      case '/locations':
        return { color: '#65A30D' }; // Darker Lime

      // YEDEK PARÇA PERSONELİ
      case '/statu-gecis/SPA_P/100_101':
      case '/statu-gecis/SPA_P/101_102':
      case '/statu-gecis/SPA_P/126_127':
        return { color: '#EA580C' };

      // TEST PERSONELİ
      case '/statu-gecis/QAC/102_103':
      case '/statu-gecis/QAC/103_104':
      case '/statu-gecis/QAC/124_125':
      case '/statu-gecis/QAC/125_126':
        return { color: '#0284C7' };

      // DEMONTAJ TEKNİSYENİ
      case '/servis-onarimlari-demontaj':
      case '/statu-gecis/TEC_DISMANTLE/104_105':
      case '/statu-gecis/TEC_DISMANTLE/105_106':
      case '/statu-gecis/TEC_DISMANTLE/105_109':
        return { color: '#059669' };

      // ARA TEST
      case '/musteri-onayi':
      case '/statu-gecis/MNG1_AS/107_136':
      case '/statu-gecis/MNG1_AS/138_124':
        return { color: '#9333EA' };

      // KULLANICI & AYARLAR
      case '/users':
        return { color: '#EA580C' };
      case '/batch-entry':
        return { color: '#059669' };
      case '/part-categories':
        return { color: '#7C3AED' };
      case '/item-bom':
        return { color: '#0284C7' };
      case '/settings':
        return { color: '#475569' };
      case '/data-management':
        return { color: '#0891B2' };
      case '/departments':
        return { color: '#E11D48' };
      case '/schema-mapper':
        return { color: '#9333EA' };

      default:
        return { color: '#2563EB' };
    }
  };

  const currentPage = menuGroups.flatMap(g => g.items).find(i => 
    location.pathname === i.path || (i.path !== '/' && location.pathname.startsWith(i.path))
  );

  return (
    <div className="flex h-screen bg-[#F1F5F9] dark:bg-[#050A18] text-[#0F172A] dark:text-[#FAFAFA] overflow-hidden">
      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-[#F1F5F9]/80 dark:bg-[#050A18]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - High Contrast Crisp Deep Indigo: #0B132B */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-[#FFFFFF] dark:bg-[#0B132B] text-[#0F172A] dark:text-[#FAFAFA] flex flex-col border-r border-[#E2E8F0] dark:border-[#2A3A5E] z-50
        transition-transform duration-300 transform lg:translate-x-0 lg:static lg:inset-auto shadow-2xl
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#EEF2F7] dark:bg-[#1C2541] border border-[#E2E8F0] dark:border-[#2A3A5E] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] lg:hidden"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-center pb-6 pt-10 border-b border-[#E2E8F0]/80 dark:border-[#2A3A5E]/80">
          <img src="/logo.png" alt="Remalab Logo" className="h-36 w-full object-contain drop-shadow-md scale-110 dark:hidden" />
          <img src="/karanlık-mod.png" alt="Remalab Logo" className="h-36 w-full object-contain drop-shadow-md scale-110 hidden dark:block" />
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 space-y-5 scrollbar-thin scrollbar-thumb-[#2A3A5E] scrollbar-track-transparent">
          {filteredGroups.map((group, idx) => {
            const isOpen = openGroups[group.title];
            const groupColor = getGroupTitleColor(group.title);
            
            return (
              <div key={idx} className="px-3">
                <button 
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-2 mb-1.5 rounded-lg group outline-none transition-colors fast-transition hover:bg-[#EEF2F7]/80 dark:hover:bg-[#1C2541]/80"
                >
                  <h3 
                    className="text-[11px] font-extrabold uppercase tracking-widest transition-colors"
                    style={{ color: groupColor }}
                  >
                    {group.title}
                  </h3>
                  {isOpen ? (
                    <ChevronDown size={14} style={{ color: groupColor }} />
                  ) : (
                    <ChevronRight size={14} style={{ color: groupColor }} />
                  )}
                </button>
                
                <div className={`grid transition-all duration-150 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1 mb-2' : 'grid-rows-[0fr] opacity-0 mb-0'}`}>
                  <div className="overflow-hidden">
                    <nav className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        const itemCfg = getItemColorConfig(item.path);

                        return (
                          <a
                            key={item.name}
                            href={item.path}
                            className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-bold transition-all fast-transition group relative ${
                              isActive 
                                ? 'bg-[#EEF2F7] dark:bg-[#1C2541] text-[#0F172A] dark:text-white shadow-md border-l-4 font-extrabold'
                                : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#EEF2F7]/60 dark:hover:bg-[#1C2541]/60'
                            }`}
                            style={{
                              borderLeftColor: isActive ? itemCfg.color : 'transparent',
                              boxShadow: isActive ? `0 4px 14px ${itemCfg.color}35` : 'none'
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              setIsMobileOpen(false);
                              navigate(item.path);
                            }}
                          >
                            {/* Larger Clean Borderless Icon with Rich Darker Unique Color */}
                            <item.icon 
                              size={20} 
                              strokeWidth={isActive ? 2.5 : 2} 
                              className="shrink-0 transition-transform group-hover:scale-110"
                              style={{ color: itemCfg.color }} 
                            />

                            <span className="truncate">{item.name}</span>
                          </a>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1F2937]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/15 dark:hover:bg-[#F87171]/15 hover:text-red-300 transition-colors"
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header / Üst Bar - Ultra Dark Charcoal Navy: #030712 */}
        <header className="h-16 bg-[#FFFFFF] dark:bg-[#030712] border-b border-[#E2E8F0] dark:border-[#1F2937] flex items-center justify-between px-6 shadow-sm z-30 shrink-0 text-[#0F172A] dark:text-[#F9FAFB]">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 text-[#64748B] dark:text-[#9CA3AF] hover:text-[#0F172A] dark:hover:text-[#F9FAFB] transition-colors lg:hidden rounded-xl bg-[#F8FAFC] dark:bg-[#0B1120] border border-[#E2E8F0] dark:border-[#1F2937]"
              title="Menüyü Aç"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Date/Time Widget (Next to Theme Toggle) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0B1120] rounded-lg border border-[#E2E8F0] dark:border-[#1F2937]">
              <span className="text-[11px] font-medium text-[#64748B] dark:text-[#9CA3AF]">⏱ SON GÜNCELLEME:</span>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F9FAFB] font-mono tracking-wider">
                {currentTime.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })} - {currentTime.toLocaleTimeString('tr-TR')}
              </span>
            </div>

            {/* Refresh Page Button */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 text-[#64748B] dark:text-[#9CA3AF] hover:text-[#2563EB] transition-colors bg-[#F8FAFC] dark:bg-[#0B1120] rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] hover:border-[#2563EB] cursor-pointer"
              title="Sayfayı Yenile"
            >
              <RefreshCw size={18} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-[#64748B] dark:text-[#9CA3AF] hover:text-[#60A5FA] transition-colors bg-[#F8FAFC] dark:bg-[#0B1120] rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] hover:border-[#60A5FA] cursor-pointer"
              title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors relative bg-[#FFFFFF] dark:bg-[#1E293B] rounded-xl border border-[#334155]" 
                title="Bildirimler"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF4444] rounded-full border border-[#F1F5F9] dark:border-[#070E20] animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-[calc(100vw-32px)] sm:w-[360px] bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-2xl rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 text-[#0F172A] dark:text-[#FAFAFA]">
                  <div className="p-4 border-b border-[#E2E8F0] dark:border-[#334155] bg-[#F1F5F9]/70 dark:bg-[#070E20]/70 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">Kritik Stok Bildirimleri</h3>
                      {notifications.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-md">{notifications.length} Uyarı</span>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              const saved = JSON.parse(localStorage.getItem('readNotifications') || '[]');
                              notifications.forEach(n => {
                                const key = String(n.id);
                                if (!saved.includes(key)) saved.push(key);
                              });
                              localStorage.setItem('readNotifications', JSON.stringify(saved));
                              setNotifications([]); 
                            }}
                            className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-500/10 rounded-md transition-colors"
                          >
                            Tümünü Sil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-[#334155] scrollbar-track-transparent">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                        {notifications.map((notif, idx) => {
                          const notifKey = String(notif.id);
                          
                          const markAsRead = () => {
                            const saved = JSON.parse(localStorage.getItem('readNotifications') || '[]');
                            if (!saved.includes(notifKey)) {
                              saved.push(notifKey);
                              localStorage.setItem('readNotifications', JSON.stringify(saved));
                              setNotifications(prev => prev.filter(n => String(n.id) !== notifKey));
                            }
                          };

                          return (
                          <div 
                            key={idx} 
                            className="p-4 hover:bg-[#F1F5F9]/60 dark:hover:bg-[#070E20]/60 transition-colors cursor-pointer" 
                            onClick={() => {
                              markAsRead();
                              setShowNotifications(false); 
                              navigate('/depo');
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0">
                                <AlertTriangle size={18} className={notif.status === 'Tükendi' ? "text-red-400" : "text-amber-400"} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#0F172A] dark:text-[#FAFAFA] mb-1 leading-snug line-clamp-2" title={notif.part_name}>{notif.part_name}</p>
                                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-1">Lokasyon: <strong className="text-[#0F172A] dark:text-[#FAFAFA]">{notif.location_name}</strong></p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#070E20] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E2E8F0] dark:border-[#334155]">Stok: {notif.quantity}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${notif.status === 'Tükendi' ? 'text-red-400' : 'text-amber-400'}`}>
                                    {notif.status === 'Tükendi' ? 'STOK TÜKENDİ' : 'KRİTİK SEVİYE'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-[#64748B] dark:text-[#94A3B8] flex flex-col items-center">
                        <CheckCircle size={36} className="mb-3 text-emerald-500/60" />
                        <p className="text-sm font-medium text-[#0F172A] dark:text-[#FAFAFA]">Harika! Tüm stoklar güvende.</p>
                        <p className="text-xs mt-1">Şu an için kritik seviyede ürün yok.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 border-l border-[#E2E8F0] dark:border-[#334155] pl-4">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 dark:bg-[#2563EB]/20 border border-[#2563EB]/25 dark:border-[#2563EB]/40 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] font-bold uppercase shadow-sm">
                {user && user.username ? user.username.charAt(0) : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-[#0F172A] dark:text-[#FAFAFA] leading-none">{(user && user.username) ? user.username : 'Misafir'}</p>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{(user && user.role) ? user.role : 'Guest'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content (Outlet renders child routes) */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#F1F5F9] dark:bg-[#070E20]">
          <div className="min-h-full max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
