import { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Edit, X, Save } from 'lucide-react';
import { api } from '../services/api';

const DEPARTMENT_NAMES = [
  'TEC_BATTERY',
  'TEC_CAMERA',
  'TEC_CASE',
  'TEC_DISPLAY',
  'TEC_L1REPAIR',
  'TEC_L2REPAIR',
  'TEC_L3REPAIR'
];
const DEPARTMENT_CODES = {
  'TEC_BATTERY': 'BAT',
  'TEC_CAMERA': 'CAM',
  'TEC_CASE': 'CAS',
  'TEC_DISPLAY': 'DISP',
  'TEC_L1REPAIR': 'L1',
  'TEC_L2REPAIR': 'L2',
  'TEC_L3REPAIR': 'L3'
};

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptFormData, setDeptFormData] = useState({ name: '', code: '', responsible: '', default_location_id: '', status: 'Aktif' });

  const fetchDepartments = async () => {
    const res = await api.getDepartments();
    if (res.success) setDepartments(res.departments || []);
  };

  useEffect(() => {
    fetchDepartments();
    api.getLocations().then(res => { if (res.success) setLocations(res.locations || []); });
  }, []);

  const handleOpenDeptForm = (dept = null) => {
    if (dept) {
      setEditingDept(dept);
      setDeptFormData({
        name: dept.name || '',
        code: dept.code || '',
        responsible: dept.responsible || '',
        default_location_id: dept.default_location_id || '',
        status: dept.status || 'Aktif'
      });
    } else {
      setEditingDept(null);
      setDeptFormData({ name: '', code: '', responsible: '', default_location_id: '', status: 'Aktif' });
    }
    setShowDeptForm(true);
  };

  const handleDeptNameChange = (value) => {
    const mappedCode = DEPARTMENT_CODES[value.trim()];
    setDeptFormData(prev => ({
      ...prev,
      name: value,
      code: mappedCode || prev.code
    }));
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    const res = editingDept
      ? await api.updateDepartment(editingDept.id, deptFormData)
      : await api.createDepartment(deptFormData);
    if (res.success) {
      setShowDeptForm(false);
      fetchDepartments();
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDeleteDept = async (id) => {
    if (window.confirm('Bu departmanı silmek istediğinize emin misiniz?')) {
      const res = await api.deleteDepartment(id);
      if (res.success) {
        fetchDepartments();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Building2 className="text-blue-400" size={24} /> Departman Yönetimi
        </h1>
        <p className="text-slate-400 mt-1">Departmanları, sorumlularını ve varsayılan lokasyonlarını yönetin.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
        {!showDeptForm ? (
          <>
            <div className="flex justify-end items-center">
              <button
                onClick={() => handleOpenDeptForm()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium text-sm"
              >
                <Plus size={16} /> Yeni Departman
              </button>
            </div>

            <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">Departman</th>
                    <th className="px-6 py-4">Kod</th>
                    <th className="px-6 py-4">Sorumlu</th>
                    <th className="px-6 py-4">Varsayılan Lokasyon</th>
                    <th className="px-6 py-4">Durum</th>
                    <th className="px-6 py-4 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                    </tr>
                  ) : (
                    departments.map(dept => (
                      <tr key={dept.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{dept.name}</td>
                        <td className="px-6 py-4 font-mono text-slate-400">{dept.code}</td>
                        <td className="px-6 py-4">{dept.responsible}</td>
                        <td className="px-6 py-4">{dept.default_location_name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                            dept.status === 'Pasif'
                              ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              : 'bg-green-500/10 text-green-400 border-green-500/20'
                          }`}>
                            {dept.status || 'Aktif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button onClick={() => handleOpenDeptForm(dept)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Düzenle">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteDept(dept.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {editingDept ? 'Departmanı Düzenle' : 'Yeni Departman Ekle'}
              </h2>
              <button onClick={() => setShowDeptForm(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Departman <span className="text-red-400">*</span></label>
                  <input
                    type="text" required
                    list="department-names-list"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={deptFormData.name}
                    onChange={e => handleDeptNameChange(e.target.value)}
                    placeholder="Örn: Teknik Servis"
                  />
                  <datalist id="department-names-list">
                    {DEPARTMENT_NAMES.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Kod</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={deptFormData.code}
                    onChange={e => setDeptFormData({...deptFormData, code: e.target.value})}
                    placeholder="Örn: TS"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Sorumlu</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={deptFormData.responsible}
                  onChange={e => setDeptFormData({...deptFormData, responsible: e.target.value})}
                  placeholder="Departman sorumlusunun adı"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Varsayılan Lokasyon</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={deptFormData.default_location_id}
                    onChange={e => setDeptFormData({...deptFormData, default_location_id: e.target.value})}
                  >
                    <option value="">Seçilmedi</option>
                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Durum</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={deptFormData.status}
                    onChange={e => setDeptFormData({...deptFormData, status: e.target.value})}
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Pasif">Pasif</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                <button type="button" onClick={() => setShowDeptForm(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
