import React, { useState, useEffect, useCallback, useRef } from "react";
import { ScanLine, CheckCircle, AlertTriangle, X, Check, RefreshCw, Info } from "lucide-react";
import { api } from "../services/api";

const SOURCE_STATU = 106;
const APPROVE_TARGET = 109;
const REJECT_TARGET = 124;

const NotificationToast = ({ notification, onClose }) => {
  if (!notification) return null;
  const colors = {
    success: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    error: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300",
  };
  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <AlertTriangle size={18} className="text-red-500" />,
  };
  return (
    <div className={`fixed top-6 right-6 z-[110] max-w-sm w-full border rounded-xl px-4 py-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-3 fade-in duration-300 ${colors[notification.type]}`}>
      <span className="mt-0.5 shrink-0">{icons[notification.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{notification.message}</p>
      </div>
      <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

const CustomerApprovalDecision = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const inputRef = useRef(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    if (type !== "error") setTimeout(() => setNotification(null), 5000);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBatchEntriesByStatu(SOURCE_STATU);
      if (data.success) {
        setItems(data.items || []);
      } else {
        showNotification("error", data.message || "Liste yüklenemedi.");
      }
    } catch (e) {
      console.error(e);
      showNotification("error", "Sistem hatası: liste yüklenirken beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = items.filter((it) => {
    if (!term.trim()) return true;
    const t = term.trim().toLowerCase();
    return (it.imei || "").toLowerCase().includes(t)
      || (it.batch_no || "").toLowerCase().includes(t)
      || (it.flow || "").toLowerCase().includes(t);
  });

  const handleDecision = async (entry, targetStatu) => {
    setProcessingId(entry.entry_id);
    try {
      const data = await api.executeBatchEntryStatuTransition(entry.entry_id, SOURCE_STATU, targetStatu);
      if (data.success) {
        showNotification("success", data.message);
        const decision = targetStatu === APPROVE_TARGET ? "approved" : "rejected";
        setItems((prev) => prev.map((it) => (it.entry_id === entry.entry_id ? { ...it, decision } : it)));
      } else {
        showNotification("error", data.message);
      }
    } catch (e) {
      console.error(e);
      showNotification("error", "Sistem hatası: işlem sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#16204A] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#101935] via-[#DDE2F2] dark:via-[#16204A] to-[#FFFFFF] dark:to-[#24326A] p-6 sm:p-8 text-[#1B2755] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#24326A]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(122, 84, 192,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(122, 84, 192,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 text-xs font-semibold tracking-wide">
              <ScanLine size={13} className="text-purple-400" /> MÜŞTERİ ONAY KARARLARI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2755] dark:text-white">
              Müşteri Onayı Bekleyen Cihazlar
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Müşteri onayına sunulmuş ({SOURCE_STATU}) tüm cihazları görüntüleyin, gelen müşteri kararına göre onay (109) veya red (124) işlemini yapın.
            </p>
          </div>

          <button
            onClick={loadItems}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#24326A] hover:bg-[#EFF1FA] dark:hover:bg-[#3B4A85] text-[#16204A] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#3B4A85] text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 shrink-0"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Yenile
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="glass-card p-6 rounded-2xl shadow-md">
        <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5] uppercase tracking-wider mb-2">Filtrele (IMEI / Seri No / Batch No)</label>
        <input
          ref={inputRef}
          type="text"
          placeholder="Okutunuz veya yazınız..."
          className="w-full bg-[#FFFFFF] dark:bg-[#24326A] border border-[#DCE1F1] dark:border-[#3B4A85] text-[#16204A] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-3 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-[#4457A5] transition-all shadow-xs"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {/* DEVICE LIST */}
      <div className="glass-card rounded-2xl p-6 shadow-md flex-1 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[#5A6685] dark:text-[#8892B5] text-xs font-semibold py-16">
            <RefreshCw className="animate-spin mr-2" size={18} /> Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#5A6685]">
            <Info size={32} className="text-[#3B4A85]" />
            <p className="text-xs font-semibold">{items.length === 0 ? "Müşteri onayı bekleyen cihaz bulunmuyor." : "Aramanızla eşleşen cihaz bulunamadı."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => (
              <div
                key={entry.entry_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#DCE1F1] dark:border-[#24326A] bg-[#F5F7FC] dark:bg-[#1B2755] hover:bg-[#FFFFFF]/70 dark:hover:bg-[#24326A]/70 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#16204A] dark:text-[#F6F8FF] font-mono tracking-wide">{entry.imei}</p>
                  <p className="text-xs text-[#5A6685] dark:text-[#8892B5] mt-0.5">{entry.batch_no} · <span className="text-blue-400 font-semibold">{entry.flow}</span></p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.decision === "approved" ? (
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold">
                      <Check size={15} /> Onaylandı
                    </span>
                  ) : entry.decision === "rejected" ? (
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-xs font-bold">
                      <X size={15} /> Reddedildi
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDecision(entry, REJECT_TARGET)}
                        disabled={processingId === entry.entry_id}
                        title="Red Ver (124 Statüsüne Gönder)"
                        className="px-4 py-2 flex items-center gap-1.5 rounded-xl bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition-all text-xs font-bold cursor-pointer disabled:opacity-40"
                      >
                        <X size={16} /> Reddet
                      </button>
                      <button
                        onClick={() => handleDecision(entry, APPROVE_TARGET)}
                        disabled={processingId === entry.entry_id}
                        title="Onayla (109 Statüsüne Gönder)"
                        className="px-4 py-2 flex items-center gap-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 transition-all text-xs font-bold cursor-pointer disabled:opacity-40"
                      >
                        <Check size={16} /> Onayla
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerApprovalDecision;
