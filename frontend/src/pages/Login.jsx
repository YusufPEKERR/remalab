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
// Giris kartindaki rozet icin "PR" isaretli amblem varyanti
import amblemPr from '../assets/Uygulama-Amblemi-Pr.png';

/* ════════════ TEMA-2 PALETİ (kurumsal banner görselinden) ════════════ */
const T = {
  ink: '#16204A',   // en koyu lacivert
  deep: '#1E2B5C',
  navy: '#2E3F78',
  indigo: '#3B4C93',  // birincil aksiyon rengi
  royal: '#5B6EC4',
  peri: '#8894D8',  // periwinkle
  lilac: '#A9B2E3',
  mist: '#D7DCEF',
  pale: '#F1F3FB',
  teal: '#4FA890',  // yeşil-teal aksan
  tealSoft: '#7CC7B2',
  muted: '#2E3650'
};

/* Sayfa fonu: koyu indigodan açık lilaya diyagonal geçiş */
const THEME_BG =
  'linear-gradient(100deg,#16204A 0%,#24326A 17%,#3C4C90 36%,#6C7ABF 54%,#A9B2E3 70%,#8A98B8 85%,#B5BFD8 100%)';

const DIAMOND_COLORS = [T.royal, T.peri, T.indigo, T.lilac, T.teal, T.tealSoft, '#C6CEE2', T.navy];

/* Deterministik PRNG — her render'da aynı mozaik çıksın diye */
function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Eğik kare (baklava) mozaiği — solda yoğun, sağa doğru seyrelir */
const MOSAIC = (() => {
  const r = mulberry(20260730);
  const out = [];
  for (let i = 0; i < 120; i++) {
    const x = Math.pow(r(), 1.9) * 80;
    const y = r() * 100;
    const s = 10 + r() * 30;
    out.push({
      x, y, s,
      c: DIAMOND_COLORS[Math.floor(r() * DIAMOND_COLORS.length)],
      o: (0.10 + r() * 0.55) * (1 - x / 96),
      rot: 45 + (r() * 8 - 4)
    });
  }
  return out;
})();

