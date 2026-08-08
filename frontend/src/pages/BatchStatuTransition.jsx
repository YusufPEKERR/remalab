import React, { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ScanLine, CheckCircle, AlertTriangle, Info, X, ArrowRight, History, ClipboardEdit, Tag, Printer } from "lucide-react";
import { api } from "../services/api";
import EtiketYazdirModal from "../components/EtiketYazdirModal";

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

// Sadece İLK TEST geçişinde (103_104) IMEI okutulduğunda Phonecheck'e gidilir (Pass/Fail testi).
// Son teste kabul (124_125) artık Phonecheck'e GİTMEZ — cihaz doğrudan 124→125'e taşınır;
// PhoneCheck test verisi Son Test Sonuç ekranında (onaydan sonra) gösterilir.
// Diğer tüm statü geçiş ekranlarında da PhoneCheck sorgusu yapılmaz, kayıt doğrudan taşınır.
const PHONECHECK_DRIVEN_CODES = ["103_104"];

// Okutma yanıtından etikete gereken cihaz alanları. Üç yerde birden kullanılıyor
// (manuel form, eksik alan tamamlama, doğrudan geçiş); tek yerde toplanmazsa
// biri unutulduğunda etiket o yolda yarım basılıyor.
const cihazBilgisi = (scanData) => ({
  imei: scanData.imei,
  internalId: scanData.internal_id || "",
  serialNo: scanData.serial_number || "",
  brand: scanData.brand || "",
  model: scanData.model || "",
  gb: scanData.gb || "",
  color: scanData.color || "",
  productCode: scanData.batch_no || "",
});

// Geçiş başarılı olduktan sonra etiket sorulan ekranlar.
// 103_104 = "Üretime teslim edilecek": barkod basılır, kalan alanlar elle doldurulur.
const ETIKET_SORULAN_KODLAR = { "103_104": "teslim" };

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

// Üretime teslim statü geçişindeki "Test Verisini Elle Doldur" modalinde gösterilmeyecek
// alanlar. Model / Hafıza / Seri Numarası / Renk / Cihaz Notu bu ekrandan kaldırıldı;
// backend manual_fields içinde gönderse bile bunlar filtrelenir.
const HIDDEN_MANUAL_FIELDS = ['model', 'memory', 'serial', 'color', 'notes'];

// "Test Verisini Elle Doldur" modalindeki Grade alanı için geçerli kalite dereceleri.
const GRADE_OPTIONS = ['A', 'B', 'C', 'C++', 'C+', 'C-', 'C-P', 'D', 'D+'];

