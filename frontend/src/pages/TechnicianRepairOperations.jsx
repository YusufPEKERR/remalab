import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  Search, Plus, Play, AlertTriangle, Shield, Battery,
  BatteryCharging, Cpu, X, ChevronLeft, ChevronRight, Wrench,
  CheckCircle, Clock, Package, ArrowRightLeft, Info, User
} from "lucide-react";
import { api } from "../services/api";
import PartSelectCombobox from "../components/PartSelectCombobox";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}


// ─── REPAIR STATUS CODES ────────────────────────────────────────────
// warehouse.repair_result_type tablosundaki gerçek statü kodları/anlamları.
const REPAIR_STATUS = {
  1000: { label: "Teknisyene Atanacak", color: "bg-slate-500", textColor: "text-slate-600 dark:text-slate-400", bgLight: "bg-slate-100 dark:bg-slate-800" },
  1001: { label: "Teknisyene Atandı", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400", bgLight: "bg-blue-50 dark:bg-blue-500/10" },
  1002: { label: "Onarım Tamamlandı", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400", bgLight: "bg-emerald-50 dark:bg-emerald-500/10" },
  1003: { label: "Onarım İptal Edildi", color: "bg-red-500", textColor: "text-red-600 dark:text-red-400", bgLight: "bg-red-50 dark:bg-red-500/10" },
  1004: { label: "Yüksek Seviye Onarımını Bekliyor", color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400", bgLight: "bg-violet-50 dark:bg-violet-500/10" },
  1005: { label: "Onarım Müşteri Onayı Bekliyor", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400", bgLight: "bg-amber-50 dark:bg-amber-500/10" },
  1006: { label: "Onarım Testi Bekleniyor", color: "bg-cyan-500", textColor: "text-cyan-600 dark:text-cyan-400", bgLight: "bg-cyan-50 dark:bg-cyan-500/10" },
  1007: { label: "Onarım Testi Başarısız", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400", bgLight: "bg-orange-50 dark:bg-orange-500/10" },
  1008: { label: "Parça Bekleniyor", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400", bgLight: "bg-orange-50 dark:bg-orange-500/10" },
};

// ─── ONARIM ÜCRET TİPİ ───────────────────────────────────────────────
const CHARGE_TYPES = {
  FREE: { label: "Ücretsiz", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" },
  PAID: { label: "Ücretli", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30" },
};

// ─── DEPO DURUM HÜCRESİ ────────────────────────────────────────────
// SALT GÖSTERİM - seçim kutusu ya da buton YOK. Gösterilen metin her zaman
// warehouse.item_supply_status'taki bir short_name'dir (MioCreate.xlsx -> ItemSupplyStatus).
//
// Kaydın supply_status_code'u varsa doğrudan o yazılır. Boşsa duruma göre TÜRETİLİR:
//   stok takipsiz / parçasız -> Talepsiz (Depo çıkışı yapılmaz)
//   Good Stock > 0           -> Depodan parça talep edilebilir
//   Good Stock = 0           -> Stok Yok
// Türetilen değer sadece ekranda durur, veritabanına YAZILMAZ.
//
// Kodlar short_name'lerden farklı olabiliyor (code "Talepsiz" -> short_name
// "Talepsiz (Depo çıkışı yapılmaz)", code "Tedarik edilemiyor" -> "Tedarik Edilemiyor"),
// o yüzden etiket her zaman tablodan çözülür, elle yazılmaz.
// Kritik parça orijinallik renkleri (Phonecheck Parts -> parse_critical_parts).
// Servis ekranındaki rozetlerle aynı renk sözlüğü.
const CRITICAL_PART_TONES = {
  genuine: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40",
  not_genuine: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/40",
  unknown: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600",
};

const SUPPLY_TONES = {
  "Stoktan Çıktı":                  "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  "Depodan parça talep edilebilir": "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
  "Stok Yok":                       "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  "Tedarik edilemiyor":             "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  "Talepsiz":                       "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  "İptal Edildi":                   "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};
const SUPPLY_TONE_DEFAULT = "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";

const SupplyStatusCell = ({ repair: r, statuses, stockQty }) => {
  if (r.isCancelled) return <span className="text-xs text-slate-400">—</span>;

  const code = (r.supplyStatusCode || "").trim();

  let shownCode = code;
  if (!shownCode) {
    if (r.isStoksuz) shownCode = "Talepsiz";
    else if (stockQty === undefined) return <span className="text-xs text-slate-400">…</span>;
    else shownCode = stockQty > 0 ? "Depodan parça talep edilebilir" : "Stok Yok";
  }

  // Etiket tablodan; kayıtta tabloda olmayan eski bir kod varsa (ör. 'Teslim Edildi')
  // backend'in döndürdüğü isme, o da yoksa kodun kendisine düşülür.
  const label = statuses.find(s => s.code === shownCode)?.short_name
    || (shownCode === code ? r.supplyStatusName : "")
    || shownCode;

  // Parça Teslim ekranı depo durumuna DEĞİL atamaya bakar (get_deliverable_parts_for_device
  // statü 1001 + atanmış teknisyen arar). Talep açılmış ama kayıt atanmamışsa parça
  // depocuda hiç görünmez - uyarmazsak teknisyen boşuna bekler.
  const stokCikti = ["stoktan çıktı", "teslim edildi", "teslimedildi"].includes(shownCode.toLowerCase());
  const uyari = !!code && !stokCikti && !(r.statusCode === 1001 && (r.assignedTechnician || "").trim());

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${SUPPLY_TONES[shownCode] || SUPPLY_TONE_DEFAULT}`}>
        {label}
      </span>
      {uyari && (
        <span title="Onarım henüz bir teknisyene atanmadı — Parça Teslim ekranı yalnızca atanmış kayıtları listeler, bu parça depocuda görünmez. Üstteki 'Teknisyene Ata' ile atama yapın."
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
          <AlertTriangle size={11} /> atanmalı
        </span>
      )}
    </div>
  );
};

// ─── STATUS BADGE COMPONENT ────────────────────────────────────────
const StatusBadge = ({ code }) => {
  const s = REPAIR_STATUS[code] || { label: `Kod: ${code}`, color: "bg-gray-500", textColor: "text-gray-500", bgLight: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${s.textColor} ${s.bgLight} border ${s.bgLight.includes('emerald') ? 'border-emerald-200 dark:border-emerald-500/30' : s.bgLight.includes('blue') ? 'border-blue-200 dark:border-blue-500/30' : s.bgLight.includes('orange') ? 'border-orange-200 dark:border-orange-500/30' : s.bgLight.includes('amber') ? 'border-amber-200 dark:border-amber-500/30' : s.bgLight.includes('red') ? 'border-red-200 dark:border-red-500/30' : s.bgLight.includes('violet') ? 'border-violet-200 dark:border-violet-500/30' : s.bgLight.includes('cyan') ? 'border-cyan-200 dark:border-cyan-500/30' : s.bgLight.includes('green') ? 'border-green-200 dark:border-green-500/30' : 'border-slate-200 dark:border-slate-700'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.color}`}></span>
      {code} - {s.label}
    </span>
  );
};

// ─── ADD REPAIR MODAL ───────────────────────────────────────────────
// lockedMissionGroupCode verilirse modal "Seçili Onarıma Parça Ekle" modunda açılır:
// eklenen parça YENİ bir onarım açmaz, verilen görev grubuna ikinci/üçüncü bir parça
// satırı olarak yazılır. Grup bu modda değiştirilemez - değiştirilebilseydi kayıt
// başka bir onarıma giderdi ve "seçili onarıma ekleme" anlamını yitirirdi.
const AddRepairModal = ({ onClose, onAdd, missionGroups, device, lockedMissionGroupCode = "", lockedMissionGroupName = "" }) => {
  const [parts, setParts] = useState([]);
  const [partsWarning, setPartsWarning] = useState(null);
  const [itemFaults, setItemFaults] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [availableMissionCodes, setAvailableMissionCodes] = useState([]);

  const [selectedPartId, setSelectedPartId] = useState("");
  const [faultCode, setFaultCode] = useState("");
  const [missionGroupCode, setMissionGroupCode] = useState(lockedMissionGroupCode || "");
  const [warrantyCode, setWarrantyCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getRepairItemWarranties().then(res => { if (res && res.success) setWarranties(res.warranties || []); });
  }, []);

  const isRmaFlow = device?.customerRequest === "To RMA";
  useEffect(() => {
    if (isRmaFlow) return;
    const paidWarranty = warranties.find(w => w.is_paid_for);
    setWarrantyCode(paidWarranty ? paidWarranty.code : "OOW");
  }, [isRmaFlow, warranties]);

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

  useEffect(() => {
    if (!selectedItemCategory) { setItemFaults([]); setFaultCode(""); return; }
    api.getItemFaultsByCategory(selectedItemCategory).then(res => {
      setItemFaults(res && res.success ? (res.item_faults || []) : []);
      setFaultCode("");
    });
  }, [selectedItemCategory]);

  // Normalde seçilen parçanın kategorisi görev grubunu otomatik belirler. Kilitli modda
  // bu otomatik öneri devre dışıdır: grup seçili onarımdan gelir, parça değişse bile sabittir.
  useEffect(() => {
    if (!selectedItemCategory) {
      setAvailableMissionCodes([]);
      if (!lockedMissionGroupCode) setMissionGroupCode("");
      return;
    }
    api.getMissionsForItemCategory(selectedItemCategory).then(res => {
      setAvailableMissionCodes(res && res.success ? (res.mission_codes || []) : []);
    });
    if (lockedMissionGroupCode) return;
    setMissionGroupCode("");
    api.getMissionForItemCategory(selectedItemCategory).then(res => {
      if (res && res.success && res.mission_code) setMissionGroupCode(res.mission_code);
    });
  }, [selectedItemCategory, lockedMissionGroupCode]);

  const filteredMissionGroups = availableMissionCodes.length > 0
    ? missionGroups.filter(mg => availableMissionCodes.includes(mg.code))
    : missionGroups;

  const handleSubmit = async () => {
    if (!faultCode || !missionGroupCode || !warrantyCode || submitting) return;
    setSubmitting(true);
    const ok = await onAdd(missionGroupCode, warrantyCode, description, selectedPart?.item_code || "", faultCode, !!lockedMissionGroupCode);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#181a24] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e222d] max-w-2xl w-full mx-4 flex flex-col min-h-0">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1e222d] flex flex-wrap items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Wrench size={18} className="text-slate-400" />
            {lockedMissionGroupCode
              ? <>Seçili Onarıma Parça Ekle <span className="text-xs font-bold text-blue-500">— {lockedMissionGroupName || lockedMissionGroupCode}</span></>
              : "Teknik: Teklif Parçaları"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {partsWarning && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{partsWarning}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PartSelectCombobox parts={parts} value={selectedPartId} onChange={setSelectedPartId} placeholder="Parça seçiniz..." labelMode="category" disabled={false} />
            <select
              value={faultCode}
              onChange={e => setFaultCode(e.target.value)}
              disabled={!selectedItemCategory}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{selectedItemCategory ? "Arıza Tespiti seçiniz..." : "Önce parça seçiniz..."}</option>
              {itemFaults.length > 0
                ? itemFaults.map(f => <option key={f.code} value={f.code}>{f.short_name}</option>)
                : selectedItemCategory && <option value="N/A">N/A</option>}
            </select>
            {lockedMissionGroupCode ? (
              <div className="w-full px-3 py-2.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-sm font-semibold flex items-center gap-2">
                <Wrench size={14} className="shrink-0" />
                <span className="truncate">{lockedMissionGroupName || lockedMissionGroupCode}</span>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest opacity-70 shrink-0">Sabit</span>
              </div>
            ) : (
              <select
                value={missionGroupCode}
                onChange={e => setMissionGroupCode(e.target.value)}
                disabled={!selectedItemCategory}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="">{selectedItemCategory ? "Onarım Takımı seçiniz..." : "Önce parça seçiniz..."}</option>
                {filteredMissionGroups.map(mg => <option key={mg.code} value={mg.code}>{mg.short_name} ({mg.code})</option>)}
              </select>
            )}
            <select
              value={warrantyCode}
              onChange={e => setWarrantyCode(e.target.value)}
              disabled={!isRmaFlow}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="">Ücretli/Ücretsiz Onarım seçiniz...</option>
              {warranties.map(w => <option key={w.code} value={w.code}>{w.short_name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Açıklama..."
              className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!faultCode || !missionGroupCode || !warrantyCode || submitting}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              <Plus size={16} />
              {submitting ? "EKLENİYOR..." : lockedMissionGroupCode ? "PARÇA EKLE" : "EKLE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── STATUS ADVANCE MODAL ───────────────────────────────────────────
const StatusAdvanceModal = ({ repair, onClose, onAdvance }) => {
  if (!repair) return null;
  const current = repair.statusCode;
  let rawOptions = [];
  // Ekrandan SADECE:
  // 1. Teknisyene Atama (1001)
  // 2. Onarıma Devam Etme (1001)
  // 3. Onarımı Tamamlama (1002 - ana toolbar butonundan yapılır)
  // aşamaları yapılabilmelidir. Diğer karmaşık ara statüler kaldırıldı.
  if (current === 1000) {
    rawOptions.push({ code: 1001, label: "Teknisyene Ata" });
  } else if (current !== 1002 && current !== 1003) {
    rawOptions.push({ code: 1001, label: "Onarıma Devam Et" });
  }

  const nextOptions = rawOptions;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full mx-4 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap items-center justify-between bg-slate-50 dark:bg-[#181a24]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Play size={20} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Onarıma Devam Et</h3>
              <p className="text-xs text-slate-500 mt-0.5">{repair.missionGroup} — {repair.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">Mevcut Statü:</span>
            <StatusBadge code={current} />
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Hedef Statü Seçiniz</p>
          <div className="space-y-2">
            {nextOptions.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic py-4 text-center">Bu statüden ileri geçiş yapılamaz.</p>
            )}
            {nextOptions.map(opt => (
              <button key={opt.code} onClick={() => { onAdvance(repair.id, opt.code); onClose(); }} className="w-full flex flex-wrap items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all group">
                <div className="flex items-center gap-3">
                  <ArrowRightLeft size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt.label}</span>
                </div>
                <StatusBadge code={opt.code} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── TEKNİSYEN ATAMA MODALI ─────────────────────────────────────────
// Kaydın görev grubuna (department_mission) bağlı teknisyenleri listeler.
// Liste, üzerindeki açık iş sayısına göre artan sıralı gelir (backend) —
// en az yüklü teknisyen en üstte görünür.
const TechnicianAssignModal = ({ repair, partCount, technicians, loading, onClose, onAssign, onUnassign, submitting }) => {
  const [selected, setSelected] = useState(repair?.assignedTechnician || "");
  if (!repair) return null;

  const already = repair.assignedTechnician || "";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e222d] max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1e222d] bg-slate-50 dark:bg-[#181a24]">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Teknisyen Ata</h3>
          {/* Atama ONARIM seviyesindedir; tek bir parçaya değil, bu görev grubundaki
              tüm aktif kayıtlara uygulanır. Parça adı bilerek gösterilmiyor. */}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Görev grubu: <span className="font-semibold">{repair.missionGroup || "—"}</span>
            {partCount > 0 ? <> · Bu onarımdaki <span className="font-semibold">{partCount} kaydın tamamı</span> seçilen teknisyene atanır.</> : null}
          </p>
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Teknisyenler yükleniyor…</div>
          ) : technicians.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Bu görev grubuna tanımlı aktif teknisyen bulunamadı.
              <div className="text-xs mt-1 opacity-70">Kullanıcı kartlarındaki "Görev" alanı boş olabilir.</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {technicians.map(t => (
                <label key={t.username}
                  className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    selected === t.username
                      ? "border-blue-400 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-500/10"
                      : "border-slate-200 dark:border-[#1e222d] hover:border-blue-300 dark:hover:border-blue-500/40"
                  }`}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <input type="radio" name="tech" className="accent-blue-600 shrink-0"
                      checked={selected === t.username} onChange={() => setSelected(t.username)} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {t.fullname}
                        {already === t.username && <span className="ml-2 text-[10px] font-bold text-blue-600 dark:text-blue-400">MEVCUT</span>}
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {t.missionName ? t.missionName : <span className="font-mono">{t.username}</span>}
                      </span>
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                    açık iş: {t.openJobs}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-[#1e222d] flex flex-wrap items-center justify-between gap-2">
          {already ? (
            <button onClick={onUnassign} disabled={submitting}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40 transition-colors">
              Atamayı Kaldır
            </button>
          ) : <span />}
          <span className="flex items-center gap-2">
            <button onClick={onClose} disabled={submitting}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e222d] disabled:opacity-40 transition-colors">
              Vazgeç
            </button>
            <button onClick={() => onAssign(selected)} disabled={!selected || submitting || selected === already}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors">
              {submitting ? "Atanıyor…" : "Ata"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── CİHAZ İADE PROSEDÜRÜ MODALI ─────────────────────────────────────
// Sert engelleme modeli: bu modal SADECE handleReturnDevice'ın istemci tarafı ön
// kontrolünden (depoda görünmeyen/Stoktan Çıktı parça yok) geçildiğinde açılır -
// bu yüzden burada artık parça/yönlendirme (GOOD/DOA) seçimi YOK, sadece iade
// nedeni + onay var. Backend (execute_device_return) aynı kontrolü otoriter
// şekilde tekrar yapar.
const DeviceReturnModal = ({ onClose, onConfirm, submitting }) => {
  const [returnReason, setReturnReason] = useState("");
  const canConfirm = returnReason.trim().length > 0 && !submitting;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-2xl border border-red-300 dark:border-red-500/40 max-w-lg w-full mx-4 overflow-hidden flex flex-col">
        <div className="bg-red-500/10 dark:bg-red-500/5 border-b border-red-200 dark:border-red-500/20 px-6 py-5 flex items-center gap-4 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
            <Shield size={28} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Cihaz İade Prosedürü</h3>
            <p className="text-sm text-red-500/80 dark:text-red-400/70 mt-0.5">Cihaza bağlı tüm aktif onarımlar iptal edilecek</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">İade Nedeni *</label>
          <textarea
            value={returnReason}
            onChange={e => setReturnReason(e.target.value)}
            rows="3"
            placeholder="İade nedenini yazınız..."
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181a24] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 resize-none"
          />
        </div>

        <div className="px-6 pb-5 pt-1 flex gap-3 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-700">
            İptal
          </button>
          <button onClick={() => onConfirm(returnReason.trim())} disabled={!canConfirm} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors shadow-lg shadow-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? "İşleniyor..." : "İadeyi Onayla"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── NOTIFICATION TOAST ─────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════
// ═══ MAIN COMPONENT ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
const TechnicianRepairOperations = () => {
  const location = useLocation();
  // ── State ───────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [device, setDevice] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [selectedRepairIdx, setSelectedRepairIdx] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  // Aynı modal iki modda kullanılır: showAddModal -> yeni onarım (grup serbest),
  // showAddPartModal -> seçili onarıma ek parça (grup sabit).
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  // Teknisyene Atama modalı
  const [assignTarget, setAssignTarget] = useState(null);   // atanacak onarım kaydı
  const [technicians, setTechnicians] = useState([]);
  const [techLoading, setTechLoading] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [cancellingRepairId, setCancellingRepairId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [techNotes, setTechNotes] = useState("");
  const [chipCode, setChipCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [missionGroups, setMissionGroups] = useState([]);
  const [serviceStatuList, setServiceStatuList] = useState([]);
  const [diagnosisDraft, setDiagnosisDraft] = useState("");
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);
  const [supplyStatuses, setSupplyStatuses] = useState([]);
  const [partStock, setPartStock] = useState({}); // { [item_code]: quantity }
  const searchRef = useRef(null);

  // Görev grupları MioCreate.xlsx MissionGroup sayfasından seed edilen
  // organization.mission_groups tablosundan gelir (üretim/onarım ile ilgili olanlar).
  useEffect(() => {
    api.getMissionGroups().then(res => {
      if (res && res.success) setMissionGroups(res.mission_groups || []);
    });
  }, []);

  // Statü kodu -> gerekli mission (rol) eşlemesi. warehouse.service_statu.mission
  // her statü kodunun hangi role ait olduğunu tanımlar (ör. 103/125 -> QAC, 105/109 -> TEC_DISMANTLE).
  useEffect(() => {
    api.getServiceStatuList().then(res => {
      if (res && res.success) setServiceStatuList(res.service_statu || []);
    });
  }, []);

  // Depo Durum seçenekleri (warehouse.item_supply_status) - Onarım Parçaları sütunu.
  useEffect(() => {
    api.getItemSupplyStatuses().then(res => {
      if (res && res.success) setSupplyStatuses(res.supply_statuses || []);
    });
  }, []);

  const showNotif = useCallback((type, title, message) => {
    setNotification({ type, title, message });
    if (type !== "error") setTimeout(() => setNotification(null), 4000);
  }, []);

  // ── Search Handler ───────────────────────────────────────────
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

      let repairLink = null;
      try {
        const repairRes = await api.getRepairOperationsByImei(imei);
        if (repairRes && repairRes.success) repairLink = repairRes;
      } catch (_e) {
        repairLink = null;
      }

      // Müşteri Arıza Tespiti'ni PhoneCheck'ten (başarısız/Failed testler) çek. Kayıtlı bir
      // tespit (service_records/batch_entries) varsa o korunur; yoksa PhoneCheck sonucu kullanılır.
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
        model: d.model || "",
        productInfo: productInfo || "-",
        productCode: d.batch_no || "",
        customerRequest: d.flow || "Belirtilmemiş",
        // Öncelik: kayıtlı tespit → canlı PhoneCheck (Failed) → Batch girişinde PhoneCheck'ten
        // çekilip saklanan defects. Böylece cihaz PhoneCheck'te canlı bulunmasa da tespit görünür.
        customerDiagnosis: repairLink?.device?.customerDiagnosis || phonecheckDefects || (d.defects || ""),
        phonecheckNotes: phonecheckNotes || "",
        serviceStatus: batchStatusCode,
        serviceStatusText: batchStatusCode == null ? (repairLink?.device?.statusText || "") : "",
        workOrderId: repairLink ? repairLink.work_order_id : null,
        faultTags: [],
        // Kritik parça orijinallik kontrolü - kaynak: cihazın en yeni Phonecheck
        // kaydındaki Parts verisi (bkz. WebBridge._get_device_critical_parts).
        // Phonecheck kaydı yoksa backend yine 3 satır döner, hepsi "unknown" (gri).
        criticalParts: repairLink?.device?.criticalParts || [],
        batteryCycle: pcBatteryCycle ?? repairLink?.battery_cycle ?? d.battery_cycle ?? null,
        batteryHealth: pcBatteryHealth ?? repairLink?.battery_health ?? d.battery_health_percentage ?? null,
      };

      setDevice(realDevice);
      setTechNotes("");
      setChipCode("");
      setDiagnosisDraft(realDevice.customerDiagnosis || "");
      setSelectedRepairIdx(0);

      if (repairLink) {
        // technician: Onarım Detay grid'indeki "Teknisyen" sütununun okuduğu alan.
        // Eskiden sabit "" yazılıyordu, bu yüzden atama yapılmış olsa bile sütun
        // HER ZAMAN "Atanmadı" gösteriyordu. Backend zaten assignedTechnicianName
        // dönüyor (bkz. get_repair_operations_by_imei), onu kullanıyoruz.
        setRepairs((repairLink.repairs || []).map(r => ({ ...r, technician: r.assignedTechnicianName || r.assignedTechnician || "" })));
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

  // warehouse.service_records.preliminary_diagnosis'e kalıcı yazar. Sadece test
  // teknisyenleri (QAC ailesi) ve o statüde zaten yetkili olanlar çağırabilir —
  // gerçek yetki kontrolü backend'de de tekrar yapılır.
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

  // ── Repair Actions ──────────────────────────────────────────
  // Güncel onarım/parça listesini backend'den tekrar çeker (ekleme/karar sonrası ortak kullanılır).
  const refreshRepairs = useCallback(async () => {
    if (!device?.imei) return null;
    const refreshed = await api.getRepairOperationsByImei(device.imei).catch(() => null);
    if (refreshed && refreshed.success) {
      setRepairs((refreshed.repairs || []).map(r => ({ ...r, technician: r.assignedTechnicianName || r.assignedTechnician || "" })));
    }
    return refreshed;
  }, [device]);

  // Backend'e kalıcı olarak yazar (warehouse.repair_records) ve ardından
  // güncel listeyi tekrar çeker — sayfa yenilense/cihaz tekrar aransa da kaybolmaz.
  const handleAddRepair = useCallback(async (missionGroupCode, warrantyCode, notes, partItemCode, itemFaultCode, isPartAdd = false) => {
    if (!device) return false;
    // Bağlı bir servis iş emri varsa onun id'si, yoksa doğrudan cihazın IMEI'si kullanılır
    // (get_repair_operations_by_imei bu durumda onarımı yine aynı IMEI ile bulup gösterir).
    const deviceRef = device.workOrderId || device.imei;
    const res = await api.addRepairRecord(deviceRef, missionGroupCode, warrantyCode, notes, getCurrentUser()?.username, partItemCode, itemFaultCode, "");
    if (!res || !res.success) {
      showNotif("error", isPartAdd ? "Parça Eklenemedi" : "Onarım Eklenemedi", res?.message || "Kayıt başarısız oldu.");
      return false;
    }

    const refreshed = await refreshRepairs();

    // Yeni eklenen onarım grubunu listede otomatik seçili duruma getir
    if (refreshed && refreshed.success && refreshed.repairs) {
      const updatedRepairs = refreshed.repairs;
      const groups = [];
      const map = new Map();
      for (const r of updatedRepairs) {
        const key = r.missionGroupCode || r.missionGroup;
        if (!map.has(key)) {
          map.set(key, true);
          groups.push(key);
        }
      }
      const targetIdx = groups.indexOf(missionGroupCode);
      if (targetIdx !== -1) {
        setSelectedRepairIdx(targetIdx);
      }
    }

    const groupLabel = missionGroups.find(mg => mg.code === missionGroupCode)?.short_name || missionGroupCode;
    // Aynı akış iki şeyi yapıyor: yeni onarım açmak ya da mevcut onarıma parça eklemek.
    // Mesaj ayrı olmazsa kullanıcı ikinci bir onarım açtığını sanır.
    if (isPartAdd) {
      showNotif("success", "Parça Eklendi", `${partItemCode || "Parça"} → ${groupLabel} onarımına eklendi.`);
    } else {
      showNotif("success", "Onarım Eklendi", `${groupLabel} başarıyla eklendi.`);
    }
    return true;
  }, [device, missionGroups, showNotif, refreshRepairs]);

  // warehouse.repair_records.repair_result_type_code'a kalıcı olarak yazar.
  // ── Teknisyene Atama ────────────────────────────────────────
  // Modalı açar ve kaydın görev grubuna bağlı teknisyenleri çeker.
  const openAssignModal = useCallback(async (repair) => {
    if (!repair) return;
    setAssignTarget(repair);
    setTechnicians([]);
    setTechLoading(true);
    const res = await api.getTechniciansForMission(repair.missionGroupCode || "").catch(() => null);
    setTechLoading(false);
    if (res && res.success) {
      setTechnicians(res.technicians || []);
    } else {
      showNotif("error", "Teknisyenler Getirilemedi", res?.message || "Liste alınamadı.");
    }
  }, [showNotif]);

  // Atama + statü 1001 tek işlemde backend'de yapılır.
  const handleAssignTechnician = useCallback(async (technicianUsername) => {
    if (!assignTarget) return;
    setAssignSubmitting(true);
    const res = await api.assignTechnicianToRepair(assignTarget.id, technicianUsername, getCurrentUser()?.username);
    setAssignSubmitting(false);
    if (!res || !res.success) {
      showNotif("error", "Atama Yapılamadı", res?.message || "İşlem başarısız oldu.");
      return;
    }
    setAssignTarget(null);
    await refreshRepairs();
    showNotif("success", res.assigned ? "Teknisyen Atandı" : "Atama Kaldırıldı", res.message || "");
  }, [assignTarget, refreshRepairs, showNotif]);

  const handleAdvanceStatus = useCallback(async (repairId, newStatus) => {
    // 1001 "Teknisyene Atandı" doğrudan set EDİLMEZ — önce teknisyen seçtirilir.
    // Statüyü, atama işlemiyle birlikte backend tek transaction içinde yazar.
    if (Number(newStatus) === 1001) {
      const target = repairs.find(r => r.id === repairId);
      if (target) { openAssignModal(target); return; }
    }
    const prevRepairs = repairs;
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, statusCode: newStatus } : r));
    const res = await api.updateRepairStatus(repairId, newStatus, getCurrentUser()?.username);
    if (!res || !res.success) {
      setRepairs(prevRepairs);
      showNotif("error", "Statü Güncellenemedi", res?.message || "İşlem başarısız oldu.");
      return;
    }
    const statusLabel = REPAIR_STATUS[newStatus]?.label || newStatus;
    showNotif("success", "Statü Güncellendi", `${newStatus} - ${statusLabel}`);
  }, [repairs, showNotif, openAssignModal]);

  // ── Cihaz İade Prosedürü (Sert Engelleme) ──────────────────────
  // Cihaza bağlı stok takipli bir parça hâlâ 'Stoktan Çıktı' ise (isStoksuz=false,
  // isDelivered=true - bkz. get_repair_operations_by_imei) modal HİÇ AÇILMAZ; bu sadece
  // hızlı/istemci tarafı bir ön kontroldür, backend (execute_device_return) aynı kontrolü
  // otoriter şekilde tekrar yapar.
  const handleReturnDevice = useCallback(() => {
    const blocking = repairs.filter(r => !r.isCancelled && !r.isStoksuz && r.isDelivered);
    if (blocking.length > 0) {
      const names = [...new Set(blocking.map(r => r.partName || r.partItemCode))].join(", ");
      showNotif(
        "error",
        "İade Edilemez",
        `${names} parçası/parçaları hâlâ depoda görünmüyor (Stoktan Çıktı). Parçaları depocuya teslim edin — depocu 'Depo → Parça Teslim' ekranından geri alma işlemini tamamladıktan sonra tekrar deneyin.`
      );
      return;
    }
    setShowReturnModal(true);
  }, [repairs, showNotif]);

  const handleReturnConfirm = useCallback(async (returnReason) => {
    if (!device) return;
    const deviceRef = device.workOrderId || device.imei;
    setReturnSubmitting(true);
    try {
      const result = await api.executeDeviceReturn(deviceRef, returnReason, getCurrentUser()?.username);
      if (result.success) {
        setShowReturnModal(false);
        setDevice(prev => (prev ? { ...prev, serviceStatus: 124 } : prev));
        await refreshRepairs();
        showNotif("success", "İade İşlemi Tamamlandı", result.message || "Cihaz 124 statüsüne alındı.");
      } else {
        showNotif("error", "İade Başarısız", result.message || "İşlem tamamlanamadı.");
      }
    } catch (err) {
      showNotif("error", "Sistem Hatası", "İade işlemi sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setReturnSubmitting(false);
    }
  }, [device, refreshRepairs, showNotif]);

  // ── Tekil Onarım İptali (Sert Engelleme) ───────────────────────
  // Tek bir görev grubunu (ör. sadece Batarya) diğerlerine dokunmadan iptal eder.
  // Cihaz İade Prosedürü'ndeki AYNI korumayla çalışır: parça stok takipliyse ve hâlâ
  // 'Stoktan Çıktı' ise reddedilir - önce depocuya teslim edilmeli.
  const handleCancelRepair = useCallback(async (repair) => {
    if (!repair || repair.isCancelled) return;
    if (!repair.isStoksuz && repair.isDelivered) {
      showNotif(
        "error",
        "İptal Edilemez",
        `'${repair.partName || repair.partItemCode}' parçası hâlâ depoda görünmüyor (Stoktan Çıktı). Parçayı depocuya teslim edin — depocu 'Depo → Parça Teslim' ekranından geri alma işlemini tamamladıktan sonra tekrar deneyin.`
      );
      return;
    }
    setCancellingRepairId(repair.id);
    const res = await api.updateRepairStatus(repair.id, "1003", getCurrentUser()?.username);
    setCancellingRepairId(null);
    if (!res || !res.success) {
      showNotif("error", "İptal Edilemedi", res?.message || "İşlem başarısız oldu.");
      return;
    }
    await refreshRepairs();
    showNotif("success", "Onarım İptal Edildi", `${repair.missionGroup} onarımı iptal edildi.`);
  }, [refreshRepairs, showNotif]);

  // ── Toggle Repair Charge Type ─────────────────────────────────
  // warehouse.repair_records.warranty_code'a kalıcı olarak yazar (IW=Ücretsiz, OOW=Ücretli).
  const handleToggleChargeType = useCallback(async (repairId, currentChargeType) => {
    const newChargeType = currentChargeType === "FREE" ? "PAID" : "FREE";
    const prevRepairs = repairs;
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, chargeType: newChargeType } : r));

    const warrantyCode = newChargeType === "FREE" ? "IW" : "OOW";
    const res = await api.updateRepairWarranty(repairId, warrantyCode, getCurrentUser()?.username);
    if (!res || !res.success) {
      setRepairs(prevRepairs);
      showNotif("error", "Ücret Tipi Güncellenemedi", res?.message || "İşlem başarısız oldu.");
    }
  }, [repairs, showNotif]);

  // ── Görev grubuna göre gruplama ──────────────────────────────
  // Aynı görev grubuna (ör. Batarya) ait birden fazla onarım kaydı olabilir - özellikle
  // bir onarım iptal edilip aynı departmana yeniden eklendiğinde (eski kayıt silinmez,
  // "İptal Edildi" olarak kalır, bkz. update_repair_status). Onarım Detay grid'inde/
  // sekmelerinde bu kayıtlar TEK satırda gösterilir; o grup seçildiğinde Onarım Parçaları
  // bölümünde grubun TÜM kayıtları ayrı satırlar halinde (detay) listelenir.
  const groupedRepairs = useMemo(() => {
    const map = new Map();
    for (const r of repairs) {
      const key = r.missionGroupCode || r.missionGroup;
      if (!map.has(key)) map.set(key, { key, missionGroup: r.missionGroup, items: [] });
      map.get(key).items.push(r);
    }
    return Array.from(map.values()).map(g => ({
      ...g,
      // Grup satırında/sekmesinde gösterilecek temsilci kayıt: aktif (iptal edilmemiş)
      // olan varsa o, hepsi iptal edildiyse en sonuncusu.
      active: g.items.find(r => !r.isCancelled) || g.items[g.items.length - 1],
    }));
  }, [repairs]);

  // ── Selected repair group ────────────────────────────────────
  const selectedGroup = groupedRepairs[selectedRepairIdx] || null;
  const selectedRepair = selectedGroup?.active || null;

  // "Onarımı Tamamla" iki şartı birden ister (backend'de update_repair_status
  // aynı iki kontrolü tekrar yapar; burası yalnızca butonu erkenden kilitler):
  //   1) kayıt bir teknisyene atanmış olmalı,
  //   2) stok takipli parçaların hepsi depodan teslim alınmış olmalı.
  const completeBlockReason = useMemo(() => {
    if (!selectedRepair) return null;
    if (!(selectedRepair.assignedTechnician || "").trim())
      return "Kayıt teknisyene atanmadan onarım tamamlanamaz";
    const bekleyen = (selectedGroup?.items || [])
      .filter(r => !r.isCancelled)
      .some(r => r.partItemCode && !r.isStoksuz && !r.isDelivered);
    if (bekleyen)
      return "Depodan parça teslimatı yapılmadan onarım tamamlanamaz";
    return null;
  }, [selectedRepair, selectedGroup]);

  // Seçili gruptaki her parça kodu için Good Stock'ta kaç adet olduğunu çeker - Onarım
  // Parçaları'ndaki 'Depo Parça' sütunu ve 'Depodan parça talep edilebilir' otomatik
  // durumu bunu kullanır. warehouse.stock ~30 bin satır olduğundan sadece görünen
  // parça kodları için tek tek sorgulanır (get_stock_by_item_code), tüm tablo değil.
  useEffect(() => {
    const codes = Array.from(new Set((selectedGroup?.items || []).map(r => r.partItemCode).filter(Boolean)));
    const missing = codes.filter(c => !(c in partStock));
    if (missing.length === 0) return;
    missing.forEach(code => {
      api.getStockByItemCode(code).then(res => {
        if (res && res.success) {
          setPartStock(prev => ({ ...prev, [code]: res.quantity }));
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup]);

  // ── Statü-bazlı rol/yetki kontrolü ──────────────────────────
  // warehouse.service_statu.mission: her statü kodunun hangi rol (mission) tarafından
  // işlenebileceğini tanımlar (ör. 103/125 -> QAC, 105/109 -> TEC_DISMANTLE). Kullanıcının
  // rolleri warehouse.users.gorev'de virgülle ayrılmış mission kodları olarak durur.
  // Admin/Developer her zaman muaftır.
  const currentUser = getCurrentUser();
  const isAdminUser = ["admin", "developer"].includes((currentUser?.role || "").trim().toLowerCase());
  const userMissions = (currentUser?.gorev || "").split(",").map(s => s.trim()).filter(Boolean);
  const currentStatuInfo = (device && device.serviceStatus != null)
    ? serviceStatuList.find(s => s.code === device.serviceStatus)
    : null;
  const requiredMission = currentStatuInfo?.mission || "";
  const hasAccess = isAdminUser || !requiredMission || userMissions.includes(requiredMission);

  // NOT: Depo Durum sütunu SALT GÖSTERİMDİR (bkz. SupplyStatusCell) - bu ekrandan
  // supply_status_code yazılmaz. Parça talebi/teslimi Depo > Parça Teslim ekranının işi.

  // Müşteri Arıza Tespiti sadece test teknisyenleri (QAC ailesi) tarafından ve
  // mevcut statü kilidi açıkken düzenlenebilir.
  const isTestTechnician = userMissions.some(m => m === "QAC" || m.startsWith("QAC_"));
  const canEditDiagnosis = isAdminUser || (hasAccess && isTestTechnician);

  // ── Statü rozeti: sayısal kod, eski metin statü veya bağlı iş emri yok ──
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

  // ── Focus search on mount ──────────────────────────────────
  useEffect(() => { searchRef.current?.focus(); }, []);

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* Notification Toast */}
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* Add Repair Modal */}
      {showAddModal && <AddRepairModal onClose={() => setShowAddModal(false)} onAdd={handleAddRepair} missionGroups={missionGroups} device={device} />}
      {showAddPartModal && selectedGroup && (
        <AddRepairModal
          onClose={() => setShowAddPartModal(false)}
          onAdd={handleAddRepair}
          missionGroups={missionGroups}
          device={device}
          lockedMissionGroupCode={selectedGroup.active.missionGroupCode || selectedGroup.key}
          lockedMissionGroupName={selectedGroup.active.missionGroup}
        />
      )}

      {/* Status Advance Modal */}
      {showAdvanceModal && <StatusAdvanceModal repair={selectedRepair} onClose={() => setShowAdvanceModal(false)} onAdvance={handleAdvanceStatus} />}

      {/* Teknisyene Atama */}
      {assignTarget && (
        <TechnicianAssignModal
          repair={assignTarget}
          /* Atama parçaya değil onarıma yapılır; kaç kaydı kapsadığını modalda göster. */
          partCount={(groupedRepairs.find(g => g.key === (assignTarget.missionGroupCode || assignTarget.missionGroup))?.items || [])
            .filter(r => !r.isCancelled).length}
          technicians={technicians}
          loading={techLoading}
          submitting={assignSubmitting}
          onClose={() => setAssignTarget(null)}
          onAssign={handleAssignTechnician}
          onUnassign={() => handleAssignTechnician("")}
        />
      )}

      {/* Cihaz İade Prosedürü Modalı */}
      {showReturnModal && <DeviceReturnModal onClose={() => setShowReturnModal(false)} onConfirm={handleReturnConfirm} submitting={returnSubmitting} />}

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(194, 68, 95,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(194, 68, 95,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-400/30 text-rose-700 dark:text-rose-300 text-xs font-semibold tracking-wide">
              <Wrench size={13} className="text-rose-400" /> ÜRETİM KAYDI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Üretim Kaydını Görüntüle
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              IMEI/Seri no ile cihaz sorgulayın, arıza teşhisi ekleyin, yedek parça taleplerini ve onarım aşamalarını yönetin.
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════ SECTION 1: SEARCH BAR ════════════════ */}
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

        {/* Rol/Yetki Uyarı Şeridi (engellemez, sadece bilgilendirir) */}
        {device && !hasAccess && (
          <div className="mx-5 mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl flex items-start gap-3">
            <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Bu cihaz şu an <strong>"{currentStatuInfo ? `${currentStatuInfo.short_name} (${device.serviceStatus})` : device.serviceStatus}"</strong> aşamasında
              — bu aşamada işlem yapabilmek için <strong>'{requiredMission}'</strong> yetkisi gerekiyor.
              Senin rollerin: <strong>{userMissions.length > 0 ? userMissions.join(', ') : 'Tanımlı değil'}</strong>.
              Cihazı ve onarım kayıtlarını görüntüleyebilirsin ama işlem yapamazsın.
            </p>
          </div>
        )}

        {/* Device Identity & Telemetry */}
        {device && (
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* CRM Read-Only Fields */}
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

              {/* Fault Tags + Telemetry */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                {/* Fault Tags */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Arızalı Parça Kategorileri</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(device.faultTags || []).length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-slate-600 italic">Belirtilmemiş</span>
                    ) : (
                      device.faultTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                          <AlertTriangle size={11} />
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {/* Kritik Parça Orijinalliği — Phonecheck "Parts" verisinden.
                    Yeşil = Orijinal, Kırmızı = Orijinal Değil, Gri = Belirtilmemiş.
                    Gri, "orijinal değil" DEĞİLDİR: Phonecheck o parçayı hiç
                    değerlendirmemiş ya da cihazın Phonecheck kaydı yok demektir. */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Kritik Parça Orijinalliği</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(device.criticalParts || []).length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-slate-600 italic">Phonecheck verisi yok</span>
                    ) : (
                      device.criticalParts.map(p => (
                        <span
                          key={p.key}
                          title={`${p.label}: ${p.statusLabel}`
                            + (p.sourceName ? ` (Phonecheck: ${p.sourceName})` : " (Phonecheck çıktısında bu parça yok)")
                            + (p.reason ? ` — ${p.reason}` : "")}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${CRITICAL_PART_TONES[p.status] || CRITICAL_PART_TONES.unknown}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {p.label}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {/* Telemetry */}
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <BatteryCharging size={14} className="text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Battery Cycle</span>
                    </div>
                    <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{(device.batteryCycle !== null && device.batteryCycle !== undefined && device.batteryCycle !== "") ? String(device.batteryCycle) : "-"}</p>
                  </div>
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Battery size={14} className="text-teal-500" />
                      <span className="text-[10px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-wider">Battery Health</span>
                    </div>
                    <p className={`text-xl font-bold ${(device.batteryHealth === null || device.batteryHealth === undefined || device.batteryHealth === "") ? 'text-slate-400 dark:text-slate-600' : Number(device.batteryHealth) >= 80 ? 'text-teal-700 dark:text-teal-300' : Number(device.batteryHealth) >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{(device.batteryHealth !== null && device.batteryHealth !== undefined && device.batteryHealth !== "") ? `${device.batteryHealth}%` : "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ═══════════════════════════════════════════════════════════
           SECTION 2: ORTA PANEL — Onarım Detay Grid
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1e222d] flex flex-wrap items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Wrench size={16} className="text-slate-400" />
            Onarım Detay
            {repairs.length > 0 && <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{repairs.length} kayıt</span>}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowAddModal(true)} disabled={!hasAccess || !device} className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer">
                <Plus size={14} /> Onarım Ekle
              </button>
              {/* Yeni onarım AÇMADAN, seçili onarıma ikinci bir parça satırı ekler.
                  Görev grubu seçili onarımdan gelir ve modalda değiştirilemez. */}
              <button
                onClick={() => setShowAddPartModal(true)}
                disabled={!hasAccess || !device || !selectedGroup || selectedGroup.active.isCancelled}
                title={selectedGroup
                  ? `'${selectedGroup.active.missionGroup}' onarımına yeni bir parça ekler (yeni onarım açmaz)`
                  : "Önce alttaki listeden bir onarım seçin"}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#181a24] border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Package size={14} /> Parça Ekle
              </button>
              {selectedRepair && selectedRepair.statusCode === 1000 && (
                <button
                  onClick={() => handleAdvanceStatus(selectedRepair.id, 1001)}
                  disabled={!hasAccess}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Play size={14} /> Teknisyene Ata
                </button>
              )}
              {selectedRepair && selectedRepair.statusCode === 1001 && (
                <button
                  disabled={true}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600/30 text-indigo-300 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-default"
                  title="Cihaz şu an teknisyende / onarım aşamasında"
                >
                  <Play size={14} /> Onarım Devam Ediyor
                </button>
              )}
              {selectedRepair && selectedRepair.statusCode !== 1002 && selectedRepair.statusCode !== 1003 && (
                <button
                  onClick={() => handleAdvanceStatus(selectedRepair.id, 1002)}
                  disabled={!hasAccess || !!completeBlockReason}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                  title={completeBlockReason || "Onarımı tamamla"}
                >
                  <CheckCircle size={14} /> Onarımı Tamamla
                </button>
              )}
              <button onClick={handleReturnDevice} disabled={!hasAccess || !device} className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer">
                <AlertTriangle size={14} /> İade Edilecek
              </button>
          </div>
        </div>

        {/* Repair Navigation Tabs */}
        {groupedRepairs.length > 0 && (
          <div className="px-5 py-2 border-b border-slate-100 dark:border-[#1e222d] flex items-center gap-2 overflow-x-auto">
            <button onClick={() => setSelectedRepairIdx(Math.max(0, selectedRepairIdx - 1))} disabled={selectedRepairIdx === 0} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0">
              <ChevronLeft size={16} className="text-slate-500" />
            </button>
            {groupedRepairs.map((g, i) => (
              <button key={g.key} onClick={() => setSelectedRepairIdx(i)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border flex items-center gap-1.5 ${i === selectedRepairIdx ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white dark:bg-[#12141c] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50'}`}>
                {g.active.missionGroup}
                {/* Sekmede de her zaman görünür - alttaki grid ile aynı sayıyı versin. */}
                <span className={`px-1.5 rounded-full text-[10px] font-bold ${i === selectedRepairIdx ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>×{g.items.length}</span>
              </button>
            ))}
            <button onClick={() => setSelectedRepairIdx(Math.min(groupedRepairs.length - 1, selectedRepairIdx + 1))} disabled={selectedRepairIdx === groupedRepairs.length - 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0">
              <ChevronRight size={16} className="text-slate-500" />
            </button>
          </div>
        )}

        {/* Repair Data Grid */}
        <div className="flex-1 overflow-auto">
          {!device ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
              <Search size={48} strokeWidth={1} className="mb-4 opacity-40" />
              <p className="text-sm font-medium">Cihaz barkodunu okutarak başlayınız</p>
              <p className="text-xs mt-1">IMEI, Internal ID veya Seri No giriniz</p>
            </div>
          ) : groupedRepairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
              <Package size={48} strokeWidth={1} className="mb-4 opacity-40" />
              <p className="text-sm font-medium">Aktif onarım kaydı yok</p>
              <p className="text-xs mt-1">{hasAccess ? "\"Onarım Ekle\" butonuyla yeni kayıt oluşturun" : "Görüntüleyebilirsin ama bu statüde işlem yapamazsın"}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-[#12141c] sticky top-0 z-10">
                <tr className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Görev Grubu</th>
                  <th className="text-left px-3 py-3">Teknisyen</th>
                  <th className="text-left px-3 py-3">Alt Statü</th>
                  <th className="text-center px-3 py-3">Ücret</th>
                  <th className="text-center px-3 py-3">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
                {groupedRepairs.map((g, i) => (
                  <tr key={g.key} onClick={() => setSelectedRepairIdx(i)} className={`cursor-pointer transition-colors ${i === selectedRepairIdx ? 'bg-blue-50 dark:bg-blue-500/5 border-l-[3px] border-l-blue-500' : 'hover:bg-slate-50 dark:hover:bg-[#12141c] border-l-[3px] border-l-transparent'}`}>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {g.active.missionGroup}
                      {/* Tek kayıtlı grupta da yazılır: rozet yokken "kaç parça var"
                          sorusunun cevabı belirsiz kalıyordu (yok mu, bir mi?). */}
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">{g.items.length} kayıt</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">{g.active.technician || <span className="italic text-slate-400">Atanmadı</span>}</td>
                    <td className="px-3 py-3"><StatusBadge code={g.active.statusCode} /></td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (hasAccess && !g.active.isCancelled) handleToggleChargeType(g.active.id, g.active.chargeType); }}
                        disabled={!hasAccess || g.active.isCancelled}
                        title="Tıklayarak ücret tipini değiştirin"
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed ${CHARGE_TYPES[g.active.chargeType]?.bg} ${CHARGE_TYPES[g.active.chargeType]?.color}`}
                      >
                        {CHARGE_TYPES[g.active.chargeType]?.label}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {/* Tekil onarım iptali: bu görev grubunu (ör. sadece Batarya) diğer
                          gruplara dokunmadan iptal eder. Parça 'Stoktan Çıktı' ise backend
                          reddeder (_repair_cancellation_blocker), burada da önden aynı
                          kontrolle engellenir - handleCancelRepair. */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCancelRepair(g.active); }}
                        disabled={!hasAccess || g.active.isCancelled || g.active.statusCode === 1002 || cancellingRepairId === g.active.id}
                        title="Onarımı İptal Et"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 3: ALT ORTA PANEL — Onarım Parçaları
         ═══════════════════════════════════════════════════════════ */}
      {selectedGroup && (
        <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1e222d] flex flex-wrap items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} className="text-slate-400" />
              Onarım Parçaları
              <span className="text-[11px] font-bold text-blue-500">— {selectedGroup.active.missionGroup}</span>
            </h3>

            {/* Onarımın teknisyeni: parça başına DEĞİL, onarım başına tek kayıt.
                Backend atamayı bu grubun tüm aktif satırlarına birden yazar
                (bkz. assign_technician_to_repair), burada da tek yerde okunur. */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Teknisyen
              </span>
              {selectedGroup.active.assignedTechnicianName ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                  <User size={12} className="text-blue-500" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {selectedGroup.active.assignedTechnicianName}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">Atanmadı</span>
              )}
              {/* "Değiştir" SADECE atama varken çıkar. Atama yokken üst bardaki
                  "Teknisyene Ata" butonu zaten görünür durumda (statü 1000);
                  aynı işlem için iki buton olmasın diye burada tekrarlanmıyor.
                  Atandıktan sonra üstteki buton kaybolduğu için değiştirmenin
                  tek yolu burasıdır. */}
              {selectedGroup.active.assignedTechnicianName && (
                <button
                  onClick={() => openAssignModal(selectedGroup.active)}
                  disabled={!hasAccess || selectedGroup.active.isCancelled}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#1e222d] text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181a24] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Bu onarımın teknisyenini değiştir (tüm parçaları kapsar)"
                >
                  Değiştir
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            {selectedGroup.items.every(r => !r.partItemCode) ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-600">
                Bu onarım kaydına henüz parça eklenmemiş.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#12141c]">
                  <tr className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-5 py-2.5">Parça Kodu</th>
                    <th className="text-left px-3 py-2.5">Parça Kategorisi</th>
                    <th className="text-left px-3 py-2.5">Arıza Tespiti</th>
                    <th className="text-center px-3 py-2.5">Ücret</th>
                    {/* "Atanan Teknisyen" sütunu YOK: teknisyen parçaya değil ONARIMA
                        atanır, bu yüzden bölüm başlığında tek yerde gösterilir. */}
                    <th className="text-left px-3 py-2.5">Depo Durum</th>
                    <th className="text-left px-3 py-2.5">Depo Parça</th>
                    <th className="text-left px-3 py-2.5">Açıklama</th>
                    {/* "Durum" sütunu YOK: statü zaten üstteki Onarım Detay
                        satırında/sekmesinde görünüyor, burada tekrar edilmiyor. */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
                  {selectedGroup.items.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-[#12141c] transition-colors ${r.isCancelled ? "opacity-50" : ""}`}>
                      <td className="px-5 py-2.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{r.partItemCode || "N/A"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200">{r.itemCategory || "N/A"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300">{r.faultName || "N/A"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => hasAccess && !r.isCancelled && handleToggleChargeType(r.id, r.chargeType)} disabled={!hasAccess || r.isCancelled} className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer hover:opacity-80 transition-opacity ${CHARGE_TYPES[r.chargeType]?.bg} ${CHARGE_TYPES[r.chargeType]?.color} disabled:cursor-not-allowed`} title="Tıklayarak ücret tipini değiştirin">
                          {CHARGE_TYPES[r.chargeType]?.label}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <SupplyStatusCell
                          repair={r}
                          statuses={supplyStatuses}
                          stockQty={r.partItemCode ? partStock[r.partItemCode] : 0}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        {!r.partItemCode ? (
                          <span className="text-xs text-slate-400">-</span>
                        ) : partStock[r.partItemCode] === undefined ? (
                          <span className="text-xs text-slate-400">…</span>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${partStock[r.partItemCode] > 0 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30"}`}>
                            {partStock[r.partItemCode] > 0 ? `${partStock[r.partItemCode]} adet stokta` : "Stokta yok"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{r.notes || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
           SECTION 4: ALT PANEL — Teknisyen Notları & Chip Kodu
         ═══════════════════════════════════════════════════════════ */}
      {device && (
        <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden">
          <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Açıklama (Teknisyen Notu)</label>
              <textarea
                value={techNotes}
                onChange={e => setTechNotes(e.target.value)}
                disabled={!hasAccess}
                placeholder="Yapılan işlemlerle ilgili detaylı notlarınızı buraya giriniz..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Chip Kodu</label>
              <input
                type="text"
                value={chipCode}
                onChange={e => setChipCode(e.target.value)}
                disabled={!hasAccess}
                placeholder="Anakart / Baseband Chip Kodu"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">Anakart / Security çip tanımlayıcısı</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianRepairOperations;