/* Yumuşak beyaz bokeh daireleri */
const BOKEH = (() => {
  const r = mulberry(77201);
  return Array.from({ length: 18 }, () => ({
    x: Math.pow(r(), 1.7) * 72,
    y: r() * 100,
    s: 36 + r() * 140,
    o: 0.05 + r() * 0.18
  }));
})();

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
      <div style={{ minHeight: '100vh', background: THEME_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <img src={amblem} alt="Remalab" style={{ width: 52, height: 52, objectFit: 'contain' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: T.royal, display: 'inline-block', animationName: 'dotb', animationDuration: '1.2s', animationTimingFunction: 'ease-in-out', animationDelay: `${i * 0.2}s`, animationIterationCount: 'infinite' }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes dotb{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    );
  }

  /* ── Main Layout — Tema2 mozaik fon + sağda cam (glassmorphism) panel ── */
  return (
    <div style={{ width: '100vw', minHeight: '100vh', display: 'flex', background: THEME_BG, position: 'relative', overflowX: 'hidden', fontFamily: "'Inter','Outfit',system-ui,sans-serif" }}>

      {/* ════════════════ TEMA-2 DEKORATİF FON KATMANI (mozaik + bokeh) ════════════════ */}
      {/* Sağdaki cam panelin backdrop-filter'ı tam olarak bu katmanı bulanıklaştırır */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {BOKEH.map((b, i) => (
          <div key={`bk${i}`} style={{
            position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
            width: b.s, height: b.s, borderRadius: '50%',
            background: '#C6CEE2', opacity: b.o, filter: 'blur(8px)'
          }} />
        ))}
        {MOSAIC.map((d, i) => (
          <div key={`dm${i}`} style={{
            position: 'absolute', left: `${d.x}%`, top: `${d.y}%`,
            width: d.s, height: d.s, borderRadius: 2,
            background: d.c, opacity: d.o,
            transform: `rotate(${d.rot}deg)`
          }} />
        ))}
        {/* Sol üstte derin ışık, sağ altta lila parlama */}
        <div style={{ position: 'absolute', top: '-12%', left: '4%', width: 560, height: 560, borderRadius: '50%', background: `radial-gradient(circle,${T.royal}44 0%,transparent 70%)`, filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '-8%', left: '32%', width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle,${T.teal}2E 0%,transparent 70%)`, filter: 'blur(110px)' }} />
      </div>

      {/* ════════════════ SOL BÖLÜM: GÖRSEL & MARKA (58%) ════════════════ */}
      {/* login-left: 980px altinda gizlenir (asagidaki media query) */}
      <div className="login-left" style={{ flex: '1 1 58%', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px', overflow: 'hidden' }}>

        {/* ── ÜST LOGO ──
            Beyaz yazili tam logo (marka + "remalab teknoloji" kelime isareti).
            MainLayout'un koyu tema logosuyla ayni dosya; public/ altindan
            servis ediliyor, bu yuzden kopyalanmadi.
            Genislik 'auto': gorsel 566x441 (en/boy 1.3), yukseklikten olcekleniyor. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 10 }}>
          <img
            src="/karanlık-mod.png"
            alt="Remalab Teknoloji"
            style={{ height: 104, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 6px 20px rgba(22,32,74,0.55))' }}
          />
        </div>

        {/* ── ORTA İÇERİK & İZOMETRİK SAHNE ── */}
        <div style={{ margin: '36px 0', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Başlıklar */}
          <div>
            <h1 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.15, color: '#C6CEE2', letterSpacing: '-1.2px', margin: 0, textShadow: '0 6px 24px rgba(22,32,74,.45)' }}>
              ERP Yönetim Sistemi
            </h1>

            {/* İndigo-teal aksan çizgisi */}
            <div style={{ width: 42, height: 5, borderRadius: 3, background: `linear-gradient(90deg,${T.royal},${T.teal})`, marginTop: 14, marginBottom: 16, boxShadow: `0 0 14px ${T.royal}99` }} />

            <p style={{ fontSize: 14, color: '#CDD4EE', lineHeight: 1.7, maxWidth: 460, margin: 0 }}>
              İş süreçlerinizi dijitalleştirin, verimliliğinizi artırın, geleceğinizi birlikte şekillendirelim.
            </p>
          </div>

          {/* İzometrik dashboard illüstrasyonu */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 620, height: 320, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* Zemin yansıması */}
            <div style={{ position: 'absolute', bottom: 10, width: '85%', height: 100, background: `radial-gradient(ellipse, ${T.royal}59 0%, ${T.teal}1F 50%, transparent 80%)`, filter: 'blur(30px)', transform: 'rotateX(60deg)', pointerEvents: 'none' }} />

            {/* 3D ekran maketi — camsı koyu indigo */}
            <div style={{
              width: 380,
              height: 230,
              background: 'linear-gradient(150deg, rgba(30,43,92,.80) 0%, rgba(22,32,74,.90) 100%)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: 16,
              border: `2px solid ${T.peri}BF`,
              boxShadow: '0 25px 60px rgba(11,18,45,0.55), 0 0 42px rgba(91,110,196,0.32)',
              transform: 'perspective(1000px) rotateY(-18deg) rotateX(12deg) rotateZ(3deg)',
              padding: 12,
              position: 'relative',
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {/* Maket üst navigasyon */}
              <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,.10)' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#C6CEE2', letterSpacing: '0.05em' }}>ERP DASHBOARD</span>
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 8, background: T.teal, color: '#FFF', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>+12.5%</span>
                </div>
              </div>

              {/* Maket grid */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>

                {/* Satış grafiği */}
                <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 8, color: T.lilac, fontWeight: 600 }}>Satış Grafiği</div>
                  <div style={{ height: 40, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                    {[40, 60, 45, 80, 55, 90, 75, 100].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 2, background: i % 2 === 0 ? T.royal : T.peri }} />
                    ))}
                  </div>
                </div>

                {/* Donut */}
                <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 8, color: T.lilac, marginBottom: 4 }}>Toplam Sipariş</div>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `conic-gradient(${T.royal} 0deg 240deg, ${T.teal} 240deg 360deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.deep, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: '#FFF' }}>1.250</span>
                    </div>
                  </div>
                </div>

                {/* Alt kartlar */}
                <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: 6, border: '1px solid rgba(255,255,255,.08)' }}>
                  <div style={{ fontSize: 7, color: T.lilac }}>Stok Durumu</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#FFF', marginTop: 2 }}>8.650</div>
                  <div style={{ fontSize: 6, color: T.tealSoft }}>Ürün</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: 6, border: '1px solid rgba(255,255,255,.08)' }}>
                  <div style={{ fontSize: 7, color: T.lilac }}>Aktif Kullanıcılar</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#FFF', marginTop: 2 }}>320</div>
                  <div style={{ fontSize: 6, color: T.peri }}>Kullanıcı</div>
                </div>
              </div>
            </div>

            {/* Bulut / sunucu rozeti (sol) */}
            <div style={{
              position: 'absolute', left: 10, top: 40, zIndex: 4,
              width: 70, height: 70, borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(46,63,120,.88), rgba(22,32,74,.92))',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1.5px solid ${T.peri}CC`,
              boxShadow: '0 15px 30px rgba(11,18,45,0.45), 0 0 22px rgba(136,148,216,0.28)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              animation: 'iconFloat 4s ease-in-out infinite'
            }}>
              <Cloud size={28} color={T.lilac} />
              <Server size={14} color={T.peri} />
            </div>

            {/* AI çip rozeti (sol alt) */}
            <div style={{
              position: 'absolute', left: 80, bottom: 20, zIndex: 5,
              padding: '8px 14px', borderRadius: 12,
              background: `linear-gradient(135deg,${T.royal},${T.navy})`,
              border: `1.5px solid ${T.lilac}`,
              boxShadow: '0 12px 26px rgba(46,63,120,0.50)',
              display: 'flex', alignItems: 'center', gap: 8,
              animation: 'iconFloat 3.5s ease-in-out infinite 0.5s'
            }}>
              <Cpu size={18} color="#FFF" />
              <span style={{ fontSize: 13, fontWeight: 900, color: '#FFF', letterSpacing: '0.1em' }}>AI</span>
            </div>

            {/* Güvenlik kalkanı rozeti (sağ) — teal aksan */}
            <div style={{
              position: 'absolute', right: 30, top: 30, zIndex: 4,
              width: 64, height: 72, borderRadius: '16px 16px 30px 30px',
              background: `linear-gradient(135deg,${T.teal},#3B8B76)`,
              border: `1.5px solid ${T.tealSoft}`,
              boxShadow: '0 15px 35px rgba(79,168,144,0.42)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'iconFloat 4.2s ease-in-out infinite 1s'
            }}>
              <Shield size={32} color="#FFF" />
              <Check size={16} color="#FFF" style={{ position: 'absolute', strokeWidth: 3 }} />
            </div>

            {/* 3D bar grafikler (orta alt) */}
            <div style={{
              position: 'absolute', right: 140, bottom: 15, zIndex: 4,
              display: 'flex', alignItems: 'flex-end', gap: 6
            }}>
              {[30, 50, 70, 40].map((h, i) => (
                <div key={i} style={{ width: 12, height: h, background: `linear-gradient(to top,${T.indigo},${T.peri})`, borderRadius: 3, boxShadow: '0 6px 16px rgba(46,63,120,0.42)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── ALT ÖZELLİK KARTLARI (cam) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, position: 'relative', zIndex: 10 }}>
          {[
            { icon: BarChart2, title: 'Gerçek Zamanlı', sub: 'Raporlama' },
            { icon: Shield, title: 'Güvenli', sub: 'Altyapı' },
            { icon: Settings, title: 'Esnek ve', sub: 'Özelleştirilebilir' },
            { icon: Users, title: 'Kullanıcı Dostu', sub: 'Arayüz' }
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.peri}33`, border: `1px solid ${T.lilac}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <item.icon size={16} color={T.lilac} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#C6CEE2', lineHeight: 1.2 }}>{item.title}</span>
                <span style={{ fontSize: 10, color: '#C3CAE6', lineHeight: 1.2 }}>{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════ SAĞ BÖLÜM: CAM (FROSTED GLASS) PANEL & FORM (42%) ════════════════ */}
      <div className="login-right" style={{
        flex: '1 1 42%',
        background: 'linear-gradient(160deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.10) 100%)',
        backdropFilter: 'blur(28px) saturate(150%)',
        WebkitBackdropFilter: 'blur(28px) saturate(150%)',
        borderLeft: '1px solid rgba(255,255,255,.45)',
        borderTopLeftRadius: 40,
        borderBottomLeftRadius: 40,
        boxShadow: '-24px 0 70px rgba(22,32,74,.20)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px', position: 'relative', zIndex: 20
      }}>

        {/* CAM GİRİŞ KARTI */}
        <div className="login-card" style={{
          width: '100%', maxWidth: 440,
          background: 'linear-gradient(155deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.42) 100%)',
          backdropFilter: 'blur(32px) saturate(165%)',
          WebkitBackdropFilter: 'blur(32px) saturate(165%)',
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,.70)',
          boxShadow: '0 24px 70px rgba(22,32,74,.18), inset 0 1px 0 rgba(255,255,255,.75)',
          padding: '40px 36px', display: 'flex', flexDirection: 'column'
        }}>

          {/* Kart logosu — "PR" isaretli amblem.
              Rozet 58->88, gorsel 36->66 buyutuldu: PR bu olcekte net okunuyor
              (36px'te lekeye donusuyordu). */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 88, height: 88, borderRadius: 24, background: `linear-gradient(135deg, ${T.indigo} 0%, ${T.ink} 100%)`, border: `1.5px solid ${T.peri}B3`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, boxShadow: '0 12px 30px rgba(46,63,120,0.38)' }}>
              <img src={amblemPr} alt="Remalab PR" style={{ width: 66, height: 66, objectFit: 'contain' }} />
            </div>
          </div>

          {/* Başlık */}
          <h2 style={{ fontSize: 22, fontWeight: 800, color: T.ink, textAlign: 'center', margin: '0 0 6px' }}>Hoş Geldiniz!</h2>
          <p style={{ fontSize: 13, color: T.muted, textAlign: 'center', margin: '0 0 24px' }}>Hesabınıza giriş yaparak devam edin.</p>

          {/* Bağlantı / hata bildirimleri */}
          {conn === 'offline' && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(245,158,11,.14)', border: '1px solid rgba(180,83,9,.30)', color: '#8a5208', fontSize: 12.5, lineHeight: 1.5 }}>
              <WifiOff size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Sunucu bağlantısı kurulamadı. Yöneticinize bildirin.</span>
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(220,38,38,.12)', border: '1px solid rgba(185,28,28,.30)', color: '#b91c1c', fontSize: 12.5, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* E-posta */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.deep, display: 'block', marginBottom: 6 }}>E-posta</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.indigo, opacity: .65, pointerEvents: 'none' }} />
                <input
                  id="username-input"
                  type="text"
                  autoComplete="username"
                  placeholder="ornek@remalab.com"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{ width: '100%', height: 48, boxSizing: 'border-box', paddingLeft: 44, paddingRight: 16, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1.5px solid ${T.indigo}33`, borderRadius: 10, outline: 'none', fontSize: 14, color: T.ink, transition: 'all .2s', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = T.indigo; e.target.style.background = 'rgba(255,255,255,.78)'; e.target.style.boxShadow = `0 0 0 3px ${T.indigo}29`; }}
                  onBlur={e => { e.target.style.borderColor = `${T.indigo}33`; e.target.style.background = 'rgba(255,255,255,.55)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.deep, display: 'block', marginBottom: 6 }}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.indigo, opacity: .65, pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={onKey} onKeyDown={onKey}
                  style={{ width: '100%', height: 48, boxSizing: 'border-box', paddingLeft: 44, paddingRight: 44, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1.5px solid ${T.indigo}33`, borderRadius: 10, outline: 'none', fontSize: 14, color: T.ink, transition: 'all .2s', fontFamily: 'inherit', letterSpacing: '0.06em' }}
                  onFocus={e => { e.target.style.borderColor = T.indigo; e.target.style.background = 'rgba(255,255,255,.78)'; e.target.style.boxShadow = `0 0 0 3px ${T.indigo}29`; }}
                  onBlur={e => { e.target.style.borderColor = `${T.indigo}33`; e.target.style.background = 'rgba(255,255,255,.55)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              {capsLock && (
                <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8a5208', marginTop: 5, marginBottom: 0 }}>
                  <ShieldAlert size={12} /> Caps Lock açık
                </p>
              )}
            </div>

            {/* Beni hatırla & şifremi unuttum */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <label 
                onClick={() => setRememberMe(prev => !prev)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
              >
                <div
                  style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${rememberMe ? T.indigo : `${T.indigo}59`}`, background: rememberMe ? T.indigo : 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s', cursor: 'pointer' }}>
                  {rememberMe && <CheckCircle2 size={12} color="#C6CEE2" />}
                </div>
                <span style={{ fontSize: 13, color: T.deep, fontWeight: 500 }}>Beni Hatırla</span>
              </label>

              <button type="button" onClick={() => setShowForgotModal(true)}
                style={{ background: 'none', border: 'none', color: T.indigo, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                Şifremi Unuttum?
              </button>
            </div>

            {/* Giriş butonu */}
            <button type="submit" disabled={loading}
              style={{ width: '100%', height: 48, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: `linear-gradient(135deg,${T.indigo} 0%,${T.navy} 100%)`, color: '#C6CEE2', fontWeight: 700, fontSize: 15, border: '1px solid rgba(255,255,255,.22)', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .85 : 1, boxShadow: '0 8px 24px rgba(46,63,120,.35)', transition: 'all .2s', fontFamily: 'inherit' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = `linear-gradient(135deg,${T.royal} 0%,${T.indigo} 100%)`; e.currentTarget.style.boxShadow = '0 12px 30px rgba(46,63,120,.45)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg,${T.indigo} 0%,${T.navy} 100%)`; e.currentTarget.style.boxShadow = '0 8px 24px rgba(46,63,120,.35)'; }}>
              {loading
                ? <><RefreshCw size={17} style={{ animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} /> Giriş yapılıyor…</>
                : <><ArrowRight size={17} /> Giriş Yap</>
              }
            </button>
          </form>
        </div>

        {/* Sürüm */}
        <div style={{ marginTop: 24, fontSize: 12, color: T.deep, opacity: .55, fontWeight: 600 }}>v1.0.0</div>
      </div>

      {/* Şifremi Unuttum modalı — cam */}
      {showForgotModal && (
        <div
          onClick={() => setShowForgotModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,74,.58)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'linear-gradient(155deg, rgba(255,255,255,.80) 0%, rgba(255,255,255,.62) 100%)', backdropFilter: 'blur(34px) saturate(165%)', WebkitBackdropFilter: 'blur(34px) saturate(165%)', borderRadius: 24, border: '1px solid rgba(255,255,255,.75)', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 28px 80px rgba(22,32,74,.35), inset 0 1px 0 rgba(255,255,255,.8)' }}
          >
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.indigo}1F`, border: `1px solid ${T.indigo}4D`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Lock size={26} color={T.indigo} />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: '0 0 8px' }}>Şifre Sıfırlama Talebi</h3>

            <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6, margin: '0 0 20px' }}>
              Güvenlik politikaları gereği şifre sıfırlama işlemleri sistem yöneticisi tarafından gerçekleştirilmektedir. Lütfen yetkili yöneticiniz ile iletişime geçiniz.
            </p>

            <div style={{ width: '100%', background: 'rgba(255,255,255,.55)', border: `1px solid ${T.indigo}26`, borderRadius: 12, padding: '12px 14px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Mail size={16} color={T.indigo} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: T.deep, fontWeight: 600 }}>Destek: <strong style={{ color: T.indigo }}>destek@remalab.com</strong></span>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{ width: '100%', height: 46, background: `linear-gradient(135deg,${T.indigo} 0%,${T.navy} 100%)`, color: '#C6CEE2', fontWeight: 700, fontSize: 14.5, border: '1px solid rgba(255,255,255,.22)', borderRadius: 10, cursor: 'pointer', boxShadow: '0 6px 18px rgba(46,63,120,.32)', transition: 'all .2s', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.background = `linear-gradient(135deg,${T.royal} 0%,${T.indigo} 100%)`}
              onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg,${T.indigo} 0%,${T.navy} 100%)`}
            >
              Anladım, Kapat
            </button>
          </div>
        </div>
      )}

      {/* Yükleniyor overlay — cam */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,74,.58)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'linear-gradient(155deg, rgba(255,255,255,.80) 0%, rgba(255,255,255,.62) 100%)', backdropFilter: 'blur(30px) saturate(160%)', WebkitBackdropFilter: 'blur(30px) saturate(160%)', border: '1px solid rgba(255,255,255,.75)', borderRadius: 20, padding: '32px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, boxShadow: '0 32px 80px rgba(22,32,74,.30)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.indigo}1F`, border: `1px solid ${T.indigo}4D`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={26} color={T.indigo} style={{ animationName: 'spin', animationDuration: '1s', animationTimingFunction: 'linear', animationIterationCount: 'infinite' }} />
            </div>
            <p style={{ color: T.ink, fontWeight: 600, fontSize: 14, margin: 0 }}>Giriş yapılıyor…</p>
            <p style={{ color: T.muted, fontSize: 12, margin: 0 }}>Lütfen bekleyin</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dotb     { 0%,80%,100%{transform:scale(.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
        @keyframes iconFloat{ 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        input::placeholder  { color:#7C87AC; letter-spacing:normal; }

        /* ── RESPONSIVE ──────────────────────────────────────────
           Sol tanitim paneli 980px altinda gizlenir; form paneli tum
           genisligi alir. Boylece dar ekranda 42%'lik bir sutuna
           sikismis form yerine tam genislikte bir giris ekrani olur. */
        @media (max-width: 980px) {
          .login-left  { display: none !important; }
          .login-right {
            flex: 1 1 100% !important;
            border-top-left-radius: 0 !important;
            border-bottom-left-radius: 0 !important;
            border-left: none !important;
            box-shadow: none !important;
            padding: 32px 20px !important;
          }
        }
        @media (max-width: 560px) {
          .login-right { padding: 20px 14px !important; }
          .login-card  { padding: 28px 20px !important; border-radius: 22px !important; }
        }
        /* Kisa ekranlarda (yatay telefon) form dikeyde sigsin */
        @media (max-height: 700px) {
          .login-right { justify-content: flex-start !important; overflow-y: auto; }
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: ${T.ink};
          -webkit-box-shadow: 0 0 0 1000px rgba(255,255,255,.72) inset;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
}
