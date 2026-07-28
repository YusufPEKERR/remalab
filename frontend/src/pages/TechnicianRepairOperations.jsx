import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, Plus, Play, AlertTriangle, Trash2, Shield, Battery,
  BatteryCharging, Cpu, X, ChevronLeft, ChevronRight, Wrench,
  CheckCircle, Clock, Package, ArrowRightLeft, Info
} from "lucide-react";
import { api } from "../services/api";

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
const AddRepairModal = ({ onClose, onAdd, missionGroups, workOrderId }) => {
  const [group, setGroup] = useState("");
  const [chargeType, setChargeType] = useState("PAID");
  const [submitting, setSubmitting] = useState(false);
  const technician = getCurrentUser()?.fullname || getCurrentUser()?.username || "";

  const missionGroupOptions = missionGroups.map(mg => ({
    code: mg.code,
    label: `${mg.short_name} (${mg.code})`,
  }));

  const handleSubmit = async () => {
    if (!group || !workOrderId || submitting) return;
    setSubmitting(true);
    const ok = await onAdd(group, chargeType);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full mx-4 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between bg-slate-50 dark:bg-[#242a38]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Plus size={20} className="text-blue-500" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Yeni Onarım Emri</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Görev Grubu *</label>
            <select value={group} onChange={e => setGroup(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
              <option value="">Seçiniz...</option>
              {missionGroupOptions.length === 0 ? (
                <option value="" disabled>Yükleniyor...</option>
              ) : (
                missionGroupOptions.map(mg => <option key={mg.code} value={mg.code}>{mg.label}</option>)
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Teknisyen</label>
            <input type="text" value={technician || "Oturum açılmamış"} disabled readOnly className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#0f1219] text-slate-600 dark:text-slate-400 text-sm cursor-not-allowed" />
          </div>
          {!workOrderId && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
              Bu cihaza bağlı bir servis iş emri olmadığı için onarım eklenemiyor.
            </p>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Ücret Tipi</label>
            <div className="flex gap-3">
              {["FREE", "PAID"].map(w => (
                <button key={w} onClick={() => setChargeType(w)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${chargeType === w ? (w === "FREE" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20") : "bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
                  {CHARGE_TYPES[w].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-700">İptal</button>
          <button onClick={handleSubmit} disabled={!group || !workOrderId || submitting} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Ekleniyor..." : "Onarım Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── STATUS ADVANCE MODAL ───────────────────────────────────────────
const StatusAdvanceModal = ({ repair, onClose, onAdvance }) => {
  if (!repair) return null;
  const current = repair.statusCode;
  const nextOptions = [];
  // warehouse.repair_result_type'daki gerçek statülere göre kurulmuş akış.
  // 1002 (Tamamlandı) ve 1003 (İptal Edildi) terminal statülerdir — ileri geçiş yok.
  if (current === 1000) {
    nextOptions.push({ code: 1001, label: "Teknisyene Ata" });
  }
  if (current === 1001) {
    nextOptions.push({ code: 1002, label: "Tamamla" });
    nextOptions.push({ code: 1008, label: "Parça Bekleniyor" });
    nextOptions.push({ code: 1004, label: "Yüksek Seviye Onarıma Gönder" });
    nextOptions.push({ code: 1006, label: "Teste Gönder" });
    nextOptions.push({ code: 1005, label: "Müşteri Onayına Sun" });
    nextOptions.push({ code: 1003, label: "İptal Et" });
  }
  if (current === 1008) {
    nextOptions.push({ code: 1001, label: "Parça Geldi - Devam Et" });
  }
  if (current === 1004) {
    nextOptions.push({ code: 1001, label: "Üst Seviye Onarım Bitti - Devam Et" });
  }
  if (current === 1006) {
    nextOptions.push({ code: 1002, label: "Test Başarılı - Tamamla" });
    nextOptions.push({ code: 1007, label: "Test Başarısız" });
  }
  if (current === 1007) {
    nextOptions.push({ code: 1001, label: "Tekrar Onarıma Al" });
    nextOptions.push({ code: 1003, label: "İptal Et" });
  }
  if (current === 1005) {
    nextOptions.push({ code: 1002, label: "Onay Geldi - Tamamla" });
    nextOptions.push({ code: 1003, label: "Onay Reddedildi - İptal Et" });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full mx-4 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between bg-slate-50 dark:bg-[#242a38]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Play size={20} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Onarıma Devam Et</h3>
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
              <button key={opt.code} onClick={() => { onAdvance(repair.id, opt.code); onClose(); }} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all group">
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

// ─── DOA RETURN PROTECTION MODAL ────────────────────────────────────
const DOAReturnModal = ({ parts, onClose, onConfirm, submitting }) => {
  const [dispositions, setDispositions] = useState(
    parts.filter(p => p.location === "OUT").reduce((acc, p) => ({ ...acc, [p.id]: "" }), {})
  );
  const [returnReason, setReturnReason] = useState("");
  const outParts = parts.filter(p => p.location === "OUT");
  const allSelected = outParts.length > 0 && outParts.every(p => dispositions[p.id]);
  const canConfirm = returnReason.trim().length > 0 && (outParts.length === 0 || allSelected) && !submitting;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-2xl border border-red-300 dark:border-red-500/40 max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-red-500/10 dark:bg-red-500/5 border-b border-red-200 dark:border-red-500/20 px-6 py-5 flex items-center gap-4 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
            <Shield size={28} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400">İade Güvenlik Kontrolü</h3>
            <p className="text-sm text-red-500/80 dark:text-red-400/70 mt-0.5">Zero-Invoice Protection Aktif</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-amber-50 dark:bg-amber-500/5 border-b border-amber-200 dark:border-amber-500/20 shrink-0">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>DİKKAT!</strong> Bu cihaz iadeye ayrılmıştır. Cihaz üzerindeki depodan çıkmış parçaların sistemden temizlenmesi zorunludur! Her parça için aşağıdaki seçeneklerden birini belirlemeniz gerekmektedir.
            </p>
          </div>
        </div>

        <div className="px-6 pt-4 shrink-0">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">İade Nedeni *</label>
          <textarea
            value={returnReason}
            onChange={e => setReturnReason(e.target.value)}
            rows="2"
            placeholder="İade nedenini yazınız..."
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 resize-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {outParts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Depodan çıkmış parça bulunmuyor. İade işlemi doğrudan onaylanabilir.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {outParts.map(p => (
                <div key={p.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-[#161B22]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.itemCode} — Miktar: {p.qty}</p>
                    </div>
                    <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg border border-red-200 dark:border-red-500/30">DEPODAN ÇIKMIŞ</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDispositions(d => ({ ...d, [p.id]: "GOOD" }))} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${dispositions[p.id] === "GOOD" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-white dark:bg-[#1e2330] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-300"}`}>
                      ✅ Sağlam Söküldü → GOOD Depoya
                    </button>
                    <button onClick={() => setDispositions(d => ({ ...d, [p.id]: "DOA" }))} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${dispositions[p.id] === "DOA" ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20" : "bg-white dark:bg-[#1e2330] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-red-300"}`}>
                      ❌ Hasarlı → DOA Hurda Depoya
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 flex gap-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-700">
            İptal
          </button>
          <button onClick={() => onConfirm(dispositions, returnReason.trim())} disabled={!canConfirm} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors shadow-lg shadow-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? "İşleniyor..." : outParts.length === 0 ? "İadeyi Onayla" : "Transferleri Tamamla & İadeyi Onayla"}
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
  // ── State ───────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [device, setDevice] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [selectedRepairIdx, setSelectedRepairIdx] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showDOAModal, setShowDOAModal] = useState(false);
  const [deviceParts, setDeviceParts] = useState([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [techNotes, setTechNotes] = useState("");
  const [chipCode, setChipCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [missionGroups, setMissionGroups] = useState([]);
  const [serviceStatuList, setServiceStatuList] = useState([]);
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

  const showNotif = useCallback((type, title, message) => {
    setNotification({ type, title, message });
    if (type !== "error") setTimeout(() => setNotification(null), 4000);
  }, []);

  // ── Search Handler ───────────────────────────────────────────
  // 1) Cihaz kimliği (IMEI/Internal ID/Seri No/model/flow) Batch Girişi'nden
  //    (lookup_batch_entry → warehouse.batch_entries) gelir — gerçek veri burada.
  // 2) Aynı IMEI için bağlı bir Servis Kaydı + SERVICE iş emri varsa
  //    (get_repair_operations_by_imei → service_records/work_orders) onarım
  //    kayıtları/parçalar/statü oradan eklenir. Yoksa sadece kimlik gösterilir.
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
        setDeviceParts([]);
        return;
      }

      const d = batchRes.data;
      const imei = d.imei_number || term;
      const productInfo = [d.model, d.gb, d.color].filter(Boolean).join(" ");
      // Cihazın gerçek anlık statüsü Batch Girişi'ndeki statu_code'dur (ör. 109 =
      // Üretim Aşamasında) — bağlı bir servis iş emri bulunup bulunmamasından bağımsızdır.
      const batchStatusCode = (d.statu_code !== null && d.statu_code !== undefined) ? Number(d.statu_code) : null;

      let repairLink = null;
      try {
        const repairRes = await api.getRepairOperationsByImei(imei);
        if (repairRes && repairRes.success) repairLink = repairRes;
      } catch (_e) {
        repairLink = null;
      }

      const realDevice = {
        imei,
        internalId: d.internal_id || "",
        serialNo: d.serial_number || "",
        productInfo: productInfo || "-",
        productCode: d.batch_no || "",
        customerRequest: d.flow || "Belirtilmemiş",
        customerDiagnosis: repairLink?.device?.customerDiagnosis || "",
        serviceStatus: batchStatusCode,
        // Batch'te statü kodu yoksa, bağlı iş emrinin eski metin statüsü (Beklemede vb.) fallback olarak gösterilir.
        serviceStatusText: batchStatusCode == null ? (repairLink?.device?.statusText || "") : "",
        workOrderId: repairLink ? repairLink.work_order_id : null,
        faultTags: [],
        batteryCycle: null,
        batteryHealth: null,
      };

      setDevice(realDevice);
      setTechNotes("");
      setChipCode("");
      setDeviceParts(repairLink?.parts || []);
      setSelectedRepairIdx(0);

      // Statüye/role göre kilitleme artık burada değil, render sırasında `hasAccess`
      // türetilmiş değeriyle yapılıyor — cihaz ve onarımlar her zaman gösterilir.
      if (repairLink) {
        setRepairs((repairLink.repairs || []).map(r => ({ ...r, technician: "", parts: [] })));
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

  // ── Repair Actions ──────────────────────────────────────────
  // Backend'e kalıcı olarak yazar (warehouse.repair_records) ve ardından
  // güncel listeyi tekrar çeker — sayfa yenilense/cihaz tekrar aransa da kaybolmaz.
  const handleAddRepair = useCallback(async (missionGroupCode, newChargeType) => {
    if (!device?.workOrderId) {
      showNotif("error", "Onarım Eklenemedi", "Bu cihaza bağlı bir servis iş emri yok.");
      return false;
    }
    const warrantyCode = newChargeType === "FREE" ? "IW" : "OOW";
    const res = await api.addRepairRecord(device.workOrderId, missionGroupCode, warrantyCode, "", getCurrentUser()?.username);
    if (!res || !res.success) {
      showNotif("error", "Onarım Eklenemedi", res?.message || "Kayıt başarısız oldu.");
      return false;
    }

    const refreshed = await api.getRepairOperationsByImei(device.imei).catch(() => null);
    if (refreshed && refreshed.success) {
      setDeviceParts(refreshed.parts || []);
      setRepairs((refreshed.repairs || []).map(r => ({ ...r, technician: "", parts: [] })));
    }

    const groupLabel = missionGroups.find(mg => mg.code === missionGroupCode)?.short_name || missionGroupCode;
    showNotif("success", "Onarım Eklendi", `${groupLabel} — ${CHARGE_TYPES[newChargeType]?.label}`);
    return true;
  }, [device, missionGroups, showNotif]);

  // warehouse.repair_records.repair_result_type_code'a kalıcı olarak yazar.
  const handleAdvanceStatus = useCallback(async (repairId, newStatus) => {
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
  }, [repairs, showNotif]);

  // ── DOA Return Handler (Guardrail: tüm onarımlar iptal + parça yönlendirmesi + iade nedeni) ──
  const handleReturnDevice = useCallback(() => {
    const activeRepairs = repairs.filter(r => !r.isCancelled);
    if (activeRepairs.length > 0) {
      showNotif(
        "error",
        "İade Edilemez",
        `Tüm onarımlar iptal edilmeden cihaz iadeye alınamaz. Aktif onarım(lar): ${activeRepairs.map(r => r.missionGroup).join(", ")}`
      );
      return;
    }
    setShowDOAModal(true);
  }, [repairs, showNotif]);

  const handleDOAConfirm = useCallback(async (dispositions, returnReason) => {
    if (!device?.workOrderId) return;
    setReturnSubmitting(true);
    try {
      const result = await api.executeDeviceReturn(device.workOrderId, returnReason, dispositions, getCurrentUser()?.username);
      if (result.success) {
        setShowDOAModal(false);
        setDevice(prev => (prev ? { ...prev, serviceStatus: 124 } : prev));
        setDeviceParts(prev => prev.map(p => (dispositions[p.id] ? { ...p, location: dispositions[p.id] } : p)));
        showNotif("success", "İade İşlemi Tamamlandı", result.message || "Cihaz 124 statüsüne alındı.");
      } else {
        showNotif("error", "İade Başarısız", result.message || "İşlem tamamlanamadı.");
      }
    } catch (err) {
      showNotif("error", "Sistem Hatası", "İade işlemi sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setReturnSubmitting(false);
    }
  }, [device, showNotif]);

  // ── Delete Part ─────────────────────────────────────────────
  const handleDeletePart = useCallback((repairId, partId) => {
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, parts: r.parts.filter(p => p.id !== partId) } : r));
    showNotif("info", "Parça Silindi", "Onarım listesinden kaldırıldı.");
  }, [showNotif]);

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

  // ── Selected repair ────────────────────────────────────────
  const selectedRepair = repairs[selectedRepairIdx] || null;

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
    <div className="flex flex-col h-full gap-4">
      {/* Notification Toast */}
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* Add Repair Modal */}
      {showAddModal && <AddRepairModal onClose={() => setShowAddModal(false)} onAdd={handleAddRepair} missionGroups={missionGroups} workOrderId={device?.workOrderId} />}

      {/* Status Advance Modal */}
      {showAdvanceModal && <StatusAdvanceModal repair={selectedRepair} onClose={() => setShowAdvanceModal(false)} onAdvance={handleAdvanceStatus} />}

      {/* DOA Return Modal */}
      {showDOAModal && <DOAReturnModal parts={deviceParts} onClose={() => setShowDOAModal(false)} onConfirm={handleDOAConfirm} submitting={returnSubmitting} />}

      {/* ═══════════════════════════════════════════════════════════
           SECTION 1: ÜST PANEL — Header & Telemetry
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#30363D]">
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={isSearching}
                placeholder="IMEI / Internal ID / Seri No okutunuz..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-60"
              />
            </div>
            <button type="submit" disabled={isSearching} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2">
              <Search size={15} /> {isSearching ? "Sorgulanıyor..." : "Sorgula"}
            </button>
            {statusBadge && (
              <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${statusBadge.tone === 'ok' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' : statusBadge.tone === 'neutral' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'}`}>
                <span className={`w-2 h-2 rounded-full ${statusBadge.tone === 'ok' ? 'bg-emerald-500 animate-pulse' : statusBadge.tone === 'neutral' ? 'bg-blue-500' : 'bg-red-500'}`}></span>
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
                  <div className="px-3 py-2.5 bg-slate-50 dark:bg-[#0f1219] rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px]">
                    {device.customerRequest}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Müşteri Arıza Tespiti</label>
                  <div className="px-3 py-2.5 bg-slate-50 dark:bg-[#0f1219] rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px]">
                    {device.customerDiagnosis}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Ürün Bilgisi</label>
                  <div className="px-3 py-2.5 bg-slate-50 dark:bg-[#0f1219] rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[56px] font-semibold">
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
                {/* Telemetry */}
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <BatteryCharging size={14} className="text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Battery Cycle</span>
                    </div>
                    <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">{device.batteryCycle ?? "-"}</p>
                  </div>
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Battery size={14} className="text-teal-500" />
                      <span className="text-[10px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-wider">Battery Health</span>
                    </div>
                    <p className={`text-xl font-black ${device.batteryHealth == null ? 'text-slate-400 dark:text-slate-600' : device.batteryHealth >= 80 ? 'text-teal-700 dark:text-teal-300' : device.batteryHealth >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{device.batteryHealth != null ? `${device.batteryHealth}%` : "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
           SECTION 2: ORTA PANEL — Onarım Detay Grid
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-[#30363D] flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Wrench size={16} className="text-slate-400" />
            Onarım Detay
            {repairs.length > 0 && <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{repairs.length} kayıt</span>}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddModal(true)} disabled={!hasAccess || !device} className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
              <Plus size={14} /> Onarım Ekle
            </button>
            <button onClick={() => setShowAdvanceModal(true)} disabled={!hasAccess || !selectedRepair} className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
              <Play size={14} /> Onarıma Devam Et
            </button>
            <button onClick={handleReturnDevice} disabled={!hasAccess || !device} className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
              <AlertTriangle size={14} /> İade Edilecek
            </button>
          </div>
        </div>

        {/* Repair Navigation Tabs */}
        {repairs.length > 0 && (
          <div className="px-5 py-2 border-b border-slate-100 dark:border-[#30363D] flex items-center gap-2 overflow-x-auto">
            <button onClick={() => setSelectedRepairIdx(Math.max(0, selectedRepairIdx - 1))} disabled={selectedRepairIdx === 0} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0">
              <ChevronLeft size={16} className="text-slate-500" />
            </button>
            {repairs.map((r, i) => (
              <button key={r.id} onClick={() => setSelectedRepairIdx(i)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border ${i === selectedRepairIdx ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white dark:bg-[#0f1219] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50'}`}>
                {r.missionGroup}
              </button>
            ))}
            <button onClick={() => setSelectedRepairIdx(Math.min(repairs.length - 1, selectedRepairIdx + 1))} disabled={selectedRepairIdx === repairs.length - 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors shrink-0">
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
          ) : repairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
              <Package size={48} strokeWidth={1} className="mb-4 opacity-40" />
              <p className="text-sm font-medium">Aktif onarım kaydı yok</p>
              <p className="text-xs mt-1">{hasAccess ? "\"Onarım Ekle\" butonuyla yeni kayıt oluşturun" : "Görüntüleyebilirsin ama bu statüde işlem yapamazsın"}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-[#0f1219] sticky top-0 z-10">
                <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Repair ID</th>
                  <th className="text-left px-3 py-3">Görev Grubu</th>
                  <th className="text-left px-3 py-3">Teknisyen</th>
                  <th className="text-left px-3 py-3">Alt Statü</th>
                  <th className="text-center px-3 py-3">Ücret</th>
                  <th className="text-center px-3 py-3">Parça Sayısı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#30363D]">
                {repairs.map((r, i) => (
                  <tr key={r.id} onClick={() => setSelectedRepairIdx(i)} className={`cursor-pointer transition-colors ${i === selectedRepairIdx ? 'bg-blue-50 dark:bg-blue-500/5 border-l-[3px] border-l-blue-500' : 'hover:bg-slate-50 dark:hover:bg-[#1e2330] border-l-[3px] border-l-transparent'}`}>
                    <td className="px-5 py-3 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{r.id}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200">{r.missionGroup}</td>
                    <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">{r.technician || <span className="italic text-slate-400">Atanmadı</span>}</td>
                    <td className="px-3 py-3"><StatusBadge code={r.statusCode} /></td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (hasAccess) handleToggleChargeType(r.id, r.chargeType); }}
                        disabled={!hasAccess}
                        title="Tıklayarak ücret tipini değiştirin"
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed ${CHARGE_TYPES[r.chargeType]?.bg} ${CHARGE_TYPES[r.chargeType]?.color}`}
                      >
                        {CHARGE_TYPES[r.chargeType]?.label}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-400">{r.parts.length}</td>
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
      {selectedRepair && (
        <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#30363D] flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} className="text-slate-400" />
              Onarım Parçaları
              <span className="text-[11px] font-bold text-blue-500">— {selectedRepair.missionGroup}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            {selectedRepair.parts.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-600">
                Bu onarım emrine henüz parça eklenmemiş.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#0f1219]">
                  <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-5 py-2.5">Parça Kodu</th>
                    <th className="text-left px-3 py-2.5">Parça Adı</th>
                    <th className="text-center px-3 py-2.5">Miktar</th>
                    <th className="text-center px-3 py-2.5">Ücret</th>
                    <th className="text-right px-3 py-2.5">Birim Fiyat</th>
                    <th className="text-center px-3 py-2.5">Depo Konumu</th>
                    <th className="text-center px-3 py-2.5">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#30363D]">
                  {selectedRepair.parts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#1e2330] transition-colors">
                      <td className="px-5 py-2.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{p.itemCode}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200">{p.name}</td>
                      <td className="px-3 py-2.5 text-xs text-center font-bold text-slate-700 dark:text-slate-300">{p.qty}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => hasAccess && handleToggleChargeType(selectedRepair.id, p.id)} disabled={!hasAccess} className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer hover:opacity-80 transition-opacity ${CHARGE_TYPES[p.chargeType]?.bg} ${CHARGE_TYPES[p.chargeType]?.color} disabled:cursor-not-allowed`} title="Tıklayarak ücret tipini değiştirin">
                          {CHARGE_TYPES[p.chargeType]?.label}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-slate-700 dark:text-slate-300">
                        {p.unitPrice > 0 ? `₺${p.unitPrice.toLocaleString('tr-TR')}` : <span className="text-emerald-500">Ücretsiz</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${p.location === "GOOD" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30" : p.location === "DOA" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30" : p.location === "OUT" ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"}`}>
                          {p.location}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => hasAccess && handleDeletePart(selectedRepair.id, p.id)} disabled={!hasAccess} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Parçayı Sil">
                          <Trash2 size={14} />
                        </button>
                      </td>
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
        <div className="bg-white dark:bg-[#161B22] rounded-2xl border border-slate-200 dark:border-[#30363D] shadow-sm overflow-hidden">
          <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Açıklama (Teknisyen Notu)</label>
              <textarea
                value={techNotes}
                onChange={e => setTechNotes(e.target.value)}
                disabled={!hasAccess}
                placeholder="Yapılan işlemlerle ilgili detaylı notlarınızı buraya giriniz..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
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
