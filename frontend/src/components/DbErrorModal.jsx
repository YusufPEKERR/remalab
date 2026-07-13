import { useState } from 'react';
import { AlertTriangle, Server, Database, User, Lock, Key } from 'lucide-react';
import { api } from '../services/api';

export default function DbErrorModal({ isOpen, errorMessage, onClose, onReconnect }) {
  const [view, setView] = useState('error'); // 'error' | 'settings'
  
  // Settings state
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('5432');
  const [dbName, setDbName] = useState('remalab');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('');
  
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveAndReconnect = async () => {
    setSaving(true);
    try {
      // Varsayılan olarak backend tarafında updateDbSettings adında bir köprü olması gerekecek.
      const res = await api.updateDbSettings({ host, port, dbName, user, password });
      if (res && res.success) {
        onReconnect(); // Tekrar bağlanmayı dene
      } else {
        alert("Ayarlar kaydedilirken hata oluştu: " + (res ? res.message : ""));
      }
    } catch (err) {
      alert("Sunucuyla iletişim kurulamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-[#1e2330] border border-slate-700 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {view === 'error' ? (
          /* --- ERROR VIEW --- */
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Veritabanı bağlantısı kurulamadı!</h2>
            <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 w-full mb-8">
              {errorMessage || "Sunucuyla iletişim kurulamıyor. Lütfen veritabanı ayarlarını kontrol edin."}
            </p>
            
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={onReconnect}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Yeniden Bağlan
              </button>
              <button 
                onClick={() => setView('settings')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold py-3 rounded-xl transition-colors"
              >
                Sunucu Değiştir
              </button>
              <button 
                onClick={onClose}
                className="w-full bg-transparent hover:bg-slate-800 text-slate-400 font-medium py-2 rounded-xl transition-colors"
              >
                Çıkış
              </button>
            </div>
          </div>
        ) : (
          /* --- SETTINGS VIEW --- */
          <div className="p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
              <Database size={20} className="text-blue-400"/>
              Veritabanı Ayarlarını Güncelle
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Host IP</label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="text" value={host} onChange={e => setHost(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Port</label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="text" value={port} onChange={e => setPort(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Veritabanı</label>
                <div className="relative">
                  <Database className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="text" value={dbName} onChange={e => setDbName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Kullanıcı</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="text" value={user} onChange={e => setUser(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setView('error')}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2.5 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleSaveAndReconnect}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet ve Bağlan'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
