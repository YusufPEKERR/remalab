import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Edit, X, Save, Factory, Package, TrendingUp } from 'lucide-react';
import { api } from '../services/api';

const PRIORITY_OPTIONS = ['Düşük', 'Orta', 'Yüksek', 'Acil'];
const PRIORITY_STYLES = {
  'Düşük': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Orta': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Yüksek': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Acil': 'bg-red-500/10 text-red-400 border-red-500/20'
};

const STATUS_OPTIONS = ['Beklemede', 'Devam Ediyor', 'Tamamlandı', 'İptal'];
const STATUS_STYLES = {
  'Beklemede': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Devam Ediyor': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Tamamlandı': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'İptal': 'bg-red-500/10 text-red-400 border-red-500/20'
};

const EMPTY_FORM = {
  service_record_id: '', description: '', assigned_technician: '', priority: 'Orta',
  start_date: '', end_date: '', status: 'Beklemede'
};

const EMPTY_PRODUCTION_FORM = {
  target_part_id: '', quantity_produced: 1, location_id: '', produced_by: '', notes: ''
};

export default function WorkOrders() {
  const [activeTab, setActiveTab] = useState('new');

  // --- İş Emirleri (work orders) state ---
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [partsUsed, setPartsUsed] = useState([]);

  const [serviceRecords, setServiceRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [parts, setParts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);

  // --- Üretim (production) state ---
  const [productionRuns, setProductionRuns] = useState([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionForm, setProductionForm] = useState(EMPTY_PRODUCTION_FORM);
  const [productionMaterials, setProductionMaterials] = useState([]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    const res = await api.getWorkOrders();
    if (res.success) setOrders(res.work_orders || []);
    setOrdersLoading(false);
  };

  const fetchProductionRuns = async () => {
    setProductionLoading(true);
    const res = await api.getProductionRuns();
    if (res.success) setProductionRuns(res.production_runs || []);
    setProductionLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    fetchProductionRuns();
    api.getServiceRecords().then(res => { if (res.success) setServiceRecords(res.records || []); });
    api.getUsers().then(res => { if (res.success) setUsers(res.users || []); });
    api.getParts().then(res => { if (res.success) setParts(res.parts || []); });
    api.getLocations().then(res => { if (res.success) setLocations(res.locations || []); });
    api.getStockStatus().then(res => { if (res.success) setStockStatus(res.stock || []); });
  }, []);

  const getStockQty = (partId, locId) => {
    if (!partId || !locId) return 0;
    const entry = stockStatus.find(s => String(s.part_id) === String(partId) && String(s.location_id) === String(locId));
    return entry ? entry.quantity : 0;
  };

  // ===================== İş Emri handlers =====================

  const handleOpenForm = (order = null) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        service_record_id: order.service_record_id || '',
        description: order.description || '',
        assigned_technician: order.assigned_technician || '',
        priority: order.priority || 'Orta',
        start_date: order.start_date || '',
        end_date: order.end_date || '',
        status: order.status || 'Beklemede'
      });
      try {
        setPartsUsed(JSON.parse(order.parts_used || '[]'));
      } catch (_e) {
        setPartsUsed([]);
      }
    } else {
      setEditingOrder(null);
      setFormData(EMPTY_FORM);
      setPartsUsed([]);
    }
    setActiveTab('new');
  };

  const handleAddPartRow = () => {
    setPartsUsed(prev => [...prev, { part_id: '', quantity: 1 }]);
  };

  const handlePartRowChange = (index, field, value) => {
    setPartsUsed(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleRemovePartRow = (index) => {
    setPartsUsed(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...formData, parts_used: JSON.stringify(partsUsed.filter(r => r.part_id)) };
    const res = editingOrder
      ? await api.updateWorkOrder(editingOrder.id, payload)
      : await api.createWorkOrder(payload);
    if (res.success) {
      setEditingOrder(null);
      setFormData(EMPTY_FORM);
      setPartsUsed([]);
      fetchOrders();
      setActiveTab('list');
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu iş emrini silmek istediğinize emin misiniz?')) {
      const res = await api.deleteWorkOrder(id);
      if (res.success) {
        fetchOrders();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  const parsePartsUsed = (json) => {
    try {
      return JSON.parse(json || '[]');
    } catch (_e) {
      return [];
    }
  };

  // ===================== Üretim handlers =====================

  const handleAddMaterialRow = () => {
    setProductionMaterials(prev => [...prev, { part_id: '', quantity_consumed: 1 }]);
  };

  const handleMaterialRowChange = (index, field, value) => {
    setProductionMaterials(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleRemoveMaterialRow = (index) => {
    setProductionMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduction = async (e) => {
    e.preventDefault();
    const materials = productionMaterials.filter(r => r.part_id && Number(r.quantity_consumed) > 0);

    for (const m of materials) {
      const available = getStockQty(m.part_id, productionForm.location_id);
      if (Number(m.quantity_consumed) > available) {
        alert('Seçilen lokasyonda bazı hammaddeler için yeterli stok yok. Lütfen miktarları kontrol edin.');
        return;
      }
    }

    const res = await api.createProductionRun({
      ...productionForm,
      materials_json: JSON.stringify(materials)
    });
    if (res.success) {
      setProductionForm(EMPTY_PRODUCTION_FORM);
      setProductionMaterials([]);
      fetchProductionRuns();
      api.getStockStatus().then(r => { if (r.success) setStockStatus(r.stock || []); });
      setActiveTab('history');
    } else {
      alert(res.message || 'Üretim kaydı oluşturulamadı.');
    }
  };

  const handleDeleteProduction = async (id) => {
    if (window.confirm('Bu üretim kaydını silmek istediğinize emin misiniz? (Stok hareketleri geri alınmaz, sadece geçmiş kaydı silinir.)')) {
      const res = await api.deleteProductionRun(id);
      if (res.success) {
        fetchProductionRuns();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  const materialConsumption = () => {
    const map = new Map();
    productionRuns.forEach(run => {
      (run.materials || []).forEach(m => {
        const key = m.part_id;
        const prev = map.get(key) || { part_name: m.part_name, item_code: m.item_code, total: 0, runCount: 0 };
        prev.total += Number(m.quantity_consumed) || 0;
        prev.runCount += 1;
        map.set(key, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  };

  const TABS = [
    { key: 'new', label: 'Yeni İş Emri', icon: Plus },
    { key: 'list', label: 'İş Emri Listesi', icon: ClipboardList },
    { key: 'production', label: 'Yarı Mamul Üretimi', icon: Factory },
    { key: 'consumption', label: 'Malzeme Tüketimi', icon: Package },
    { key: 'history', label: 'Üretim Geçmişi', icon: TrendingUp }
  ];

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <ClipboardList className="text-blue-400" size={24} /> İş Emirleri
        </h1>
        <p className="text-slate-400 mt-1">Servis kayıtlarına bağlı teknisyen iş emirlerini ve üretim/malzeme takibini yönetin.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 shrink-0 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200
              ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-white dark:bg-[#1e2330] text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a3142] border border-slate-200 dark:border-slate-700/50'}
            `}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">

        {/* --- YENİ İŞ EMRİ --- */}
        {activeTab === 'new' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
              {editingOrder ? 'İş Emrini Düzenle' : 'Yeni İş Emri'}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Servis Kaydı <span className="text-red-400">*</span></label>
                <select required className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.service_record_id} onChange={e => setFormData({...formData, service_record_id: e.target.value})}>
                  <option value="">Servis kaydı seçiniz...</option>
                  {serviceRecords.map(rec => (
                    <option key={rec.id} value={rec.id}>
                      {rec.customer_name} — {rec.brand} {rec.model} {rec.fault_category ? `(${rec.fault_category})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Açıklama</label>
                <textarea rows={2} placeholder="Bu iş emrinde yapılacak işin açıklaması..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Atanan Teknisyen</label>
                  <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.assigned_technician} onChange={e => setFormData({...formData, assigned_technician: e.target.value})}>
                    <option value="">Seçiniz...</option>
                    {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Öncelik</label>
                  <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Başlangıç Tarihi</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Bitiş Tarihi</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Kullanılan Parçalar</label>
                  <button type="button" onClick={handleAddPartRow} className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                    <Plus size={14} /> Parça Ekle
                  </button>
                </div>
                {partsUsed.length === 0 ? (
                  <p className="text-xs text-slate-500">Henüz parça eklenmedi.</p>
                ) : (
                  <div className="space-y-2">
                    {partsUsed.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.part_id} onChange={e => handlePartRowChange(idx, 'part_id', e.target.value)}>
                          <option value="">Parça seçiniz...</option>
                          {parts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} {p.item_code ? `- ${p.item_code}` : ''}</option>)}
                        </select>
                        <input type="number" min="1" className="w-20 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.quantity} onChange={e => handlePartRowChange(idx, 'quantity', e.target.value)} />
                        <button type="button" onClick={() => handleRemovePartRow(idx)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Durum</label>
                <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                {editingOrder && (
                  <button type="button" onClick={() => { setEditingOrder(null); setFormData(EMPTY_FORM); setPartsUsed([]); }} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                )}
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {/* --- İŞ EMRİ LİSTESİ --- */}
        {activeTab === 'list' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Servis Kaydı</th>
                  <th className="px-6 py-4">Teknisyen</th>
                  <th className="px-6 py-4">Öncelik</th>
                  <th className="px-6 py-4">Tarih Aralığı</th>
                  <th className="px-6 py-4">Kullanılan Parça</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {ordersLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                  </tr>
                ) : (
                  orders.map(order => {
                    const usedParts = parsePartsUsed(order.parts_used);
                    return (
                      <tr key={order.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{order.customer_name || '-'}</div>
                          <div className="text-xs text-slate-400">{order.brand} {order.model}{order.fault_category ? ` · ${order.fault_category}` : ''}</div>
                        </td>
                        <td className="px-6 py-4">{order.assigned_technician || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${PRIORITY_STYLES[order.priority] || PRIORITY_STYLES['Orta']}`}>
                            {order.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {order.start_date || '?'} &rarr; {order.end_date || '?'}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {usedParts.length > 0 ? `${usedParts.length} kalem` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[order.status] || STATUS_STYLES['Beklemede']}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button onClick={() => handleOpenForm(order)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Düzenle">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(order.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- YARI MAMUL ÜRETİMİ --- */}
        {activeTab === 'production' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Factory size={20} className="text-orange-400" /> Yarı Mamul Üretimi
            </h2>
            <p className="text-slate-400 text-sm mb-6">Hammadde/parça tüketerek yeni bir parça stoku oluşturun. Seçilen lokasyondaki hammaddeler otomatik düşülür, üretilen parçanın stoku artırılır.</p>

            <form onSubmit={handleSaveProduction} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretilen Parça <span className="text-red-400">*</span></label>
                  <select required className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={productionForm.target_part_id} onChange={e => setProductionForm({...productionForm, target_part_id: e.target.value})}>
                    <option value="">Parça seçiniz...</option>
                    {parts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} {p.item_code ? `- ${p.item_code}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretilen Miktar <span className="text-red-400">*</span></label>
                  <input type="number" required min="1" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={productionForm.quantity_produced} onChange={e => setProductionForm({...productionForm, quantity_produced: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Lokasyon <span className="text-red-400">*</span></label>
                  <select required className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={productionForm.location_id} onChange={e => setProductionForm({...productionForm, location_id: e.target.value})}>
                    <option value="">Lokasyon seçiniz...</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretici / Sorumlu</label>
                  <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={productionForm.produced_by} onChange={e => setProductionForm({...productionForm, produced_by: e.target.value})}>
                    <option value="">Seçiniz...</option>
                    {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Tüketilen Hammaddeler</label>
                  <button type="button" onClick={handleAddMaterialRow} className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                    <Plus size={14} /> Hammadde Ekle
                  </button>
                </div>
                {productionMaterials.length === 0 ? (
                  <p className="text-xs text-slate-500">Henüz hammadde eklenmedi.</p>
                ) : (
                  <div className="space-y-2">
                    {productionMaterials.map((row, idx) => {
                      const available = getStockQty(row.part_id, productionForm.location_id);
                      const insufficient = row.part_id && productionForm.location_id && Number(row.quantity_consumed) > available;
                      return (
                        <div key={idx}>
                          <div className="flex gap-2 items-center">
                            <select className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.part_id} onChange={e => handleMaterialRowChange(idx, 'part_id', e.target.value)}>
                              <option value="">Parça seçiniz...</option>
                              {parts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} {p.item_code ? `- ${p.item_code}` : ''}</option>)}
                            </select>
                            <input type="number" min="1" className="w-20 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.quantity_consumed} onChange={e => handleMaterialRowChange(idx, 'quantity_consumed', e.target.value)} />
                            <button type="button" onClick={() => handleRemoveMaterialRow(idx)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                          {row.part_id && productionForm.location_id && (
                            <p className={`mt-1 text-xs font-medium ${insufficient ? 'text-red-500' : 'text-emerald-500'}`}>
                              Mevcut Stok: {available}{insufficient ? ' — Yetersiz!' : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Notlar</label>
                <textarea rows={2} placeholder="İsteğe bağlı not..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={productionForm.notes} onChange={e => setProductionForm({...productionForm, notes: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                <button type="submit" className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-900/20 flex items-center gap-2"><Save size={18}/> Üretimi Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {/* --- MALZEME TÜKETİMİ --- */}
        {activeTab === 'consumption' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package size={20} className="text-purple-400" /> Malzeme Tüketimi
              </h2>
              <p className="text-slate-400 text-sm mt-1">Üretimde tüketilen malzemelerin toplu raporu (tüm üretim kayıtlarından derlenir).</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Parça</th>
                  <th className="px-6 py-4">Ürün Kodu</th>
                  <th className="px-6 py-4">Toplam Tüketilen Miktar</th>
                  <th className="px-6 py-4">Kaç Üretimde Kullanıldı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {productionLoading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : materialConsumption().length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Henüz malzeme tüketimi yok.</td>
                  </tr>
                ) : (
                  materialConsumption().map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{m.part_name || '-'}</td>
                      <td className="px-6 py-4 font-mono text-slate-400">{m.item_code}</td>
                      <td className="px-6 py-4 font-mono">{m.total}</td>
                      <td className="px-6 py-4 text-slate-400">{m.runCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- ÜRETİM GEÇMİŞİ --- */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-400" /> Üretim Geçmişi
              </h2>
              <p className="text-slate-400 text-sm mt-1">Geçmişte yapılan tüm yarı mamul üretim kayıtları.</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Üretilen Parça</th>
                  <th className="px-6 py-4">Miktar</th>
                  <th className="px-6 py-4">Lokasyon</th>
                  <th className="px-6 py-4">Tüketilen Malzemeler</th>
                  <th className="px-6 py-4">Üretici</th>
                  <th className="px-6 py-4">Tarih</th>
                  <th className="px-6 py-4 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {productionLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : productionRuns.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                  </tr>
                ) : (
                  productionRuns.map(run => (
                    <tr key={run.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{run.target_part_name || '-'}</div>
                        <div className="text-xs text-slate-400">{run.target_item_code}</div>
                      </td>
                      <td className="px-6 py-4 font-mono">{run.quantity_produced}</td>
                      <td className="px-6 py-4">{run.location_name || '-'}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {(run.materials || []).length > 0
                          ? run.materials.map(m => `${m.part_name} (${m.quantity_consumed})`).join(', ')
                          : '-'}
                      </td>
                      <td className="px-6 py-4">{run.produced_by || '-'}</td>
                      <td className="px-6 py-4 text-slate-400">{run.created_at}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleDeleteProduction(run.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
