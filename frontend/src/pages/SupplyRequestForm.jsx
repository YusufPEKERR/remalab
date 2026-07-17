import { useState, useEffect } from 'react';
import { PackagePlus, Send, Trash2 } from 'lucide-react';
import { api } from '../services/api';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

const EMPTY_FORM = { work_order_id: '', part_id: '', quantity: 1, notes: '' };

const REQUEST_STATUS_LABELS = {
  'Tedarik Bekleniyor': 'Bekleniyor',
  'Stokta Var': 'Onaylandı',
  'Teslim Edildi': 'Teslim Edildi',
  'İptal Edildi': 'İptal Edildi'
};

const REQUEST_STATUS_STYLES = {
  'Tedarik Bekleniyor': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Stokta Var': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Teslim Edildi': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'İptal Edildi': 'bg-red-500/10 text-red-400 border-red-500/20'
};

export default function SupplyRequestForm() {
  const currentUser = getCurrentUser();
  const [workOrders, setWorkOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const res = await api.getSupplyRequestHistory(currentUser?.username);
    if (res.success) setRequests(res.requests || []);
    setLoading(false);
  };

  useEffect(() => {
    api.getWorkOrders().then(res => { if (res.success) setWorkOrders(res.work_orders || []); });
    api.getParts().then(res => { if (res.success) setParts(res.parts || []); });
    fetchRequests();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.work_order_id || !formData.part_id || !formData.notes.trim()) return;
    setSubmitting(true);
    const res = await api.createSupplyRequest(formData.work_order_id, formData.part_id, formData.quantity || 1, formData.notes, currentUser?.username);
    setSubmitting(false);
    if (res.success) {
      setFormData(EMPTY_FORM);
      fetchRequests();
    } else {
      alert(res.message || 'Talep oluşturulamadı.');
    }
  };

  const handleCancel = async (row) => {
    if (!window.confirm('Bu talebi iptal etmek istediğinizden emin misiniz?')) return;
    const res = await api.cancelSupplyRequest(row.id, currentUser?.username);
    if (res.success) {
      fetchRequests();
    } else {
      alert(res.message || 'İptal işlemi başarısız oldu.');
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <PackagePlus className="text-blue-400" size={24} /> Tedarik Talepleri
        </h1>
        <p className="text-slate-400 mt-1">Bir iş emri için depodan tedarik edilmesi gereken parça talebinde bulunun.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">

        {/* Talep Formu */}
        <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">Yeni Talep</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">İş Emri <span className="text-red-400">*</span></label>
                <select required className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.work_order_id} onChange={e => setFormData({ ...formData, work_order_id: e.target.value })}>
                  <option value="">İş emri seçiniz...</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      #{wo.id} — {wo.customer_name || 'Müşteri yok'} {wo.brand} {wo.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Parça <span className="text-red-400">*</span></label>
                <select required className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.part_id} onChange={e => setFormData({ ...formData, part_id: e.target.value })}>
                  <option value="">Parça seçiniz...</option>
                  {parts.map(p => (
                    <option key={p.id} value={p.id}>{p.brand} {p.model} {p.color} {p.part_category} {p.item_code ? `- ${p.item_code}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Miktar</label>
                <input type="number" min="1" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Not <span className="text-red-400">*</span></label>
              <textarea required rows={2} placeholder="Talep için not giriniz..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2">
                <Send size={18} /> Talep Gönder
              </button>
            </div>
          </form>
        </div>

        {/* Talepler */}
        <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Talepler</h2>
            <p className="text-slate-400 text-sm mt-1">Sizin oluşturduğunuz tedarik talepleri ve güncel durumları.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Müşteri / Cihaz</th>
                <th className="px-6 py-4">Parça</th>
                <th className="px-6 py-4">Miktar</th>
                <th className="px-6 py-4">Teknisyen</th>
                <th className="px-6 py-4">Not</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Henüz tedarik talebi yok.</td>
                </tr>
              ) : (
                requests.map(row => (
                  <tr key={row.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{row.customer_name || '-'}</div>
                      <div className="text-xs text-slate-400">{row.device_brand} {row.device_model}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{row.part_name}</div>
                      <div className="text-xs text-slate-400">{row.item_code}</div>
                    </td>
                    <td className="px-6 py-4 font-mono">{row.quantity}</td>
                    <td className="px-6 py-4">{row.assigned_technician || '-'}</td>
                    <td className="px-6 py-4 text-xs text-slate-400 max-w-[220px] truncate" title={row.waiting_notes}>{row.waiting_notes || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${REQUEST_STATUS_STYLES[row.status] || REQUEST_STATUS_STYLES['Tedarik Bekleniyor']}`}>
                        {REQUEST_STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.status === 'Tedarik Bekleniyor' ? (
                        <button onClick={() => handleCancel(row)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Talebi İptal Et">
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
