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
    <div className="flex flex-col space-y-6 pb-12 text-[#0F172A] dark:text-[#FAFAFA] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F1F5F9] dark:from-[#050A18] via-[#E2E9F5] dark:via-[#0F172A] to-[#FFFFFF] dark:to-[#1E293B] p-6 sm:p-8 text-[#0D1B3E] dark:text-white shadow-xl border border-[#E2E8F0] dark:border-[#1E293B]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/30 text-[#1D4ED8] dark:text-blue-300 text-xs font-semibold tracking-wide">
              <PackagePlus size={13} className="text-blue-400" /> YEDEK PARÇA TEDARİK TALEBİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0D1B3E] dark:text-white">
              Tedarik Talepleri Formu
            </h1>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Bir iş emri için depodan veya dış tedarikçiden temin edilmesi gereken parça taleplerini oluşturun.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">

        {/* Talep Formu */}
        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl p-6 shadow-md">
          <h2 className="text-base font-semibold text-[#0D1B3E] dark:text-white mb-5">Yeni Talep Oluştur</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-2">İş Emri <span className="text-rose-400">*</span></label>
                <select required className="w-full bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#FAFAFA] rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#2563EB]" value={formData.work_order_id} onChange={e => setFormData({ ...formData, work_order_id: e.target.value })}>
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
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Talepler</h2>
            <p className="text-slate-400 text-sm mt-1">Sizin oluşturduğunuz tedarik talepleri ve güncel durumları.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-semibold uppercase tracking-wider text-xs">
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
                        <span className="text-slate-700 dark:text-slate-300 dark:text-slate-600">-</span>
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
