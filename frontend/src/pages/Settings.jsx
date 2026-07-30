import { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import {
  Settings as SettingsIcon,
  Database,
  HardDrive,
  Globe,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  FolderOpen,
  FileText,
  Save,
  Server,
  DatabaseZap,
  PlugZap,
  Code2,
  X,
  Building2
} from 'lucide-react';
import { api } from '../services/api';

// Icons based on DB type
const dbTypeConfig = {
  postgresql: { icon: "🐘", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", label: "PostgreSQL" },
  mysql: { icon: "🐬", color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/20", label: "MySQL" },
  mssql: { icon: "🗄️", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", label: "SQL Server" }
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [language, setLanguage] = useState('tr');

  // Current user / role (Dev Mode sadece Admin'e görünür)
  const [user, setUser] = useState(null);
  useEffect(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch (_e) { /* ignore */ }
    }
  }, []);
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  // Dev Mode
  const [devMode, setDevModeState] = useState(true);
  const [devModeSaved, setDevModeSaved] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    api.getDevMode().then(res => {
      if (res.success) setDevModeState(res.dev_mode);
    });
  }, [isAdmin]);

  const handleToggleDevMode = async () => {
    const next = !devMode;
    setDevModeState(next);
    setDevModeSaved(false);
    const res = await api.setDevMode(next);
    if (res.success) {
      setDevModeSaved(true);
    }
  };

  // DB Connections
  const [connections, _setConnections] = useState([
    { id: '1', name: 'Main DB', db_type: 'postgresql', host: 'localhost', port: 5432, database: 'remalab_db', username: 'postgres', active: true },
    { id: '2', name: 'Legacy Test', db_type: 'mysql', host: '192.168.1.100', port: 3306, database: 'test_db', username: 'root', active: false }
  ]);
  const [showDbForm, setShowDbForm] = useState(false);
  const [editingDb, setEditingDb] = useState(null);
  const [dbFormData, setDbFormData] = useState({ name: '', db_type: 'postgresql', host: 'localhost', port: 5432, database: '', username: '', password: '' });

  // Local DB
  const [localFiles, setLocalFiles] = useState([]);
  const [dataFolders, setDataFolders] = useState([]);

  const fetchLocalData = async () => {
    const [dbRes, fdRes] = await Promise.all([
      api.getLocalFiles(),
      api.getDataFolders()
    ]);
    if (dbRes.success) setLocalFiles(dbRes.local_files || []);
    if (fdRes.success) setDataFolders(fdRes.data_folders || []);
  };

  useEffect(() => {
    if (activeTab === 'local') {
      fetchLocalData();
    }
  }, [activeTab]);

  const handleOpenDbForm = (conn = null) => {
    if (conn) {
      setEditingDb(conn);
      setDbFormData({ ...conn, password: '' });
    } else {
      setEditingDb(null);
      setDbFormData({ name: '', db_type: 'postgresql', host: 'localhost', port: 5432, database: '', username: 'postgres', password: '' });
    }
    setShowDbForm(true);
  };

  const handleSaveDb = (e) => {
    e.preventDefault();
    console.log("Saving DB:", dbFormData);
    setShowDbForm(false);
  };

  const handleDeleteDb = (id) => {
    if (window.confirm("Bu bağlantıyı silmek istediğinize emin misiniz?")) {
      console.log("Deleting DB:", id);
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#16204A] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#101935] via-[#DDE2F2] dark:via-[#16204A] to-[#FFFFFF] dark:to-[#24326A] p-6 sm:p-8 text-[#1B2755] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#24326A]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(91, 110, 196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(91, 110, 196,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/30 text-[#2E3F78] dark:text-blue-300 text-xs font-semibold tracking-wide">
              <SettingsIcon size={13} className="text-blue-400" /> SİSTEM YAPILANDIRMASI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2755] dark:text-white">
              Sistem Ayarları
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Uygulama dilini, veritabanı bağlantılarını ve lokal depolama klasörlerini yönetin.
            </p>
          </div>
        </div>
      </div>

      {/* TABS CONTAINER */}
      <div className="glass-card p-2 rounded-2xl shadow-md flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'general' ? 'bg-[#4457A5] text-white shadow-md' : 'text-[#5A6685] dark:text-[#8892B5] hover:text-[#16204A] dark:hover:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#24326A]'
          }`}
        >
          <SettingsIcon size={16} /> Genel Ayarlar
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'database' ? 'bg-[#4457A5] text-white shadow-md' : 'text-[#5A6685] dark:text-[#8892B5] hover:text-[#16204A] dark:hover:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#24326A]'
          }`}
        >
          <Server size={16} /> Veritabanı Bağlantıları
        </button>
        <button
          onClick={() => setActiveTab('local')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'local' ? 'bg-[#4457A5] text-white shadow-md' : 'text-[#5A6685] dark:text-[#8892B5] hover:text-[#16204A] dark:hover:text-[#F6F8FF] hover:bg-[#FFFFFF] dark:hover:bg-[#24326A]'
          }`}
        >
          <HardDrive size={16} /> Lokal DB / Klasörler
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
        
        {/* --- GENERAL TAB --- */}
        {activeTab === 'general' && (
          <div className="bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
              <Globe className="text-blue-400" size={20} />
              Dil Ayarları
            </h2>
            <div className="flex flex-wrap items-center justify-between p-4 bg-slate-50 dark:bg-[#232F63] rounded-xl border border-slate-200 dark:border-slate-700/50">
              <div>
                <h3 className="text-slate-800 dark:text-slate-200 font-medium">Uygulama Dili</h3>
                <p className="text-slate-400 text-sm mt-1">Arayüzde kullanılacak dili seçin</p>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-white dark:bg-[#1E2B5C] border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="tr">🇹🇷 Türkçe</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>

            {isAdmin && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700/50">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                  <Code2 className="text-emerald-400" size={20} />
                  Geliştirici Ayarları
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Admin</span>
                </h2>
                <div className="flex flex-wrap items-center justify-between p-4 bg-slate-50 dark:bg-[#232F63] rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <div>
                    <h3 className="text-slate-800 dark:text-slate-200 font-medium">Dev Mode</h3>
                    <p className="text-slate-400 text-sm mt-1">
                      Açıkken arayüz canlı Vite sunucusundan (127.0.0.1:5173), kapalıyken derlenmiş sabit sürümden yüklenir.
                    </p>
                    {devModeSaved && (
                      <p className="text-emerald-400 text-xs mt-2">Kaydedildi - değişiklik için uygulamayı yeniden başlatın.</p>
                    )}
                  </div>
                  <button
                    onClick={handleToggleDevMode}
                    className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${devMode ? 'bg-blue-600' : 'bg-slate-600'}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${devMode ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- DATABASE TAB --- */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            {!showDbForm ? (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Uzak Veritabanı Bağlantıları</h2>
                    <p className="text-slate-400 text-sm">PostgreSQL, MySQL ve SQL Server sunucularınızı yönetin.</p>
                  </div>
                  <button 
                    onClick={() => handleOpenDbForm()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium text-sm"
                  >
                    <Plus size={16} /> Yeni Bağlantı
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {connections.map(conn => {
                    const cfg = dbTypeConfig[conn.db_type] || dbTypeConfig.postgresql;
                    return (
                      <div key={conn.id} className="bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 flex gap-5 hover:border-slate-500 transition-colors group relative overflow-hidden">
                        {conn.active && (
                          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                            Aktif
                          </div>
                        )}
                        
                        <div className={`w-14 h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center text-3xl shrink-0`}>
                          {cfg.icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-slate-800 dark:text-slate-200 font-semibold truncate text-lg">{conn.name}</h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                              {cfg.label}
                            </span>
                          </div>
                          
                          <div className="text-sm text-slate-400 mt-2 space-y-1">
                            <p className="flex items-center gap-2"><Server size={14}/> {conn.host}:{conn.port}</p>
                            <p className="flex items-center gap-2"><DatabaseZap size={14}/> {conn.database}</p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 shrink-0 justify-center">
                          <button onClick={() => alert("Bağlantı test ediliyor...")} className="px-3 py-1.5 bg-slate-50 dark:bg-[#232F63] hover:bg-slate-100 dark:hover:bg-[#2E3F78] text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 transition-colors flex items-center gap-1.5">
                            <PlugZap size={14} /> Test
                          </button>
                          <div className="flex gap-2">
                            <button onClick={() => handleOpenDbForm(conn)} className="flex-1 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg flex justify-center items-center transition-colors">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteDb(conn.id)} className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex justify-center items-center transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              // DB FORM
              <div className="bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {editingDb ? 'Bağlantıyı Düzenle' : 'Yeni Bağlantı Ekle'}
                  </h2>
                  <button onClick={() => setShowDbForm(false)} className="text-slate-400 hover:text-slate-900 dark:text-white p-1">
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleSaveDb} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Bağlantı Adı</label>
                      <input type="text" required className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={dbFormData.name} onChange={e => setDbFormData({...dbFormData, name: e.target.value})} placeholder="├ûrn: Ana Veritabanı"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Veritabanı Türü</label>
                      <select className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={dbFormData.db_type} onChange={e => setDbFormData({...dbFormData, db_type: e.target.value})}>
                        <option value="postgresql">🐘 PostgreSQL</option>
                        <option value="mysql">🐬 MySQL</option>
                        <option value="mssql">🗄️ SQL Server</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-[2fr_1fr] gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Sunucu (Host)</label>
                      <input type="text" required className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={dbFormData.host} onChange={e => setDbFormData({...dbFormData, host: e.target.value})} placeholder="localhost"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Port</label>
                      <input type="number" required className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={dbFormData.port} onChange={e => setDbFormData({...dbFormData, port: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Veritabanı Adı (Database)</label>
                    <input type="text" required className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={dbFormData.database} onChange={e => setDbFormData({...dbFormData, database: e.target.value})} placeholder="remalab_db"/>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Kullanıcı Adı</label>
                      <input type="text" required className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={dbFormData.username} onChange={e => setDbFormData({...dbFormData, username: e.target.value})} placeholder="postgres"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">┼Şifre</label>
                      <input type="password" required className="w-full bg-slate-50 dark:bg-[#232F63] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={dbFormData.password} onChange={e => setDbFormData({...dbFormData, password: e.target.value})} placeholder="ÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇóÔÇó"/>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                    <button type="button" onClick={() => setShowDbForm(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-[#232F63] hover:bg-slate-100 dark:hover:bg-[#2E3F78] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">─░ptal</button>
                    <button type="button" onClick={() => alert("Test Ediliyor...")} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-900/20 flex items-center gap-2"><PlugZap size={18}/> Test Et</button>
                    <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* --- LOCAL DB TAB --- */}
        {activeTab === 'local' && (
          <div className="space-y-8">
            
            {/* Local DB Files */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"><HardDrive size={20} className="text-purple-400"/> Lokal Veritabanları</h2>
                  <p className="text-slate-400 text-sm mt-1">SQLite veritabanı veya SQL betik dosyalarını yönetin.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => { const res = await api.addLocalFile(); if(res.success) fetchLocalData(); else if(res.message !== "Seçim iptal edildi") alert(res.message); }} className="flex items-center gap-2 bg-slate-50 dark:bg-[#232F63] hover:bg-slate-100 dark:hover:bg-[#2E3F78] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-4 py-2 rounded-xl transition-all font-medium text-sm">
                    Var Olanı Ekle
                  </button>
                  <button onClick={async () => { const res = await api.createLocalFile(); if(res.success) fetchLocalData(); else if(res.message !== "─░şlem iptal edildi") alert(res.message); }} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-900/20 font-medium text-sm">
                    <Plus size={16} /> Yeni Oluştur
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {localFiles.map(file => (
                  <div key={file.id} className="bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 flex gap-4 hover:border-slate-500 transition-colors">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${file.type === 'sql' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
                      {file.type === 'sql' ? '­şô£' : '­şùä´©Å'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-slate-800 dark:text-slate-200 font-semibold truncate text-base">{file.name}</h3>
                      <p className="text-slate-500 text-xs truncate mb-2">­şôé {file.path}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {file.size && <span className="flex items-center gap-1"><HardDrive size={12}/> {file.size}</span>}
                        {(file.tables !== undefined) && <span>­şôï {file.tables} Tablo</span>}
                        {(file.records !== undefined) && <span>­şôØ {file.records.toLocaleString()} Kayıt</span>}
                        {file.modified && <span>­şòÉ {file.modified}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 justify-center">
                      <button onClick={async () => { const res = await api.openLocalFolder(file.path); if(!res.success) alert(res.message); }} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors" title="Klasörü Aç"><FolderOpen size={16} /></button>
                      <button onClick={async () => { if(window.confirm('Bu veritabanını listeden kaldırmak istiyor musunuz?')) { await api.deleteLocalFile(file.id); fetchLocalData(); } }} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Kaldır"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-700/50 w-full" />

            {/* Data Folders */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"><FolderOpen size={20} className="text-orange-400"/> Veri Klasörleri</h2>
                  <p className="text-slate-400 text-sm mt-1">Yedekleme veya dışa aktarım klasörlerini buradan yönetin.</p>
                </div>
                <button onClick={async () => { const res = await api.addDataFolder(); if(res.success) fetchLocalData(); else if(res.message !== "Seçim iptal edildi") alert(res.message); }} className="flex items-center gap-2 bg-slate-50 dark:bg-[#232F63] hover:bg-slate-100 dark:hover:bg-[#2E3F78] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-4 py-2 rounded-xl transition-all font-medium text-sm">
                  <Plus size={16} /> Klasör Ekle
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dataFolders.map(folder => {
                  const isBackup = folder.type === 'backup';
                  return (
                    <div key={folder.id} className="bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex gap-4 hover:border-slate-500 transition-colors items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${isBackup ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {isBackup ? '­şÆ╝' : '­şôü'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-slate-800 dark:text-slate-200 font-semibold truncate text-sm">{folder.name}</h3>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBackup ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'}`}>
                            {isBackup ? 'YEDEK' : 'VER─░'}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs truncate">{folder.path}</p>
                      </div>
                      <button onClick={async () => { if(window.confirm('Bu klasörü listeden kaldırmak istiyor musunuz?')) { await api.deleteDataFolder(folder.id); fetchLocalData(); } }} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors shrink-0" title="Kaldır">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}


      </div>

    </div>
  );
}
