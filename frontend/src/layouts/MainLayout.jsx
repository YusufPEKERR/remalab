import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut, LayoutDashboard, Users, Package, Settings, Bell,
  Warehouse, FileText, BarChart2, Box, Truck, MapPin,
  CheckCircle, Search, AlertTriangle, Zap, RefreshCw, Sun, Moon, Database, Building2, Wrench, ClipboardList, PackagePlus, Tags, ChevronDown, ChevronRight, Menu, X, Layers, FileSpreadsheet,
  Boxes, ClipboardCheck, Cog, Repeat, DollarSign, Target, ShieldCheck, Receipt, FileCheck2
} from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import logoLight from '../assets/logo.png';
import logoDark from '../assets/karanlik-mod.png';

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
    'ÜRETİM TEKNİSYENİ': true,
    'ONARIM HAVUZU': true,
    'ONARIM BİTİŞ TESTİ': true,
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

  const [appVersion, setAppVersion] = useState("v1.0.0");

  useEffect(() => {
    api.getAppVersion().then(res => {
      if (res && res.success && res.data?.version) {
        setAppVersion(res.data.version);
      }
    });
  }, []);

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
        { name: 'QC', icon: ShieldCheck, path: '/qc' },
        { name: 'Arama', icon: Search, path: '/servis' },
        { name: 'Statü Kontrol', icon: Zap, path: '/statu-kontrol' }
      ]
    },
    {
      title: 'DEPO',
      colorTheme: 'orange',
      items: [
        { name: 'Depo', icon: Warehouse, path: '/depo' },
        { name: 'Parça Teslim', icon: PackagePlus, path: '/parca-teslim' },
        { name: 'İrsaliye', icon: FileText, path: '/irsaliye' },
        { name: 'İş Emirleri', icon: ClipboardList, path: '/work-orders' },
        { name: 'Raporlar', icon: BarChart2, path: '/raporlar' },
        { name: 'Test Raporu', icon: FileCheck2, path: '/test-raporu' }
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
        { name: 'Müşteri için sevket (126>127)', icon: Boxes, path: '/statu-gecis/SPA_P/126_127' },
        // Sevke okutulanların müşteri bazında faturalandırıldığı ekran: fatura kesilince
        // cihazlar 128'e (çıkış yapıldı) geçer.
        { name: 'Sevk ve Faturalandırma', icon: Receipt, path: '/musteri-sevk-fatura' }
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
        { name: 'Üretime Aktar', icon: Wrench, path: '/servis-onarimlari-demontaj' },
        { name: 'Teknik departmana kabul et (104>105)', icon: Cog, path: '/statu-gecis/TEC_DISMANTLE/104_105' },
        { name: 'Müşteri onayına gönder (105>106)', icon: Cog, path: '/statu-gecis/TEC_DISMANTLE/105_106' },
        // Ara Test akışının GİRİŞ adımı. Geçiş (109_138) veritabanında tanımlı ve
        // aktifti ama menüde hiçbir yerde yoktu; bu yüzden 109'daki cihaz 138'e
        // hiç geçemiyor, "Ara Test Yap" ekranında okutulunca "bu okutmaya uygun
        // statü değil" hatası alınıyordu. Ekran değil, akışın girişi eksikmiş.
        { name: 'Ara Test için Teslim al (109>138)', icon: Repeat, path: '/statu-gecis/TEC_DISMANTLE/109_138' }
        // "Üretime Aktar (105>109)" toplu statü geçişi menüden KALDIRILDI: aynı işi
        // yukarıdaki "Üretime Aktar" ekranındaki karar butonu yapıyor
        // (submit_dismantle_decision, eklenen parçalara göre 109 ya da 106 seçiyor).
        // İki ayrı yolun olması hem isim karışıklığı yaratıyordu hem de toplu geçiş
        // müşteri onayı kontrolünü atlayıp doğrudan 109'a taşıyabiliyordu.
        // Sayfa (BatchStatuTransition) SİLİNMEDİ - başka 9 menü öğesi aynı bileşeni
        // kullanıyor; sadece bu giriş kaldırıldı.
      ]
    },
    {
      title: 'ÜRETİM TEKNİSYENİ',
      colorTheme: 'red',
      items: [
        { name: 'Üretim Kaydını Görüntüle', icon: Wrench, path: '/technician-repair' },
        // Departman başına ayrı giriş (karar #6). Rota aynı bileşene gider,
        // görev grubu URL'den okunur - bkz. HizliOnarimBitir.jsx.
        { name: 'BATARYA Onarımı Hızlı Bitiş', icon: Zap, path: '/hizli-onarim-bitir/BATTERY' },
        { name: 'KAMERA Onarımı Hızlı Bitiş', icon: Zap, path: '/hizli-onarim-bitir/CAMERA' }
      ]
    },
    {
      title: 'ONARIM HAVUZU',
      colorTheme: 'indigo',
      items: [
        { name: 'Batarya Onarımı', icon: Wrench, path: '/onarim-havuzu/BATTERY' },
        { name: 'Kamera Onarımı', icon: Wrench, path: '/onarim-havuzu/CAMERA' },
        { name: 'Ekran Onarımı', icon: Wrench, path: '/onarim-havuzu/DISPLAY' },
        { name: 'Kasa Onarımı', icon: Wrench, path: '/onarim-havuzu/CASE' },
        { name: 'L1 Onarımı', icon: Wrench, path: '/onarim-havuzu/L1REPAIR' },
        { name: 'L2 Onarımı', icon: Wrench, path: '/onarim-havuzu/L2REPAIR' },
        { name: 'L3 Onarımı', icon: Wrench, path: '/onarim-havuzu/L3REPAIR' },
      ]
    },
    {
      title: 'ONARIM BİTİŞ TESTİ',
      colorTheme: 'cyan',
      items: [
        // Teknisyen onarımı bitirince kayıt 1006'ya (test bekliyor) düşer; burada
        // başarılı/başarısız kararı verilir. Görev grubu rotadan okunur.
        { name: 'Kamera Bitiş Testi', icon: ClipboardCheck, path: '/onarim-bitis-testi/CAMERA' },
        { name: 'L3 Bitiş Testi', icon: ClipboardCheck, path: '/onarim-bitis-testi/L3REPAIR' },
        { name: 'Ekran Bitiş Testi', icon: ClipboardCheck, path: '/onarim-bitis-testi/DISPLAY' },
        { name: 'Kasa Bitiş Testi', icon: ClipboardCheck, path: '/onarim-bitis-testi/CASE' },
      ]
    },
    {
      title: 'ARA TEST',
      colorTheme: 'purple',
      items: [
        { name: 'Müşteri onayı bekleyecek', icon: Repeat, path: '/musteri-onayi' },
        { name: 'Müşteri Onay/Red Geldi', icon: Repeat, path: '/musteri-onay-red' },
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
        { name: 'Flow → DGD Eşleşmesi', icon: Wrench, path: '/flow-dgd-mapping' },
        { name: 'Müşteri Fiyat Matrisi', icon: DollarSign, path: '/customer-price-matrix' },
        { name: 'Müşteri Hedef Fiyat Matrisi', icon: Target, path: '/customer-target-price-matrix' },
        // "Müşteri İşçilik Fiyatı Matrisi" (parça başına sabit işçilik) kaldırıldı: işçilik
        // artık seviye modelinden hesaplanıyor (cihazın en baskın seviyesi + parçanın sırası),
        // dolayısıyla parça başına sabit bir işçilik fiyatı diye bir şey yok. İkisi bir arada
        // kalsaydı hangisinin faturaya girdiği belirsizleşirdi.
        { name: 'İşçilik Fiyatlandırma', icon: Layers, path: '/labour-pricing-matrices' },
        { name: 'Etiket Tasarımı', icon: Tags, path: '/etiket-tasarimi' },
        { name: 'Schema Mapper', icon: Database, path: '/schema-mapper' }
      ]
    }
  ];

  // Rol filtresi kaldırıldı — tüm kullanıcılar tüm menüleri görebilir
  const filteredGroups = menuGroups;

  // Department & Module Specific Unique Color Palette Configurations (Richer, Slightly Darker Tones)
  const getGroupTitleColor = (title) => {
    switch (title) {
      case 'GENEL BAKIŞ': return '#5B6EC4';
      case 'DEPO': return '#C1801C'; // Rich Darker Amber/Yellow for Depo!
      case 'ENVANTER': return '#8A44C4';
      case 'YEDEK PARÇA PERSONELİ': return '#CE6320';
      case 'TEST PERSONELİ': return '#3A76B8';
      case 'DEMONTAJ TEKNİSYENİ': return '#3B8B76';
      case 'ÜRETİM TEKNİSYENİ': return '#C0392F';
      case 'ONARIM BİTİŞ TESTİ': return '#2C8CA8';
      case 'ARA TEST': return '#A83EAE';
      case 'KULLANICI & AYARLAR': return '#C2445F';
      default: return '#5B6EC4';
    }
  };

  const getItemColorConfig = (itemPath) => {
    switch (itemPath) {
      // GENEL BAKIŞ
      case '/dashboard':
        return { color: '#00B2FF' }; // Rich Royal Blue
      case '/qc':
        return { color: '#06B6D4' }; // Cyan (Quality Control)
      case '/statu-kontrol':
        return { color: '#2C8CA8' }; // Darker Cyan
      
      // DEPO - Unique Rich Dark Amber/Yellow for Depo!
      case '/depo':
        return { color: '#C1801C' }; // Rich Amber Yellow
      case '/depo-talepler':
        return { color: '#D97706' };
      case '/parca-teslim':
        return { color: '#E67E22' };
      case '/servis':
        return { color: '#C2445F' }; // Darker Rose
      case '/irsaliye':
        return { color: '#3B8B76' }; // Darker Emerald Green
      case '/work-orders':
        return { color: '#3A76B8' }; // Darker Sky Blue
      case '/technician-repair':
        return { color: '#C0392F' }; // Darker Crimson Red
      case '/raporlar':
        return { color: '#B93E86' }; // Darker Magenta

      // ENVANTER
      case '/parts':
        return { color: '#5B4FB0' }; // Darker Indigo
      case '/products':
        return { color: '#7A54C0' }; // Darker Violet
      case '/suppliers':
        return { color: '#2F8C86' }; // Darker Teal
      case '/locations':
        return { color: '#6E9B33' }; // Darker Lime

      // YEDEK PARÇA PERSONELİ
      case '/statu-gecis/SPA_P/100_101':
      case '/statu-gecis/SPA_P/101_102':
      case '/statu-gecis/SPA_P/126_127':
        return { color: '#CE6320' };

      // TEST PERSONELİ
      case '/statu-gecis/QAC/102_103':
      case '/statu-gecis/QAC/103_104':
      case '/statu-gecis/QAC/124_125':
      case '/statu-gecis/QAC/125_126':
        return { color: '#3A76B8' };

      // ÜRETİM TEKNİSYENİ — Hızlı Onarım Bitiş (departman başına ayrı rota)
      case '/hizli-onarim-bitir/BATTERY':
      case '/hizli-onarim-bitir/CAMERA':
        return { color: '#B84A4A' };

      // ONARIM BİTİŞ TESTİ (departman başına ayrı rota)
      case '/onarim-bitis-testi/CAMERA':
      case '/onarim-bitis-testi/L3REPAIR':
      case '/onarim-bitis-testi/DISPLAY':
      case '/onarim-bitis-testi/CASE':
        return { color: '#2C8CA8' };

      // DEMONTAJ TEKNİSYENİ
      case '/servis-onarimlari-demontaj':
      case '/statu-gecis/TEC_DISMANTLE/104_105':
      case '/statu-gecis/TEC_DISMANTLE/105_106':
      case '/statu-gecis/TEC_DISMANTLE/109_138':
        // 105_109 buradan da kaldirildi - menude artik yok (bkz. menuGroups).
        return { color: '#3B8B76' };

      // ARA TEST
      case '/musteri-onayi':
      case '/musteri-onay-red':
      case '/statu-gecis/MNG1_AS/138_124':
        return { color: '#8A44C4' };

      // KULLANICI & AYARLAR
      case '/users':
        return { color: '#CE6320' };
      case '/batch-entry':
        return { color: '#3B8B76' };
      case '/part-categories':
        return { color: '#7A54C0' };
      case '/item-bom':
        return { color: '#3A76B8' };
      case '/settings':
        return { color: '#4A5A9E' };
      case '/data-management':
        return { color: '#2C8CA8' };
      case '/departments':
        return { color: '#C2445F' };
      case '/flow-dgd-mapping':
        return { color: '#B27B2F' };
      case '/customer-price-matrix':
        return { color: '#2FA36E' };
      case '/labour-pricing-matrices':
        return { color: '#2FA36E' };
      case '/musteri-sevk-fatura':
        return { color: '#2FA36E' };
      case '/etiket-tasarimi':
        return { color: '#7A54C0' };
      case '/schema-mapper':
        return { color: '#8A44C4' };

      default:
        return { color: '#00B2FF' };
    }
  };

  const currentPage = menuGroups.flatMap(g => g.items).find(i => 
    location.pathname === i.path || (i.path !== '/' && location.pathname.startsWith(i.path))
  );

  return (
    <div className="app-shell flex h-screen text-[#12141c] dark:text-[#F6F8FF] overflow-hidden">
      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-[#EFF1FA]/80 dark:bg-[#090a0f]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Tema2 cam panel (giris ekraniyla ayni yuzey) */}
      <aside className={`
        app-sidebar fixed inset-y-0 left-0 w-64 text-[#12141c] dark:text-[#F6F8FF] flex flex-col z-50
        transition-transform duration-300 transform lg:translate-x-0 lg:static lg:inset-auto shadow-2xl
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#ECEFF9] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#1e222d] text-[#5A6685] dark:text-[#8892B5] hover:text-[#12141c] dark:hover:text-[#F6F8FF] lg:hidden"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-center pb-6 pt-10 border-b border-[#DCE1F1]/80 dark:border-[#1e222d]/80">
          <img src={logoLight} alt="Remalab Logo" className="h-36 w-full object-contain drop-shadow-md scale-110 dark:hidden" />
          <img src={logoDark} alt="Remalab Logo" className="h-36 w-full object-contain drop-shadow-md scale-110 hidden dark:block" />
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 space-y-5 scrollbar-thin scrollbar-thumb-[#1e222d] scrollbar-track-transparent">
          {filteredGroups.map((group, idx) => {
            const isOpen = openGroups[group.title];
            const groupColor = getGroupTitleColor(group.title);
            
            return (
              <div key={idx} className="px-3">
                <button 
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex flex-wrap items-center justify-between px-3 py-1.5 mb-1 rounded-lg group outline-none transition-colors fast-transition hover:bg-slate-100/80 dark:hover:bg-[#1e222d]/80"
                >
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                    {group.title}
                  </h3>
                  {isOpen ? (
                    <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />
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
                            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all fast-transition group relative ${
                              isActive 
                                ? 'bg-blue-500/10 dark:bg-[#1e222d] text-blue-700 dark:text-white font-bold shadow-xs'
                                : 'text-slate-700 dark:text-slate-300 font-semibold hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-[#1e222d]/60'
                            }`}
                            style={{
                              borderLeft: isActive ? `3.5px solid ${itemCfg.color}` : '3.5px solid transparent'
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              setIsMobileOpen(false);
                              navigate(item.path);
                            }}
                          >
                            <item.icon 
                              size={19} 
                              strokeWidth={isActive ? 2.4 : 1.9} 
                              className="shrink-0 transition-transform group-hover:scale-105"
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
        
        <div className="p-4 border-t border-[#DCE1F1] dark:border-[#1e222d] flex flex-col gap-2">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-[#C0392F] dark:text-[#F87171] hover:bg-[#C0392F]/15 dark:hover:bg-[#F87171]/15 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500 pt-1 px-1">
            <span>RemaLab WMS</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-[#00b2ff] font-bold border border-blue-500/20">{appVersion}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header / Üst Bar - Ultra Dark Charcoal Navy: #090a0f */}
        <header className="app-header h-16 flex flex-wrap items-center justify-between px-6 shadow-sm z-30 shrink-0 text-[#12141c] dark:text-[#F7F8FC]">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 -ml-2 text-[#5A6685] dark:text-[#9AA3C6] hover:text-[#12141c] dark:hover:text-[#F7F8FC] transition-colors lg:hidden rounded-xl bg-[#F5F7FC] dark:bg-[#12141c] border border-[#DCE1F1] dark:border-[#1e222d]"
              title="Menüyü Aç"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Date/Time Widget (Next to Theme Toggle) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-[#12141c] rounded-xl border border-slate-300 dark:border-[#1e222d] shadow-xs">
              <span className="text-[11px] font-bold text-blue-600 dark:text-[#00b2ff]">⏱ SON GÜNCELLEME:</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono tracking-wider">
                {currentTime.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })} - {currentTime.toLocaleTimeString('tr-TR')}
              </span>
            </div>

            {/* Refresh Page Button */}
            <button
              onClick={() => window.location.reload()}
              className="p-2 text-slate-700 dark:text-slate-200 hover:text-[#00b2ff] dark:hover:text-[#00b2ff] transition-colors bg-slate-100 dark:bg-[#12141c] rounded-xl border border-slate-300 dark:border-[#1e222d] hover:border-[#00b2ff] cursor-pointer shadow-xs"
              title="Sayfayı Yenile"
            >
              <RefreshCw size={18} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-700 dark:text-amber-400 hover:text-[#00b2ff] transition-colors bg-slate-100 dark:bg-[#12141c] rounded-xl border border-slate-300 dark:border-[#1e222d] hover:border-[#00b2ff] cursor-pointer shadow-xs"
              title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-700 dark:text-slate-200 hover:text-[#00b2ff] dark:hover:text-[#00b2ff] transition-colors relative bg-slate-100 dark:bg-[#12141c] rounded-xl border border-slate-300 dark:border-[#1e222d] hover:border-[#00b2ff] cursor-pointer shadow-xs" 
                title="Bildirimler"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#090a0f] animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="glass-card absolute right-0 mt-3 w-[calc(100vw-32px)] sm:w-[360px] shadow-2xl rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 text-slate-900 dark:text-white">
                  <div className="p-4 border-b border-slate-200 dark:border-[#1e222d] bg-slate-100/90 dark:bg-[#12141c] flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between">
                      <h3 className="font-bold text-slate-900 dark:text-white">Kritik Stok Bildirimleri</h3>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-slate-200 dark:divide-[#1e222d]">
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
                            className="p-4 hover:bg-slate-100 dark:hover:bg-[#181a24] transition-colors cursor-pointer" 
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
                                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1 leading-snug line-clamp-2" title={notif.part_name}>{notif.part_name}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Lokasyon: <strong className="text-slate-900 dark:text-white">{notif.location_name}</strong></p>
                                <div className="flex flex-wrap items-center justify-between mt-2">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#181a24] text-slate-900 dark:text-white border border-slate-300 dark:border-[#1e222d]">Stok: {notif.quantity}</span>
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
                      <div className="p-8 text-center text-slate-600 dark:text-slate-300 flex flex-col items-center">
                        <CheckCircle size={36} className="mb-3 text-emerald-500" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Harika! Tüm stoklar güvende.</p>
                        <p className="text-xs mt-1">Şu an için kritik seviyede ürün yok.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 border-l border-slate-300 dark:border-[#1e222d] pl-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 dark:bg-[#00b2ff]/20 border border-blue-500/40 dark:border-[#00b2ff]/50 flex items-center justify-center text-blue-700 dark:text-[#00b2ff] font-extrabold text-base uppercase shadow-sm">
                {user && user.username ? user.username.charAt(0) : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">{(user && user.username) ? user.username : 'Misafir'}</p>
                <p className="text-xs font-bold text-blue-600 dark:text-[#00b2ff] mt-1">{(user && user.role) ? user.role : 'Guest'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content (Outlet renders child routes) */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-transparent">
          <div className="min-h-full max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
