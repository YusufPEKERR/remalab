import { useState, useEffect } from 'react';
import { PackageSearch, CheckCircle, Trash2 } from 'lucide-react';
import { api } from '../services/api';

const PRIORITY_STYLES = {
  'Düşük': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Orta': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Yüksek': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Acil': 'bg-red-500/10 text-red-400 border-red-500/20'
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

function formatWaitDuration(dateStr) {
  if (!dateStr) return '-';
  const then = new Date(dateStr.replace(' ', 'T'));
  if (Number.isNaN(then.getTime())) return '-';
  const diffMs = Date.now() - then.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return '< 1 saat';
  if (hours < 24) return `${hours} saat`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days} gün ${remHours} saat`;
}

export default function SupplyRequests() {
  const currentUser = getCurrentUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const res = await api.getSupplyRequests();
    if (res.success) setRequests(res.requests || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Onayla: parça geldi, "Stokta Var" durumuna döner (depodan teslim alınabilir hale gelir).
  // Gerçek teslimat/stok düşümü İş Emirleri ekranındaki "Depodan Teslim Al" akışıyla ayrıca yapılır.
  const handleApprove = async (row) => {
    const res = await api.revertWorkOrderPartStatus(row.id, currentUser?.username);
    if (res.success) {
      fetchRequests();
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm('Bu talebi silmek istediğinizden emin misiniz?')) return;
    const res = await api.cancelSupplyRequest(row.id, currentUser?.username);
    if (res.success) {
      fetchRequests();
    } else {
      alert(res.message || 'Silme işlemi başarısız oldu.');
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <PackageSearch className="text-amber-400" size={24} /> Tedarik İstekleri
        </h1>
        <p className="text-slate-400 mt-1">Teknisyenlerin istediği, depodan tedarik/sipariş bekleyen iş emri parçalarını görüntüleyin ve yönetin.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
        <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Müşteri / Cihaz</th>
                <th className="px-6 py-4">Parça</th>
                <th className="px-6 py-4">Miktar</th>
                <th className="px-6 py-4">Teknisyen</th>
                <th className="px-6 py-4">Öncelik</th>
                <th className="px-6 py-4">Not</th>
                <th className="px-6 py-4">Beklemede Süresi</th>
                <th className="px-6 py-4 text-center">Tedarik İşlemleri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-500">Bekleyen tedarik isteği yok.</td>
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
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${PRIORITY_STYLES[row.priority] || PRIORITY_STYLES['Orta']}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 max-w-[220px] truncate" title={row.waiting_notes}>
                      {row.waiting_notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{formatWaitDuration(row.marked_waiting_at)}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => handleDelete(row)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
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
    </div>
  );
}
