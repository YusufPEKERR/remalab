import { useState, useEffect } from 'react';
import { Wrench, Plus, Trash2, Edit, X, Save, User, Smartphone, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

const FAULT_TYPES_BY_CATEGORY = {
  'Ekran Arızası': ['Kırık Ekran', 'Görüntü Sorunu (Leke/Çizgi)', 'Dokunmatik Çalışmıyor', 'Ekran Karartısı'],
  'Batarya Arızası': ['Şarj Tutmuyor', 'Hızlı Bitiyor', 'Şişme', 'Şarj Olmuyor'],
  'Şarj / Bağlantı Arızası': ['Şarj Soketi Arızası', 'Kablo Teması Yapmıyor', 'Yavaş Şarj Oluyor'],
  'Ses / Kamera Arızası': ['Hoparlör Çalışmıyor', 'Mikrofon Arızası', 'Kamera Bulanık', 'Kamera Açılmıyor'],
  'Yazılım Arızası': ['Açılmıyor / Kilitleniyor', 'Kendiliğinden Yeniden Başlıyor', 'Uygulama Çöküyor', 'Güncelleme Hatası'],
  'Su / Nem Hasarı': ['Suya Düştü', 'Nem Hasarı', 'Korozyon'],
  'Fiziksel Hasar': ['Kasa Kırık', 'Düşme Hasarı', 'Tuş Arızası'],
  'Diğer': ['Diğer']
};

const FAULT_CATEGORIES = Object.keys(FAULT_TYPES_BY_CATEGORY);

const STATUS_OPTIONS = ['Arıza Kabul', 'İncelemede', 'Parça Bekliyor', 'Onarımda', 'Testte', 'Hazır', 'Teslim Edildi', 'İptal'];

const STATUS_STYLES = {
  'Arıza Kabul': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'İncelemede': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Parça Bekliyor': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Onarımda': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Testte': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Hazır': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Teslim Edildi': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'İptal': 'bg-red-500/10 text-red-400 border-red-500/20'
};

const EMPTY_FORM = {
  customer_name: '', customer_phone: '', customer_email: '', company: '',
  brand: '', model: '', memory: '', product_code: '', color: '',
  fault_category: '', fault_type: '', customer_complaint: '', preliminary_diagnosis: '',
  status: 'Arıza Kabul', technician_note: ''
};

export default function ServiceRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [products, setProducts] = useState([]);

  const fetchRecords = async () => {
    setLoading(true);
    const res = await api.getServiceRecords();
    if (res.success) setRecords(res.records || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
    api.getProducts().then(res => { if (res.success) setProducts(res.products || []); });
  }, []);

  const getModelsFor = (brand) =>
    Array.from(new Set(products.filter(p => p.brand === brand).map(p => p.model).filter(Boolean))).sort();
  const getMemoriesFor = (brand, model) =>
    Array.from(new Set(products.filter(p => p.brand === brand && p.model === model).map(p => p.memory).filter(Boolean))).sort();
  const getCodesFor = (brand, model, memory) =>
    Array.from(new Set(products.filter(p => p.brand === brand && p.model === model && p.memory === memory).map(p => p.item_code).filter(Boolean))).sort();
  const getColorFor = (brand, model, memory, code) => {
    const match = products.find(p => p.brand === brand && p.model === model && p.memory === memory && p.item_code === code);
    return match ? (match.color || '') : '';
  };

  const uniqueBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort();
  const modelsForBrand = getModelsFor(formData.brand);
  const memoriesForModel = getMemoriesFor(formData.brand, formData.model);
  const codesForMemory = getCodesFor(formData.brand, formData.model, formData.memory);

  const handleBrandChange = (value) => {
    const models = getModelsFor(value);
    const model = models.length === 1 ? models[0] : '';
    const memories = model ? getMemoriesFor(value, model) : [];
    const memory = memories.length === 1 ? memories[0] : '';
    const codes = memory ? getCodesFor(value, model, memory) : [];
    const product_code = codes.length === 1 ? codes[0] : '';
    const color = product_code ? getColorFor(value, model, memory, product_code) : '';
    setFormData(prev => ({ ...prev, brand: value, model, memory, product_code, color }));
  };

  const handleModelChange = (value) => {
    const memories = getMemoriesFor(formData.brand, value);
    const memory = memories.length === 1 ? memories[0] : '';
    const codes = memory ? getCodesFor(formData.brand, value, memory) : [];
    const product_code = codes.length === 1 ? codes[0] : '';
    const color = product_code ? getColorFor(formData.brand, value, memory, product_code) : '';
    setFormData(prev => ({ ...prev, model: value, memory, product_code, color }));
  };

  const handleMemoryChange = (value) => {
    const codes = getCodesFor(formData.brand, formData.model, value);
    const product_code = codes.length === 1 ? codes[0] : '';
    const color = product_code ? getColorFor(formData.brand, formData.model, value, product_code) : '';
    setFormData(prev => ({ ...prev, memory: value, product_code, color }));
  };

  const handleProductCodeChange = (value) => {
    const color = getColorFor(formData.brand, formData.model, formData.memory, value);
    setFormData(prev => ({ ...prev, product_code: value, color: color || prev.color }));
  };

  const handleOpenForm = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({ ...EMPTY_FORM, ...record });
    } else {
      setEditingRecord(null);
      setFormData(EMPTY_FORM);
    }
    setShowForm(true);
  };

  const handleCategoryChange = (value) => {
    setFormData(prev => ({ ...prev, fault_category: value, fault_type: '' }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const res = editingRecord
      ? await api.updateServiceRecord(editingRecord.id, formData)
      : await api.createServiceRecord(formData);
    if (res.success) {
      setShowForm(false);
      fetchRecords();
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu servis kaydını silmek istediğinize emin misiniz?')) {
      const res = await api.deleteServiceRecord(id);
      if (res.success) {
        fetchRecords();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  const availableFaultTypes = FAULT_TYPES_BY_CATEGORY[formData.fault_category] || [];

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Wrench className="text-blue-400" size={24} /> Servis Kaydı
        </h1>
        <p className="text-slate-400 mt-1">Müşteri cihazlarının arıza kabul ve tamir takibini yönetin.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
        {!showForm ? (
          <>
            <div className="flex justify-end items-center">
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium text-sm"
              >
                <Plus size={16} /> Yeni Servis Kaydı
              </button>
            </div>

            <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">Müşteri</th>
                    <th className="px-6 py-4">Cihaz</th>
                    <th className="px-6 py-4">Arıza</th>
                    <th className="px-6 py-4">Durum</th>
                    <th className="px-6 py-4">Kayıt Tarihi</th>
                    <th className="px-6 py-4 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                    </tr>
                  ) : (
                    records.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{rec.customer_name}</div>
                          <div className="text-xs text-slate-400">{rec.customer_phone}{rec.company ? ` · ${rec.company}` : ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>{rec.brand} {rec.model}{rec.memory ? ` (${rec.memory})` : ''}</div>
                          <div className="text-xs text-slate-400">{rec.product_code}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>{rec.fault_category}</div>
                          <div className="text-xs text-slate-400">{rec.fault_type}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[rec.status] || STATUS_STYLES['Arıza Kabul']}`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">{rec.created_at}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button onClick={() => handleOpenForm(rec)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Düzenle">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(rec.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
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
                {editingRecord ? 'Servis Kaydını Düzenle' : 'Yeni Servis Kaydı'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

              {/* 1. Müşteri Bilgileri */}
              <div>
                <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <User size={16} /> Müşteri Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Müşteri Adı <span className="text-red-400">*</span></label>
                    <input type="text" required className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Telefon</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.customer_phone} onChange={e => setFormData({...formData, customer_phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">E-posta (Opsiyonel)</label>
                    <input type="email" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.customer_email} onChange={e => setFormData({...formData, customer_email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Firma (B2B ise)</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-6">
                <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <Smartphone size={16} /> Cihaz Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Marka</label>
                    <input type="text" list="service-brand-list" placeholder="Marka seçin veya yazın..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.brand} onChange={e => handleBrandChange(e.target.value)} />
                    <datalist id="service-brand-list">
                      {uniqueBrands.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Model</label>
                    <input type="text" list="service-model-list" placeholder="Model seçin veya yazın..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.model} onChange={e => handleModelChange(e.target.value)} />
                    <datalist id="service-model-list">
                      {modelsForBrand.map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Hafıza</label>
                    <input type="text" list="service-memory-list" placeholder="Hafıza seçin veya yazın..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.memory} onChange={e => handleMemoryChange(e.target.value)} />
                    <datalist id="service-memory-list">
                      {memoriesForModel.map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Ürün Kodu</label>
                    <input type="text" list="service-code-list" placeholder="Ürün kodu seçin veya yazın..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.product_code} onChange={e => handleProductCodeChange(e.target.value)} />
                    <datalist id="service-code-list">
                      {codesForMemory.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Renk</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-6">
                <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <AlertTriangle size={16} /> Arıza Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Arıza Kategorisi</label>
                    <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.fault_category} onChange={e => handleCategoryChange(e.target.value)}>
                      <option value="">Kategori seçiniz...</option>
                      {FAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Arıza Tipi</label>
                    <select disabled={!formData.fault_category} className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50" value={formData.fault_type} onChange={e => setFormData({...formData, fault_type: e.target.value})}>
                      <option value="">{formData.fault_category ? 'Tip seçiniz...' : 'Önce kategori seçin'}</option>
                      {availableFaultTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Müşteri Şikayeti</label>
                  <textarea rows={3} placeholder="Müşterinin kendi ifadesiyle şikayeti..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={formData.customer_complaint} onChange={e => setFormData({...formData, customer_complaint: e.target.value})} />
                </div>
                <div className="mt-5">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Ön Teşhis</label>
                  <textarea rows={2} placeholder="Kabul sırasındaki ön teşhis..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={formData.preliminary_diagnosis} onChange={e => setFormData({...formData, preliminary_diagnosis: e.target.value})} />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Durum</label>
                    <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Teknisyen Notu</label>
                  <textarea rows={3} placeholder="Teknisyenin dahili notu..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={formData.technician_note} onChange={e => setFormData({...formData, technician_note: e.target.value})} />
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
