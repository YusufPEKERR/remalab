import React, { useState } from "react";
import { ScanLine, CheckCircle, AlertTriangle, Info, X, ArrowRight } from "lucide-react";
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
        <p className="text-sm font-bold">{notification.title}</p>
        <p className="text-xs mt-0.5 opacity-80">{notification.message}</p>
      </div>
      <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

const ServiceTransition = () => {
  const [barcode, setBarcode] = useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [currentStatu, setCurrentStatu] = useState(null);

  const showNotification = (type, title, message) => {
    setNotification({ type, title, message });
    if (type !== "error") {
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const fetchTransitions = async (statuCode) => {
    setLoading(true);
    try {
      const data = await api.getAllowedTransitions(statuCode);
      if (data.success) {
        setTransitions(data.transitions);
      } else {
        showNotification("error", "Geçişler alınamadı", data.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!barcode) return;

    setLoading(true);
    setDeviceInfo(null);
    setTransitions([]);
    try {
      const data = await api.getDeviceByBarcode(barcode);

      if (!data.success) {
        showNotification("error", "Cihaz bulunamadı", data.message);
        setCurrentStatu(null);
        return;
      }

      if (data.current_statu_code === 109) {
        showNotification("warning", "Uyarı", "Bu cihaz üretimdedir, teknisyen panelinden işlem yapınız!");
        setCurrentStatu(109);
        return;
      }

      setDeviceInfo({
        imei: data.imei,
        model: data.model || "-",
        statu: data.current_statu_code,
        workOrderId: data.work_order_id,
      });
      setCurrentStatu(data.current_statu_code);
      fetchTransitions(data.current_statu_code);
    } catch (err) {
      console.error(err);
      showNotification("error", "Sistem Hatası", "Cihaz sorgulanırken beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const executeTransition = async (targetStatu) => {
    if (!deviceInfo?.workOrderId) return;
    try {
      const data = await api.executeStatuTransition(deviceInfo.workOrderId, currentStatu, targetStatu, "", "");

      if (data.success) {
        showNotification("success", "Başarılı", data.message || "Statü güncellendi!");
        setCurrentStatu(data.new_statu_code);
        setDeviceInfo((prev) => ({ ...prev, statu: data.new_statu_code }));

        if (data.new_statu_code === 109) {
          showNotification("warning", "Bilgi", "Cihaz üretime geçti. Teknisyen Paneline yönlendiriliyorsunuz.");
          setTransitions([]);
        } else {
          fetchTransitions(data.new_statu_code);
        }
      } else {
        if (data.error_code === "DOA_TRANSFER_REQUIRED") {
          const confirmDoa = window.confirm(data.message + "\nDOA Store'a aktarmak için Tamam'a basın.");
          if (confirmDoa) {
            const doaData = await api.transferToDoa(deviceInfo.workOrderId);
            if (doaData.success) {
              showNotification("success", "DOA Aktarımı", "Parçalar DOA'ya aktarıldı. Şimdi işlemi tekrar deneyebilirsiniz.");
            } else {
              showNotification("error", "DOA Hata", doaData.message);
            }
          }
        } else {
          showNotification("error", "Hata", data.message);
        }
      }
    } catch (e) {
      console.error(e);
      showNotification("error", "Sistem Hatası", "Beklenmeyen bir hata oluştu.");
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
              <ScanLine size={13} className="text-amber-400" /> STATÜ GEÇİŞ İŞLEMLERİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D1B3E] dark:text-white">
              Yedek Parça & Statü Geçiş İşlemleri
            </h1>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Barkod veya IMEI okutarak cihazın kayıt kabul, test veya sevkiyat statüsünü güncelleyin.
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH CARD */}
      <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-md">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-2">Barkod / IMEI Okutun</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Barkod veya IMEI okutunuz..."
                className="flex-1 bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] rounded-xl px-4 py-3 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-[#2563EB] transition-all shadow-xs"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white px-8 py-3 rounded-xl transition-all shadow-md font-bold text-xs cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <ScanLine size={16} /> {loading ? "Sorgulanıyor..." : "Sorgula"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {deviceInfo && currentStatu !== 109 && (
        <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                Cihaz: <span className="font-mono text-[#60A5FA]">{deviceInfo.imei}</span> {deviceInfo.model && <span className="text-[#64748B] dark:text-[#94A3B8]">({deviceInfo.model})</span>}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 dark:bg-blue-500/20 text-blue-400 border border-blue-500/30 w-fit">
              Mevcut Statü: {deviceInfo.statu}
            </span>
          </div>

          <p className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">İzin Verilen Statü Geçişleri</p>

          {transitions.length === 0 ? (
            <p className="text-[#64748B] dark:text-[#94A3B8] text-xs italic">Bu statüden yapılabilecek işlem bulunamadı.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {transitions.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => executeTransition(t.target_statu_code)}
                  className={`px-4 py-3.5 rounded-xl font-bold text-xs text-[#0D1B3E] dark:text-white transition-all shadow-md flex flex-col items-center gap-1 cursor-pointer border ${
                    t.is_positive
                      ? "bg-emerald-600/90 hover:bg-emerald-600 border-emerald-500/40"
                      : "bg-red-600/90 hover:bg-red-600 border-red-500/40"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-extrabold text-sm">
                    {t.target_statu_name} <ArrowRight size={15} />
                  </span>
                  <span className="text-[11px] opacity-80 font-mono">Hedef Statü Kodu: {t.target_statu_code}</span>
                  {(t.kontrol_1 || t.kontrol_2) && (
                    <span className="text-[10px] italic opacity-80">
                      {t.kontrol_1} → {t.kontrol_2}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceTransition;
