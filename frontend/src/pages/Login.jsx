import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Lock, ArrowRight, AlertCircle, RefreshCw,
  Sun, Moon, ShieldAlert, Wifi, WifiOff, CheckCircle2, Mail,
  BarChart2, Shield, Settings, Users, Cloud, Server, Cpu, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, getBackend } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import amblem from '../assets/Uygulama-Amblemi.png';

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
  const [showForgotModal, setShowForgotModal] = useState(false);
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
        if (sPass) {
          try {
            setPassword(decodeURIComponent(escape(atob(sPass))));
          } catch {
            try { setPassword(atob(sPass)); } catch { }
          }
        }
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
          try {
            localStorage.setItem('saved_password', btoa(unescape(encodeURIComponent(password))));
          } catch {
            localStorage.setItem('saved_password', btoa(password));
          }
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
      <div style={{ minHeight: '100vh', background: '#070E20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <img src={amblem} alt="Remalab" style={{ width: 52, height: 52, objectFit: 'contain' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block', animationName: 'dotb', animationDuration: '1.2s', animationTimingFunction: 'ease-in-out', animationDelay: `${i * 0.2}s`, animationIterationCount: 'infinite' }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes dotb{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  /* ── Main Layout matching the Reference Image ── */
  return (
    <div style={{ width: '100vw', minHeight: '100vh', display: 'flex', background: '#070E20', position: 'relative', overflowX: 'hidden', fontFamily: "'Inter','Outfit',system-ui,sans-serif" }}>

      {/* ════════════════ LEFT SECTION: ISOMETRIC GRAPHIC & BRANDING (58% Width) ════════════════ */}
      <div style={{ flex: '1 1 58%', position: 'relative', background: 'radial-gradient(ellipse at top left,#0D1B3E 0%,#070E20 70%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px', overflow: 'hidden' }}>

        {/* Ambient Grid Lines & Glow Effects */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(37,99,235,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,.07) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '-10%', left: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.25) 0%,transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '5%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(96,165,250,.18) 0%,transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />

        {/* ── TOP LOGO HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 10 }}>
          <img src={amblem} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(37,99,235,0.4))' }} />
        </div>

        {/* ── MIDDLE CONTENT & ISOMETRIC GRAPHIC STAGE ── */}
        <div style={{ margin: '36px 0', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Headlines */}
          <div>
            <h1 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.15, color: '#FFFFFF', letterSpacing: '-1.2px', margin: 0 }}>
              ERP Yönetim Sistemi
            </h1>
            
            {/* Blue Accent Underline Line */}
            <div style={{ width: 42, height: 5, borderRadius: 3, background: '#2563EB', marginTop: 14, marginBottom: 16, boxShadow: '0 0 12px rgba(37,99,235,.6)' }} />

            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>
              İş süreçlerinizi dijitalleştirin, verimliliğinizi artırın, geleceğinizi birlikte şekillendirelim.
            </p>
          </div>

          {/* Isometric Dashboard Illustration Container */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 620, height: 320, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* Glowing Floor Reflection */}
            <div style={{ position: 'absolute', bottom: 10, width: '85%', height: 100, background: 'radial-gradient(ellipse, rgba(37,99,235,.35) 0%, rgba(225,29,72,.1) 50%, transparent 80%)', filter: 'blur(30px)', transform: 'rotateX(60deg)', pointerEvents: 'none' }} />

            {/* 3D Isometric Screen Mockup */}
            <div style={{
              width: 380,
              height: 230,
              background: '#0F172A',
              borderRadius: 16,
              border: '2px solid #2563EB',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(37,99,235,0.4)',
              transform: 'perspective(1000px) rotateY(-18deg) rotateX(12deg) rotateZ(3deg)',
              padding: 12,
              position: 'relative',
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {/* Inner Dashboard Mockup Top Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.05em' }}>ERP DASHBOARD</span>
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 8, background: '#2563EB', color: '#FFF', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>+12.5%</span>
                </div>
              </div>

              {/* Inner Mockup Grid */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>

                {/* Main Sales Chart */}
                <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 600 }}>Satış Grafiği</div>
                  <div style={{ height: 40, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                    {[40, 60, 45, 80, 55, 90, 75, 100].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 2, background: i % 2 === 0 ? '#2563EB' : '#38BDF8' }} />
                    ))}
                  </div>
                </div>

                {/* Donut Chart Block */}
                <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: 4 }}>Toplam Sipariş</div>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'conic-gradient(#2563EB 0deg 240deg, #38BDF8 240deg 360deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: '#FFF' }}>1.250</span>
                    </div>
                  </div>
                </div>

                {/* Sub Cards */}
                <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: 6, border: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ fontSize: 7, color: '#94A3B8' }}>Stok Durumu</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#FFF', marginTop: 2 }}>8.650</div>
                  <div style={{ fontSize: 6, color: '#22C55E' }}>Ürün</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: 6, border: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ fontSize: 7, color: '#94A3B8' }}>Aktif Kullanıcılar</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#FFF', marginTop: 2 }}>320</div>
                  <div style={{ fontSize: 6, color: '#38BDF8' }}>Kullanıcı</div>
                </div>
              </div>
            </div>

            {/* 3D Floating Server Cloud Badge (Left) */}
            <div style={{
              position: 'absolute', left: 10, top: 40, zIndex: 4,
              width: 70, height: 70, borderRadius: 18,
              background: 'linear-gradient(135deg,#1E293B,#0F172A)',
              border: '1.5px solid #38BDF8',
              boxShadow: '0 15px 30px rgba(0,0,0,0.6), 0 0 20px rgba(56,189,248,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              animation: 'iconFloat 4s ease-in-out infinite'
            }}>
              <Cloud size={28} color="#38BDF8" />
              <Server size={14} color="#94A3B8" />
            </div>

            {/* 3D Floating AI Chip Badge (Bottom Left) */}
            <div style={{
              position: 'absolute', left: 80, bottom: 20, zIndex: 5,
              padding: '8px 14px', borderRadius: 12,
              background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
              border: '1.5px solid #60A5FA',
              boxShadow: '0 12px 25px rgba(37,99,235,0.5)',
              display: 'flex', alignItems: 'center', gap: 8,
              animation: 'iconFloat 3.5s ease-in-out infinite 0.5s'
            }}>
              <Cpu size={18} color="#FFF" />
              <span style={{ fontSize: 13, fontWeight: 900, color: '#FFF', letterSpacing: '0.1em' }}>AI</span>
            </div>

            {/* 3D Floating Security Shield Badge (Right) */}
            <div style={{
              position: 'absolute', right: 30, top: 30, zIndex: 4,
              width: 64, height: 72, borderRadius: '16px 16px 30px 30px',
              background: 'linear-gradient(135deg,#2563EB,#1D4ED8)',
              border: '1.5px solid #60A5FA',
              boxShadow: '0 15px 35px rgba(37,99,235,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'iconFloat 4.2s ease-in-out infinite 1s'
            }}>
              <Shield size={32} color="#FFF" />
              <Check size={16} color="#FFF" style={{ position: 'absolute', strokeWidth: 3 }} />
            </div>

            {/* 3D Blue Bar Charts (Center Bottom) */}
            <div style={{
              position: 'absolute', right: 140, bottom: 15, zIndex: 4,
              display: 'flex', alignItems: 'flex-end', gap: 6
            }}>
              {[30, 50, 70, 40].map((h, i) => (
                <div key={i} style={{ width: 12, height: h, background: 'linear-gradient(to top,#2563EB,#60A5FA)', borderRadius: 3, boxShadow: '0 6px 15px rgba(37,99,235,0.4)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── BOTTOM FEATURE PILLS (4 Inline Items) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, position: 'relative', zIndex: 10 }}>
          {[
            { icon: BarChart2, title: 'Gerçek Zamanlı', sub: 'Raporlama' },
            { icon: Shield, title: 'Güvenli', sub: 'Altyapı' },
            { icon: Settings, title: 'Esnek ve', sub: 'Özelleştirilebilir' },
            { icon: Users, title: 'Kullanıcı Dostu', sub: 'Arayüz' }
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(8px)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(37,99,235,.2)', border: '1px solid rgba(37,99,235,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <item.icon size={16} color="#60A5FA" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', leading: 1.2 }}>{item.title}</span>
                <span style={{ fontSize: 10, color: '#94A3B8', leading: 1.2 }}>{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════ RIGHT SECTION: WHITE CARD & FORM (42% Width) ════════════════ */}
      <div style={{ flex: '1 1 42%', background: '#F1F5F9', borderTopLeftRadius: 40, borderBottomLeftRadius: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', position: 'relative', zIndex: 20 }}>

        {/* FLOATING PURE WHITE LOGIN CARD */}
        <div style={{ width: '100%', maxWidth: 440, background: '#FFFFFF', borderRadius: 28, border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)', padding: '40px 36px', display: 'flex', flexDirection: 'column' }}>

          {/* Card Top Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)', border: '1.5px solid #2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, boxShadow: '0 8px 24px rgba(37,99,235,0.38)' }}>
              <img src={amblem} alt="Logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </div>
          </div>

          {/* Heading */}
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', textAlign: 'center', margin: '0 0 6px' }}>Hoş Geldiniz!</h2>
          <p style={{ fontSize: 13, color: '#64748B', textAlign: 'center', margin: '0 0 24px' }}>Hesabınıza giriş yaparak devam edin.</p>

          {/* Connection / Error Banners */}
          {conn === 'offline' && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', color: '#b45309', fontSize: 12.5, lineHeight: 1.5 }}>
              <WifiOff size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Sunucu bağlantısı kurulamadı. Yöneticinize bildirin.</span>
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontSize: 12.5, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email / Username Input */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>E-posta</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  id="username-input"
                  type="text"
                  autoComplete="username"
                  placeholder="ornek@remalab.com"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ width: '100%', height: 48, boxSizing: 'border-box', paddingLeft: 44, paddingRight: 16, background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', fontSize: 14, color: '#0F172A', transition: 'all .2s', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.15)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={onKey} onKeyDown={onKey}
                  style={{ width: '100%', height: 48, boxSizing: 'border-box', paddingLeft: 44, paddingRight: 44, background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', fontSize: 14, color: '#0F172A', transition: 'all .2s', fontFamily: 'inherit', letterSpacing: '0.06em' }}
                  onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.15)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              {capsLock && (
                <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#b45309', marginTop: 5, marginBottom: 0 }}>
                  <ShieldAlert size={12} /> Caps Lock açık
                </p>
              )}
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <label 
                onClick={() => setRememberMe(prev => !prev)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
              >
                <div
                  style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${rememberMe ? '#2563EB' : '#CBD5E1'}`, background: rememberMe ? '#2563EB' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s', cursor: 'pointer' }}>
                  {rememberMe && <CheckCircle2 size={12} color="#FFFFFF" />}
                </div>
                <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>Beni Hatırla</span>
              </label>
              
              <button type="button" onClick={() => setShowForgotModal(true)}
                style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                Şifremi Unuttum?
              </button>
            </div>

            {/* Primary Submit Button */}
            <button type="submit" disabled={loading}
              style={{ width: '100%', height: 48, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: loading ? '#1D4ED8' : '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .85 : 1, boxShadow: '0 6px 20px rgba(37,99,235,.3)', transition: 'all .2s', fontFamily: 'inherit' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#1D4ED8'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(37,99,235,.4)'; } }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,.3)'; }}>
              {loading
                ? <><RefreshCw size={17} style={{ animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} /> Giriş yapılıyor…</>
                : <><ArrowRight size={17} /> Giriş Yap</>
              }
            </button>
          </form>
        </div>

        {/* Card Footer Version */}
        <div style={{ marginTop: 24, fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>v1.0.0</div>
      </div>

      {/* Modern Custom Forgot Password Modal */}
      {showForgotModal && (
        <div 
          onClick={() => setShowForgotModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(7,14,32,.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 24, border: '1px solid #E2E8F0', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 25px 70px rgba(0,0,0,.3)' }}
          >
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(37,99,235,.1)', border: '1px solid rgba(37,99,235,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Lock size={26} color="#2563EB" />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>Şifre Sıfırlama Talebi</h3>
            
            <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.6, margin: '0 0 20px' }}>
              Güvenlik politikaları gereği şifre sıfırlama işlemleri sistem yöneticisi tarafından gerçekleştirilmektedir. Lütfen yetkili yöneticiniz ile iletişime geçiniz.
            </p>

            <div style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Mail size={16} color="#2563EB" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 600 }}>Destek: <strong style={{ color: '#2563EB' }}>destek@remalab.com</strong></span>
            </div>

            <button 
              type="button" 
              onClick={() => setShowForgotModal(false)}
              style={{ width: '100%', height: 46, background: '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: 14.5, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,.3)', transition: 'all .2s', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1D4ED8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563EB'}
            >
              Anladım, Kapat
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay Modal */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,14,32,.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: '32px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, boxShadow: '0 32px 80px rgba(0,0,0,.25)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(37,99,235,.12)', border: '1px solid rgba(37,99,235,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={26} color="#2563EB" style={{ animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} />
            </div>
            <p style={{ color: '#0F172A', fontWeight: 600, fontSize: 14, margin: 0 }}>Giriş yapılıyor…</p>
            <p style={{ color: '#64748B', fontSize: 12, margin: 0 }}>Lütfen bekleyin</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dotb     { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
        @keyframes iconFloat{ 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        input::placeholder  { color:#94A3B8; letter-spacing:normal; }
      `}</style>
    </div>
  );
}