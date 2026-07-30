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
    <div className="flex flex-col space-y-6 pb-12 text-[#16204A] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#9FADC9] dark:from-[#101935] via-[#8A98B8] dark:via-[#16204A] to-[#C6CEE2] dark:to-[#24326A] p-6 sm:p-8 text-[#1B2755] dark:text-white shadow-xl border border-[#8593B4] dark:border-[#24326A]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/30 text-amber-700 dark:text-amber-300 text-xs font-semibold tracking-wide">
              <PackageSearch size={13} className="text-amber-400" /> DEPO PARÇA TEDARİK İSTEKLERİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2755] dark:text-white">
              Tedarik İstekleri Paneli
            </h1>
            <p className="text-sm text-[#3D4B86] dark:text-slate-300 leading-relaxed">
              Teknisyenlerin depodan istediği ve tedarik bekleyen parçaları inceleyin ve onaylayın.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="glass-card rounded-2xl shadow-md overflow-hidden">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#B5BFD8] dark:bg-[#1B2755] text-[#2E3650] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#8593B4] dark:border-[#24326A] sticky top-0 z-10 select-none">
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
            <tbody className="divide-y divide-[#8593B4] dark:divide-[#24326A]">
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
                  <tr key={row.id} className="hover:bg-slate-100 dark:bg-[#2E3F78] transition-colors text-slate-700 dark:text-slate-300">
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
