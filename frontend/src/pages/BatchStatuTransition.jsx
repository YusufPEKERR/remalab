import React, { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ScanLine, CheckCircle, AlertTriangle, Info, X, ArrowRight, History, ClipboardEdit } from "lucide-react";
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
        <p className="text-sm font-medium leading-snug">{notification.message}</p>
      </div>
      <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

const LOG_STYLES = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const LOG_ICONS = {
  success: <CheckCircle size={15} />,
  error: <AlertTriangle size={15} />,
  warning: <AlertTriangle size={15} />,
};

// test_stage artık "103_104" gibi service_statu_map.code formatında gelir.
// Ekranda geçişin kendi adını (transition.short_name) göstermek daha anlamlı.
const stageLabel = (testStage, transition) =>
  transition?.short_name || testStage || "Test";

// Sadece bu iki geçişte IMEI okutulduğunda Phonecheck'e gidilir (Pass/Fail testi).
// Diğer tüm statü geçiş ekranlarında eski davranış geçerlidir: PhoneCheck sorgusu
// yapılmaz, kayıt doğrudan sabit kaynak→hedef statüsüne taşınır.
const PHONECHECK_DRIVEN_CODES = ["103_104", "124_125"];

const MANUAL_FIELD_LABELS = {
  working: "Çalışıyor mu (Working)",
  grade: "Grade",
  model: "Model",
  memory: "Hafıza (Memory)",
  serial: "Seri Numarası",
  color: "Renk",
  notes: "Cihaz Notu",
};

// Batch Girişi'ndeki GB_OPTIONS ile aynı - kalıcı bir referans tablosu yok.
const MEMORY_OPTIONS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];

