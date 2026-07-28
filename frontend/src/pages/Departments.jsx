import { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Edit, X, Save } from 'lucide-react';
import { api } from '../services/api';

// Gerçek verideki (organization.missions) department değerleri.
const DEPARTMENT_VALUES = ['Üretim', 'Yönetim', 'Operasyon', 'Finans', 'İnsan Kaynakları', 'Lojistik', 'Depo'];

const EMPTY_FORM = {
  code: '', short_name: '', full_name: '', description: '', cost_center: '',
  department: '', order_number: '', mission_group_code: '', mission_workgroup_code: '',
  team_leader_mission_code: '', operation_manager_mission_code: '', administrative_manager_mission_code: ''
};

export default function Departments() {
  const [missions, setMissions] = useState([]);
  const [missionGroups, setMissionGroups] = useState([]);
  const [missionWorkgroups, setMissionWorkgroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchMissions = async () => {
    const res = await api.getMissions();
    if (res.success) setMissions(res.missions || []);
  };

  useEffect(() => {
    fetchMissions();
    api.getMissionGroups().then(res => { if (res.success) setMissionGroups(res.mission_groups || []); });
    api.getMissionWorkgroups().then(res => { if (res.success) setMissionWorkgroups(res.mission_workgroups || []); });
  }, []);

  const handleOpenForm = (mission = null) => {
    if (mission) {
      setEditingMission(mission);
      setFormData({
        code: mission.code || '',
        short_name: mission.short_name || '',
        full_name: mission.full_name || '',
        description: mission.description || '',
        cost_center: mission.cost_center || '',
        department: mission.department || '',
        order_number: mission.order_number != null ? String(mission.order_number) : '',
        mission_group_code: mission.mission_group_code || '',
        mission_workgroup_code: mission.mission_workgroup_code || '',
        team_leader_mission_code: mission.team_leader_mission_code || '',
        operation_manager_mission_code: mission.operation_manager_mission_code || '',
        administrative_manager_mission_code: mission.administrative_manager_mission_code || ''
      });
    } else {
      setEditingMission(null);
      setFormData(EMPTY_FORM);
    }
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const res = editingMission
      ? await api.updateMission(editingMission.id, formData)
      : await api.createMission(formData);
    if (res.success) {
      setShowForm(false);
      fetchMissions();
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (mission) => {
    if (window.confirm(`"${mission.short_name}" (${mission.code}) görevini silmek istediğinize emin misiniz?`)) {
      const res = await api.deleteMission(mission.id);
      if (res.success) {
        if (res.note) alert(res.note);
        fetchMissions();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  // Amir zinciri dropdown'larında düzenlenen kaydın kendisi hariç tutulur.
  const managerOptions = missions.filter(m => !editingMission || m.id !== editingMission.id);

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Building2 className="text-blue-400" size={24} /> Departman Yönetimi
        </h1>
        <p className="text-slate-400 mt-1">Görevleri/rolleri (MioCreate.xlsx → Mission), görev gruplarını, atölye/masa ve amir zincirini yönetin.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
        {!showForm ? (
          <>
            <div className="flex justify-end items-center">
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium text-sm"
              >
                <Plus size={16} /> Yeni Görev
              </button>
            </div>

            <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">Kod</th>
                    <th className="px-6 py-4">Kısa Ad</th>
                    <th className="px-6 py-4">Departman</th>
                    <th className="px-6 py-4">Görev Grubu</th>
                    <th className="px-6 py-4">Atölye/Masa</th>
                    <th className="px-6 py-4">Takım Lideri</th>
                    <th className="px-6 py-4">Operasyon Yön.</th>
                    <th className="px-6 py-4">İdari Yön.</th>
                    <th className="px-6 py-4 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {missions.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                    </tr>
                  ) : (
                    missions.map(m => (
                      <tr key={m.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                        <td className="px-6 py-4 font-mono text-slate-400">{m.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{m.short_name}</td>
                        <td className="px-6 py-4">{m.department}</td>
                        <td className="px-6 py-4">{m.mission_group_name || <span className="italic text-slate-400">-</span>}</td>
                        <td className="px-6 py-4">{m.mission_workgroup_name || <span className="italic text-slate-400">-</span>}</td>
                        <td className="px-6 py-4">{m.team_leader_name || <span className="italic text-slate-400">-</span>}</td>
                        <td className="px-6 py-4">{m.operation_manager_name || <span className="italic text-slate-400">-</span>}</td>
                        <td className="px-6 py-4">{m.administrative_manager_name || <span className="italic text-slate-400">-</span>}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button onClick={() => handleOpenForm(m)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Düzenle">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(m)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
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
                {editingMission ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Kod <span className="text-red-400">*</span></label>
                  <input
                    type="text" required
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Örn: TEC_BATTERY"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Kısa Ad <span className="text-red-400">*</span></label>
                  <input
                    type="text" required
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.short_name}
                    onChange={e => setFormData({ ...formData, short_name: e.target.value })}
                    placeholder="Örn: Batarya Teknisyeni"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Tam Ad</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Maliyet Merkezi</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.cost_center}
                    onChange={e => setFormData({ ...formData, cost_center: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Açıklama</label>
                <textarea
                  rows="2"
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Departman</label>
                  <input
                    type="text"
                    list="department-values-list"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Örn: Üretim"
                  />
                  <datalist id="department-values-list">
                    {DEPARTMENT_VALUES.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Sıra No</label>
                  <input
                    type="number" step="any"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.order_number}
                    onChange={e => setFormData({ ...formData, order_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Görev Grubu</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.mission_group_code}
                    onChange={e => setFormData({ ...formData, mission_group_code: e.target.value })}
                  >
                    <option value="">Seçilmedi</option>
                    {missionGroups.map(mg => <option key={mg.code} value={mg.code}>{mg.short_name} ({mg.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Atölye/Masa</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.mission_workgroup_code}
                    onChange={e => setFormData({ ...formData, mission_workgroup_code: e.target.value })}
                  >
                    <option value="">Seçilmedi</option>
                    {missionWorkgroups.map(mw => <option key={mw.code} value={mw.code}>{mw.short_name} ({mw.code})</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Takım Lideri</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.team_leader_mission_code}
                    onChange={e => setFormData({ ...formData, team_leader_mission_code: e.target.value })}
                  >
                    <option value="">Seçilmedi</option>
                    {managerOptions.map(m => <option key={m.id} value={m.code}>{m.short_name} ({m.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Operasyon Yöneticisi</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.operation_manager_mission_code}
                    onChange={e => setFormData({ ...formData, operation_manager_mission_code: e.target.value })}
                  >
                    <option value="">Seçilmedi</option>
                    {managerOptions.map(m => <option key={m.id} value={m.code}>{m.short_name} ({m.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">İdari Yönetici</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.administrative_manager_mission_code}
                    onChange={e => setFormData({ ...formData, administrative_manager_mission_code: e.target.value })}
                  >
                    <option value="">Seçilmedi</option>
                    {managerOptions.map(m => <option key={m.id} value={m.code}>{m.short_name} ({m.code})</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