// ─── PHONECHECK MANUEL DOLDURMA MODALI ───
// tamamlamaModu: cihaz Phonecheck'te BULUNDU ama bazı alanları boş geldi. O zaman
// "neden bulunamadı" açıklaması sorulmaz (cihaz bulundu); yalnızca eksik alanlar ve
// barkod bilgileri istenir. Phonecheck'ten gelen değerler baslangicDegerleri ile
// dolu gelir ve zaten "fields" listesinde olmadıkları için tekrar sorulmaz.
const ManualTestModal = ({ open, imei, stageName, fields, onClose, onSubmit, saving,
                          etiketBasilacak = false, tamamlamaModu = false,
                          baslangicDegerleri = null }) => {
  const [reason, setReason] = useState("");
  const [values, setValues] = useState({});
  const [modelOptions, setModelOptions] = useState([]);
  const [lokasyon, setLokasyon] = useState("");
  const [referans, setReferans] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setValues(baslangicDegerleri || {});
      setLokasyon("");
      setReferans("");
      api.getProductFamilies().then((res) => {
        if (res && res.success) setModelOptions(res.product_families || []);
      });
    }
  }, [open, imei]);

  if (!open) return null;

  // FORMUN TAMAMI ZORUNLU. Barkod bir kez basılıp cihazla birlikte üretime gidiyor;
  // yarım doldurulmuş etiket sahada düzeltilemiyor. Bu yüzden hem test verisi hem
  // barkod alanları eksiksiz olmadan kaydedilemez. Eksik alanlar butonun üstünde
  // adıyla listelenir - kullanıcı hangi alanın kaldığını aramasın.
  const gorunenAlanlar = (fields || []).filter((f) => !HIDDEN_MANUAL_FIELDS.includes(f));
  const eksikler = [];
  if (!tamamlamaModu && !reason.trim()) eksikler.push("Açıklama");
  for (const f of gorunenAlanlar) {
    if (!String(values[f] || "").trim()) eksikler.push(MANUAL_FIELD_LABELS[f] || f);
  }
  if (etiketBasilacak) {
    if (!lokasyon.trim()) eksikler.push("Lokasyon");
    if (!referans.trim()) eksikler.push("Referans Kodu");
  }
  const reasonEmpty = !reason.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#12141c] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700/50 flex items-start gap-3">
          <ClipboardEdit size={20} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {tamamlamaModu ? "Eksik Test Alanları ve Barkod"
                : etiketBasilacak ? "Test Verisi ve Barkod" : "Test Verisini Elle Doldur"}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {imei} · {stageName} — {tamamlamaModu
                ? "Phonecheck'ten gelmeyen alanlar"
                : "Phonecheck'te bulunamadı"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {/* Açıklama yalnızca cihaz Phonecheck'te BULUNAMADIĞINDA sorulur; orada
              "neden bulunamadı" gerekçesidir. Cihaz bulunup sadece bazı alanları
              eksik geldiyse böyle bir gerekçe yok, alan hiç gösterilmez. */}
          {!tamamlamaModu && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Açıklama <span className="text-red-500">*</span>
                {etiketBasilacak && (
                  <span className="ml-1 font-normal text-xs text-slate-400">— etikete de basılır</span>
                )}
              </label>
              <textarea
                rows={3}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Cihazın neden Phonecheck'te bulunmadığını açıklayın (zorunlu)"
                className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
              />
              {reasonEmpty && (
                <p className="text-xs text-red-500 mt-1">Bu alan zorunludur, boş bırakılamaz.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(fields || []).filter((f) => !HIDDEN_MANUAL_FIELDS.includes(f)).map((f) => (
              <div key={f} className={f === "notes" ? "col-span-2" : ""}>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {MANUAL_FIELD_LABELS[f] || f}<span className="text-red-500"> *</span>
                </label>
                {f === "working" ? (
                  <select
                    value={values[f] || ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seçiniz...</option>
                    <option value="Yes">Evet — test başarılı</option>
                    <option value="No">Hayır — test başarısız</option>
                  </select>
                ) : f === "model" ? (
                  <select
                    value={values[f] || ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
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
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Hafıza seçiniz...</option>
                    {MEMORY_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : f === "grade" ? (
                  <select
                    value={values[f] || ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Grade seçiniz...</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={values[f] || ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            ))}
          </div>

          {/* BARKOD ALANLARI AYNI FORMDA. Eskiden kayıt sonrası ayrı bir etiket
              penceresi açılıp Lokasyon/Referans orada isteniyordu; kullanıcı arka
              arkaya iki form dolduruyordu. Artık tek form: Açıklama zaten etikete
              basılan metin, Lokasyon ve Referans da burada alınır ve "Kaydet ve
              Barkod Yazdır" tek adımda kaydedip yazdırır. */}
          {etiketBasilacak && (
            <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Tag size={15} className="text-blue-500 shrink-0" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Barkod Bilgileri</h4>
                <span className="text-[11px] text-slate-400">— yukarıdaki açıklama etikete basılır</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Lokasyon<span className="text-red-500"> *</span>
                  </label>
                  <input
                    type="text"
                    value={lokasyon}
                    onChange={(e) => setLokasyon(e.target.value)}
                    placeholder="ör. İST11"
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Referans Kodu<span className="text-red-500"> *</span>
                  </label>
                  <input
                    type="text"
                    value={referans}
                    onChange={(e) => setReferans(e.target.value)}
                    placeholder="ör. 016-GR03-REF-O"
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap justify-end items-center gap-3">
          {eksikler.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mr-auto max-w-[60%]">
              Eksik alan: <span className="font-semibold">{eksikler.join(", ")}</span>
            </p>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
          >
            Vazgeç
          </button>
          <button
            onClick={() => onSubmit(reason, values, { lokasyon, referans })}
            disabled={eksikler.length > 0 || saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
          >
            {etiketBasilacak && <Printer size={15} />}
            {saving ? "Kaydediliyor..." : etiketBasilacak ? "Kaydet ve Barkod Yazdır" : "Kaydet ve Devam Et"}
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
  const [etiketSorusu, setEtiketSorusu] = useState(null); // { tur, cihaz }
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
  // etiketForm: etiket alanlarının önceden dolu gelecek değerleri. Test verisi elle
  // doldurulduğunda Açıklama/Lokasyon/Referans aynı formdan gelir; o durumda etiket
  // penceresi kullanıcıya HİÇ soru sormaz, doğrudan basar (otomatik).
  const applyTransition = async (entryId, cihazBilgisi = null, etiketForm = null) => {
    const data = await api.executeBatchEntryStatuTransition(
      entryId,
      transition.parent_statu,
      transition.child_statu
    );

    if (data.success) {
      showNotification("success", data.message);
      appendLog("success", data.message);
      setDeviceInfo((prev) => (prev ? { ...prev, statuCode: transition.child_statu, statuName: null } : prev));
      const etiketTuru = ETIKET_SORULAN_KODLAR[transition.code];
      if (etiketTuru) setEtiketSorusu({
        tur: etiketTuru,
        cihaz: cihazBilgisi,
        form: etiketForm || null,
        otomatik: !!etiketForm,
      });
    } else {
      showNotification("error", data.message);
      appendLog("error", data.message);
    }
    return data.success;
  };

  // Manuel doldurma formu gönderildiğinde: kaydı yaz, sonra geçişi uygula.
  const handleManualSubmit = async (reason, values, etiket = {}) => {
    if (!manualModal) return;
    setSavingManual(true);
    try {
      // İki ayrı yol: cihaz Phonecheck'te BULUNAMADIYSA yeni bir manuel test kaydı
      // yazılır; BULUNDU ama alanları eksik geldiyse var olan kayıt tamamlanır.
      // İkincisinde yeni kayıt açılsaydı attempt_no artar, aynı test adımı iki
      // denemeymiş gibi görünür ve 10 deneme hakkı boşuna tükenirdi.
      const res = manualModal.tamamlamaModu
        ? await api.completePhonecheckRecord(
            manualModal.recordId, values, localStorage.getItem("username") || "")
        : await api.savePhonecheckManual(
            manualModal.imei, manualModal.testStage, reason,
            localStorage.getItem("username") || "", values);

      if (!res.success) {
        showNotification("error", res.message);
        appendLog("error", res.message);
        return;
      }

      appendLog("warning", manualModal.tamamlamaModu
        ? `${stageLabel(manualModal.testStage, transition)} verisinin eksik alanları elle tamamlandı: ${(res.updated || []).join(", ")}`
        : `${stageLabel(manualModal.testStage, transition)} verisi elle dolduruldu: ${reason}`);
      setManualModal(null);
      // Etiket bu yolda da dolu basılsın: cihaz alanları okutma anından taşınır,
      // Açıklama burada yazılan zorunlu gerekçedir, Lokasyon/Referans da aynı
      // formdan gelir. Form dolu geldiği için etiket penceresi soru sormaz.
      await applyTransition(manualModal.entryId, manualModal.cihaz, {
        // Tamamlama modunda "neden bulunamadı" açıklaması yok; etiketin açıklama
        // alanı da bu yüzden boş basılır.
        aciklama: manualModal.tamamlamaModu ? "" : reason,
        lokasyon: etiket.lokasyon || "",
        referans: etiket.referans || "",
      });
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
            cihaz: cihazBilgisi(scanData),
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

        // Cihaz Phonecheck'te BULUNDU ama bazı alanları boş geldi. Aynı formu
        // aç: Phonecheck'ten gelenler DOLU gelir, yalnızca boş kalanlar elle
        // doldurulur. Kayıt zaten yazıldı; form yeni deneme açmaz, o satırı
        // tamamlar (complete_phonecheck_record).
        if (pcData.needs_completion) {
          setManualModal({
            imei: scanData.imei,
            testStage: pcData.test_stage,
            fields: pcData.missing_fields || [],
            baslangicDegerleri: pcData.values || {},
            recordId: pcData.record_id,
            tamamlamaModu: true,
            entryId: scanData.entry_id,
            cihaz: cihazBilgisi(scanData),
          });
          const msg = "Phonecheck verisi eksik geldi; kalan alanları doldurun.";
          showNotification("warning", msg);
          appendLog("warning", msg);
          return;
        }
      }

      // 3. Adım: bu ekranın sabit kaynak→hedef geçişini uygula.
      // Parti şu an bu geçişin kaynak statüsünde değilse backend "uygun statü değil" hatası döner.
      await applyTransition(scanData.entry_id, cihazBilgisi(scanData));
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
      <div className="bg-white dark:bg-[#12141c] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
        <AlertTriangle size={32} className="text-slate-700 dark:text-slate-300 dark:text-slate-600" />
        <p className="text-sm">Bu statü geçişi bulunamadı veya artık aktif değil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <EtiketYazdirModal
        acik={!!etiketSorusu}
        cihaz={etiketSorusu?.cihaz}
        tur={etiketSorusu?.tur || "teslim"}
        soruMetni="Barkod yazdırmak ister misiniz?"
        varsayilanForm={etiketSorusu?.form || null}
        otomatik={!!etiketSorusu?.otomatik}
        onKapat={() => setEtiketSorusu(null)}
      />

      <ManualTestModal
        open={!!manualModal}
        imei={manualModal?.imei}
        stageName={stageLabel(manualModal?.testStage, transition)}
        fields={manualModal?.fields}
        saving={savingManual}
        etiketBasilacak={!!ETIKET_SORULAN_KODLAR[transition?.code]}
        tamamlamaModu={!!manualModal?.tamamlamaModu}
        baslangicDegerleri={manualModal?.baslangicDegerleri || null}
        onClose={() => { setManualModal(null); inputRef.current?.focus(); }}
        onSubmit={handleManualSubmit}
      />

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/30 text-amber-700 dark:text-amber-300 text-xs font-semibold tracking-wide">
              <ScanLine size={13} className="text-amber-400" /> TOPLU STATÜ GEÇİŞ İŞLEMİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white flex items-center gap-3">
              {transition.short_name}
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              IMEI, seri numarası, internal ID veya parti numarasını okutun. Parti statü {transition.parent_statu} değilse işlem reddedilir.
            </p>
          </div>

          <div className="shrink-0">
            <span className="px-4 py-2 rounded-xl text-xs font-bold border bg-blue-500/10 dark:bg-blue-500/20 text-[#8894D8] border-blue-500/30 flex items-center gap-2 shadow-md">
              {transition.parent_statu} <ArrowRight size={14} /> {transition.child_statu}
            </span>
          </div>
        </div>
      </div>

      {/* OKUTMA INPUT KARTI */}
      <div className="glass-card p-6 rounded-2xl shadow-md">
        <form onSubmit={handleScan} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5] uppercase tracking-wider mb-2">IMEI / Seri Numara / Internal ID / Batch No Okutun</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Barkod / IMEI okutunuz..."
                className="flex-1 bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-3 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-[#00B2FF] disabled:opacity-50 transition-all shadow-xs"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#00B2FF] hover:bg-[#1e222d] disabled:opacity-40 text-white px-8 py-3 rounded-xl transition-all shadow-md font-semibold text-xs cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <ScanLine size={16} /> {loading ? "Sorgulanıyor..." : "Okut"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {deviceInfo && (
        <div className="glass-card p-6 rounded-2xl shadow-md">
          <div className="flex flex-wrap items-center justify-between flex-wrap gap-3">
            <h3 className="text-base font-semibold text-[#12141c] dark:text-[#F6F8FF]">
              <span className="font-mono text-[#8894D8]">{deviceInfo.imei}</span> <span className="text-[#5A6685] dark:text-[#8892B5] font-normal">· {deviceInfo.batchNo} · {deviceInfo.flow}</span>
            </h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-blue-500/10 dark:bg-blue-500/20 text-blue-400 border-blue-500/30">
              Statü: {deviceInfo.statuCode}{deviceInfo.statuName ? ` — ${deviceInfo.statuName}` : ""}
            </span>
          </div>
        </div>
      )}

      {/* İŞLEM GEÇMİŞİ LOG */}
      <div className="glass-card rounded-2xl p-6 shadow-md flex-1 min-h-[300px]">
        <h4 className="text-xs font-bold text-[#5A6685] dark:text-[#8892B5] uppercase tracking-wider mb-4 flex items-center gap-2">
          <History size={16} /> İşlem Geçmişi (Log)
        </h4>

        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#5A6685]">
            <ScanLine size={32} className="text-[#2e3545]" />
            <p className="text-xs font-semibold">Henüz bir okutma yapılmadı.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs font-medium ${LOG_STYLES[entry.type]}`}
              >
                <span className="mt-0.5 shrink-0">{LOG_ICONS[entry.type]}</span>
                <span className="flex-1 leading-relaxed">{entry.message}</span>
                <span className="shrink-0 opacity-70 font-mono text-[11px]">{entry.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchStatuTransition;
