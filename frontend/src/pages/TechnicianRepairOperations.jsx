import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Search, Plus, Play, AlertTriangle, Trash2, Shield, Battery,
  BatteryCharging, Cpu, X, ChevronLeft, ChevronRight, Wrench,
  CheckCircle, Clock, Package, ArrowRightLeft, Info, Lock
} from "lucide-react";
import { api } from "../services/api";

// ─── REPAIR STATUS CODES ────────────────────────────────────────────
const REPAIR_STATUS = {
  1000: { label: "Atanacak", color: "bg-slate-500", textColor: "text-slate-600 dark:text-slate-400", bgLight: "bg-slate-100 dark:bg-slate-800" },
  1001: { label: "Atandı", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400", bgLight: "bg-blue-50 dark:bg-blue-500/10" },
  1002: { label: "Tamamlandı", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400", bgLight: "bg-emerald-50 dark:bg-emerald-500/10" },
  1003: { label: "Parça Değişti", color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400", bgLight: "bg-violet-50 dark:bg-violet-500/10" },
  1004: { label: "Test Edildi", color: "bg-cyan-500", textColor: "text-cyan-600 dark:text-cyan-400", bgLight: "bg-cyan-50 dark:bg-cyan-500/10" },
  1005: { label: "Kontrol Ediliyor", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400", bgLight: "bg-amber-50 dark:bg-amber-500/10" },
  1006: { label: "Onaylandı", color: "bg-green-600", textColor: "text-green-600 dark:text-green-400", bgLight: "bg-green-50 dark:bg-green-500/10" },
  1007: { label: "Reddedildi", color: "bg-red-500", textColor: "text-red-600 dark:text-red-400", bgLight: "bg-red-50 dark:bg-red-500/10" },
  1008: { label: "Parça Bekliyor", color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400", bgLight: "bg-orange-50 dark:bg-orange-500/10" },
};

// ─── WARRANTY TYPES ─────────────────────────────────────────────────
const WARRANTY_TYPES = {
  IW: { label: "IW (Garanti İçi)", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" },
  OOW: { label: "OOW (Garanti Dışı)", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30" },
};

// ─── MISSION GROUPS (Görev Grupları) ────────────────────────────────
const MISSION_GROUPS = [
  "Ekran Onarımı", "Batarya Değişimi", "L3 Ana Kart", "Kamera Onarımı",
  "Hoparlör Değişimi", "Şarj Soketi", "Arka Kapak", "Vibrasyon Motoru",
  "Proximity Sensörü", "Face ID Modülü"
];

// ─── MOCK DATA ──────────────────────────────────────────────────────
const MOCK_DEVICE = {
  imei: "354832117654890",
  internalId: "RM-2024-001847",
  serialNo: "DNQXK0ABHNRW",
  customerRequest: "Ekranı kırıldı, batarya hızlı bitiyor. Arka kamera odaklamıyor.",
  customerDiagnosis: "LCD kırık, batarya cycle yüksek, arka kamera modül arızası tespit edildi.",
  productInfo: "iPhone 11 128GB Black (A2221)",
  productCode: "iP11-128-BLK",
  serviceStatus: 109,
  batteryCycle: 847,
  batteryHealth: 72,
  faultTags: ["LCD Panel", "Battery", "Main Camera", "Proximity"],
};

const MOCK_REPAIRS = [
  {
    id: "RPR-001",
    missionGroup: "Ekran Onarımı",
    technician: "Ahmet Yılmaz",
    statusCode: 1001,
    warrantyType: "OOW",
    parts: [
      { id: "P1", itemCode: "LCD-IP11-BLK", name: "iPhone 11 LCD Assembly Black", qty: 1, warranty: "OOW", unitPrice: 1250, location: "OUT" },
      { id: "P2", itemCode: "ADH-IP11-SET", name: "Yapışkan Seti iPhone 11", qty: 1, warranty: "OOW", unitPrice: 45, location: "OUT" },
    ]
  },
  {
    id: "RPR-002",
    missionGroup: "Batarya Değişimi",
    technician: "Mehmet Kaya",
    statusCode: 1002,
    warrantyType: "IW",
    parts: [
      { id: "P3", itemCode: "BAT-IP11-3110", name: "iPhone 11 Battery 3110mAh", qty: 1, warranty: "IW", unitPrice: 0, location: "OUT" },
      { id: "P4", itemCode: "LAB-BAT-CHG", name: "Batarya Değişim İşçiliği", qty: 1, warranty: "IW", unitPrice: 0, location: "-" },
    ]
  },
  {
    id: "RPR-003",
    missionGroup: "Kamera Onarımı",
    technician: "",
    statusCode: 1000,
    warrantyType: "OOW",
    parts: [
      { id: "P5", itemCode: "CAM-IP11-MAIN", name: "iPhone 11 Main Camera Module", qty: 1, warranty: "OOW", unitPrice: 680, location: "GOOD" },
    ]
  },
];

const MOCK_DEVICE_NON109 = {
  ...MOCK_DEVICE,
  serviceStatus: 101,
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

// ─── GUARDRAIL 109 MODAL ────────────────────────────────────────────
const Guardrail109Modal = ({ status, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
    <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-2xl border border-red-300 dark:border-red-500/40 max-w-lg w-full mx-4 overflow-hidden">
      <div className="bg-red-500/10 dark:bg-red-500/5 border-b border-red-200 dark:border-red-500/20 px-6 py-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
          <Lock size={28} className="text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Erişim Engellendi</h3>
          <p className="text-sm text-red-500/80 dark:text-red-400/70 mt-0.5">Statü Kilidi Aktif</p>
        </div>
      </div>
      <div className="px-6 py-6">
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
          Bu cihaz şu anda <strong className="text-red-500 font-bold">"{status} - Üretim Aşamasında Değil"</strong> statüsündedir.
        </p>
        <p className="text-slate-600 dark:text-slate-400 mt-3 text-sm leading-relaxed">
          Teknisyen Servis Onarımları ekranı yalnızca <strong className="text-emerald-600 dark:text-emerald-400">109 - Üretim Aşamasında</strong> statüsüne sahip cihazlar için aktiftir. Lütfen cihazın durumunu kontrol ediniz.
        </p>
        <div className="mt-5 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl flex items-start gap-3">
          <Info size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Cihaz üretim hattına alınmadan müdahale edilemez. Statü geçişi için "Servis Statü Geçişleri" ekranını kullanınız.
          </p>
        </div>
      </div>
      <div className="px-6 pb-6">
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors border border-slate-200 dark:border-slate-700">
          Kapat
        </button>
      </div>
    </div>
  </div>
);

// ─── ADD REPAIR MODAL ───────────────────────────────────────────────
const AddRepairModal = ({ onClose, onAdd }) => {
  const [group, setGroup] = useState("");
  const [technician, setTechnician] = useState("");
  const [warranty, setWarranty] = useState("OOW");

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
              {MISSION_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Teknisyen Adı</label>
            <input type="text" value={technician} onChange={e => setTechnician(e.target.value)} placeholder="Teknisyen adı giriniz..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Garanti Tipi</label>
            <div className="flex gap-3">
              {["IW", "OOW"].map(w => (
                <button key={w} onClick={() => setWarranty(w)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${warranty === w ? (w === "IW" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20") : "bg-white dark:bg-[#161B22] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
                  {WARRANTY_TYPES[w].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-700">İptal</button>
          <button onClick={() => { if (!group) return; onAdd({ id: `RPR-${Date.now()}`, missionGroup: group, technician, statusCode: 1000, warrantyType: warranty, parts: [] }); onClose(); }} disabled={!group} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
            Onarım Ekle
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
  if (current === 1000) nextOptions.push({ code: 1001, label: "Atandı (İşleme Al)" });
  if (current === 1001) {
    nextOptions.push({ code: 1002, label: "Tamamlandı" });
    nextOptions.push({ code: 1008, label: "Parça Bekliyor" });
    nextOptions.push({ code: 1003, label: "Parça Değişti" });
  }
  if (current === 1008) nextOptions.push({ code: 1001, label: "Onarıma Devam (Atandı)" });
  if (current === 1003) nextOptions.push({ code: 1004, label: "Test Edildi" });
  if (current === 1004) {
    nextOptions.push({ code: 1005, label: "Kontrol Ediliyor" });
    nextOptions.push({ code: 1002, label: "Tamamlandı" });
  }
  if (current === 1005) {
    nextOptions.push({ code: 1006, label: "Onaylandı" });
    nextOptions.push({ code: 1007, label: "Reddedildi" });
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
  const [isLocked, setIsLocked] = useState(false);
  const [show109Modal, setShow109Modal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showDOAModal, setShowDOAModal] = useState(false);
  const [deviceParts, setDeviceParts] = useState([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [techNotes, setTechNotes] = useState("");
  const [chipCode, setChipCode] = useState("");
  const searchRef = useRef(null);

  const showNotif = useCallback((type, title, message) => {
    setNotification({ type, title, message });
    if (type !== "error") setTimeout(() => setNotification(null), 4000);
  }, []);

  // ── Search Handler ──────────────────────────────────────────
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    const data = await api.getRepairOperationsByImei(searchTerm.trim());
    if (!data.success) {
      showNotif("error", "Cihaz Bulunamadı", data.message || "Bu IMEI için kayıt bulunamadı.");
      setDevice(null);
      setRepairs([]);
      setDeviceParts([]);
      return;
    }

    const realDevice = { ...data.device, workOrderId: data.work_order_id };

    setDevice(realDevice);
    setDeviceParts(data.parts || []);
    setTechNotes("");
    setChipCode("");

    // GUARDRAIL 1: Check status 109
    if (realDevice.serviceStatus !== 109) {
      setIsLocked(true);
      setShow109Modal(true);
      setRepairs([]);
      setSelectedRepairIdx(0);
      return;
    }

    setIsLocked(false);
    setRepairs((data.repairs || []).map(r => ({ ...r, technician: "", warrantyType: "OOW", parts: [] })));
    setSelectedRepairIdx(0);
    showNotif("success", "Cihaz Yüklendi", `${realDevice.productInfo} — IMEI: ${realDevice.imei}`);
  }, [searchTerm, showNotif]);

  // ── Repair Actions ──────────────────────────────────────────
  const handleAddRepair = useCallback((newRepair) => {
    setRepairs(prev => [...prev, newRepair]);
    showNotif("success", "Onarım Eklendi", `${newRepair.missionGroup} — ${newRepair.warrantyType}`);
  }, [showNotif]);

  const handleAdvanceStatus = useCallback((repairId, newStatus) => {
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, statusCode: newStatus } : r));
    const statusLabel = REPAIR_STATUS[newStatus]?.label || newStatus;
    showNotif("success", "Statü Güncellendi", `Repair ${repairId} → ${newStatus} - ${statusLabel}`);
  }, [showNotif]);

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
      const result = await api.executeDeviceReturn(device.workOrderId, returnReason, dispositions);
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

  // ── Toggle Part Warranty ────────────────────────────────────
  const handleToggleWarranty = useCallback((repairId, partId) => {
    setRepairs(prev => prev.map(r => r.id === repairId ? {
      ...r, parts: r.parts.map(p => p.id === partId ? { ...p, warranty: p.warranty === "IW" ? "OOW" : "IW" } : p)
    } : r));
  }, []);

  // ── Selected repair ────────────────────────────────────────
  const selectedRepair = repairs[selectedRepairIdx] || null;

  // ── Focus search on mount ──────────────────────────────────
  useEffect(() => { searchRef.current?.focus(); }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Notification Toast */}
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* Guardrail 109 Modal */}
      {show109Modal && <Guardrail109Modal status={device?.serviceStatus} onClose={() => setShow109Modal(false)} />}

      {/* Add Repair Modal */}
      {showAddModal && <AddRepairModal onClose={() => setShowAddModal(false)} onAdd={handleAddRepair} />}

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
                placeholder="IMEI / Internal ID / Seri No okutunuz..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2">
              <Search size={15} /> Sorgula
            </button>
            {device && (
              <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${device.serviceStatus === 109 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'}`}>
                <span className={`w-2 h-2 rounded-full ${device.serviceStatus === 109 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                Statü: {device.serviceStatus} {device.serviceStatus === 109 ? "- Üretim Aşamasında" : "- Kilitli"}
              </div>
            )}
          </form>
        </div>

        {/* Device Identity & Telemetry */}
        {device && (
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* CRM Read-Only Fields */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Müşteri Talebi</label>
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
                    {device.faultTags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                        <AlertTriangle size={11} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Telemetry */}
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <BatteryCharging size={14} className="text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Battery Cycle</span>
                    </div>
                    <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">{device.batteryCycle}</p>
                  </div>
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Battery size={14} className="text-teal-500" />
                      <span className="text-[10px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-wider">Battery Health</span>
                    </div>
                    <p className={`text-xl font-black ${device.batteryHealth >= 80 ? 'text-teal-700 dark:text-teal-300' : device.batteryHealth >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{device.batteryHealth}%</p>
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
            <button onClick={() => setShowAddModal(true)} disabled={isLocked || !device} className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
              <Plus size={14} /> Onarım Ekle
            </button>
            <button onClick={() => setShowAdvanceModal(true)} disabled={isLocked || !selectedRepair} className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
              <Play size={14} /> Onarıma Devam Et
            </button>
            <button onClick={handleReturnDevice} disabled={isLocked || !device} className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5">
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
              <p className="text-sm font-medium">{isLocked ? "Cihaz üretim aşamasında değil" : "Aktif onarım kaydı yok"}</p>
              <p className="text-xs mt-1">{isLocked ? "Statü kilidi nedeniyle işlem yapılamaz" : "\"Onarım Ekle\" butonuyla yeni kayıt oluşturun"}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-[#0f1219] sticky top-0 z-10">
                <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                  <th className="text-left px-5 py-3">Repair ID</th>
                  <th className="text-left px-3 py-3">Görev Grubu</th>
                  <th className="text-left px-3 py-3">Teknisyen</th>
                  <th className="text-left px-3 py-3">Alt Statü</th>
                  <th className="text-center px-3 py-3">Garanti</th>
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
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${WARRANTY_TYPES[r.warrantyType]?.bg} ${WARRANTY_TYPES[r.warrantyType]?.color}`}>
                        {r.warrantyType}
                      </span>
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
                    <th className="text-center px-3 py-2.5">Garanti</th>
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
                        <button onClick={() => !isLocked && handleToggleWarranty(selectedRepair.id, p.id)} disabled={isLocked} className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer hover:opacity-80 transition-opacity ${WARRANTY_TYPES[p.warranty]?.bg} ${WARRANTY_TYPES[p.warranty]?.color} disabled:cursor-not-allowed`} title="Tıklayarak garanti tipini değiştirin">
                          {p.warranty}
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
                        <button onClick={() => !isLocked && handleDeletePart(selectedRepair.id, p.id)} disabled={isLocked} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Parçayı Sil">
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
                disabled={isLocked}
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
                disabled={isLocked}
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
