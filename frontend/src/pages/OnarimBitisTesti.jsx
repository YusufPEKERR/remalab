import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  RefreshCw,
  Camera,
  Monitor,
  Box,
  HardDrive,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Clock,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';

// ─── ONARIM BİTİŞ TESTİ ──────────────────────────────────────────────
// Kamera / L3 / Ekran / Kasa departmanlarında teknisyen onarımı bitirince onarım
// DOĞRUDAN tamamlanmaz; 1006 (Onarım Testi Bekleniyor) statüsüne düşer ve bu
// ekranda listelenir. Testçi her ONARIM için tek karar verir:
//   Başarılı → backend onarımın TÜM parçalarını 1002 (Onarım Tamamlandı) yapar,
//   Başarısız → 1001 (Teknisyene Atandı) yapar (onarım teknisyende açık iş kalır),
//                açıklama (arıza nedeni) girmek ZORUNLUDUR.
// Departman bazlıdır; görev grubu URL'den (/onarim-bitis-testi/CAMERA) okunur.
//
// LİSTENİN BİRİMİ ONARIMDIR, PARÇA DEĞİL. Bir onarımın birden çok parçası olabilir
// (ör. 4 parçalı Ekran Onarımı) ve hepsi tek tıkla teste gönderilir. Eskiden bu
// ekran her parçayı ayrı kart olarak gösteriyordu; hiçbir işaret kartların aynı
// onarıma ait olduğunu söylemediği için testçi birini onaylayıp diğerlerini
// unutabiliyordu. Unutulan parça "açık onarım" sayıldığından hem alt seviyeyi
// 1004'te hem cihazı 109'da tutuyordu. Artık her kart bir onarımdır, parçaları
// kartın içinde listelenir ve karar bütününe uygulanır.

