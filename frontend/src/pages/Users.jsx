import { useState, useEffect, useMemo } from 'react';
import { Download, Search, Plus, Edit, Key, Trash2, RefreshCw, AlertCircle, X, Users as UsersIcon, Mail, Shield } from 'lucide-react';
import { api } from '../services/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'password'
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'Teknisyen' });

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getUsers();
      if (res && res.success) {
        const sortedUsers = (res.users || []).sort((a, b) => {
          const nameA = a.username || '';
          const nameB = b.username || '';
          return nameA.localeCompare(nameB, 'tr');
        });
        setUsers(sortedUsers);
        setError('');
      } else {
        setError(res ? res.message : 'Hata');
      }
    } catch (err) {
      setError('Bağlantı hatası.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(() => fetchUsers(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const openModal = (mode) => {
    setModalMode(mode);
    if (mode === 'add') {
      setFormData({ username: '', email: '', password: '', role: 'Teknisyen' });
    } else {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        setFormData({ username: u.username, email: u.email, password: '', role: u.role });
      }
    }
    setIsModalOpen(true);
  };

  const handleAdd = () => openModal('add');
  
  const handleEdit = () => {
    if (!selectedUserId) return alert("Lütfen bir kullanıcı seçin.");
    openModal('edit');
  };

  const handleResetPassword = () => {
    if (!selectedUserId) return alert("Lütfen bir kullanıcı seçin.");
    openModal('password');
  };

  const handleDelete = async () => {
    if (!selectedUserId) return alert("Lütfen bir kullanıcı seçin.");
    if (window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) {
      const res = await api.deleteUser(selectedUserId);
      if (res && res.success) {
        setSelectedUserId(null);
        fetchUsers();
      } else {
        alert(res ? res.message : "Hata");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (modalMode === 'add') {
        res = await api.createUser(formData);
      } else {
        // Edit or Password update uses updateUser API with conditional password payload
        res = await api.updateUser(selectedUserId, formData);
      }

      if (res && res.success) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        alert(res ? res.message : "Hata oluştu");
      }
    } catch (err) {
      alert("İşlem başarısız.");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.role && u.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(u.id).includes(searchTerm)
    );
  }, [users, searchTerm]);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1e2330] p-6 rounded-2xl border border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            <UsersIcon className="text-blue-400" size={28}/> Kullanıcılar
          </h1>
          <p className="text-slate-400 mt-1">Sistem erişimini, kullanıcı rollerini ve şifrelerini yönetin</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-500/20 shrink-0">
          <AlertCircle size={20} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Kullanıcı Ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1e2330] border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-200 text-sm shadow-sm"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={() => api.exportTableToExcel(users, "kullanicilar.xlsx")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors">
            <Download size={16} /> Excel
          </button>
          <button onClick={handleAdd} className="flex items-center gap-2 bg-[#242a38] hover:bg-[#2a3142] border border-slate-600 text-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors">
            <Plus size={16} className="text-green-400" /> Ekle
          </button>
          <button onClick={handleEdit} disabled={!selectedUserId} className="flex items-center gap-2 bg-[#242a38] hover:bg-[#2a3142] border border-slate-600 text-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Edit size={16} className="text-blue-400" /> Düzenle
          </button>
          <button onClick={handleResetPassword} disabled={!selectedUserId} className="flex items-center gap-2 bg-[#242a38] hover:bg-[#2a3142] border border-slate-600 text-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Key size={16} className="text-yellow-400" /> Şifre
          </button>
          <button onClick={handleDelete} disabled={!selectedUserId} className="flex items-center gap-2 bg-[#242a38] hover:bg-red-500/10 border border-slate-600 hover:border-red-500/30 text-slate-200 hover:text-red-400 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Trash2 size={16} className={selectedUserId ? "text-red-400" : ""} /> Sil
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e2330] border border-slate-700/50 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#242a38] text-slate-400 font-medium border-b border-slate-700/50 sticky top-0 uppercase text-xs z-10">
              <tr>
                <th className="px-6 py-4 w-16">ID</th>
                <th className="px-6 py-4">KULLANICI ADI</th>
                <th className="px-6 py-4">E-POSTA</th>
                <th className="px-6 py-4">ROL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
                    <span className="font-medium">Yükleniyor...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    onClick={() => setSelectedUserId(user.id)}
                    className={`transition-colors cursor-pointer text-slate-300
                      ${selectedUserId === user.id ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-[#2a3142] border-l-2 border-transparent'}`}
                  >
                    <td className="px-6 py-4 font-mono text-slate-400">{user.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-200 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700 uppercase">
                        {user.username.charAt(0)}
                      </div>
                      {user.username}
                    </td>
                    <td className="px-6 py-4 text-slate-400">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold
                        ${user.role === 'Admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 
                          user.role === 'Depo Müdürü' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'}
                      `}>
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit/Password Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0f1219]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2330] border border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-[#242a38]">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {modalMode === 'add' ? <><Plus size={20} className="text-green-400"/> Yeni Kullanıcı</> : 
                 modalMode === 'password' ? <><Key size={20} className="text-yellow-400"/> Şifre Sıfırla</> : 
                 <><Edit size={20} className="text-blue-400"/> Kullanıcı Düzenle</>}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-[#1e2330] p-1.5 rounded-lg border border-slate-700">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* Only show username/email/role for Add/Edit */}
              {modalMode !== 'password' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                      <UsersIcon size={14}/> Kullanıcı Adı
                    </label>
                    <input 
                      type="text" required 
                      className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500" 
                      value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} 
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                      <Mail size={14}/> E-posta
                    </label>
                    <input 
                      type="email" required 
                      className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500" 
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                      <Shield size={14}/> Rol
                    </label>
                    <select 
                      className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500" 
                      value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Depo Müdürü">Depo Müdürü</option>
                      <option value="Depo">Depo</option>
                      <option value="Teknisyen">Teknisyen</option>
                    </select>
                  </div>
                </>
              )}

              {/* Only show password for Add/Password modes */}
              {(modalMode === 'add' || modalMode === 'password') && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Key size={14}/> {modalMode === 'add' ? 'Şifre' : 'Yeni Şifre'}
                  </label>
                  <input 
                    type="password" required 
                    className="w-full bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500" 
                    value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-700/50 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-[#242a38] hover:bg-[#2a3142] text-slate-300 rounded-xl font-medium transition-colors border border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
