import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  ScanLine, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Check, 
  RefreshCw, 
  Info, 
  Barcode, 
  Search, 
  Wrench, 
  Smartphone, 
  ChevronLeft,
  ChevronRight,
  Package,
  User,
  Trash2,
  ArrowRightCircle
} from "lucide-react";
import { api } from "../services/api";

const VARSAYILAN = {
  sourceStatu: 106,
  autoTargetStatu: null,
  araStatu: null,
  approveTarget: 109,
  rejectTarget: 124,
  rozet: "MÜŞTERİ ONAY KARARLARI",
  baslik: "Müşteri Onayı Bekleyen Cihazlar",
  bosMetin: "Müşteri onayı bekleyen cihaz bulunmuyor.",
};

const SUPPLY_TONES = {
  "Stoktan Çıktı":                  "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  "Depodan parça talep edilebilir": "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
  "Stok Yok":                       "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  "Tedarik edilemiyor":             "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  "Talepsiz":                       "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  "İptal Edildi":                   "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  "Teslim Edildi":                  "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  "Talep Edildi":                   "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
};
const SUPPLY_TONE_DEFAULT = "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";

const getSupplyLabel = (r) => {
  if (r.isCancelled || r.statusCode === 1003) return null;
  const code = (r.supplyStatusCode || "").trim();
  if (code) return r.supplyStatusName || code;
  if (r.isStoksuz) return "Talepsiz";
  return null; // will show loading/unknown indicator
};

