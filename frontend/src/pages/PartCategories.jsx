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

const DEPARTMENTS = [
  'TEC_BATTERY',
  'TEC_CAMERA',
  'TEC_CASE',
  'TEC_DISPLAY',
  'TEC_L1REPAIR',
  'TEC_L2REPAIR',
  'TEC_L3REPAIR'
];

// Backend'deki CUSTOMER_FLOW_VALUES (core/web_bridge.py) ile birebir aynı olmalı.
const FLOW_VALUES = ['Refurbish', 'Repair', 'RMA', 'Battery Replacement'];

const EMPTY_FORM = {
  name: '', part_type: '', flow: '', departments: [], stock_tracking_type: 'Stok Takipli',
  is_active: true, description: ''
};

export default function PartCategories() {
  const [categories, setCategories] = useState([]);
  const [dynamicPartTypes, setDynamicPartTypes] = useState(PART_TYPES);
  const [locations, setLocations] = useState([]);
  const [systemLocations, setSystemLocations] = useState([]);
  const [departmentList, setDepartmentList] = useState(DEPARTMENTS);
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
    api.getDepartments().then(res => {
      if (res.success && (res.departments || []).length > 0) {
        setDepartmentList(res.departments.map(d => d.name));
      }
    });
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
        flow: cat.flow || '',
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
    if (!formData.flow) {
      alert('Flow seçiniz.');
      return;
    }
    const payload = { ...formData };
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
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Tags className="text-blue-400" size={24} /> Parça Kategorileri
        </h1>
        <p className="text-slate-400 mt-1">
          Kullanabilecek departmanlar ve stok takibi kurallarını tek bir yerden yönetin —
          parça kaydederken sadece kategori seçilir, bu bilgiler otomatik gelir.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
        {!showForm ? (
          <>
            <div className="flex justify-between items-center gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="text-slate-400" size={18} />
                </div>
                <input
                  type="text"
                  className="w-full bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 shadow-sm"
                  placeholder="Kategori Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium text-sm shrink-0"
              >
                <Plus size={16} /> Yeni Kategori
              </button>
            </div>

            <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="overflow-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4">Kategori Adı</th>
                      <th className="px-6 py-4">Parça Tipi</th>
                      <th className="px-6 py-4">Flow</th>
                      <th className="px-6 py-4">Departmanlar</th>
                      <th className="px-6 py-4">Stok Takibi</th>
                      <th className="px-6 py-4">Durum</th>
                      <th className="px-6 py-4 text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                      </tr>
                    ) : filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
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
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Flow <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  value={formData.flow}
                  onChange={e => setFormData({...formData, flow: e.target.value})}
                >
                  <option value="">Seçiniz...</option>
                  {FLOW_VALUES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
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
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
