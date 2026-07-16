import { useState, useEffect, useMemo } from 'react';
import { Download, Search, Plus, Edit, Key, Trash2, RefreshCw, AlertCircle, X, Users as UsersIcon, Shield, User, Fingerprint } from 'lucide-react';
import { api } from '../services/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);

  // Modal State
  // Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState({
    "ID": true,
    "Kullanıcı Adı": true,
    "İsim Soyisim": true,
    "TC No": true,
    "Hesap Tipi": true,
    "Görevler": true,
    "Durum": true,
    "Team Leader": true,
    "Operation Manager": true,
    "Administrative Manager": true
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'password'
  const [formData, setFormData] = useState({ username: '', fullname: '', tc_no: '', password: '', role: 'Teknisyen', gorev: '', account_enabled: true, team_leader: '', operation_manager: '', administrative_manager: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomGorev, setIsCustomGorev] = useState(false);

  const [deletedRoles, setDeletedRoles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('deletedRoles')) || [];
    } catch(e) {
      return [];
    }
  });

  const [deletedGorevs, setDeletedGorevs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('deletedGorevs')) || [];
    } catch(e) {
      return [];
    }
  });

  const [isDeletingRole, setIsDeletingRole] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState('');
  const [isDeletingGorev, setIsDeletingGorev] = useState(false);
  const [gorevToDelete, setGorevToDelete] = useState('');
  const [tempCustomGorev, setTempCustomGorev] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'username', direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({
    id: '',
    username: '',
    fullname: '',
    tc_no: '',
    role: '',
    gorev: '',
    account_enabled: '',
    team_leader: '',
    operation_manager: '',
    administrative_manager: ''
  });

  const defaultRoles = useMemo(() => [
    'DEVELOPER',
    'LOG_P',
    'QAC',
    'STAFF',
    'TEC_CASE',
    'TEC_L3REPAIR',
    'TEC_TL_L3REPAIR',
    'Admin',
    'Depo Müdürü',
    'Depo',
    'Teknisyen'
  ], []);

  const defaultGorevs = useMemo(() => [
    'Batarya Tamiri',
    'Kamera Değişimi',
    'Kasa Onarımı',
    'Ekran Değişimi',
    'L1 Onarım',
    'L2 Onarım',
    'L3 Onarım',
    'Yazılım Geliştirici',
    'Depo Sorumlusu'
  ], []);

  const existingRoles = useMemo(() => {
    const list = Array.from(new Set([
      ...defaultRoles,
      ...users.map(u => u.role).filter(Boolean)
    ]));
    return list.filter(r => !deletedRoles.includes(r));
  }, [users, defaultRoles, deletedRoles]);

  const existingGorevs = useMemo(() => {
    const allGorevs = [];
    users.forEach(u => {
      if (u.gorev) {
        u.gorev.split(',').map(s => s.trim()).filter(Boolean).forEach(g => {
          allGorevs.push(g);
        });
      }
    });
    const list = Array.from(new Set([
      ...defaultGorevs,
      ...allGorevs
    ]));
    return list.filter(g => !deletedGorevs.includes(g));
  }, [users, defaultGorevs, deletedGorevs]);

  const teamLeaders = useMemo(() => {
    const tlMissions = [
      'QAC_TL',
      'TEC_TL_BATTERY',
      'TEC_TL_CAMERA',
      'TEC_TL_DISMANTLE',
      'TEC_TL_DISPLAY',
      'TEC_TL_CASE',
      'TEC_TL_L1REPAIR',
      'TEC_TL_L2REPAIR',
      'TEC_TL_L3REPAIR'
    ];
    return users.filter(u => {
      if (!u.gorev) return false;
      const userMissions = u.gorev.split(',').map(s => s.trim());
      return userMissions.some(m => tlMissions.includes(m));
    });
  }, [users]);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        } else {
          return { key: null, direction: null };
        }
      }
      return { key, direction: 'asc' };
    });
  };

  const handleAddMission = (missionName) => {
    if (!missionName) return;
    const currentList = formData.gorev ? formData.gorev.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!currentList.includes(missionName)) {
      const newList = [...currentList, missionName];
      setFormData({ ...formData, gorev: newList.join(', ') });
    }
  };

  const handleRemoveMission = (missionName) => {
    const currentList = formData.gorev ? formData.gorev.split(',').map(s => s.trim()).filter(Boolean) : [];
    const newList = currentList.filter(g => g !== missionName);
    setFormData({ ...formData, gorev: newList.join(', ') });
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return alert("Lütfen silinecek bir hesap tipi seçin.");
    if (window.confirm(`"${roleToDelete}" hesap tipini silmek istediğinize emin misiniz? Bu hesap tipine sahip kullanıcıların hesap tipi "Teknisyen" olarak değiştirilecektir.`)) {
      setLoading(true);
      try {
        const targetUsers = users.filter(u => u.role === roleToDelete);
        for (const u of targetUsers) {
          await api.updateUser(u.id, {
            username: u.username,
            tc_no: u.tc_no,
            role: 'Teknisyen',
            gorev: u.gorev,
            fullname: u.fullname,
            account_enabled: u.account_enabled,
            team_leader: u.team_leader,
            operation_manager: u.operation_manager,
            administrative_manager: u.administrative_manager
          });
        }
        const updatedDeleted = [...deletedRoles, roleToDelete];
        setDeletedRoles(updatedDeleted);
        localStorage.setItem('deletedRoles', JSON.stringify(updatedDeleted));
        setIsDeletingRole(false);
        setRoleToDelete('');
        setFormData(prev => ({ ...prev, role: 'Teknisyen' }));
        await fetchUsers();
        alert("Hesap tipi başarıyla silindi.");
      } catch(err) {
        alert("Hesap tipi silinirken hata oluştu.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteGorev = async () => {
    if (!gorevToDelete) return alert("Lütfen silinecek bir görev seçin.");
    if (window.confirm(`"${gorevToDelete}" görevini silmek istediğinize emin misiniz?`)) {
      setLoading(true);
      try {
        for (const u of users) {
          if (!u.gorev) continue;
          const list = u.gorev.split(',').map(s => s.trim()).filter(Boolean);
          if (list.includes(gorevToDelete)) {
            const newList = list.filter(g => g !== gorevToDelete);
            const newGorevStr = newList.join(', ');
            await api.updateUser(u.id, {
              username: u.username,
              tc_no: u.tc_no,
              role: u.role,
              gorev: newGorevStr,
              fullname: u.fullname,
              account_enabled: u.account_enabled,
              team_leader: u.team_leader,
              operation_manager: u.operation_manager,
              administrative_manager: u.administrative_manager
            });
          }
        }
        const updatedDeleted = [...deletedGorevs, gorevToDelete];
        setDeletedGorevs(updatedDeleted);
        localStorage.setItem('deletedGorevs', JSON.stringify(updatedDeleted));
        setIsDeletingGorev(false);
        setGorevToDelete('');
        setFormData(prev => ({ ...prev, gorev: '' }));
        await fetchUsers();
        alert("Görev başarıyla silindi.");
      } catch(err) {
        alert("Görev silinirken hata oluştu.");
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (stored) {
       try { setCurrentUser(JSON.parse(stored)); } catch(e) {}
    }
  }, []);

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
    setIsCustomRole(false);
    setIsCustomGorev(false);
    setIsDeletingRole(false);
    setRoleToDelete('');
    setIsDeletingGorev(false);
    setGorevToDelete('');
    setTempCustomGorev('');
    if (mode === 'add') {
      setFormData({ username: '', fullname: '', tc_no: '', password: '', role: 'Teknisyen', gorev: '', account_enabled: true, team_leader: '', operation_manager: '', administrative_manager: '' });
    } else {
      const u = users.find(x => x.id === selectedUserId);
      if (u) {
        setFormData({
          username: u.username,
          fullname: u.fullname || '',
          tc_no: u.tc_no || '',
          password: '',
          role: u.role,
          gorev: u.gorev || '',
          account_enabled: u.account_enabled !== undefined ? u.account_enabled : true,
          team_leader: u.team_leader || '',
          operation_manager: u.operation_manager || '',
          administrative_manager: u.administrative_manager || ''
        });
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
        const currentUserStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (currentUserStr && modalMode !== 'add') {
          try {
            const currentUser = JSON.parse(currentUserStr);
            if (String(currentUser.id) === String(selectedUserId)) {
              currentUser.username = formData.username;
              currentUser.role = formData.role;
              if (localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(currentUser));
              if (sessionStorage.getItem('user')) sessionStorage.setItem('user', JSON.stringify(currentUser));
              window.dispatchEvent(new Event('user:updated'));
            }
          } catch(e) {}
        }
        setIsModalOpen(false);
        fetchUsers();
      } else {
        alert(res ? res.message : "Hata oluştu");
      }
    } catch (err) {
      alert("İşlem başarısız.");
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === users.length && users.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(users.map(u => u.id));
    }
  };

  const toggleRowSelect = (id, e) => {
    e.stopPropagation();
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const executeExport = async () => {
    const dataToExport = selectedRows.length > 0 
      ? users.filter(u => selectedRows.includes(u.id))
      : users;

    if (dataToExport.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      setIsExportModalOpen(false);
      return;
    }

    const exportReadyData = dataToExport.map(u => {
      const row = {};
      if (selectedExportColumns["ID"]) row["ID"] = u.id;
      if (selectedExportColumns["Kullanıcı Adı"]) row["Kullanıcı Adı"] = u.username;
      if (selectedExportColumns["İsim Soyisim"]) row["İsim Soyisim"] = u.fullname;
      if (selectedExportColumns["TC No"]) row["TC No"] = u.tc_no;
      if (selectedExportColumns["Hesap Tipi"]) row["Hesap Tipi"] = u.role;
      if (selectedExportColumns["Görevler"]) row["Görevler"] = u.gorev || '';
      if (selectedExportColumns["Durum"]) row["Durum"] = u.account_enabled ? "Aktif" : "Pasif";
      if (selectedExportColumns["Team Leader"]) row["Team Leader"] = u.team_leader || '';
      if (selectedExportColumns["Operation Manager"]) row["Operation Manager"] = u.operation_manager || '';
      if (selectedExportColumns["Administrative Manager"]) row["Administrative Manager"] = u.administrative_manager || '';
      return row;
    });

    await api.exportTableToExcel(exportReadyData, 'kullanicilar.xlsx');
    setIsExportModalOpen(false);
  };

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      // 1. Global Arama Filtresi
      const matchGlobal = !searchTerm ? true : (
        (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.fullname && u.fullname.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.tc_no && u.tc_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.role && u.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.gorev && u.gorev.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.team_leader && u.team_leader.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.operation_manager && u.operation_manager.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.administrative_manager && u.administrative_manager.toLowerCase().includes(searchTerm.toLowerCase())) ||
        String(u.id).includes(searchTerm)
      );
      if (!matchGlobal) return false;

      // 2. Sütun Bazlı Filtreler
      for (const [key, value] of Object.entries(columnFilters)) {
        if (!value) continue;
        const lowerVal = value.toLowerCase();
        if (key === 'id') {
          if (!String(u.id).includes(lowerVal)) return false;
        } else if (key === 'account_enabled') {
          const statusStr = u.account_enabled ? 'aktif' : 'pasif';
          if (statusStr !== lowerVal) return false;
        } else {
          const fieldVal = (u[key] || '').toString().toLowerCase();
          if (!fieldVal.includes(lowerVal)) return false;
        }
      }
      return true;
    });

    // 3. Sıralama Fonksiyonu
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === 'id') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortConfig.key === 'account_enabled') {
          valA = valA ? 1 : 0;
          valB = valB ? 1 : 0;
        } else {
          valA = (valA || '').toString().toLocaleLowerCase('tr-TR');
          valB = (valB || '').toString().toLocaleLowerCase('tr-TR');
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, searchTerm, columnFilters, sortConfig]);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
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
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 text-sm shadow-sm"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors">
            <Download size={16} /> {selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : 'Tümünü Dışa Aktar'}
          </button>
          <button onClick={handleAdd} className="flex items-center gap-2 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors">
            <Plus size={16} className="text-green-400" /> Ekle
          </button>
          <button onClick={handleEdit} disabled={!selectedUserId} className="flex items-center gap-2 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Edit size={16} className="text-blue-400" /> Düzenle
          </button>
          <button onClick={handleResetPassword} disabled={!selectedUserId} className="flex items-center gap-2 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Key size={16} className="text-yellow-400" /> Şifre
          </button>
          <button onClick={handleDelete} disabled={!selectedUserId} className="flex items-center gap-2 bg-slate-50 dark:bg-[#242a38] hover:bg-red-500/10 border border-slate-300 dark:border-slate-600 hover:border-red-500/30 text-slate-800 dark:text-slate-200 hover:text-red-400 px-4 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Trash2 size={16} className={selectedUserId ? "text-red-400" : ""} /> Sil
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700/50 sticky top-0 uppercase text-xs z-10">
              <tr>
                <th className="px-6 py-4 w-12 text-center select-none">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    checked={selectedRows.length === users.length && users.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 w-16 cursor-pointer select-none group" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1">
                    ID
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('username')}>
                  <div className="flex items-center gap-1">
                    KULLANICI ADI
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'username' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('fullname')}>
                  <div className="flex items-center gap-1">
                    İSİM SOYİSİM
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'fullname' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('tc_no')}>
                  <div className="flex items-center gap-1">
                    TC NO
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'tc_no' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('role')}>
                  <div className="flex items-center gap-1">
                    HESAP TİPİ
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'role' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('gorev')}>
                  <div className="flex items-center gap-1">
                    GÖREVLER
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'gorev' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('account_enabled')}>
                  <div className="flex items-center gap-1">
                    DURUM
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'account_enabled' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('team_leader')}>
                  <div className="flex items-center gap-1">
                    TEAM LEADER
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'team_leader' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('operation_manager')}>
                  <div className="flex items-center gap-1">
                    OPERATION MANAGER
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'operation_manager' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer select-none group" onClick={() => handleSort('administrative_manager')}>
                  <div className="flex items-center gap-1">
                    ADMINISTRATIVE MANAGER
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                      {sortConfig.key === 'administrative_manager' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
              </tr>
              {/* Filtre Satırı */}
              <tr className="bg-slate-100/50 dark:bg-[#1a1f2c] border-b border-slate-200 dark:border-slate-700/50">
                <td className="px-6 py-2"></td>
                
                {/* ID Filtresi */}
                <td className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filtre..."
                    className="w-16 px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.id}
                    onChange={e => setColumnFilters({ ...columnFilters, id: e.target.value })}
                  />
                </td>

                {/* Kullanıcı Adı Filtresi */}
                <td className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filtre..."
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.username}
                    onChange={e => setColumnFilters({ ...columnFilters, username: e.target.value })}
                  />
                </td>

                {/* İsim Soyisim Filtresi */}
                <td className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filtre..."
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.fullname}
                    onChange={e => setColumnFilters({ ...columnFilters, fullname: e.target.value })}
                  />
                </td>

                {/* TC No Filtresi */}
                <td className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filtre..."
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.tc_no}
                    onChange={e => setColumnFilters({ ...columnFilters, tc_no: e.target.value })}
                  />
                </td>

                {/* Hesap Tipi Filtresi */}
                <td className="px-6 py-2">
                  <select
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.role}
                    onChange={e => setColumnFilters({ ...columnFilters, role: e.target.value })}
                  >
                    <option value="">Hepsi</option>
                    {existingRoles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>

                {/* Görevler Filtresi */}
                <td className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filtre..."
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.gorev}
                    onChange={e => setColumnFilters({ ...columnFilters, gorev: e.target.value })}
                  />
                </td>

                {/* Durum Filtresi */}
                <td className="px-6 py-2">
                  <select
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.account_enabled}
                    onChange={e => setColumnFilters({ ...columnFilters, account_enabled: e.target.value })}
                  >
                    <option value="">Hepsi</option>
                    <option value="aktif">Aktif</option>
                    <option value="pasif">Pasif</option>
                  </select>
                </td>

                {/* Team Leader Filtresi */}
                <td className="px-6 py-2">
                  <select
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.team_leader}
                    onChange={e => setColumnFilters({ ...columnFilters, team_leader: e.target.value })}
                  >
                    <option value="">Hepsi</option>
                    {Array.from(new Set(users.map(u => u.team_leader).filter(Boolean))).map(tl => (
                      <option key={tl} value={tl}>{tl}</option>
                    ))}
                  </select>
                </td>

                {/* Operation Manager Filtresi */}
                <td className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filtre..."
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.operation_manager}
                    onChange={e => setColumnFilters({ ...columnFilters, operation_manager: e.target.value })}
                  />
                </td>

                {/* Administrative Manager Filtresi */}
                <td className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Filtre..."
                    className="w-full px-2 py-1 text-xs bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
                    value={columnFilters.administrative_manager}
                    onChange={e => setColumnFilters({ ...columnFilters, administrative_manager: e.target.value })}
                  />
                </td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
                    <span className="font-medium">Yükleniyor...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isChecked = selectedRows.includes(user.id);
                  return (
                  <tr 
                    key={user.id} 
                    onClick={() => setSelectedUserId(user.id)}
                    className={`transition-colors cursor-pointer text-slate-700 dark:text-slate-300
                      ${selectedUserId === user.id ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-slate-100 dark:hover:bg-[#2a3142] border-l-2 border-transparent'}
                      ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        checked={isChecked}
                        onChange={(e) => toggleRowSelect(user.id, e)}
                      />
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">{user.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-200 dark:border-slate-700 uppercase">
                        {user.username.charAt(0)}
                      </div>
                      {user.username}
                    </td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{user.fullname || '-'}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{user.tc_no || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold
                        ${user.role === 'Admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 
                          user.role === 'Depo Müdürü' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'}
                      `}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate" title={user.gorev}>
                      {user.gorev ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 text-xs font-semibold">
                          {user.gorev}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        user.account_enabled ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'
                      }`}>
                        {user.account_enabled ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{user.team_leader || '-'}</td>
                    <td className="px-6 py-4 text-slate-400">{user.operation_manager || '-'}</td>
                    <td className="px-6 py-4 text-slate-400">{user.administrative_manager || '-'}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit/Password Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-[#0f1219]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#242a38] shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {modalMode === 'add' ? <><Plus size={20} className="text-green-400"/> Yeni Kullanıcı</> : 
                 modalMode === 'password' ? <><Key size={20} className="text-yellow-400"/> Şifre Sıfırla</> : 
                 <><Edit size={20} className="text-blue-400"/> Kullanıcı Düzenle</>}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:text-white transition-colors bg-white dark:bg-[#1e2330] p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Only show username/email/role for Add/Edit */}
                {modalMode !== 'password' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <UsersIcon size={14}/> Kullanıcı Adı
                      </label>
                      <input 
                        type="text" required 
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" 
                        value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <User size={14}/> İsim Soyisim
                      </label>
                      <input 
                        type="text" required 
                        placeholder="Adı Soyadı"
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" 
                        value={formData.fullname} onChange={e => setFormData({...formData, fullname: e.target.value})} 
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Fingerprint size={14}/> TC Kimlik No
                      </label>
                      <input 
                        type="text" required 
                        maxLength={11}
                        pattern="[0-9]{11}"
                        title="TC Kimlik Numarası 11 haneli sayı olmalıdır."
                        placeholder="11 Haneli TC Kimlik No"
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" 
                        value={formData.tc_no} onChange={e => setFormData({...formData, tc_no: e.target.value.replace(/[^0-9]/g, '')})} 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Shield size={14}/> Hesap Tipi
                      </label>
                      {isDeletingRole ? (
                        <div className="space-y-2 p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                          <label className="text-xs font-semibold text-red-400">Silinecek Hesap Tipini Seçin</label>
                          <div className="flex gap-2">
                            <select
                              className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-red-500"
                              value={roleToDelete}
                              onChange={e => setRoleToDelete(e.target.value)}
                            >
                              <option value="">Seçin...</option>
                              {existingRoles.filter(r => r !== 'Admin' && r !== 'Teknisyen').map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={handleDeleteRole}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs transition-colors font-semibold"
                            >
                              Sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsDeletingRole(false)}
                              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition-colors"
                            >
                              İptal
                            </button>
                          </div>
                        </div>
                      ) : isCustomRole ? (
                        <div className="flex gap-2">
                          <input
                            type="text" required
                            placeholder="Yeni Hesap Tipi Yazın..."
                            className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            value={formData.role}
                            onChange={e => setFormData({...formData, role: e.target.value})}
                          />
                          <button
                            type="button"
                            onClick={() => { setIsCustomRole(false); setFormData({...formData, role: existingRoles[0] || 'Teknisyen'}); }}
                            className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition-colors"
                          >
                            Listeden Seç
                          </button>
                        </div>
                      ) : (
                        <select
                          className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          value={formData.role}
                          onChange={e => {
                            if (e.target.value === '__NEW__') {
                              setIsCustomRole(true);
                              setFormData({...formData, role: ''});
                            } else if (e.target.value === '__DELETE__') {
                              setIsDeletingRole(true);
                            } else {
                              setFormData({...formData, role: e.target.value});
                            }
                          }}
                          disabled={modalMode === 'edit' && currentUser && String(currentUser.id) === String(selectedUserId)}
                        >
                          {existingRoles.map(r => <option key={r} value={r}>{r}</option>)}
                          <option value="__NEW__">+ Yeni Hesap Tipi Tanımla...</option>
                          <option value="__DELETE__">🗑️ Hesap Tipi Sil...</option>
                        </select>
                      )}
                      {modalMode === 'edit' && currentUser && String(currentUser.id) === String(selectedUserId) && (
                        <p className="text-[10px] text-amber-500 mt-1">Kendi hesap tipinizi değiştiremezsiniz.</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Shield size={14}/> Görevler (Birden Fazla Seçebilirsiniz)
                      </label>
                      {isDeletingGorev ? (
                        <div className="space-y-2 p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                          <label className="text-xs font-semibold text-red-400">Silinecek Görevi Seçin</label>
                          <div className="flex gap-2">
                            <select
                              className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-red-500"
                              value={gorevToDelete}
                              onChange={e => setGorevToDelete(e.target.value)}
                            >
                              <option value="">Seçin...</option>
                              {existingGorevs.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={handleDeleteGorev}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs transition-colors font-semibold"
                            >
                              Sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsDeletingGorev(false)}
                              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition-colors"
                            >
                              İptal
                            </button>
                          </div>
                        </div>
                      ) : isCustomGorev ? (
                        <div className="flex gap-2">
                          <input
                            type="text" required
                            placeholder="Yeni Görev Yazın..."
                            className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            value={tempCustomGorev}
                            onChange={e => setTempCustomGorev(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (tempCustomGorev.trim()) {
                                handleAddMission(tempCustomGorev.trim());
                                setTempCustomGorev('');
                                setIsCustomGorev(false);
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs transition-colors font-semibold"
                          >
                            Ekle
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsCustomGorev(false); setTempCustomGorev(''); }}
                            className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition-colors"
                          >
                            İptal
                          </button>
                        </div>
                      ) : (
                        <select
                          className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                          value=""
                          onChange={e => {
                            if (e.target.value === '__NEW__') {
                              setIsCustomGorev(true);
                            } else if (e.target.value === '__DELETE__') {
                              setIsDeletingGorev(true);
                            } else if (e.target.value) {
                              handleAddMission(e.target.value);
                            }
                          }}
                        >
                          <option value="">Görev Seçin ve Ekleyin...</option>
                          {existingGorevs.filter(g => !(formData.gorev ? formData.gorev.split(',').map(s => s.trim()) : []).includes(g)).map(g => <option key={g} value={g}>{g}</option>)}
                          <option value="__NEW__">+ Yeni Görev Tanımla ve Ekle...</option>
                          <option value="__DELETE__">🗑️ Görev Sil...</option>
                        </select>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(formData.gorev ? formData.gorev.split(',').map(s => s.trim()).filter(Boolean) : []).map(m => (
                          <span key={m} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
                            {m}
                            <button
                              type="button"
                              onClick={() => handleRemoveMission(m)}
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center bg-blue-500/20 hover:bg-red-500/20 hover:text-red-400 text-blue-400 font-bold text-[10px] transition-colors ml-1"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {!(formData.gorev ? formData.gorev.split(',').map(s => s.trim()).filter(Boolean) : []).length && (
                          <span className="text-xs text-slate-500 italic">Seçili görev yok.</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <Shield size={14}/> Hesap Durumu
                      </label>
                      <select
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        value={formData.account_enabled}
                        onChange={e => setFormData({...formData, account_enabled: e.target.value === 'true'})}
                      >
                        <option value="true">Aktif</option>
                        <option value="false">Pasif</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <User size={14}/> Team Leader
                      </label>
                      <select
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        value={formData.team_leader}
                        onChange={e => setFormData({...formData, team_leader: e.target.value})}
                      >
                        <option value="">Lider Yok / Seçin...</option>
                        {teamLeaders.map(tl => (
                          <option key={tl.id} value={tl.fullname || tl.username}>
                            {tl.fullname ? `${tl.fullname} (${tl.username})` : tl.username}
                          </option>
                        ))}
                        {formData.team_leader && !teamLeaders.some(tl => (tl.fullname || tl.username) === formData.team_leader) && (
                          <option value={formData.team_leader}>{formData.team_leader}</option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <User size={14}/> Operation Manager
                      </label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        value={formData.operation_manager}
                        onChange={e => setFormData({...formData, operation_manager: e.target.value})}
                        placeholder="Operation Manager ismi..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                        <User size={14}/> Administrative Manager
                      </label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        value={formData.administrative_manager}
                        onChange={e => setFormData({...formData, administrative_manager: e.target.value})}
                        placeholder="Administrative Manager ismi..."
                      />
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
                      className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" 
                      value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 dark:bg-[#242a38] border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dışa Aktar Sütun Seçimi Modalı */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Sütun Seçimi</h2>
            <p className="text-sm text-slate-500 mb-4">Dışa aktarılacak Excel dosyasında hangi sütunların bulunmasını istediğinizi seçin.</p>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {Object.keys(selectedExportColumns).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedExportColumns[col]}
                    onChange={(e) => setSelectedExportColumns(prev => ({...prev, [col]: e.target.checked}))}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{col}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium"
              >
                İptal
              </button>
              <button 
                onClick={executeExport}
                disabled={!Object.values(selectedExportColumns).some(Boolean)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                Dışa Aktar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
