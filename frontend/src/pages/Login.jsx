import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Lock, ArrowRight, AlertCircle, RefreshCw,
  Sun, Moon, ShieldAlert, Wifi, WifiOff, CheckCircle2, Mail,
  BarChart2, Package, Users, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, getBackend } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import amblem from '../assets/Uygulama-Amblemi.png';
import amblemLacivert from '../assets/remalab-logo.png';

const FLOAT_ICONS = [
  { Icon: BarChart2, color: '#3b82f6', delay: '0s' },
  { Icon: Package, color: '#8b5cf6', delay: '0.5s' },
  { Icon: Users, color: '#10b981', delay: '1s' },
  { Icon: Shield, color: '#f59e0b', delay: '1.5s' },
];

const SIDEBAR_ITEMS = ['Dashboard', 'Siparişler', 'Stok Yönetimi', 'Finans', 'Raporlar', 'Kullanıcılar', 'Ayarlar'];

const STATS = [
  { label: 'Toplam Sipariş', val: '1.250', delta: '+12.5', up: true },
  { label: 'Toplam Gelir', val: '₺8.6M', delta: '+8.2', up: true },
  { label: 'Aktif Müşteri', val: '320', delta: '+5.3', up: true },
  { label: 'Stok Uyarısı', val: '12', delta: '-3.4', up: false },
];

