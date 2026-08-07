import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, AlertTriangle, Battery, BatteryCharging, X, Info, Wrench
} from "lucide-react";
import { api } from "../services/api";
import DemontajRepairPanel from "../components/DemontajRepairPanel";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

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
    success: <span className="text-emerald-500">●</span>,
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

const DemontajServisOnarimlari = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [device, setDevice] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [missionGroups, setMissionGroups] = useState([]);
  const [serviceStatuList, setServiceStatuList] = useState([]);
  const [diagnosisDraft, setDiagnosisDraft] = useState("");
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    api.getMissionGroups().then(res => {
      if (res && res.success) setMissionGroups(res.mission_groups || []);
    });
  }, []);

  useEffect(() => {
    api.getServiceStatuList().then(res => {
      if (res && res.success) setServiceStatuList(res.service_statu || []);
    });
  }, []);

  const showNotif = useCallback((type, title, message) => {
    setNotification({ type, title, message });
    if (type !== "error") setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term || isSearching) return;

    setIsSearching(true);
    try {
      const batchRes = await api.lookupBatchEntry(term);
      if (!batchRes || !batchRes.success || !batchRes.found || !batchRes.data) {
        showNotif("error", "Kayıt Bulunamadı", `"${term}" için Batch Giriş kayıtlarında eşleşme yok.`);
        setDevice(null);
        setRepairs([]);
        return;
      }

      const d = batchRes.data;
      const imei = d.imei_number || term;
      const productInfo = [d.model, d.gb, d.color].filter(Boolean).join(" ");
      const batchStatusCode = (d.statu_code !== null && d.statu_code !== undefined) ? Number(d.statu_code) : null;

      // Cihazın Flow'una göre DGD işçilik kodunu otomatik ekler (idempotent - zaten eklenmişse
      // tekrar eklemez). Arama akışını bloklamaz, hata olursa sessizce yutulur.
      try {
        const dgdRes = await api.openDeviceForDismantle(imei, getCurrentUser()?.username);
        if (dgdRes && dgdRes.attached) {
          showNotif("info", "DGD İşçiliği Eklendi", `"${dgdRes.dgd_item_code}" işçilik kodu Flow'a göre otomatik eklendi.`);
        }
      } catch (_e) {
        /* auto-attach hatası arama sonucunu etkilemez */
      }

      let repairLink = null;
      try {
        const repairRes = await api.getRepairOperationsByImei(imei);
        if (repairRes && repairRes.success) repairLink = repairRes;
      } catch (_e) {
        repairLink = null;
      }

      // Müşteri Arıza Tespiti'ni PhoneCheck'ten (başarısız/Failed testler) çek. Kayıtlı bir
      // tespit varsa o korunur; yoksa PhoneCheck sonucu kullanılır.
      // Müşteri Arıza Tespiti, Notes ve batarya bilgileri yerel phonecheck_test_results
      // tablosundaki EN GÜNCEL kayıttan çekilir (canlı API'ye gidilmez).
      let phonecheckDefects = "", phonecheckNotes = "", pcBatteryCycle = null, pcBatteryHealth = null;
      try {
        const pcs = await api.getPhonecheckStoredByImei(imei);
        if (pcs && pcs.success && pcs.found && pcs.data) {
          phonecheckDefects = (pcs.data.failed || "").trim();
          phonecheckNotes = (pcs.data.notes || "").trim();
          pcBatteryCycle = pcs.data.battery_cycle ?? null;
          pcBatteryHealth = pcs.data.battery_health_percentage ?? null;
        }
      } catch (_e) { /* Kayıt yoksa mevcut/boş değerler kullanılır */ }

      const realDevice = {
        imei,
        internalId: d.internal_id || "",
        serialNo: d.serial_number || "",
        brand: d.brand || "",
        model: d.model || "",
        productInfo: productInfo || "-",
        productCode: d.batch_no || "",
        customerNo: d.customer_no || "",
        currency: d.currency || "EUR",
        customerRequest: d.flow || "Belirtilmemiş",
        // Öncelik: kayıtlı tespit → canlı PhoneCheck (Failed) → Batch girişinde PhoneCheck'ten
        // çekilip saklanan defects. Böylece cihaz PhoneCheck'te canlı bulunmasa da tespit görünür.
        customerDiagnosis: repairLink?.device?.customerDiagnosis || phonecheckDefects || (d.defects || ""),
        phonecheckNotes: phonecheckNotes || "",
        serviceStatus: batchStatusCode,
        serviceStatusText: batchStatusCode == null ? (repairLink?.device?.statusText || "") : "",
        workOrderId: repairLink ? repairLink.work_order_id : null,
        batteryCycle: pcBatteryCycle ?? repairLink?.battery_cycle ?? d.battery_cycle ?? null,
        batteryHealth: pcBatteryHealth ?? repairLink?.battery_health ?? d.battery_health_percentage ?? null,
      };

      setDevice(realDevice);
      setDiagnosisDraft(realDevice.customerDiagnosis || "");

      if (repairLink) {
        // technician sabit "" yazılırsa Teklif Parçaları tablosundaki Teknisyen sütunu
        // atama yapılmış kayıtlarda bile boş kalır. Backend assignedTechnicianName
        // dönüyor (bkz. get_repair_operations_by_imei), onu kullanıyoruz.
        setRepairs((repairLink.repairs || []).map(r => ({ ...r, technician: r.assignedTechnicianName || r.assignedTechnician || "", parts: [] })));
        showNotif("success", "Cihaz Yüklendi", `${realDevice.productInfo} — IMEI: ${realDevice.imei}`);
      } else {
        setRepairs([]);
        if (batchStatusCode != null) {
          showNotif("success", "Cihaz Yüklendi", `${realDevice.productInfo} — IMEI: ${realDevice.imei} (Statü: ${batchStatusCode})`);
        } else {
          showNotif("warning", "Bağlı İş Emri Yok", "Cihaz Batch Girişi'nde bulundu ama statü/iş emri bilgisi yok. Sadece kimlik bilgileri gösteriliyor.");
        }
      }
    } catch (err) {
      setDevice(null);
      setRepairs([]);
      showNotif("error", "Sorgu Hatası", err?.message || "Sorgulama başarısız oldu.");
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, isSearching, showNotif]);

  const handleSaveDiagnosis = useCallback(async () => {
    if (!device?.imei) return;
    setSavingDiagnosis(true);
    const deviceRef = device.workOrderId || device.imei;
    const res = await api.updateCustomerDiagnosis(deviceRef, diagnosisDraft, getCurrentUser()?.username);
    setSavingDiagnosis(false);
    if (res && res.success) {
      setDevice(prev => (prev ? { ...prev, customerDiagnosis: diagnosisDraft } : prev));
      showNotif("success", "Arıza Tespiti Kaydedildi", "Müşteri arıza tespiti güncellendi.");
    } else {
      showNotif("error", "Kaydedilemedi", res?.message || "İşlem başarısız oldu.");
    }
  }, [device, diagnosisDraft, showNotif]);

  const refreshRepairs = useCallback(async () => {
    if (!device?.imei) return null;
    const refreshed = await api.getRepairOperationsByImei(device.imei).catch(() => null);
    if (refreshed && refreshed.success) {
      setRepairs((refreshed.repairs || []).map(r => ({ ...r, technician: r.assignedTechnicianName || r.assignedTechnician || "", parts: [] })));
    }
    // Onarım eklendikten sonra cihazın statüsü backend'de değişmiş olabilir (örn. Üretim
    // aşamasındaki bir cihaza yeni onarım eklenince statü 105'e geri çekilir ve "Müşteri
    // Onayına Gönder / Üretime Aktar" kararı yeniden görünür). Statüyü de tazeleyip
    // ekrandaki karar butonunun anlık güncellenmesini sağlıyoruz.
    try {
      const statusRes = await api.lookupBatchEntry(device.imei);
      if (statusRes && statusRes.success && statusRes.found && statusRes.data) {
        const newCode = (statusRes.data.statu_code !== null && statusRes.data.statu_code !== undefined)
          ? Number(statusRes.data.statu_code) : null;
        setDevice(prev => (prev && newCode !== null && newCode !== prev.serviceStatus
          ? { ...prev, serviceStatus: newCode }
          : prev));
      }
    } catch (_e) { /* statü tazeleme başarısızsa mevcut statü korunur */ }
    return refreshed;
  }, [device]);

  const currentUser = getCurrentUser();
  const isAdminUser = ["admin", "developer"].includes((currentUser?.role || "").trim().toLowerCase());
  const userMissions = (currentUser?.gorev || "").split(",").map(s => s.trim()).filter(Boolean);
  const currentStatuInfo = (device && device.serviceStatus != null)
    ? serviceStatuList.find(s => s.code === device.serviceStatus)
    : null;
  const requiredMission = currentStatuInfo?.mission || "";
  const hasAccess = isAdminUser || !requiredMission || userMissions.includes(requiredMission);

  // Parça ekleme yalnızca cihaz gerçekten Demontaj aşamasındaysa yapılabilir: uygun statü,
  // gerekli mission'ı TEC_DISMANTLE olan statüdür. Cihaz başka bir statüye (ör. Üretime
  // Aktarıldı / Müşteri Onayı) geçtiyse ya da hiç statü/iş emri yoksa parça eklenemez —
  // admin dahil (bu, kullanıcı yetkisinden bağımsız bir statü kuralıdır, hasAccess'ten ayrıdır).
  const statusAllowsParts = (currentStatuInfo?.mission || "").trim().toUpperCase() === "TEC_DISMANTLE";

  const isTestTechnician = userMissions.some(m => m === "QAC" || m.startsWith("QAC_"));
  const canEditDiagnosis = isAdminUser || (hasAccess && isTestTechnician);

  const statusBadge = (() => {
    if (!device) return null;
    if (device.serviceStatus != null) {
      const label = currentStatuInfo ? `${device.serviceStatus} - ${currentStatuInfo.short_name}` : `${device.serviceStatus}`;
      return { tone: hasAccess ? "ok" : "locked", text: `Statü: ${label}` };
    }
    if (device.serviceStatusText) {
      return { tone: "neutral", text: `Statü: ${device.serviceStatusText}` };
    }
    return { tone: "locked", text: "Bağlı İş Emri Yok" };
  })();

  useEffect(() => { searchRef.current?.focus(); }, []);

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(63, 161, 135,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(63, 161, 135,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <Wrench size={13} className="text-emerald-400" /> ÜRETİME AKTAR
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Üretime Aktar
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Cihaz L1 işlemlerini yapın, sökülen ve sağlam parçaları depolara ve DOA lokasyonlarına yönlendirin.
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="glass-card rounded-2xl p-5 shadow-md">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6685] dark:text-[#8892B5]" />
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              disabled={isSearching}
              placeholder="IMEI / Internal ID / Seri No okutunuz..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] bg-[#FFFFFF] dark:bg-[#1e222d] text-xs sm:text-sm text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] focus:outline-none focus:border-[#00B2FF] transition-all disabled:opacity-50 font-mono"
            />
          </div>
          <button type="submit" disabled={isSearching} className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-[#00B2FF] hover:bg-[#1e222d] disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
            <Search size={15} /> {isSearching ? "Sorgulanıyor..." : "Sorgula"}
          </button>
          {statusBadge && (
            <div className={`md:ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${statusBadge.tone === 'ok' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' : statusBadge.tone === 'neutral' ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'}`}>
              <span className={`w-2 h-2 rounded-full ${statusBadge.tone === 'ok' ? 'bg-emerald-400 animate-pulse' : statusBadge.tone === 'neutral' ? 'bg-blue-400' : 'bg-rose-400'}`}></span>
              {statusBadge.text}
            </div>
          )}
        </form>
      </div>

      {device && !hasAccess && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
          <Info size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            Bu cihaz şu an <strong>"{currentStatuInfo ? `${currentStatuInfo.short_name} (${device.serviceStatus})` : device.serviceStatus}"</strong> aşamasında
            — bu aşamada işlem yapabilmek için <strong>'{requiredMission}'</strong> yetkisi gerekiyor.
            Senin rollerin: <strong>{userMissions.length > 0 ? userMissions.join(', ') : 'Tanımlı değil'}</strong>.
          </p>
        </div>
      )}

        {device && (
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Akış Durumu (Flow)</label>
                  <div className="px-3 py-2.5 bg-slate-50 dark:bg-[#12141c] rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px]">
                    {device.customerRequest}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Müşteri Arıza Tespiti</label>
                  {canEditDiagnosis ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={diagnosisDraft}
                        onChange={e => setDiagnosisDraft(e.target.value)}
                        rows={2}
                        placeholder="Arıza tespitini giriniz..."
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181a24] text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px] resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                      <button
                        onClick={handleSaveDiagnosis}
                        disabled={savingDiagnosis || diagnosisDraft === (device.customerDiagnosis || "")}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-semibold transition-colors"
                      >
                        {savingDiagnosis ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 bg-slate-50 dark:bg-[#12141c] rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px]">
                      {device.customerDiagnosis || <span className="italic text-slate-400">Belirtilmemiş</span>}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Notes</label>
                  <div className="px-3 py-2.5 bg-slate-50 dark:bg-[#12141c] rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px]">
                    {device.phonecheckNotes || <span className="italic text-slate-400">Not yok</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Ürün Bilgisi</label>
                  <div className="px-3 py-2.5 bg-slate-50 dark:bg-[#12141c] rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px] font-semibold">
                    {device.productInfo}
                    <span className="block text-[10px] font-normal text-slate-500 mt-1">{device.productCode}</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex gap-2 items-start">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <BatteryCharging size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Battery Cycle</span>
                  </div>
                  <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{device.batteryCycle ?? "-"}</p>
                </div>
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Battery size={14} className="text-teal-500" />
                    <span className="text-[10px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-wider">Battery Health</span>
                  </div>
                  <p className={`text-xl font-bold ${device.batteryHealth == null ? 'text-slate-400 dark:text-slate-600' : device.batteryHealth >= 80 ? 'text-teal-700 dark:text-teal-300' : device.batteryHealth >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{device.batteryHealth != null ? `${device.batteryHealth}%` : "-"}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      {device ? (
        <DemontajRepairPanel
          device={device}
          repairs={repairs}
          hasAccess={hasAccess}
          statusAllowsParts={statusAllowsParts}
          statusLabel={currentStatuInfo ? `${currentStatuInfo.short_name} (${device.serviceStatus})` : (device.serviceStatus != null ? String(device.serviceStatus) : "Bağlı iş emri/statü yok")}
          missionGroups={missionGroups}
          onRefresh={refreshRepairs}
          showNotif={showNotif}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 bg-white dark:bg-[#181a24] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm">
          <Search size={48} strokeWidth={1} className="mb-4 opacity-40" />
          <p className="text-sm font-medium">Cihaz barkodunu okutarak başlayınız</p>
          <p className="text-xs mt-1">IMEI, Internal ID veya Seri No giriniz</p>
        </div>
      )}
    </div>
  );
};

export default DemontajServisOnarimlari;
