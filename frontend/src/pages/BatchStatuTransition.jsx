import React, { useState, useRef, useEffect } from "react";
import { ScanLine, CheckCircle, AlertTriangle, Info, X, ArrowRight, History } from "lucide-react";
import { api } from "../services/api";

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

// Bu ekran şu an tek bir sabit statü geçişini temsil eder (ekran görüntüsündeki
// "Kayıt kabul yap (100>101)" penceresiyle birebir aynı). Kaynak→hedef statü
// tablosu netleştikçe her satır için bu bileşenin bir kopyası (farklı
// SOURCE/TARGET/TITLE ile) yeni bir sayfa olarak eklenebilir.
const SOURCE_STATU_CODE = 100;
const TARGET_STATU_CODE = 101;
const SCREEN_TITLE = "Kayıt Kabul Yap";

const BatchStatuTransition = () => {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [log, setLog] = useState([]);
  const [deviceInfo, setDeviceInfo] = useState(null);
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

  const handleScan = async (e) => {
    e.preventDefault();
    if (!term.trim()) return;

    setLoading(true);
    setDeviceInfo(null);
    try {
      // 1. Adım: taranan terimi partide bul (entry_id ve mevcut statü lazım)
      const scanData = await api.scanBatchEntryStatu(term);
      if (!scanData.success) {
        showNotification("error", scanData.message);
        appendLog("error", scanData.message);
        return;
      }

      // Okutulan cihazın o anki statüsünü hemen göster (geçiş başarılı olsun olmasın)
      setDeviceInfo({
        imei: scanData.imei,
        batchNo: scanData.batch_no,
        flow: scanData.flow,
        statuCode: scanData.current_statu_code,
        statuName: scanData.current_statu_name,
      });

      // 2. Adım: bu ekranın sabit kaynak→hedef geçişini uygula.
      // Parti şu an SOURCE_STATU_CODE'da değilse backend "uygun statü değil" hatası döner.
      const data = await api.executeBatchEntryStatuTransition(
        scanData.entry_id,
        SOURCE_STATU_CODE,
        TARGET_STATU_CODE
      );

      if (data.success) {
        showNotification("success", data.message);
        appendLog("success", data.message);
        setDeviceInfo((prev) => (prev ? { ...prev, statuCode: TARGET_STATU_CODE, statuName: null } : prev));
      } else {
        showNotification("error", data.message);
        appendLog("error", data.message);
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Sistem Hatası: sorgu sırasında beklenmeyen bir hata oluştu.");
      appendLog("error", "Sistem Hatası: sorgu sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
      setTerm("");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ScanLine className="text-blue-400" size={24} /> {SCREEN_TITLE}
          </h1>
          <span className="px-3 py-1.5 rounded-full text-sm font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20 flex items-center gap-2">
            {SOURCE_STATU_CODE} <ArrowRight size={14} /> {TARGET_STATU_CODE}
          </span>
        </div>
        <p className="text-slate-400 mt-1">
          IMEI, seri numarası, internal ID veya batch numarasını okutun. Parti statü {SOURCE_STATU_CODE} değilse işlem reddedilir.
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
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium whitespace-nowrap flex items-center gap-2"
              >
                <ScanLine size={18} /> {loading ? "Sorgulanıyor..." : "Okut"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {deviceInfo && (
        <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {deviceInfo.imei} <span className="text-slate-400 font-normal">· {deviceInfo.batchNo} · {deviceInfo.flow}</span>
            </h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20">
              Statü: {deviceInfo.statuCode}{deviceInfo.statuName ? ` — ${deviceInfo.statuName}` : ""}
            </span>
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
