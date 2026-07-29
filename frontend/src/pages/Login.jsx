import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, User, Lock, ArrowRight, AlertCircle, RefreshCw,
  PackageCheck, ClipboardCheck, Wrench, ScanLine, Truck,
  Sun, Moon, ShieldAlert, Wifi, WifiOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, getBackend } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import amblem from '../assets/Uygulama-Amblemi.png';
import amblemLacivert from '../assets/remalab-logo.png';

// Cihazin sistemdeki gercek yolculugu - service_statu akisindan
const FLOW = [
  { icon: PackageCheck, label: 'Kabul', desc: 'Depo girişi ve parti kaydı', tone: 'blue' },
  { icon: ClipboardCheck, label: 'İlk Test', desc: 'Cihaz durumu tespiti', tone: 'emerald' },
  { icon: Wrench, label: 'Üretim', desc: 'Onarım ve parça değişimi', tone: 'orange' },
  { icon: ScanLine, label: 'Son Test', desc: 'Çıkış kontrolü', tone: 'purple' },
  { icon: Truck, label: 'Sevkiyat', desc: 'Müşteriye teslim', tone: 'blue' },
];

const TONE = {
  blue: 'text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  emerald: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  orange: 'text-orange-500 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
  purple: 'text-purple-500 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [conn, setConn] = useState('checking'); // checking | ok | offline
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Backend baglantisini kontrol et - kopukse kullanici bunu bilmeli
  useEffect(() => {
    let alive = true;
    getBackend()
      .then((b) => { if (alive) setConn(b && b.login ? 'ok' : 'offline'); })
      .catch(() => { if (alive) setConn('offline'); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        const userRole = u?.role?.toLowerCase() || 'admin';
        setTimeout(() => {
          navigate(userRole === 'depo' ? '/depo' : '/dashboard');
        }, 500);
      } catch {
        navigate('/dashboard');
      }
    } else {
      setIsCheckingAuth(false);
      const savedUsername = localStorage.getItem('saved_username');
      const savedPassword = localStorage.getItem('saved_password');
      if (savedUsername) {
        setUsername(savedUsername);
        if (savedPassword) {
          try {
            setPassword(decodeURIComponent(escape(atob(savedPassword))));
          } catch (e) { }
        }
        setRememberMe(true);
      }
      setTimeout(() => {
        const el = document.getElementById('username-input');
        if (el) el.focus();
      }, 0);
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await api.login(username, password);
      setLoading(false);

      if (response.success) {
        if (rememberMe) {
          localStorage.setItem('user', JSON.stringify(response.user));
          localStorage.setItem('saved_username', username);
          localStorage.setItem('saved_password', btoa(unescape(encodeURIComponent(password))));
          sessionStorage.removeItem('user');
        } else {
          sessionStorage.setItem('user', JSON.stringify(response.user));
          localStorage.removeItem('user');
          localStorage.removeItem('saved_username');
          localStorage.removeItem('saved_password');
        }
        const userRole = (response.user?.role || 'Admin').toLowerCase();
        navigate(['depo', 'depo müdürü'].includes(userRole) ? '/depo' : '/dashboard');
      } else {
        setError(response.message || 'Kullanıcı adı veya şifre hatalı.');
      }
    } catch (err) {
      setLoading(false);
      setError('Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    }
  };

  const onKey = (e) => {
    if (e.getModifierState) setCapsLock(e.getModifierState('CapsLock'));
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#111827] flex flex-col items-center justify-center gap-5">
        <img src={theme === 'dark' ? amblem : amblemLacivert} alt="" className="w-14 h-14 object-contain animate-pulse" />
        <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
          <RefreshCw size={16} className="animate-spin" />
          <p className="text-sm font-medium">Oturum açılıyor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-[#0d121c] relative overflow-hidden">

      {/* Arka plan */}
      <div className="absolute top-[-15%] left-[-5%] w-[45%] h-[45%] rounded-full bg-blue-600/10 dark:bg-blue-600/[0.07] blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-5%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/[0.05] blur-[130px] rounded-full pointer-events-none"></div>

      {/* Tema butonu */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
        className="absolute top-5 right-5 z-20 p-2.5 rounded-xl bg-white/80 dark:bg-[#1e2330]/80 backdrop-blur border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="flex w-full max-w-[1040px] rounded-[26px] overflow-hidden relative z-10 border border-slate-200 dark:border-slate-800/60 shadow-2xl bg-white dark:bg-[#161b26] animate-in fade-in zoom-in-95 duration-500 flex-col lg:flex-row">

        {/* ── SOL: Sistemin gerçek akışı ── */}
        <div className="lg:w-[46%] hidden lg:flex flex-col justify-between px-11 py-12 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-[#141924] dark:to-[#0f131c] border-r border-slate-200 dark:border-slate-800/60 relative">

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <img src={amblemLacivert} alt="Remalab" className="w-12 h-12 object-contain dark:hidden" />
              <img src={amblem} alt="Remalab" className="w-12 h-12 object-contain hidden dark:block" />
              <div className="leading-tight">
                <div className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white">REMALAB</div>
                <div className="text-[11px] font-semibold tracking-[0.18em] text-blue-500">TEKNOLOJİ</div>
              </div>
            </div>

            <h2 className="text-[26px] font-bold text-slate-900 dark:text-white mt-10 leading-tight">
              Cihaz Yönetim Sistemi
            </h2>
            <p className="mt-3 text-[13.5px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[300px]">
              Kabulden sevkiyata kadar her cihazın konumunu, test sonucunu ve
              onarım geçmişini tek yerden takip edin.
            </p>
          </div>

          {/* Cihazın yolculuğu */}
          <div className="relative z-10 mt-10">
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-slate-400 dark:text-slate-500 uppercase mb-4">
              Cihazın Yolculuğu
            </p>
            <div className="flex flex-col gap-0">
              {FLOW.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex gap-3.5 group">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${TONE[s.tone]}`}>
                        <Icon size={16} />
                      </div>
                      {i < FLOW.length - 1 && (
                        <div className="w-px flex-1 min-h-[16px] bg-slate-200 dark:bg-slate-700/60 my-1"></div>
                      )}
                    </div>
                    <div className={i < FLOW.length - 1 ? 'pb-3.5' : ''}>
                      <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">{s.label}</div>
                      <div className="text-[11.5px] text-slate-400 dark:text-slate-500 mt-0.5">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nokta deseni */}
          <div className="absolute inset-0 z-0 opacity-[0.035] pointer-events-none"
            style={{ backgroundImage: `radial-gradient(${theme === 'dark' ? '#fff' : '#000'} 1px, transparent 1px)`, backgroundSize: '22px 22px' }}></div>
        </div>

        {/* ── SAĞ: Form ── */}
        <div className="lg:w-[54%] flex flex-col justify-center px-8 sm:px-14 py-12 bg-white dark:bg-[#161b26]">
          <div className="w-full max-w-[370px] mx-auto">

            {/* Mobil logo */}
            <div className="flex lg:hidden items-center gap-2.5 mb-8">
              <img src={amblemLacivert} alt="" className="w-10 h-10 object-contain dark:hidden" />
              <img src={amblem} alt="" className="w-10 h-10 object-contain hidden dark:block" />
              <div className="text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
                REMALAB <span className="text-blue-500 font-semibold">TEKNOLOJİ</span>
              </div>
            </div>

            <h2 className="text-[26px] font-bold text-slate-900 dark:text-white">Hoş geldiniz</h2>
            <p className="text-slate-500 dark:text-slate-400 text-[13.5px] mt-1.5 mb-7">
              Devam etmek için hesabınıza giriş yapın.
            </p>

            {/* Bağlantı uyarısı */}
            {conn === 'offline' && (
              <div className="mb-5 px-4 py-3 bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 rounded-xl text-[13px] flex items-start gap-2.5">
                <WifiOff size={16} className="shrink-0 mt-0.5" />
                <span>Sunucu bağlantısı kurulamadı. Giriş yapılamayabilir — yöneticinize bildirin.</span>
              </div>
            )}

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 rounded-xl text-[13px] flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">

              <div className="space-y-1.5">
                <label htmlFor="username-input" className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400">
                  Kullanıcı Adı
                </label>
                <div className="relative group">
                  <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                  <input
                    id="username-input"
                    type="text"
                    autoComplete="username"
                    placeholder="Kullanıcı adınız"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-[50px] pl-11 pr-4 bg-slate-50 dark:bg-[#1e2431] border border-slate-200 dark:border-slate-700/60 rounded-xl outline-none text-[14px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400">Şifre</label>
                <div className="relative group">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Şifreniz"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={onKey}
                    onKeyDown={onKey}
                    className="w-full h-[50px] pl-11 pr-12 bg-slate-50 dark:bg-[#1e2431] border border-slate-200 dark:border-slate-700/60 rounded-xl outline-none text-[14px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                </div>
                {capsLock && (
                  <p className="flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400 pt-0.5">
                    <ShieldAlert size={13} /> Caps Lock açık
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center cursor-pointer group select-none">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-[18px] h-[18px] rounded-[5px] border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e2431] peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-500/20 transition-all"></div>
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="ml-2.5 text-[13px] text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                    Beni hatırla
                  </span>
                </label>

                {conn === 'ok' && (
                  <span className="flex items-center gap-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400">
                    <Wifi size={12} /> Bağlı
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[50px] mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-[14.5px] rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-blue-500/25 outline-none group"
              >
                {loading ? (
                  <><RefreshCw size={18} className="animate-spin" /> Giriş yapılıyor…</>
                ) : (
                  <>Giriş Yap <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-[11.5px] text-slate-400 dark:text-slate-600">
              RemaLab Teknoloji Hizmetleri A.Ş. · Depo Yönetim Sistemi
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e2330] px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3.5 border border-slate-200 dark:border-slate-700/50">
            <RefreshCw size={28} className="text-blue-500 animate-spin" />
            <p className="text-slate-700 dark:text-slate-200 text-[14px] font-medium">Giriş yapılıyor, lütfen bekleyin…</p>
          </div>
        </div>
      )}
    </div>
  );
}