const BARS = [30, 50, 35, 65, 45, 80, 60, 75, 55, 90, 70, 85];
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [conn, setConn] = useState('checking');
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    let alive = true;
    getBackend()
      .then(b => { if (alive) setConn(b && b.login ? 'ok' : 'offline'); })
      .catch(() => { if (alive) setConn('offline'); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        const role = u?.role?.toLowerCase() || 'admin';
        setTimeout(() => navigate(role === 'depo' ? '/depo' : '/dashboard'), 500);
      } catch { navigate('/dashboard'); }
    } else {
      setIsCheckingAuth(false);
      const sUser = localStorage.getItem('saved_username');
      const sPass = localStorage.getItem('saved_password');
      if (sUser) {
        setUsername(sUser);
        if (sPass) { try { setPassword(decodeURIComponent(escape(atob(sPass)))); } catch { } }
        setRememberMe(true);
      }
      setTimeout(() => { const el = document.getElementById('username-input'); if (el) el.focus(); }, 0);
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Lütfen tüm alanları doldurun.'); return; }
    setError(''); setLoading(true);
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
    } catch {
      setLoading(false);
      setError('Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    }
  };

  const onKey = (e) => { if (e.getModifierState) setCapsLock(e.getModifierState('CapsLock')); };

  /* ── Splash ── */
  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: '100vh', background: isDark ? '#0e0e14' : '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <img src={amblem} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', animationName: 'dotb', animationDuration: '1.2s', animationTimingFunction: 'ease-in-out', animationDelay: `${i * 0.2}s`, animationIterationCount: 'infinite' }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes dotb{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  /* ── Main ── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#080c14' : '#eef2ff', position: 'relative', overflow: 'hidden', padding: '40px 24px', fontFamily: "'Inter','Outfit',system-ui,sans-serif" }}>

      {/* ── Enhanced Background Ambient Glows (Işıklı Arka Plan) ── */}
      <div style={{ position: 'absolute', top: '10%', left: '8%', width: 600, height: 600, borderRadius: '50%', background: isDark ? 'radial-gradient(circle,rgba(59,130,246,.25) 0%,rgba(37,99,235,.08) 50%,transparent 70%)' : 'radial-gradient(circle,rgba(59,130,246,.2) 0%,transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', right: '10%', width: 550, height: 550, borderRadius: '50%', background: isDark ? 'radial-gradient(circle,rgba(59,130,246,.32) 0%,rgba(99,102,241,.18) 50%,transparent 70%)' : 'radial-gradient(circle,rgba(99,102,241,.15) 0%,transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', left: '35%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,.12) 0%,transparent 70%)', filter: 'blur(85px)', pointerEvents: 'none' }} />

      {/* Theme btn */}
      <button onClick={toggleTheme} title={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
        style={{ position: 'absolute', top: 20, right: 20, zIndex: 50, width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)', border: isDark ? '1px solid rgba(255,255,255,.1)' : '1px solid rgba(0,0,0,.1)', color: isDark ? '#94a3b8' : '#475569', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* ══════════ CENTERED MAIN CONTAINER (Yakınlaştırılmış & Ortalı) ══════════ */}
      <div style={{ width: '100%', maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 36, position: 'relative', zIndex: 10 }}>

        {/* ══════════ LEFT PANEL ══════════ */}
        <div style={{ flex: '1 1 560px', maxWidth: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 2 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={amblem} alt="Remalab" style={{ width: 34, height: 34, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>REMALAB</div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.22em' }}>TEKNOLOJİ</div>
            </div>
          </div>

          {/* Headline */}
          <div style={{ marginTop: 36, maxWidth: 580 }}>
            <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, color: '#ffffff', letterSpacing: '-1px', margin: 0 }}>
              İşinizi dijitalleştirin,<br />
              yönetimi{' '}
              <span style={{ color: '#60a5fa', textShadow: '0 0 24px rgba(96,165,250,.4)' }}>kolaylaştırın.</span>
            </h1>
            <p style={{ marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, maxWidth: 420 }}>
              Remalab WMS sistemiyle tüm süreçlerinizi tek platformdan yönetin, verimliliğinizi artırın.
            </p>
          </div>

          {/* Dashboard mockup */}
          <div style={{ marginTop: 32, position: 'relative', maxWidth: 580 }}>

            {/* Floating 3D icons */}
            <div style={{ position: 'absolute', right: -14, top: -10, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 5 }}>
              {FLOAT_ICONS.map(({ Icon, color, delay }, i) => (
                <div key={i} style={{ width: 50, height: 50, borderRadius: 14, background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)', boxShadow: `0 8px 24px ${color}35`, animationName: 'iconFloat', animationDuration: `${3 + i * 0.6}s`, animationTimingFunction: 'ease-in-out', animationDelay: delay, animationIterationCount: 'infinite' }}>
                  <Icon size={20} color={color} />
                </div>
              ))}
            </div>

            {/* Main laptop / tablet frame */}
            <div style={{ background: 'linear-gradient(145deg,#1c1c2e 0%,#16213e 60%,#0f3460 100%)', borderRadius: 20, border: '1px solid rgba(255,255,255,.09)', padding: '20px 24px', boxShadow: '0 30px 80px rgba(0,0,0,.8), 0 0 30px rgba(59,130,246,.15)', transform: 'perspective(1400px) rotateY(-5deg) rotateX(3deg)', transformOrigin: 'left center', marginRight: 60 }}>

              {/* App topbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }} />
                <img src={amblem} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.85)', letterSpacing: '0.1em' }}>REMALAB ERP</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                  {['#3b82f6', '#f59e0b', '#10b981'].map((c, i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: .8 }} />
                  ))}
                </div>
              </div>

              {/* Sidebar + Content */}
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Sidebar */}
                <div style={{ width: 110, flexShrink: 0 }}>
                  <div style={{ background: 'rgba(59,130,246,.18)', borderRadius: 8, padding: '6px 10px', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(59,130,246,.3)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: '#3b82f6' }} />
                    <span style={{ fontSize: 9.5, color: '#60a5fa', fontWeight: 700 }}>Ana Sayfa</span>
                  </div>
                  {SIDEBAR_ITEMS.map((item, i) => (
                    <div key={i} style={{ padding: '4px 8px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: 'rgba(255,255,255,.12)' }} />
                      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,.38)' }}>{item}</span>
                    </div>
                  ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.65)', marginBottom: 8 }}>Genel Bakış</div>

                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 8 }}>
                    {STATS.map((s, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 7, padding: '6px 7px', border: '1px solid rgba(255,255,255,.05)' }}>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,.35)', marginBottom: 2, lineHeight: 1.2 }}>{s.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{s.val}</div>
                        <div style={{ fontSize: 7, color: s.up ? '#10b981' : '#3b82f6', marginTop: 2 }}>
                          {s.up ? '▲' : '▼'} {s.delta}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chart */}
                  <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(255,255,255,.05)', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,.4)', marginBottom: 6, fontWeight: 600 }}>Aylık Performans</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 38 }}>
                        {BARS.map((h, i) => (
                          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 2, background: i === 11 ? 'linear-gradient(to top,#3b82f6,#60a5fa)' : `rgba(59,130,246,${0.25 + i * 0.045})`, transition: 'height .3s' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        {MONTHS.map((m, i) => (
                          <div key={i} style={{ fontSize: 6, color: 'rgba(255,255,255,.2)' }}>{m}</div>
                        ))}
                      </div>
                    </div>
                    {/* Donut */}
                    <div style={{ flexShrink: 0, textAlign: 'center' }}>
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'conic-gradient(#3b82f6 0deg 190deg,#60a5fa 190deg 280deg,#10b981 280deg 360deg)', position: 'relative', margin: '0 auto' }}>
                        <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: '#16213e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 7, fontWeight: 800, color: '#fff', lineHeight: 1 }}>1.250</div>
                            <div style={{ fontSize: 5.5, color: 'rgba(255,255,255,.4)', lineHeight: 1.3 }}>Toplam</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[['#3b82f6', 'Tamamlandı'], ['#60a5fa', 'Devam Ediyor'], ['#10b981', 'İptal Edildi']].map(([c, l], i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
                            <span style={{ fontSize: 6, color: 'rgba(255,255,255,.35)' }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Glowing aura under the laptop card */}
            <div style={{ position: 'absolute', bottom: -15, left: 20, right: 80, height: 28, background: 'rgba(59,130,246,.35)', borderRadius: '50%', filter: 'blur(22px)', pointerEvents: 'none' }} />
          </div>

          {/* Bottom trust badge & footer */}
          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={16} color="#60a5fa" />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>Güvenli. Hızlı. Güçlü.</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Verileriniz bizimle güvende.</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
              © 2026 <span style={{ color: '#60a5fa' }}>Remalab Teknoloji</span>
            </div>
          </div>
        </div>

        {/* ══════════ RIGHT: FLOATING ILLUMINATED CARD (Işıklı Giriş Kartı) ══════════ */}
        <div style={{ width: 440, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
          
          {/* Card Neon Glow Aura Effect */}
          <div style={{ position: 'absolute', inset: -15, borderRadius: 36, background: isDark ? 'radial-gradient(circle,rgba(59,130,246,.35) 0%,rgba(99,102,241,.15) 60%,transparent 100%)' : 'radial-gradient(circle,rgba(59,130,246,.2) 0%,transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

          <div style={{ width: '100%', background: isDark ? 'rgba(15,23,42,.88)' : '#ffffff', backdropFilter: 'blur(20px)', borderRadius: 26, border: isDark ? '1px solid rgba(59,130,246,.3)' : '1px solid rgba(59,130,246,.18)', boxShadow: isDark ? '0 0 50px rgba(59,130,246,.25), 0 25px 80px rgba(0,0,0,.75)' : '0 20px 60px rgba(59,130,246,.2), 0 0 30px rgba(59,130,246,.1)', padding: '38px 34px', position: 'relative', zIndex: 2 }}>


          {/* Card logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, boxShadow: '0 10px 28px rgba(59,130,246,.4)' }}>
              <img src={amblem} alt="" style={{ width: 34, height: 34, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.3px' }}>REMALAB</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.22em', marginTop: 1 }}>TEKNOLOJİ</div>
          </div>

          <h2 style={{ fontSize: 21, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a', textAlign: 'center', margin: '0 0 6px' }}>ERP Yönetim Sistemi</h2>
          <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center', margin: '0 0 26px', lineHeight: 1.6 }}>Hesabınıza giriş yaparak devam edin.</p>

          {/* Connection / Error banners */}
          {conn === 'offline' && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', color: '#b45309', fontSize: 12.5, lineHeight: 1.5 }}>
              <WifiOff size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Sunucu bağlantısı kurulamadı. Yöneticinize bildirin.</span>
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', color: '#dc2626', fontSize: 12.5, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Username */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: isDark ? '#94a3b8' : '#475569', display: 'block', marginBottom: 6 }}>Kullanıcı Adı</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  id="username-input"
                  type="text"
                  autoComplete="username"
                  placeholder="örn: admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ width: '100%', height: 50, boxSizing: 'border-box', paddingLeft: 44, paddingRight: 16, background: isDark ? '#0f1929' : '#fff', border: isDark ? '1.5px solid #1e3a5f' : '1.5px solid #e2e8f0', borderRadius: 12, outline: 'none', fontSize: 14, color: isDark ? '#f1f5f9' : '#0f172a', transition: 'all .2s', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,.15)'; }}
                  onBlur={e => { e.target.style.borderColor = isDark ? '#1e3a5f' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: isDark ? '#94a3b8' : '#475569', display: 'block', marginBottom: 6 }}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={onKey} onKeyDown={onKey}
                  style={{ width: '100%', height: 50, boxSizing: 'border-box', paddingLeft: 44, paddingRight: 44, background: isDark ? '#0f1929' : '#fff', border: isDark ? '1.5px solid #1e3a5f' : '1.5px solid #e2e8f0', borderRadius: 12, outline: 'none', fontSize: 14, color: isDark ? '#f1f5f9' : '#0f172a', transition: 'all .2s', fontFamily: 'inherit', letterSpacing: '0.06em' }}
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,.15)'; }}
                  onBlur={e => { e.target.style.borderColor = isDark ? '#1e3a5f' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              {capsLock && (
                <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#f59e0b', marginTop: 5, marginBottom: 0 }}>
                  <ShieldAlert size={12} /> Caps Lock açık
                </p>
              )}
            </div>

            {/* Row: remember + connection */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <div onClick={() => setRememberMe(v => !v)}
                  style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${rememberMe ? '#3b82f6' : isDark ? '#334155' : '#cbd5e1'}`, background: rememberMe ? '#3b82f6' : isDark ? '#0f1929' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s', cursor: 'pointer' }}>
                  {rememberMe && <CheckCircle2 size={12} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500 }}>Beni Hatırla</span>
              </label>
              {conn === 'ok' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#10b981', fontWeight: 600 }}>
                  <Wifi size={11} /> Bağlı
                </span>
              )}
              {conn === 'checking' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#f59e0b', fontWeight: 500 }}>
                  <RefreshCw size={11} style={{ animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} /> Kontrol...
                </span>
              )}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{ width: '100%', height: 52, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: loading ? '#1d4ed8' : 'linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .85 : 1, boxShadow: '0 8px 28px rgba(59,130,246,.38)', transition: 'all .2s', fontFamily: 'inherit', letterSpacing: '-0.1px' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(59,130,246,.52)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(59,130,246,.38)'; }}>
              {loading
                ? <><RefreshCw size={17} style={{ animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} /> Giriş yapılıyor…</>
                : <><ArrowRight size={17} /> Giriş Yap</>
              }
            </button>
          </form>

          {/* Version */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11.5, color: isDark ? '#334155' : '#cbd5e1' }}>v1.0.0</div>
        </div>
      </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: isDark ? '#0f1929' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(59,130,246,.12)'}`, borderRadius: 20, padding: '32px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, boxShadow: '0 32px 80px rgba(0,0,0,.35)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={26} color="#3b82f6" style={{ animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} />
            </div>
            <p style={{ color: isDark ? '#f1f5f9' : '#0f172a', fontWeight: 600, fontSize: 14, margin: 0 }}>Giriş yapılıyor…</p>
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Lütfen bekleyin</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dotb     { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
        @keyframes iconFloat{ 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        input::placeholder  { color:#b0bec5; letter-spacing:normal; }
      `}</style>
    </div>
  );
}