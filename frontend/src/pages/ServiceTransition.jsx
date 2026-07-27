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
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <ScanLine className="text-blue-400" size={24} /> Hızlı İşlem / Barkod Ekranı
        </h1>
        <p className="text-slate-400 mt-1">Barkod veya IMEI okutarak cihazın servis statüsünü güncelleyin.</p>
      </div>

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Barkod / IMEI</label>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Barkod veya IMEI okutunuz..."
                className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium whitespace-nowrap flex items-center gap-2"
              >
                <ScanLine size={18} /> {loading ? "Sorgulanıyor..." : "Sorgula"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {deviceInfo && currentStatu !== 109 && (
        <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Cihaz: {deviceInfo.imei} ({deviceInfo.model})
            </h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-500 border-blue-500/20">
              Mevcut Statü: {deviceInfo.statu}
            </span>
          </div>

          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">İzin Verilen Geçişler</p>

          {transitions.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Bu statüden yapılabilecek işlem bulunamadı.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {transitions.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => executeTransition(t.target_statu_code)}
                  className={`px-4 py-3 rounded-xl font-medium text-sm text-white transition-all shadow-lg flex flex-col items-center gap-1 ${
                    t.is_positive
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                      : "bg-red-600 hover:bg-red-700 shadow-red-900/20"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    {t.target_statu_name} <ArrowRight size={14} />
                  </span>
                  <span className="text-[11px] opacity-75">Kod: {t.target_statu_code}</span>
                  {(t.kontrol_1 || t.kontrol_2) && (
                    <span className="text-[10px] italic opacity-75">
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
