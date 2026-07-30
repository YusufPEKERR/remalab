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
    <div className="flex flex-col space-y-6 pb-12 text-[#0F172A] dark:text-[#FAFAFA] max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F1F5F9] dark:from-[#050A18] via-[#E2E9F5] dark:via-[#0F172A] to-[#FFFFFF] dark:to-[#1E293B] p-6 sm:p-8 text-[#0D1B3E] dark:text-white shadow-xl border border-[#E2E8F0] dark:border-[#1E293B]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/30 text-amber-700 dark:text-amber-300 text-xs font-semibold tracking-wide">
              <Zap size={13} className="text-amber-400" /> MANUEL İDARİ STATÜ MÜDAHALESİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D1B3E] dark:text-white">
              Statü Kontrol & Doğrudan Statü Değişimi
            </h1>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              IMEI, Seri No, Dahili ID veya Batch No ile sorgulayarak bir cihazın statüsünü doğrudan değiştirin. Bu ekran idari düzeltme amaçlıdır.
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-md">
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <label className="block text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">Cihaz Sorgulama (IMEI / Seri No / Dahili ID / Batch No)</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Sorgulanacak cihazı okutunuz veya yazınız..."
                className="w-full bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm font-mono focus:outline-none focus:border-[#2563EB] transition-all disabled:opacity-50"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !term.trim()}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-[#0D1B3E] dark:text-white px-8 py-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Search size={15} /> {loading ? "Sorgulanıyor..." : "Sorgula"}
            </button>
          </div>
        </form>
      </div>

      {/* DEVICE DETAILS & TARGET STATUS SELECTION */}
      {device && (
        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-md space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#162032] border border-[#E2E8F0] dark:border-[#1E293B]">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-[#FAFAFA] font-mono tracking-wide">
                {device.imei_number}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 font-medium">
                Parti: <span className="text-[#0D1B3E] dark:text-white font-semibold">{device.batch_no}</span> · Model: <span className="text-[#0D1B3E] dark:text-white font-semibold">{device.model}</span> · Akış: <span className="text-blue-400 font-semibold">{device.flow}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Mevcut Statü: {device.statu_code} — {currentStatuName(device.statu_code)}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-2">Hedef Yeni Statü Seçiniz</label>
              <select
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value)}
                className="w-full bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#FAFAFA] rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#2563EB] cursor-pointer"
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
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-[#0D1B3E] dark:text-white px-8 py-3 rounded-xl transition-all shadow-md text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {device.statu_code} <ArrowRight size={15} /> {targetCode || "?"} {applying ? "Uygulanıyor..." : "Statüyü Uygula"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
