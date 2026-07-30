import { useState, useEffect, useMemo } from 'react';
import { Tags, Plus, Trash2, Edit, X, Save, Search } from 'lucide-react';
import { api } from '../services/api';

const PART_TYPES = [
  'Ekran', 'Batarya', 'Kasa', 'Anakart', 'Kamera', 'Şarj Soketi', 'Hoparlör', 'Mikrofon',
  'Ön Cam', 'Arka Cam', 'Buton', 'Titreşim Motoru', 'Sim Tepsi', 'Flex Kablo',
  'Kılıf', 'Ekran Koruyucu', 'Şarj Aleti', 'Kablo', 'Kulaklık', 'Ambalaj',
  'Hammadde', 'Yarı Mamül', 'OCA Film', 'Polarizer', 'Çerçeve', 'Lens',
  'Test Cihazı', 'Kalibrasyon Malzemesi', 'Ölçüm Aleti', 'Numune'
];

const EMPTY_FORM = {
  name: '', part_type: '', flow: [], departments: [], stock_tracking_type: 'Stok Takipli',
  is_active: true, description: ''
};

export default function PartCategories() {
  const [categories, setCategories] = useState([]);
  const [dynamicPartTypes, setDynamicPartTypes] = useState(PART_TYPES);
  const [locations, setLocations] = useState([]);
  const [systemLocations, setSystemLocations] = useState([]);
  const [departmentList, setDepartmentList] = useState([]);
  const [flowValues, setFlowValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchCategories = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await api.getPartCategories();
    if (res.success) setCategories(res.categories || []);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
    api.getLocations().then(res => { if (res.success) setLocations(res.locations || []); });
    api.getSystemLocations().then(res => { if (res.success) setSystemLocations(res.locations || []); });
    api.getMissions('Üretim').then(res => {
      if (res.success && (res.missions || []).length > 0) {
        setDepartmentList(res.missions.map(m => m.code));
      }
    });
    api.getFlowValues().then(res => { if (res.success) setFlowValues(res.flows || []); });
    const interval = setInterval(() => fetchCategories(true), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const uniqueTypes = Array.from(new Set([
      ...PART_TYPES, 
      ...categories.map(c => c.name).filter(Boolean)
    ]));
    setDynamicPartTypes(uniqueTypes);
  }, [categories]);

  const getSystemLocationId = (kind) => {
    const loc = systemLocations.find(l => l.kind === kind);
    return loc ? String(loc.id) : '';
  };

  const handleOpenForm = (cat = null) => {
    if (cat) {
      setEditingCat(cat);
      setFormData({
        name: cat.name || '',
        part_type: cat.part_type || '',
        flow: cat.flow ? cat.flow.split(',').map(f => f.trim()).filter(Boolean) : [],
        departments: cat.departments ? cat.departments.split(',').map(d => d.trim()).filter(Boolean) : [],
        stock_tracking_type: cat.stock_tracking_type || 'Stok Takipli',
        is_active: cat.is_active !== false,
        description: cat.description || ''
      });
    } else {
      setEditingCat(null);
      setFormData(EMPTY_FORM);
    }
    setShowForm(true);
  };

  const toggleDepartment = (dept) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter(d => d !== dept)
        : [...prev.departments, dept]
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.flow || formData.flow.length === 0) {
      alert('En az bir Flow seçiniz.');
      return;
    }
    const payload = { 
      ...formData, 
      departments: formData.departments.join(','),
      flow: formData.flow.join(',') 
    };
    const res = editingCat
      ? await api.updatePartCategory(editingCat.id, payload)
      : await api.createPartCategory(payload);
    if (res.success) {
      setShowForm(false);
      fetchCategories();
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu Parça Kategorisini silmek istediğinize emin misiniz?')) {
      const res = await api.deletePartCategory(id);
      if (res.success) {
        fetchCategories();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  const filteredCategories = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return categories.filter(c =>
      (c.name && c.name.toLowerCase().includes(q))
    );
  }, [categories, searchTerm]);

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#0F172A] dark:text-[#FAFAFA] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F1F5F9] dark:from-[#050A18] via-[#E2E9F5] dark:via-[#0F172A] to-[#FFFFFF] dark:to-[#1E293B] p-6 sm:p-8 text-[#0D1B3E] dark:text-white shadow-xl border border-[#E2E8F0] dark:border-[#1E293B]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide">
              <Tags size={13} className="text-indigo-400" /> ENVANTER VE PARÇA KATEGORİLERİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D1B3E] dark:text-white">
              Parça Kategorileri
            </h1>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Departman yetkileri, stok takip kuralları ve varsayılan parça parametrelerini yapılandırın.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        {!showForm ? (
          <>
            {/* SEARCH & NEW BTN */}
            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#1E293B] shadow-md flex items-center justify-between gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B] dark:text-[#94A3B8]">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  className="w-full bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#2563EB] transition-all shadow-xs"
                  placeholder="Kategori Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#0D1B3E] dark:text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
              >
                <Plus size={16} /> Yeni Kategori
              </button>
            </div>

            {/* TABLE */}
            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl shadow-md overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-[#F8FAFC] dark:bg-[#162032] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-10 select-none">
                    <tr>
                      <th className="px-6 py-4">Kategori Adı</th>
                      <th className="px-6 py-4">Parça Tipi</th>
                      <th className="px-6 py-4">Flow</th>
                      <th className="px-6 py-4">Departmanlar</th>
                      <th className="px-6 py-4">İşçilik Seviyesi</th>
                      <th className="px-6 py-4">Ön Fiyat Verebilir</th>
                      <th className="px-6 py-4">Stok Takibi</th>
                      <th className="px-6 py-4">Durum</th>
                      <th className="px-6 py-4 text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                      </tr>
                    ) : filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                      </tr>
                    ) : (
                      filteredCategories.map(cat => (
                        <tr key={cat.id} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                          <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{cat.name}</td>
                          <td className="px-6 py-4">
                            {cat.part_type ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">{cat.part_type}</span>
                            ) : <span className="text-slate-500">-</span>}
                          </td>
                          <td className="px-6 py-4">
                            {cat.flow ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-500/10 text-amber-400 border-amber-500/20">{cat.flow}</span>
                            ) : <span className="text-slate-500">-</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {cat.departments ? cat.departments.split(',').map(d => d.trim()).filter(Boolean).map((d, i) => (
                                <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-500/10 text-purple-400 border-purple-500/20">{d}</span>
                              )) : <span className="text-slate-500">-</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {cat.labour_level ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{cat.labour_level}</span>
                            ) : <span className="text-slate-500">-</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                              cat.can_pre_price
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                              {cat.can_pre_price ? 'Evet' : 'Hayır'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                              cat.stock_tracking_type === 'Stok Takipsiz'
                                ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                : 'bg-green-500/10 text-green-400 border-green-500/20'
                            }`}>
                              {cat.stock_tracking_type === 'Stok Takipsiz' ? 'Hayır' : 'Evet'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                              cat.is_active === false
                                ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                : 'bg-green-500/10 text-green-400 border-green-500/20'
                            }`}>
                              {cat.is_active === false ? 'Pasif' : 'Aktif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-3">
                              <button onClick={() => handleOpenForm(cat)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Düzenle">
                                <Edit size={16} />
                              </button>
                              <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
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
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {editingCat ? 'Kategoriyi Düzenle' : 'Yeni Parça Kategorisi Ekle'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-900 dark:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 gap-5">
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Parça Kategorisi Adı <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    list="part-types-list"
                    required
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Örn: Ekran, Batarya..."
                  />
                  <datalist id="part-types-list">
                    {dynamicPartTypes.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Flow Seçimleri <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {flowValues.map(f => (
                    <label key={f} className="flex items-center gap-2 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-500 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800"
                        checked={formData.flow.includes(f)}
                        onChange={(e) => {
                          const newFlows = e.target.checked
                            ? [...formData.flow, f]
                            : formData.flow.filter(x => x !== f);
                          setFormData({ ...formData, flow: newFlows });
                        }}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{f}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Kullanabilecek Departmanlar</label>
                <div className="grid grid-cols-2 gap-2">
                  {departmentList.map(dept => (
                    <label key={dept} className="flex items-center gap-2 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-500 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.departments.includes(dept)}
                        onChange={() => toggleDepartment(dept)}
                        className="accent-blue-600"
                      />
                      <span className="text-slate-800 dark:text-slate-200 text-sm">{dept}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Stok Takibi</label>
                <select
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.stock_tracking_type}
                  onChange={e => setFormData({...formData, stock_tracking_type: e.target.value})}
                >
                  <option value="Stok Takipli">Evet</option>
                  <option value="Stok Takipsiz">Hayır</option>
                </select>
              </div>

              {editingCat && (
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#242a38] rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <div>
                    <h3 className="text-slate-800 dark:text-slate-200 font-medium text-sm">Durum</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Pasif kategoriler Parçalar ekranındaki seçim listesinde görünmez.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, is_active: !prev.is_active}))}
                    className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${formData.is_active ? 'bg-blue-600' : 'bg-slate-600'}`}
                  >
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-[#0D1B3E] dark:text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
