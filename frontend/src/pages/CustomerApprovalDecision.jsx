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
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ScanLine className="text-blue-400" size={24} /> Müşteri Onayı Bekleyecek
          </h1>
          <button
            onClick={loadItems}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Yenile
          </button>
        </div>
        <p className="text-slate-400 mt-1 text-sm">
          Müşteri onayına sunulmuş ({SOURCE_STATU}) tüm cihazlar aşağıda listelenir. Onay geldiyse tike, red geldiyse çarpıya basın.
        </p>
      </div>

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI / Seri Numara / Internal ID / Batch No ile filtrele</label>
        <input
          ref={inputRef}
          type="text"
          placeholder="Okutunuz veya yazınız..."
          className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
            <Info size={32} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm">{items.length === 0 ? "Müşteri onayı bekleyen cihaz bulunmuyor." : "Aramanızla eşleşen cihaz bulunamadı."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <div
                key={entry.entry_id}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#242a38]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{entry.imei}</p>
                  <p className="text-xs text-slate-400 truncate">{entry.batch_no} · {entry.flow}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.decision === "approved" ? (
                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold">
                      <Check size={14} /> Onayladım
                    </span>
                  ) : entry.decision === "rejected" ? (
                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold">
                      <X size={14} /> Red Verdim
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDecision(entry, REJECT_TARGET)}
                        disabled={processingId === entry.entry_id}
                        title="Red geldi"
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors disabled:opacity-40"
                      >
                        <X size={18} />
                      </button>
                      <button
                        onClick={() => handleDecision(entry, APPROVE_TARGET)}
                        disabled={processingId === entry.entry_id}
                        title="Onay geldi"
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-colors disabled:opacity-40"
                      >
                        <Check size={18} />
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