// ─── PHONECHECK MANUEL DOLDURMA MODALI ───
const ManualTestModal = ({ open, imei, stageName, fields, onClose, onSubmit, saving }) => {
  const [reason, setReason] = useState("");
  const [values, setValues] = useState({});
  const [modelOptions, setModelOptions] = useState([]);

  useEffect(() => {
    if (open) {
      setReason("");
      setValues({});
      api.getProductFamilies().then((res) => {
        if (res && res.success) setModelOptions(res.product_families || []);
      });
    }
  }, [open, imei]);

  if (!open) return null;

  const reasonEmpty = !reason.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#1e2330] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700/50 flex items-start gap-3">
          <ClipboardEdit size={20} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Test Verisini Elle Doldur</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {imei} · {stageName} — Phonecheck'te bulunamadı
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cihazın neden Phonecheck'te bulunmadığını açıklayın (zorunlu)"
              className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
            {reasonEmpty && (
              <p className="text-xs text-red-500 mt-1">Bu alan zorunludur, boş bırakılamaz.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(fields || []).map((f) => (
              <div key={f} className={f === "notes" ? "col-span-2" : ""}>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {MANUAL_FIELD_LABELS[f] || f}
                </label>
                {f === "model" ? (
                  <select
                    value={values[f] || ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Model seçiniz...</option>
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                ) : f === "memory" ? (
                  <select
                    value={values[f] || ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Hafıza seçiniz...</option>
                    {MEMORY_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={values[f] || ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
          >
            Vazgeç
          </button>
          <button
            onClick={() => onSubmit(reason, values)}
            disabled={reasonEmpty || saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-900/20"
          >
            {saving ? "Kaydediliyor..." : "Kaydet ve Devam Et"}
          </button>
        </div>
      </div>
    </div>
  );
};

const BatchStatuTransition = () => {
  const { groupKey, code } = useParams();
  const [transition, setTransition] = useState(null);
  const [loadingTransition, setLoadingTransition] = useState(true);

  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [log, setLog] = useState([]);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [manualModal, setManualModal] = useState(null); // { imei, testStage, fields, entryId }
  const [savingManual, setSavingManual] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const loadTransition = async () => {
      setLoadingTransition(true);
      setTransition(null);
      setLog([]);
      setDeviceInfo(null);
      try {
        const data = await api.getAllStatuTransitions();
        if (data.success) {
          const found = data.transitions.find((t) => t.to_dest === groupKey && t.code === code);
          setTransition(found || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTransition(false);
      }
    };
    loadTransition();
  }, [groupKey, code]);

  useEffect(() => {
    if (transition) inputRef.current?.focus();
  }, [transition]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    if (type !== "error") {
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const appendLog = (type, message) => {
    setLog((prev) => [
      { id: Date.now() + Math.random(), type, message, time: new Date().toLocaleTimeString("tr-TR") },
      ...prev,
    ]);
  };

  const attemptLabel = (pc) => `${pc.attempt_no || 1}. deneme`;

  // Kaynak→hedef statü geçişini uygular ve sonucu loglar.
  const applyTransition = async (entryId) => {
    const data = await api.executeBatchEntryStatuTransition(
      entryId,
      transition.parent_statu,
      transition.child_statu
    );

    if (data.success) {
      showNotification("success", data.message);
      appendLog("success", data.message);
      setDeviceInfo((prev) => (prev ? { ...prev, statuCode: transition.child_statu, statuName: null } : prev));
    } else {
      showNotification("error", data.message);
      appendLog("error", data.message);
    }
    return data.success;
  };

  // Manuel doldurma formu gönderildiğinde: kaydı yaz, sonra geçişi uygula.
  const handleManualSubmit = async (reason, values) => {
    if (!manualModal) return;
    setSavingManual(true);
    try {
      const res = await api.savePhonecheckManual(
        manualModal.imei,
        manualModal.testStage,
        reason,
        localStorage.getItem("username") || "",
        values
      );

      if (!res.success) {
        showNotification("error", res.message);
        appendLog("error", res.message);
        return;
      }

      appendLog("warning", `${stageLabel(manualModal.testStage, transition)} verisi elle dolduruldu: ${reason}`);
      setManualModal(null);
      await applyTransition(manualModal.entryId);
    } catch (err) {
      console.error(err);
      showNotification("error", "Manuel kayıt sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setSavingManual(false);
      inputRef.current?.focus();
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!term.trim() || !transition) return;

    setLoading(true);
    setDeviceInfo(null);
    try {
      // 1. Adım: taranan terimi partide bul (entry_id ve mevcut statü lazım)
      const scanData = await api.scanBatchEntryStatu(term);
      if (!scanData.success) {
        showNotification("error", scanData.message);
        appendLog("error", scanData.message);
        return;
      }

      setDeviceInfo({
        imei: scanData.imei,
        batchNo: scanData.batch_no,
        flow: scanData.flow,
        statuCode: scanData.current_statu_code,
        statuName: scanData.current_statu_name,
      });

      // Cihaz bu ekranın beklediği kaynak statüde değilse Phonecheck'e hiç gitme,
      // manuel doldurma formunu da açma — direkt reddet.
      if (scanData.current_statu_code !== transition.parent_statu) {
        const msg = `Bu cihaz şu an "${scanData.current_statu_name}" (${scanData.current_statu_code}) statüsünde — bu ekran sadece ${transition.parent_statu} statüsündeki cihazlar için geçerli.`;
        showNotification("error", msg);
        appendLog("error", msg);
        return;
      }

      // 2. Adım: sadece 103_104 ve 124_125 ekranlarında Phonecheck'ten test verisi
      // çekilir. Diğer tüm ekranlarda bu adım tamamen atlanır (eski davranış).
      if (PHONECHECK_DRIVEN_CODES.includes(transition.code)) {
        // Ham okutulan terim yerine kaydın gerçek IMEI'si (yoksa Seri Numarası) gönderilir.
        const pcData = await api.fetchPhonecheckTest(
          scanData.imei,
          transition.parent_statu,
          transition.child_statu
        );

        if (!pcData.success && pcData.needs_manual) {
          setManualModal({
            imei: scanData.imei,
            testStage: pcData.test_stage,
            fields: pcData.manual_fields || [],
            entryId: scanData.entry_id,
          });
          showNotification("warning", pcData.message);
          appendLog("warning", pcData.message);
          return;
        }

        if (!pcData.success) {
          showNotification("error", pcData.message);
          appendLog("error", pcData.message);
          return;
        }

        if (pcData.test_stage) {
          const attempt = pcData.attempt_no ? ` (${attemptLabel(pcData)})` : "";
          appendLog("success", `${stageLabel(pcData.test_stage, transition)} verisi Phonecheck'ten alındı${attempt}.`);
        }
      }

      // 3. Adım: bu ekranın sabit kaynak→hedef geçişini uygula.
      // Parti şu an bu geçişin kaynak statüsünde değilse backend "uygun statü değil" hatası döner.
      await applyTransition(scanData.entry_id);
    } catch (err) {
      console.error(err);
      showNotification("error", "Sistem Hatası: sorgu sırasında beklenmeyen bir hata oluştu.");
      appendLog("error", "Sistem Hatası: sorgu sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
      setTerm("");
      inputRef.current?.focus();
    }
  };

  if (loadingTransition) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Yükleniyor...</div>;
  }

  if (!transition) {
    return (
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
        <AlertTriangle size={32} className="text-slate-300 dark:text-slate-600" />
        <p className="text-sm">Bu statü geçişi bulunamadı veya artık aktif değil.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <ManualTestModal
        open={!!manualModal}
        imei={manualModal?.imei}
        stageName={stageLabel(manualModal?.testStage, transition)}
        fields={manualModal?.fields}
        saving={savingManual}
        onClose={() => { setManualModal(null); inputRef.current?.focus(); }}
        onSubmit={handleManualSubmit}
      />

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ScanLine className="text-blue-400" size={24} /> {transition.short_name}
          </h1>
          <span className="px-3 py-1.5 rounded-full text-sm font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20 flex items-center gap-2">
            {transition.parent_statu} <ArrowRight size={14} /> {transition.child_statu}
          </span>
        </div>
        <p className="text-slate-400 mt-1">
          IMEI, seri numarası, internal ID veya batch numarasını okutun. Parti statü {transition.parent_statu} değilse işlem reddedilir.
        </p>
      </div>

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <form onSubmit={handleScan} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI / Seri Numara / Internal ID / Batch No</label>
            <div className="flex gap-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Okutunuz..."
                className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium whitespace-nowrap flex items-center gap-2"
              >
                <ScanLine size={18} /> {loading ? "Sorgulanıyor..." : "Okut"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {deviceInfo && (
        <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {deviceInfo.imei} <span className="text-slate-400 font-normal">· {deviceInfo.batchNo} · {deviceInfo.flow}</span>
            </h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-500 border-blue-500/20">
              Statü: {deviceInfo.statuCode}{deviceInfo.statuName ? ` — ${deviceInfo.statuName}` : ""}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6">
        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <History size={16} /> İşlem Durumu
        </h4>

        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <ScanLine size={32} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm">Henüz bir okutma yapılmadı.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium ${LOG_STYLES[entry.type]}`}
              >
                <span className="mt-0.5 shrink-0">{LOG_ICONS[entry.type]}</span>
                <span className="flex-1 leading-relaxed">{entry.message}</span>
                <span className="shrink-0 opacity-60 font-mono">{entry.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchStatuTransition;
