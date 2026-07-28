import { useState, useEffect, useCallback } from "react";
import { Plus, Package, Wrench, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import PartSelectCombobox from "./PartSelectCombobox";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

// ─── DEMONTAJ TEKNİSYENİ ÖZEL PANELİ ─────────────────────────────────
// Eski "Remalab Lifecycle Management Suite" masaüstü uygulamasının "Demontaj" ekranına
// (bkz. proje geçmişi) benzer, TEC_DISMANTLE rolüne özel Servis Onarımları görünümü.
export default function DemontajRepairPanel({ device, repairs, hasAccess, missionGroups, onRefresh, showNotif }) {
  const [parts, setParts] = useState([]);
  const [itemFaults, setItemFaults] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);
  const [testDetectedParts, setTestDetectedParts] = useState([]);
  const [loadingTestParts, setLoadingTestParts] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState("");
  const [faultCode, setFaultCode] = useState("");
  const [missionGroupCode, setMissionGroupCode] = useState("");
  const [operationCode, setOperationCode] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState(false);

  // Statik referans listeleri (parça/arıza/işlem) mount'ta bir kez çekilir.
  useEffect(() => {
    api.getParts().then(res => { if (res && res.success) setParts(res.parts || []); });
    api.getItemFaults().then(res => { if (res && res.success) setItemFaults(res.item_faults || []); });
    api.getRepairItemOperationTypes().then(res => { if (res && res.success) setOperationTypes(res.operation_types || []); });
  }, []);

  // Test aşamasında (QAC) tespit edilen, planlı parçalar — cihaz değiştikçe yeniden çekilir.
  // QAC test ekranı henüz olmadığından bu liste şu an her zaman boş döner.
  useEffect(() => {
    if (!device?.imei) { setTestDetectedParts([]); return; }
    setLoadingTestParts(true);
    api.getTestDetectedParts(device.imei).then(res => {
      setTestDetectedParts(res && res.success ? (res.parts || []) : []);
      setLoadingTestParts(false);
    });
  }, [device?.imei]);

  const handleAddRow = useCallback(async () => {
    if (!device || !missionGroupCode || adding) return;
    setAdding(true);
    const selectedPart = parts.find(p => String(p.id) === String(selectedPartId));
    const deviceRef = device.workOrderId || device.imei;
    const res = await api.addRepairRecord(
      deviceRef, missionGroupCode, "OOW", description, getCurrentUser()?.username,
      selectedPart?.item_code || "", faultCode, operationCode
    );
    setAdding(false);
    if (!res || !res.success) {
      showNotif("error", "Eklenemedi", res?.message || "İşlem başarısız oldu.");
      return;
    }
    await onRefresh();
    setSelectedPartId(""); setFaultCode(""); setMissionGroupCode(""); setOperationCode(""); setDescription("");
    showNotif("success", "Parça Eklendi", selectedPart ? (selectedPart.name || selectedPart.item_code) : "Onarım kaydı eklendi.");
  }, [device, missionGroupCode, faultCode, operationCode, description, selectedPartId, parts, adding, onRefresh, showNotif]);

  // Onarım Takımları — repairs içindeki benzersiz görev gruplarından türetilir.
  const activeMissionGroupCodes = new Set(repairs.map(r => r.missionGroupCode).filter(Boolean));

  // Planlı (test aşamasında tespit edilmiş) parça kodları ile eklenen onarımları karşılaştırıp
  // "Üretime Aktar" mı "Müşteri Onayı Alınacak" mı gerektiğini anlık önizler — gerçek karar
  // submit_dismantle_decision içinde backend'de yeniden ve otoriter şekilde hesaplanır.
  const plannedPartCodes = new Set(testDetectedParts.map(p => p.partItemCode).filter(Boolean));
  const hasRepairs = repairs.length > 0;
  const allPlanned = hasRepairs && repairs.every(r => r.partItemCode && plannedPartCodes.has(r.partItemCode));

  const handleSubmitDecision = useCallback(async () => {
    if (!device?.imei || !hasRepairs || deciding) return;
    setDeciding(true);
    const res = await api.submitDismantleDecision(device.imei, getCurrentUser()?.username);
    setDeciding(false);
    if (res && res.success) {
      showNotif("success", allPlanned ? "Üretime Aktarıldı" : "Müşteri Onayına Gönderildi", res.message || "");
      await onRefresh();
    } else {
      showNotif("error", "İşlem Başarısız", res?.message || "Statü güncellenemedi.");
    }
  }, [device, hasRepairs, deciding, allPlanned, onRefresh, showNotif]);

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* ── Sol Panel: Test: Sorun Tespit Edilen Parçalar ── */}
        <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#30363D]">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} className="text-slate-400" /> Test: Sorun Tespit Edilen Parçalar
            </h3>
          </div>
          <div className="flex-1 overflow-auto">
            {loadingTestParts ? (
              <div className="flex items-center justify-center h-full py-12 text-sm text-slate-400">Yükleniyor...</div>
            ) : testDetectedParts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
                <p className="text-sm font-medium">Veri yok</p>
                <p className="text-xs mt-1 text-center px-6">Test aşaması (QAC) bu cihaz için henüz bir tespit kaydı girmedi.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#0f1219] sticky top-0">
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-4 py-2.5">Semptom</th>
                    <th className="text-left px-3 py-2.5">Parça Kategorisi</th>
                    <th className="text-left px-3 py-2.5">Parça kodu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#30363D]">
                  {testDetectedParts.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">{p.symptomCode || "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{p.partCategory || "-"}</td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">{p.partItemCode || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Sağ Panel: Teknik: Teklif Parçaları ── */}
        <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#30363D]">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Wrench size={16} className="text-slate-400" /> Teknik: Teklif Parçaları
            </h3>
          </div>
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#30363D] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PartSelectCombobox parts={parts} value={selectedPartId} onChange={setSelectedPartId} placeholder="Parça seçiniz..." />
              <select value={faultCode} onChange={e => setFaultCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Arıza Tespiti seçiniz...</option>
                {itemFaults.map(f => <option key={f.code} value={f.code}>{f.short_name}</option>)}
              </select>
              <select value={missionGroupCode} onChange={e => setMissionGroupCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Onarım Takımı seçiniz...</option>
                {missionGroups.map(mg => <option key={mg.code} value={mg.code}>{mg.short_name} ({mg.code})</option>)}
              </select>
              <select value={operationCode} onChange={e => setOperationCode(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">İşlem seçiniz...</option>
                {operationTypes.map(o => <option key={o.code} value={o.code}>{o.short_name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Açıklama..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={handleAddRow}
                disabled={!hasAccess || !missionGroupCode || adding}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus size={14} /> {adding ? "Ekleniyor..." : "EKLE"}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {repairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
                <p className="text-sm font-medium">Henüz teklif parçası eklenmedi</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#0f1219] sticky top-0">
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-4 py-2.5">Parça kodu</th>
                    <th className="text-left px-3 py-2.5">Onarım Takımı</th>
                    <th className="text-left px-3 py-2.5">İşlem</th>
                    <th className="text-left px-3 py-2.5">Arıza Tespiti</th>
                    <th className="text-left px-3 py-2.5">Açıklama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#30363D]">
                  {repairs.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">{r.partItemCode || "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{r.missionGroup}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{r.operationTypeName || "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{r.faultName || "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{r.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Onarım Takımları + Karar ── */}
      <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-sm overflow-hidden px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Onarım Takımları</label>
            <div className="flex flex-wrap gap-2">
              {missionGroups.map(mg => {
                const active = activeMissionGroupCodes.has(mg.code);
                return (
                  <span
                    key={mg.code}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${active ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" : "bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700"}`}
                  >
                    {active ? <CheckCircle size={11} /> : null} {mg.short_name}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            onClick={handleSubmitDecision}
            disabled={!hasAccess || !hasRepairs || deciding}
            className={`px-5 py-3 rounded-xl text-white text-sm font-bold transition-colors shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 ${allPlanned ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-violet-600 hover:bg-violet-700 shadow-violet-500/20"}`}
          >
            {allPlanned ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {deciding ? "İşleniyor..." : allPlanned ? "Üretime Aktar" : "Müşteri Onayı Alınacak"}
          </button>
        </div>
      </div>
    </div>
  );
}
