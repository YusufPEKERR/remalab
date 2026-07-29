import { useState, useEffect, useRef } from "react";
import { Search, Zap, CheckCircle, AlertTriangle, X, ArrowRight } from "lucide-react";
import { api } from "../services/api";

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

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

export default function StatuKontrol() {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState(null);
  const [statuList, setStatuList] = useState([]);
  const [targetCode, setTargetCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [notification, setNotification] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.getServiceStatuList().then((res) => {
      if (res && res.success) setStatuList(res.service_statu || []);
    });
    inputRef.current?.focus();
  }, []);

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const currentStatuName = (code) => {
    const s = statuList.find((x) => x.code === code);
    return s ? s.short_name : String(code);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!term.trim() || loading) return;
    setLoading(true);
    setDevice(null);
    setTargetCode("");
    try {
      const res = await api.lookupBatchEntry(term.trim());
      if (!res || !res.success || !res.found || !res.data) {
        showNotif("error", res?.message || "Cihaz bulunamadı.");
        return;
      }
      if (res.data.statu_code === null || res.data.statu_code === undefined) {
        showNotif("error", "Bu cihaz için Batch Girişi kaydı yok, statü kontrol edilemez.");
        return;
      }
      setDevice(res.data);
      setTargetCode(String(res.data.statu_code));
    } catch (err) {
      showNotif("error", "Sistem hatası: sorgu sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!device || !targetCode || applying) return;
    if (Number(targetCode) === device.statu_code) {
      showNotif("error", "Seçilen statü zaten cihazın mevcut statüsü.");
      return;
    }
    setApplying(true);
    try {
      const res = await api.adminSetBatchEntryStatu(device.imei_number, Number(targetCode));
      if (!res || !res.success) {
        showNotif("error", res?.message || "Statü güncellenemedi.");
        return;
      }
      showNotif("success", res.message);
      setDevice((prev) => (prev ? { ...prev, statu_code: Number(targetCode) } : prev));
    } catch (err) {
      showNotif("error", "Sistem hatası: işlem sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Zap className="text-blue-400" size={24} /> Statü Kontrol
        </h1>
        <p className="text-slate-400 mt-1">
          IMEI, seri numarası, internal ID veya batch numarası ile bir cihazı bulup statüsünü doğrudan değiştirin. Bu ekran normal iş akışı kurallarını uygulamaz — manuel/idari düzeltme amaçlıdır.
        </p>
      </div>

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI / Seri Numara / Internal ID / Batch No</label>
            <div className="flex gap-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Sorgulanacak cihazı girin..."
                className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !term.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium whitespace-nowrap flex items-center gap-2"
              >
                <Search size={18} /> {loading ? "Sorgulanıyor..." : "Sorgula"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {device && (
        <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {device.imei_number} <span className="text-slate-400 font-normal">· {device.batch_no} · {device.model} · {device.flow}</span>
            </h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20">
              Mevcut Statü: {device.statu_code} — {currentStatuName(device.statu_code)}
            </span>
          </div>

          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Yeni Statü</label>
              <select
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              >
                {statuList.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.short_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleApply}
              disabled={applying || !targetCode || Number(targetCode) === device.statu_code}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 font-medium whitespace-nowrap flex items-center gap-2"
            >
              {device.statu_code} <ArrowRight size={16} /> {targetCode || "?"} {applying ? "Uygulanıyor..." : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
