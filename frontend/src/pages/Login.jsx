import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #F8FAFD 0%, #EBF0F8 100%)'
      }}
    >
      {/* Glass Panel wrapper */}
      <div 
        className="flex w-full max-w-[900px] h-[550px] rounded-[24px] overflow-hidden relative z-10 mx-4"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(10px)' // Optional modern touch
        }}
      >
        {/* Left Side: Graphic / Branding */}
        <div 
          className="flex-1 flex flex-col justify-center px-12 py-12"
          style={{
            borderRight: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <img src="/logo.png" alt="RemaLab Logo" className="w-[250px] object-contain mb-4" />
          
          <h2 
            className="mt-2"
            style={{ color: '#4F6CB3', fontSize: '24px', fontWeight: 400, fontFamily: '"Segoe UI", sans-serif', lineHeight: '1.3' }}
          >
            Geleceğin Depo<br/>Yönetim Sistemi
          </h2>
          
          <p 
            className="mt-5"
            style={{ color: '#4F6CB3', fontSize: '14px', fontFamily: '"Segoe UI", sans-serif', lineHeight: '1.5' }}
          >
            Tüm stok hareketlerinizi saniyeler<br/>
            içinde yönetin, izleyin ve analiz edin.
          </p>
        </div>

        {/* Right Side: Form */}
        <div 
          className="flex-1 flex flex-col justify-center px-14 py-12 bg-white"
          style={{
            borderTopRightRadius: '24px',
            borderBottomRightRadius: '24px'
          }}
        >
          <h1 
            className="text-center mb-8"
            style={{ color: '#243B7A', fontSize: '32px', fontWeight: 800, fontFamily: '"Segoe UI", sans-serif' }}
          >
            Giriş Yap
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col space-y-6">
            
            {/* Username Input */}
            <div>
              <input
                type="text"
                placeholder="Kullanıcı Adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-[50px] px-5 rounded-[14px] outline-none transition-all duration-200"
                style={{
                  border: '2px solid #D8E2F0',
                  backgroundColor: '#F8FAFD',
                  color: '#1B2338',
                  fontSize: '15px',
                  fontWeight: 500
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4FA3FF';
                  e.target.style.backgroundColor = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#D8E2F0';
                  e.target.style.backgroundColor = '#F8FAFD';
                }}
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[50px] pl-5 pr-[45px] rounded-[14px] outline-none transition-all duration-200"
                style={{
                  border: '2px solid #D8E2F0',
                  backgroundColor: '#F8FAFD',
                  color: '#1B2338',
                  fontSize: '15px',
                  fontWeight: 500
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4FA3FF';
                  e.target.style.backgroundColor = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#D8E2F0';
                  e.target.style.backgroundColor = '#F8FAFD';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4F6CB3] hover:text-[#4FA3FF] transition-colors focus:outline-none"
              >
                {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 rounded-[6px] border-2 border-[#4F6CB3] bg-[#F8FAFD] peer-checked:bg-transparent peer-checked:border-[#243B7A] transition-all"></div>
                  <svg className="absolute w-3.5 h-3.5 text-[#243B7A] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="ml-2 text-[14px] font-semibold text-[#1B2338]" style={{ fontFamily: '"Segoe UI", sans-serif' }}>
                  Beni hatırla
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[55px] rounded-[14px] text-white font-bold text-[18px] transition-all duration-200 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(90deg, #243B7A 0%, #4F6CB3 100%)',
                fontFamily: '"Segoe UI", sans-serif',
                letterSpacing: '1px'
              }}
              onMouseEnter={(e) => {
                if(!loading) e.target.style.background = 'linear-gradient(90deg, #4F6CB3 0%, #4FA3FF 100%)';
              }}
              onMouseLeave={(e) => {
                if(!loading) e.target.style.background = 'linear-gradient(90deg, #243B7A 0%, #4F6CB3 100%)';
              }}
            >
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
