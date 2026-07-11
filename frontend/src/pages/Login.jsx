import { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, ArrowRight, Activity, Box, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const el = document.getElementById('username-input');
    if (el) el.focus();
  }, []);

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
          sessionStorage.removeItem('user');
        } else {
          sessionStorage.setItem('user', JSON.stringify(response.user));
          localStorage.removeItem('user');
        }
        navigate('/dashboard');
      } else {
        setError(response.message || 'Giriş başarısız oldu.');
      }
    } catch (err) {
      setLoading(false);
      setError('Bağlantı hatası: Sunucu ile iletişim kurulamadı.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1219] relative overflow-hidden text-slate-200 p-4">
      
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Main Container */}
      <div className="flex w-full max-w-[1000px] h-auto min-h-[600px] rounded-[24px] overflow-hidden relative z-10 border border-slate-800/50 shadow-2xl bg-[#1e2330]/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500 flex-col md:flex-row">
        
        {/* Left Side: Branding / Graphic */}
        <div className="flex-1 hidden md:flex flex-col justify-between px-12 py-14 bg-gradient-to-br from-[#161b26] to-[#0f1219] border-r border-slate-800/50 relative overflow-hidden">
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 bg-[#1e2330] overflow-hidden p-1">
                <img src="/uygulama-amblemi.png" alt="RemaLab Amblem" className="w-full h-full object-contain drop-shadow-md" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">REMALAB <span className="text-blue-500 font-medium">WMS</span></h1>
            </div>
            
            <h2 className="text-3xl font-bold text-white mt-12 leading-snug">
              Depo Yönetiminde <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                Yeni Nesil Deneyim
              </span>
            </h2>
            
            <p className="mt-6 text-slate-400 leading-relaxed text-sm max-w-sm">
              Stoklarınızı anlık takip edin, lokasyon bazlı yönetim sağlayın ve detaylı raporlarla deponuzun verimliliğini maksimize edin.
            </p>
          </div>

          {/* Abstract Graphic */}
          <div className="relative z-10 mt-12">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-slate-700/50 backdrop-blur-sm animate-pulse" style={{ animationDelay: '0ms' }}>
                <Activity size={20} className="text-emerald-400" />
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-slate-700/50 backdrop-blur-sm animate-pulse" style={{ animationDelay: '300ms' }}>
                <Box size={20} className="text-blue-400" />
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center border border-slate-700/50 backdrop-blur-sm animate-pulse" style={{ animationDelay: '600ms' }}>
                <MapPin size={20} className="text-purple-400" />
              </div>
            </div>
          </div>

          {/* Background grid pattern */}
          <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        </div>

        {/* Right Side: Form */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-14 py-12 bg-[#1e2330]">
          
          <div className="w-full max-w-sm mx-auto">
            <h2 className="text-2xl font-bold text-white mb-2">Hoş Geldiniz</h2>
            <p className="text-slate-400 text-sm mb-8">Devam etmek için hesabınıza giriş yapın.</p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400 pl-1">Kullanıcı Adı</label>
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    id="username-input"
                    type="text"
                    placeholder="Kullanıcı adınızı girin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-[52px] pl-11 pr-4 bg-[#242a38] border border-slate-700/50 rounded-xl outline-none text-slate-200 placeholder:text-slate-500 transition-all focus:bg-[#2a3142] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400 pl-1">Şifre</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Şifrenizi girin"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[52px] pl-11 pr-12 bg-[#242a38] border border-slate-700/50 rounded-xl outline-none text-slate-200 placeholder:text-slate-500 transition-all focus:bg-[#2a3142] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 rounded-[6px] border border-slate-600 bg-[#242a38] peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all"></div>
                    <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="ml-2.5 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    Beni hatırla
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <RefreshCw size={20} className="animate-spin" />
                ) : (
                  <>
                    Giriş Yap
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
            
          </div>
        </div>
      </div>
    </div>
  );
}
