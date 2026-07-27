import React, { useState, useRef, useEffect } from "react";
import { ScanLine, CheckCircle, AlertTriangle, Info, X, ArrowRight, History } from "lucide-react";

// ─── NOTIFICATION TOAST (TechnicianRepairOperations.jsx ile aynı desen) ───
const NotificationToast = ({ notification, onClose }) => {
  if (!notification) return null;
  const colors = {
    success: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    error: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300",
    warning: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300",
    info: "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300",
  };
  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <AlertTriangle size={18} className="text-red-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />,
    info: <Info size={18} className="text-blue-500" />,
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

const LOG_STYLES = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const LOG_ICONS = {
  success: <CheckCircle size={15} />,
  error: <AlertTriangle size={15} />,
  warning: <AlertTriangle size={15} />,
};

const BatchStatuTransition = () => {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pendingTransitions, setPendingTransitions] = useState(null);
  const [log, setLog] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    if (type !== "error") {
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const appendLog = (type, message) => {
    setLog((prev) => [
      { id: Date.now() + Math.random(), type, message, time: new Date().toLocaleTimeString("tr-TR") },
      ...prev,
    ]);
  };

  const resetForNextScan = () => {
    setTerm("");
    setPendingTransitions(null);
    inputRef.current?.focus();
  };

  const applyTransition = async (entryId, currentCode, targetCode) => {
    if (!window.webBridge) return;
    setLoading(true);
    try {
      const resp = await window.webBridge.execute_batch_entry_statu_transition(
        String(entryId),
        currentCode,
        targetCode
      );
      const data = JSON.parse(resp);
      if (data.success) {
        showNotification("success", data.message);
        appendLog("success", data.message);
      } else {
        showNotification("error", data.message);
        appendLog("error", data.message);
      }
    } catch (e) {
      console.error(e);
      showNotification("error", "Beklenmeyen bir hata oluştu.");
      appendLog("error", "Beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
      resetForNextScan();
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!term.trim() || !window.webBridge) return;

    setLoading(true);
    setPendingTransitions(null);
    try {
      const resp = await window.webBridge.scan_batch_entry_statu(term);
      const data = JSON.parse(resp);

      if (!data.success) {
        showNotification("error", data.message);
        appendLog("error", data.message);
        resetForNextScan();
        return;
      }

      if (!data.transitions || data.transitions.length === 0) {
        const msg = `${data.imei} ${data.batch_no} ${data.flow} — "${data.current_statu_name}" statüsünden tanımlı bir sonraki adım yok.`;
        showNotification("warning", msg);
        appendLog("warning", msg);
        resetForNextScan();
        return;
      }

      if (data.transitions.length === 1) {
        await applyTransition(data.entry_id, data.current_statu_code, data.transitions[0].target_statu_code);
        return;
      }

      setPendingTransitions({
        entryId: data.entry_id,
        currentCode: data.current_statu_code,
        currentName: data.current_statu_name,
        label: `${data.imei} ${data.batch_no} ${data.flow}`,
        options: data.transitions,
      });
    } catch (err) {
      console.error(err);
      showNotification("error", "Sistem Hatası: sorgu sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <ScanLine className="text-blue-400" size={24} /> Statü Geçiş Ekranı
        </h1>
        <p className="text-slate-400 mt-1">
          IMEI, seri numarası, internal ID veya batch numarasını okutarak partiyi bir sonraki statüye taşıyın.
        </p>
      </div>

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <form onSubmit={handleScan} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI / Seri Numara / Internal ID / Batch No</label>
            <div className="flex gap-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Okutunuz..."
                className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={loading || !!pendingTransitions}
              />
              <button
                type="submit"
                disabled={loading || !!pendingTransitions}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium whitespace-nowrap flex items-center gap-2"
              >
                <ScanLine size={18} /> {loading ? "Sorgulanıyor..." : "Okut"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {pendingTransitions && (
        <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{pendingTransitions.label}</h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-500 border-blue-500/20">
              Mevcut Statü: {pendingTransitions.currentName}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hangi statüye alınacak?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingTransitions.options.map((t, idx) => (
              <button
                key={idx}
                onClick={() =>
                  applyTransition(pendingTransitions.entryId, pendingTransitions.currentCode, t.target_statu_code)
                }
                disabled={loading}
                className={`px-4 py-3 rounded-xl font-medium text-sm text-white transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                  t.is_positive
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                    : "bg-red-600 hover:bg-red-700 shadow-red-900/20"
                }`}
              >
                {t.target_statu_name} <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6">
        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <History size={16} /> İşlem Durumu
        </h4>

        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <ScanLine size={32} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm">Henüz bir okutma yapılmadı.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium ${LOG_STYLES[entry.type]}`}
              >
                <span className="mt-0.5 shrink-0">{LOG_ICONS[entry.type]}</span>
                <span className="flex-1 leading-relaxed">{entry.message}</span>
                <span className="shrink-0 opacity-60 font-mono">{entry.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchStatuTransition;