const DEPARTMENTS_CONFIG = {
  CAMERA: { title: 'Kamera', icon: Camera, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  L3REPAIR: { title: 'L3', icon: HardDrive, color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  DISPLAY: { title: 'Ekran', icon: Monitor, color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  CASE: { title: 'Kasa', icon: Box, color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

// Backend IMEI bulamazsa servis kayıt no (UUID) döner; onu "IMEI:" diye
// etiketlemek yanıltıcı olur (bkz. DepartmentRepairPool.jsx).
const cihazEtiketi = (deger) => {
  const v = (deger || '').trim();
  if (!v || v === '-') return { etiket: 'IMEI', metin: '-' };
  return /^\d{8,}$/.test(v)
    ? { etiket: 'IMEI', metin: v }
    : { etiket: 'Servis kaydı', metin: v };
};

const OnarimBitisTesti = () => {
  const { deptCode } = useParams();
  const navigate = useNavigate();

  const currentDeptCode = (deptCode || 'CAMERA').toUpperCase();
  const deptConfig = DEPARTMENTS_CONFIG[currentDeptCode] || {
    title: currentDeptCode,
    icon: Wrench,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  };
  const DeptIcon = deptConfig.icon;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});        // { [repairId]: açıklama }
  const [rowErrors, setRowErrors] = useState({});  // { [repairId]: hata metni }
  const [submitting, setSubmitting] = useState(null); // işlemdeki repairId
  const [message, setMessage] = useState(null);

  const fetchPool = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCompletionTestPool(currentDeptCode);
      setItems(res && res.success ? (res.items || []) : []);
      if (res && !res.success) setMessage({ type: 'error', text: res.message || 'Liste alınamadı.' });
    } catch (err) {
      setItems([]);
      setMessage({ type: 'error', text: 'Sistem hatası: ' + err.message });
    } finally {
      setLoading(false);
    }
  }, [currentDeptCode]);

  useEffect(() => {
    fetchPool();
    setDrafts({});
    setRowErrors({});
    setMessage(null);
  }, [fetchPool]);

  const submit = async (item, result) => {
    const aciklama = (drafts[item.repairId] || '').trim();
    // Başarısız test için açıklama zorunlu (istemci tarafı erken kontrol; backend de doğrular).
    if (result === 'fail' && !aciklama) {
      setRowErrors(prev => ({ ...prev, [item.repairId]: 'Başarısız test için açıklama (arıza nedeni) zorunludur.' }));
      return;
    }
    setRowErrors(prev => ({ ...prev, [item.repairId]: '' }));
    setSubmitting(item.repairId);
    setMessage(null);
    try {
      const res = await api.submitCompletionTest(item.repairId, result, aciklama, getCurrentUser()?.username);
      if (res && res.success) {
        setMessage({ type: result === 'pass' ? 'success' : 'warning', text: res.message });
        setDrafts(prev => { const n = { ...prev }; delete n[item.repairId]; return n; });
        fetchPool();
      } else {
        setRowErrors(prev => ({ ...prev, [item.repairId]: (res && res.message) || 'İşlem başarısız oldu.' }));
      }
    } catch (err) {
      setRowErrors(prev => ({ ...prev, [item.repairId]: 'Sistem hatası: ' + err.message }));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ── Üst Başlık & Departman Sekmeleri ── */}
      <div className="bg-white dark:bg-[#12141c] rounded-2xl p-5 border border-slate-200 dark:border-[#1e222d] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${deptConfig.color}`}>
              <DeptIcon size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ClipboardCheck size={18} className="text-blue-500" />
                {deptConfig.title} Onarım Bitiş Testi
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Onarımı biten kayıtlar teste düşer. Başarılı → tamamlandı, başarısız → teknisyene geri döner.
              </p>
            </div>
          </div>

          <button
            onClick={fetchPool}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1a1d27] hover:bg-slate-200 dark:hover:bg-[#242836] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Yenile
          </button>
        </div>

        {/* Departman Hızlı Sekmeleri */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-[#1e222d]">
          {Object.entries(DEPARTMENTS_CONFIG).map(([code, config]) => {
            const Icon = config.icon;
            const isActive = code === currentDeptCode;
            return (
              <button
                key={code}
                onClick={() => navigate(`/onarim-bitis-testi/${code}`)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-[#1a1d27] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#242836]'
                }`}
              >
                <Icon size={14} />
                {config.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bildirim ── */}
      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : message.type === 'warning'
            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
        </div>
      )}

      {/* ── Test Bekleyen Kayıtlar ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Clock size={16} className="text-cyan-500" />
            Bitiş Testi Bekleyen Onarımlar
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            Toplam {items.length} onarım
            {items.length > 0 && ` · ${items.reduce((t, i) => t + (i.partCount || 1), 0)} parça`}
          </span>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] p-12 text-center text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-2 text-blue-500" size={20} />
            Yükleniyor...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] p-12 text-center text-slate-400 dark:text-slate-600 italic">
            Bu departmanda bitiş testi bekleyen onarım bulunmuyor.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {items.map((item) => {
              const isBusy = submitting === item.repairId;
              const err = rowErrors[item.repairId];
              const dev = cihazEtiketi(item.imei);
              return (
                <div
                  key={item.repairId}
                  className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm p-4 space-y-3"
                >
                  {/* Cihaz başlığı */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.productInfo}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{dev.etiket}: {dev.metin}</div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      <Clock size={11} /> Test Bekliyor
                    </span>
                  </div>

                  {/* Detaylar */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <User size={12} className="text-blue-500 shrink-0" />
                      <span className="truncate">{item.assignedTechnicianName || 'Atanmadı'}</span>
                    </div>
                    <div className="text-slate-400 text-right">
                      {item.customerName || '-'} · {item.batchNo || '-'}
                    </div>
                  </div>

                  {/* ONARIMIN PARÇALARI. Karar bu listenin TAMAMINA uygulanır -
                      testçi hangi parçaların birlikte kapanacağını görmeden karar
                      vermemeli. */}
                  <div className="rounded-xl border border-slate-200 dark:border-[#2e3545] overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#171a26] text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Onarım Parçaları</span>
                      <span className="text-cyan-600 dark:text-cyan-400">{item.partCount || (item.parts || []).length} parça</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-[#232838]">
                      {(item.parts || []).map((p) => (
                        <div key={p.partRecordId} className="px-3 py-2 flex items-start gap-2 text-[11px]">
                          <Tag size={12} className="text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-700 dark:text-slate-200 truncate">
                              {p.partName || p.partItemCode || '-'}
                              {p.partItemCode && p.partName && (
                                <span className="text-slate-400 font-mono ml-1.5">{p.partItemCode}</span>
                              )}
                            </div>
                            {p.faultName && (
                              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mt-0.5">
                                <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                                <span className="truncate">{p.faultName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Açıklama (başarısızda zorunlu) */}
                  <textarea
                    value={drafts[item.repairId] || ''}
                    onChange={(e) => setDrafts(prev => ({ ...prev, [item.repairId]: e.target.value }))}
                    disabled={isBusy}
                    rows={2}
                    placeholder="Açıklama / arıza nedeni (başarısız testte zorunlu)..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2e3545] bg-slate-50 dark:bg-[#171a26] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all resize-none disabled:opacity-50"
                  />

                  {err && (
                    <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle size={12} /> {err}
                    </p>
                  )}

                  {/* Aksiyonlar */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submit(item, 'pass')}
                      disabled={isBusy}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle2 size={15} /> Başarılı (Tamamlandı)
                    </button>
                    <button
                      onClick={() => submit(item, 'fail')}
                      disabled={isBusy}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <XCircle size={15} /> Başarısız (Teknisyene Dön)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnarimBitisTesti;
