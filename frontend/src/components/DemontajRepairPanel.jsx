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
  const [partsWarning, setPartsWarning] = useState(null);
  const [itemFaults, setItemFaults] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [testDetectedParts, setTestDetectedParts] = useState([]);
  const [loadingTestParts, setLoadingTestParts] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState("");
  const [faultCode, setFaultCode] = useState("");
  const [missionGroupCode, setMissionGroupCode] = useState("");
  const [availableMissionCodes, setAvailableMissionCodes] = useState([]);
  const [warrantyCode, setWarrantyCode] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState(false);

  // Ücret tipi (Ücretli/Ücretsiz Onarım) referans listesi (cihazdan bağımsız) mount'ta bir kez çekilir.
  useEffect(() => {
    api.getRepairItemWarranties().then(res => { if (res && res.success) setWarranties(res.warranties || []); });
  }, []);

  // Akış Durumu (Flow) RMA olan cihazlarda Ücretli/Ücretsiz seçimi kullanıcıya bırakılır;
  // diğer tüm akışlarda otomatik "Ücretli" seçilir ve değiştirilemez.
  const isRmaFlow = device?.customerRequest === "To RMA";
  useEffect(() => {
    if (isRmaFlow) return;
    const paidWarranty = warranties.find(w => w.is_paid_for);
    setWarrantyCode(paidWarranty ? paidWarranty.code : "OOW");
  }, [isRmaFlow, warranties]);

  // Parça listesi cihaza özel: hangi marka/model telefon arandıysa sadece o cihazın
  // reçetesindeki (warehouse.product_bom_node - Product Bom sayfasıyla aynı kaynak)
  // parçalar getirilir - bkz. WebBridge.get_parts_for_device. Aynı kategoriden birden fazla
  // parça varsa sadece bir tanesi gösterilir (liste item_category, item_code sıralı geldiğinden
  // her kategorinin ilk kodu seçilir). Reçete hiç girilmemişse backend bir "warning" döner.
  useEffect(() => {
    if (!device?.model) { setParts([]); setPartsWarning(null); return; }
    api.getPartsForDevice(device.model).then(res => {
      if (!res || !res.success) { setParts([]); setPartsWarning(null); return; }
      setPartsWarning(res.warning || null);
      const seenCategories = new Set();
      const deduped = [];
      for (const p of (res.parts || [])) {
        const cat = p.item_category || p.part_category || '';
        if (seenCategories.has(cat)) continue;
        seenCategories.add(cat);
        deduped.push(p);
      }
      setParts(deduped);
    });
  }, [device?.model]);

  const selectedPart = parts.find(p => String(p.id) === String(selectedPartId));
  const selectedItemCategory = selectedPart?.item_category || "";

  // Arıza Tespiti seçenekleri, seçilen parçanın kategorisine göre filtrelenir
  // (warehouse.item_fault.item_category - bkz. WebBridge.get_item_faults_by_category).
  useEffect(() => {
    setFaultCode("");
    if (!selectedItemCategory) { setItemFaults([]); return; }
    api.getItemFaultsByCategory(selectedItemCategory).then(res => {
      setItemFaults(res && res.success ? (res.item_faults || []) : []);
    });
  }, [selectedItemCategory]);

  // Onarım Takımı dropdown'u, seçilen parçanın kategorisine göre item_category_mission'da
  // tanımlı departmanlarla sınırlanır (kategori için hiç tanım yoksa tüm departmanlara geri
  // düşülür). Kategoriye özel uzman ekip (varsa) ilk değer olarak otomatik seçilir, kullanıcı
  // isterse bu daraltılmış listeden başka birini seçebilir.
  useEffect(() => {
    setMissionGroupCode("");
    if (!selectedItemCategory) { setAvailableMissionCodes([]); return; }
    api.getMissionsForItemCategory(selectedItemCategory).then(res => {
      setAvailableMissionCodes(res && res.success ? (res.mission_codes || []) : []);
    });
    api.getMissionForItemCategory(selectedItemCategory).then(res => {
      if (res && res.success && res.mission_code) setMissionGroupCode(res.mission_code);
    });
  }, [selectedItemCategory]);

  const filteredMissionGroups = availableMissionCodes.length > 0
    ? missionGroups.filter(mg => availableMissionCodes.includes(mg.code))
    : missionGroups;

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
      deviceRef, missionGroupCode, warrantyCode, description, getCurrentUser()?.username,
      selectedPart?.item_code || "", faultCode, ""
    );
    setAdding(false);
    if (!res || !res.success) {
      showNotif("error", "Eklenemedi", res?.message || "İşlem başarısız oldu.");
      return;
    }
    await onRefresh();
    setSelectedPartId(""); setFaultCode(""); setMissionGroupCode(""); setDescription("");
    if (isRmaFlow) setWarrantyCode("");
    showNotif("success", "Parça Eklendi", selectedPart ? (selectedPart.name || selectedPart.item_code) : "Onarım kaydı eklendi.");
  }, [device, missionGroupCode, faultCode, warrantyCode, description, selectedPartId, parts, adding, onRefresh, showNotif, isRmaFlow]);

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
                      <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">{p.symptomCode || "N/A"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{p.partCategory || "N/A"}</td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">{p.partItemCode || "N/A"}</td>
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
            {partsWarning && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{partsWarning}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PartSelectCombobox parts={parts} value={selectedPartId} onChange={setSelectedPartId} placeholder="Parça seçiniz..." labelMode="category" />
              <select
                value={faultCode}
                onChange={e => setFaultCode(e.target.value)}
                disabled={!selectedItemCategory}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{selectedItemCategory ? "Arıza Tespiti seçiniz..." : "Önce parça seçiniz..."}</option>
                {itemFaults.length > 0
                  ? itemFaults.map(f => <option key={f.code} value={f.code}>{f.short_name}</option>)
                  : selectedItemCategory && <option value="N/A">N/A</option>}
              </select>
              <select
                value={missionGroupCode}
                onChange={e => setMissionGroupCode(e.target.value)}
                disabled={!selectedItemCategory}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="">{selectedItemCategory ? "Onarım Takımı seçiniz..." : "Önce parça seçiniz..."}</option>
                {filteredMissionGroups.map(mg => <option key={mg.code} value={mg.code}>{mg.short_name} ({mg.code})</option>)}
              </select>
              <select
                value={warrantyCode}
                onChange={e => setWarrantyCode(e.target.value)}
                disabled={!isRmaFlow}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="">Ücretli/Ücretsiz Onarım seçiniz...</option>
                {warranties.map(w => <option key={w.code} value={w.code}>{w.short_name}</option>)}
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
                disabled={!hasAccess || !missionGroupCode || !warrantyCode || adding}
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
                    <th className="text-left px-3 py-2.5">Ücret Tipi</th>
                    <th className="text-left px-3 py-2.5">Arıza Tespiti</th>
                    <th className="text-left px-3 py-2.5">Açıklama</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#30363D]">
                  {repairs.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">{r.partItemCode || "N/A"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{r.missionGroup}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${r.chargeType === "FREE" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"}`}>
                          {r.chargeType === "FREE" ? "Ücretsiz" : "Ücretli"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{r.faultName || "N/A"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{r.notes || "N/A"}</td>
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