const CHARGE_TYPES = {
  PAID: { label: "Ücretli", bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30", color: "text-amber-600 dark:text-amber-400" },
  FREE: { label: "Ücretsiz", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30", color: "text-emerald-600 dark:text-emerald-400" },
};

const STATUS_BADGES = {
  1000: { label: "1000 - Atama Bekliyor", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  1001: { label: "1001 - Onarımda", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  1002: { label: "1002 - Onarım Tamamlandı", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  1003: { label: "1003 - Onarım İptal Edildi", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  1004: { label: "1004 - Yüksek Seviye Onarım Bekleniyor", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  1005: { label: "1005 - Dış Serviste", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  1006: { label: "1006 - Bitiş Testinde", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
};

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

const CustomerApprovalDecision = (props) => {
  const {
    sourceStatu: SOURCE_STATU,
    autoTargetStatu: AUTO_TARGET_STATU,
    araStatu: ARA_STATU,
    approveTarget: APPROVE_TARGET,
    rejectTarget: REJECT_TARGET,
    rozet, baslik, bosMetin,
  } = { ...VARSAYILAN, ...props };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [notification, setNotification] = useState(null);

  // IMEI ile cihaz sorgulama
  const [scanImei, setScanImei] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedDevice, setScannedDevice] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [selectedRepairIdx, setSelectedRepairIdx] = useState(0);

  const inputRef = useRef(null);

  const getCurrentUser = () => {
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch (_e) {
      return null;
    }
  };

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
  }, [SOURCE_STATU]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const refreshRepairsByImei = async (imei) => {
    try {
      const repRes = await api.getRepairOperationsByImei(imei);
      if (repRes.success && repRes.repairs) {
        setRepairs(repRes.repairs);
      }
    } catch (err) {
      console.error("Parçalar güncellenemedi:", err);
    }
  };

  // IMEI Sorgula
  const handleDeviceLookup = async (imeiToLookup) => {
    const cleanRef = (imeiToLookup || scanImei).trim();
    if (!cleanRef) return;

    setScanLoading(true);
    setScannedDevice(null);
    setRepairs([]);
    setSelectedRepairIdx(0);

    try {
      const scanData = await api.scanBatchEntryStatu(cleanRef);
      if (!scanData.success) {
        showNotification("error", scanData.message || "Cihaz bulunamadı.");
        return;
      }

      setScannedDevice(scanData);

      if (AUTO_TARGET_STATU) {
        setProcessingId(scanData.entry_id);
        try {
          const res = await api.executeBatchEntryStatuTransition(scanData.entry_id, SOURCE_STATU, AUTO_TARGET_STATU);
          if (res.success) {
            showNotification("success", `${scanData.imei || "Cihaz"} Müşteri Onayına Sunuldu (${SOURCE_STATU} → ${AUTO_TARGET_STATU}).`);
            setScannedDevice(null);
            setScanImei("");
            loadItems();
          } else {
            showNotification("error", res.message);
          }
        } finally {
          setProcessingId(null);
        }
        return;
      }

      try {
        const repRes = await api.getRepairOperationsByImei(scanData.imei || cleanRef);
        if (repRes.success && repRes.repairs) {
          setRepairs(repRes.repairs);
        }
      } catch (err) {
        console.error("Onarım parçaları çekilemedi:", err);
      }
    } catch (err) {
      showNotification("error", err.message || "Cihaz bilgileri çekilirken hata oluştu.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    handleDeviceLookup();
  };

  // KARAR İŞLEME (ONAY 109 / RED 124)
  const handleDecision = async (entry, targetStatu) => {
    const entryId = entry.entry_id || entry.id;
    setProcessingId(entryId);
    try {
      let mevcut = SOURCE_STATU;
      if (ARA_STATU) {
        const ara = await api.executeBatchEntryStatuTransition(entryId, mevcut, ARA_STATU);
        if (!ara.success) {
          showNotification("error", ara.message);
          return;
        }
        mevcut = ARA_STATU;
      }
      const data = await api.executeBatchEntryStatuTransition(entryId, mevcut, targetStatu);
      if (data.success) {
        showNotification("success", data.message);
        
        if (scannedDevice && String(scannedDevice.entry_id || scannedDevice.id) === String(entryId)) {
          setScannedDevice(null);
          setScanImei("");
          setRepairs([]);
        }

        loadItems();
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

  // PARÇA İPTAL ET (Soft Cancel: kayıt fiziksel silinmez, repair_result_type_code = 1003 yapılır)
  const handleDeletePart = async (repairRecord) => {
    if (!repairRecord || !scannedDevice) return;
    const username = getCurrentUser()?.username || "";

    try {
      const res = await api.cancelRepairRecord(repairRecord.id, username);
      if (res && res.success) {
        showNotification("success", `${repairRecord.partItemCode || repairRecord.itemCategory || "Parça"} iptal edildi ('1003 - Onarım İptal Edildi').`);
        await refreshRepairsByImei(scannedDevice.imei);
      } else {
        showNotification("error", res?.message || "Parça iptal edilemedi.");
      }
    } catch (err) {
      console.error("Parça iptal etme hatası:", err);
      showNotification("error", "Parça iptal edilirken hata oluştu.");
    }
  };

  // Görev grubuna göre gruplama (Teknisyen Onarımları Ekranı Birebir Yapısı)
  const groupedRepairs = useMemo(() => {
    const map = new Map();
    for (const r of repairs) {
      const key = r.missionGroup || r.missionGroupCode || "Onarım";
      if (!map.has(key)) map.set(key, { key, missionGroup: key, items: [] });
      map.get(key).items.push(r);
    }
    return Array.from(map.values()).map(g => {
      const activeItem = g.items.find(r => !r.isCancelled && (r.technician || r.assignedTechnicianName)) ||
                         g.items.find(r => !r.isCancelled) || 
                         g.items[g.items.length - 1];
      const techName = g.items.map(r => r.technician || r.assignedTechnicianName).find(Boolean) || "";
      return {
        ...g,
        active: { ...activeItem, technician: techName || activeItem?.technician || "" }
      };
    });
  }, [repairs]);

  const selectedGroup = groupedRepairs[selectedRepairIdx] || null;

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(122, 84, 192,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(122, 84, 192,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 text-xs font-semibold tracking-wide">
              <ScanLine size={13} className="text-purple-400" /> {rozet}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              {baslik}
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              {AUTO_TARGET_STATU ? (
                <>IMEI okutun veya listeden seçin. Cihaz okutulduğu an <strong>{SOURCE_STATU} ➔ {AUTO_TARGET_STATU} (Müşteri Onayına Sunuldu)</strong> statüsüne otomatik aktarılacaktır.</>
              ) : (
                <>IMEI okutun veya yazın. Onarım detaylarını inceleyin ve müşteri kararını işleyin: <strong>Onaylandı</strong> → {APPROVE_TARGET} (üretime aktarılır), <strong>İade Edilecek</strong> → {REJECT_TARGET} (onarılmadan son teste teslim edilir).</>
              )}
            </p>
          </div>

          <button
            onClick={loadItems}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 shrink-0"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Yenile
          </button>
        </div>
      </div>

      {/* SCAN BAR SECTION */}
      <div className="bg-white/80 dark:bg-[#12141c]/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Barcode className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="IMEI, Seri No veya Internal ID okutun / yazın..."
              className="w-full pl-12 pr-4 py-3.5 text-sm sm:text-base font-mono font-semibold rounded-xl bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={scanImei}
              onChange={(e) => setScanImei(e.target.value)}
              disabled={scanLoading}
            />
          </div>
          <button
            type="submit"
            disabled={scanLoading || !scanImei.trim()}
            className="w-full sm:w-auto px-8 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            {scanLoading ? "Sorgulanıyor..." : AUTO_TARGET_STATU ? `Aktar (${SOURCE_STATU} → ${AUTO_TARGET_STATU})` : "Cihaz Sorgula"}
          </button>
        </form>
      </div>

      {/* SCANNED DEVICE & TECHNICIAN REPAIR OPERATIONS UI COPY */}
      {!AUTO_TARGET_STATU && scannedDevice && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* MAIN CARD: ONARIM DETAY */}
          <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden flex flex-col">
            {/* Header Title */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e222d] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Wrench size={18} className="text-purple-500" />
                  Onarım Detay
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {repairs.length} kayıt
                  </span>
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {scannedDevice.brand} {scannedDevice.model} · <strong className="text-slate-800 dark:text-slate-200">{scannedDevice.imei}</strong>
                </div>
              </div>
            </div>

            {/* Repair Navigation Group Tabs (Sekmeler) */}
            {groupedRepairs.length > 0 && (
              <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-[#181a24]/50 border-b border-slate-100 dark:border-[#1e222d] flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setSelectedRepairIdx(Math.max(0, selectedRepairIdx - 1))}
                  disabled={selectedRepairIdx === 0}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0"
                >
                  <ChevronLeft size={16} className="text-slate-500" />
                </button>

                {groupedRepairs.map((g, i) => (
                  <button
                    key={g.key}
                    onClick={() => setSelectedRepairIdx(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                      i === selectedRepairIdx
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                        : "bg-white dark:bg-[#12141c] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50"
                    }`}
                  >
                    {g.key}
                    <span className={`px-1.5 rounded-full text-[10px] font-bold ${i === selectedRepairIdx ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                      ×{g.items.length}
                    </span>
                  </button>
                ))}

                <button
                  onClick={() => setSelectedRepairIdx(Math.min(groupedRepairs.length - 1, selectedRepairIdx + 1))}
                  disabled={selectedRepairIdx === groupedRepairs.length - 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0"
                >
                  <ChevronRight size={16} className="text-slate-500" />
                </button>
              </div>
            )}

            {/* ONARIM DETAY GRID TABLE (İşlemler sütunu KALDIRILDI) */}
            <div className="flex-1 overflow-x-auto">
              {groupedRepairs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 italic">
                  Aktif onarım kaydı bulunmuyor.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-[#12141c] border-b border-slate-100 dark:border-[#1e222d]">
                    <tr className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                      <th className="text-left px-5 py-3">Görev Grubu</th>
                      <th className="text-left px-3 py-3">Teknisyen</th>
                      <th className="text-left px-3 py-3">Alt Statü</th>
                      <th className="text-left px-3 py-3">Tarih</th>
                      <th className="text-center px-3 py-3">Ücret</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
                    {groupedRepairs.map((g, i) => {
                      const stInfo = STATUS_BADGES[g.active.statusCode] || { label: `${g.active.statusCode || 1000} - Onarımda`, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
                      const chargeInfo = CHARGE_TYPES[g.active.chargeType] || CHARGE_TYPES.PAID;

                      return (
                        <tr
                          key={g.key}
                          onClick={() => setSelectedRepairIdx(i)}
                          className={`cursor-pointer transition-colors ${
                            i === selectedRepairIdx
                              ? "bg-blue-50 dark:bg-blue-500/5 border-l-[3px] border-l-blue-500"
                              : "hover:bg-slate-50 dark:hover:bg-[#12141c] border-l-[3px] border-l-transparent"
                          }`}
                        >
                          <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            {g.key}
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {g.items.length} kayıt
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                            {g.active.technician || <span className="italic text-slate-400">Atanmadı</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold border ${stInfo.color}`}>
                              {stInfo.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {g.active.createdAt || "—"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${chargeInfo.bg} ${chargeInfo.color}`}>
                              {chargeInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* SECTION 2: ONARIM PARÇALARI TABLE (İşlemler Sütunu ve Silme Butonları EKLENDİ) */}
          {selectedGroup && (
            <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1e222d] flex flex-wrap items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Package size={16} className="text-slate-400" />
                  Onarım Parçaları
                  <span className="text-[11px] font-bold text-blue-500">— {selectedGroup.key}</span>
                </h3>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Teknisyen
                  </span>
                  {selectedGroup.active.technician ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                      <User size={12} className="text-blue-500" />
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {selectedGroup.active.technician}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Atanmadı</span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-[#12141c]">
                    <tr className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                      <th className="text-left px-5 py-2.5">Parça Kodu</th>
                      <th className="text-left px-3 py-2.5">Parça Kategorisi</th>
                      <th className="text-left px-3 py-2.5">Arıza Tespiti</th>
                      <th className="text-center px-3 py-2.5">Ücret</th>
                      <th className="text-right px-3 py-2.5">Fiyat</th>
                      <th className="text-center px-3 py-2.5">İşçilik Seviyesi</th>
                      <th className="text-right px-3 py-2.5">İşçilik Fiyatı</th>
                      <th className="text-left px-3 py-2.5">Depo Durum</th>
                      <th className="text-left px-3 py-2.5">Depo Parça</th>
                      <th className="text-left px-3 py-2.5">Açıklama</th>
                      <th className="text-center px-3 py-2.5">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
                    {selectedGroup.items.map((r) => {
                      const chargeInfo = CHARGE_TYPES[r.chargeType] || CHARGE_TYPES.PAID;
                      const isDgd = r.itemCategory === "DGD";

                      return (
                        <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-[#12141c] transition-colors ${r.isCancelled || r.statusCode === 1003 ? "opacity-50 bg-rose-500/5" : ""}`}>
                          <td className="px-5 py-2.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {r.partItemCode || "N/A"}
                          </td>
                          <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200">
                            {r.itemCategory || "N/A"}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                            {r.faultName || "N/A"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${chargeInfo.bg} ${chargeInfo.color}`}>
                              {chargeInfo.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200">
                            0.00 USD
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {!isDgd && r.labourLevel ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
                                {r.labourLevel}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200">
                            0.00 USD
                          </td>
                          {/* DEPO DURUM (Dinamik) */}
                          <td className="px-3 py-2.5">
                            {r.isCancelled || r.statusCode === 1003 ? (
                              <span className="text-slate-400 text-[10px]">—</span>
                            ) : (() => {
                              const label = getSupplyLabel(r);
                              if (!label) return <span className="text-slate-400 text-[10px]">…</span>;
                              const tone = SUPPLY_TONES[label] || SUPPLY_TONE_DEFAULT;
                              return (
                                <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${tone}`}>
                                  {label}
                                </span>
                              );
                            })()}
                          </td>
                          {/* DEPO PARÇA (Dinamik) */}
                          <td className="px-3 py-2.5">
                            {!r.partItemCode || r.isStoksuz ? (
                              <span className="text-slate-400 text-[10px]">—</span>
                            ) : r.isDelivered ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                                Teslim Edildi
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                                Bekleniyor
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {r.notes || "[Müşteri Onay Kararı Bekleniyor]"}
                          </td>
                          {/* İŞLEMLER SÜTUNU (İptal Etme Butonu / İptal Edildi Rozeti) */}
                          <td className="px-3 py-2.5 text-center">
                            {r.isCancelled || r.statusCode === 1003 ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                                İptal Edildi
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeletePart(r)}
                                title="Parçayı İptal Et (1003)"
                                className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DECISION BUTTONS AT THE VERY BOTTOM */}
          <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm flex flex-col sm:flex-row items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => handleDecision(scannedDevice, REJECT_TARGET)}
              disabled={processingId === (scannedDevice.entry_id || scannedDevice.id)}
              className="w-full sm:w-auto px-6 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <AlertTriangle size={18} />
              {processingId === (scannedDevice.entry_id || scannedDevice.id) ? "İşleniyor..." : `İade Edilecek (Red → ${REJECT_TARGET})`}
            </button>

            <button
              type="button"
              onClick={() => handleDecision(scannedDevice, APPROVE_TARGET)}
              disabled={processingId === (scannedDevice.entry_id || scannedDevice.id)}
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check size={18} />
              {processingId === (scannedDevice.entry_id || scannedDevice.id) ? "İşleniyor..." : `Müşteri Onayladı (Onay → ${APPROVE_TARGET})`}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerApprovalDecision;
