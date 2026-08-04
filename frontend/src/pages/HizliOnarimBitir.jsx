import React, { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Zap, CheckCircle, XCircle, AlertTriangle, Trash2 } from "lucide-react";
import { api } from "../services/api";

// ─── HIZLI ONARIM BİTİŞ ──────────────────────────────────────────────
// Eski "Lifecycle Management Suite V5" uygulamasındaki "<DEPARTMAN> Onarımı Hızlı
// Bitiş" penceresinin karşılığı: tek barkod kutusu + işlem durumu log'u, buton yok.
//
// Görev grubu ROTADAN okunur (/hizli-onarim-bitir/BATTERY). Ekranlar menüde ayrı
// görünür ama tek bileşen kullanılır - kodu departman başına kopyalasaydık ileride
// biri düzeltilip diğeri unutulduğunda sessiz tutarsızlık oluşurdu.
//
// Tamamlama şartları burada TEKRAR EDİLMEZ; backend quick_complete_repair,
// "Onarımı Tamamla" butonuyla aynı yardımcıyı (_repair_completion_blocker) çağırır.
// Bu ekran müşteri onayı kontrolünü de atlayamaz.

const DEPARTMANLAR = {
  BATTERY: { ad: "BATARYA", renk: "amber" },
  CAMERA: { ad: "KAMERA", renk: "violet" },
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

const saat = () => new Date().toLocaleTimeString("tr-TR", { hour12: false });

export default function HizliOnarimBitir() {
  const { missionGroup } = useParams();
  const grup = (missionGroup || "").toUpperCase();
  const dept = DEPARTMANLAR[grup] || { ad: grup || "—", renk: "slate" };

  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [satirlar, setSatirlar] = useState([]);
  const inputRef = useRef(null);
  const logRef = useRef(null);

  // Barkod okuyucu doğrudan bu kutuya yazsın diye odak hep burada tutulur.
  useEffect(() => { inputRef.current?.focus(); }, [grup]);
  // Yeni satır eklendikçe log en alta kaydırılır.
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [satirlar]);

  // Departman değişince (menüden diğer ekrana geçilince) log karışmasın.
  useEffect(() => { setSatirlar([]); setTerm(""); }, [grup]);

  const ekle = useCallback((tip, baslik, detay) => {
    setSatirlar(prev => [...prev, { id: `${Date.now()}-${prev.length}`, saat: saat(), tip, baslik, detay }]);
  }, []);

  const okut = useCallback(async (e) => {
    e.preventDefault();
    const ref = term.trim();
    if (!ref || busy) return;

    setBusy(true);
    const res = await api.quickCompleteRepair(ref, grup, getCurrentUser()?.username).catch(() => null);
    setBusy(false);
    setTerm("");
    inputRef.current?.focus();

    if (!res) {
      ekle("error", ref, "Sunucuya ulaşılamadı.");
      return;
    }
    if (!res.success) {
      ekle("error", res.imei || ref, res.message || "İşlem başarısız oldu.");
      return;
    }

    // Kayıt bazlı sonuç: kapananlar yeşil, atlananlar kırmızı ayrı satır olarak yazılır
    // ki operatör hangi parçanın neden açık kaldığını görsün.
    (res.results || []).forEach(r => {
      const parca = r.partItemCode || "(parçasız)";
      ekle(
        r.completed ? "success" : "error",
        res.imei || ref,
        r.completed
          ? `${parca}${r.technician ? ` · ${r.technician}` : ""} → Onarım tamamlandı`
          : `${parca} · ${r.message}`
      );
    });

    if (res.skipped > 0) {
      ekle("warn", res.imei || ref, `${res.total} kayıttan ${res.completed} tanesi kapandı, ${res.skipped} tanesi açık kaldı.`);
    }
  }, [term, busy, grup, ekle]);

  const sayac = satirlar.reduce((a, s) => {
    if (s.tip === "success") a.ok += 1;
    else if (s.tip === "error") a.hata += 1;
    return a;
  }, { ok: 0, hata: 0 });

  const TONLAR = {
    success: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    error: "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300",
    warn: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300",
  };
  const IKONLAR = {
    success: <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />,
    error: <XCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />,
    warn: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />,
  };

  const bilinmeyen = !DEPARTMANLAR[grup];

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1100px] mx-auto animate-in fade-in duration-300">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 text-xs font-semibold tracking-wide">
            <Zap size={13} /> HIZLI ONARIM BİTİŞ
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
            {dept.ad} Onarımı Hızlı Bitiş
          </h1>
          <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
            Cihazı okutun. Teknisyene atanmış ve parçası depodan çıkmış onarımlar otomatik olarak tamamlanır.
            Şartları sağlamayan kayıtlar açık kalır, sebebi aşağıda listelenir.
          </p>
        </div>
      </div>

      {bilinmeyen && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <p>Tanımsız görev grubu: <strong>{grup || "(boş)"}</strong>. Bu ekran yalnızca BATARYA ve KAMERA için tanımlıdır.</p>
        </div>
      )}

      {/* BARKOD */}
      <div className="glass-card rounded-2xl p-5 shadow-md">
        <form onSubmit={okut} className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            IMEI / Seri Numara / Internal ID
          </label>
          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={e => setTerm(e.target.value)}
            disabled={busy || bilinmeyen}
            placeholder="Okutun ve Enter'a basın..."
            className="w-full px-4 py-3 rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] bg-white dark:bg-[#1e222d] text-sm text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] focus:outline-none focus:border-[#00B2FF] transition-all disabled:opacity-50 font-mono"
          />
          {busy && <p className="text-xs text-slate-400">İşleniyor...</p>}
        </form>
      </div>

      {/* İŞLEM DURUMU */}
      <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1e222d] flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">İşlem Durumu</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
              {sayac.ok} tamamlandı
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
              {sayac.hata} yapılamadı
            </span>
            {/* Log kendiliğinden silinmez - operatör kaç cihaz işlediğini görebilmeli. */}
            <button
              onClick={() => setSatirlar([])}
              disabled={satirlar.length === 0}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#1e222d] text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181a24] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} /> Temizle
            </button>
          </div>
        </div>
        <div ref={logRef} className="p-3 space-y-1.5 overflow-y-auto" style={{ minHeight: 280, maxHeight: 460 }}>
          {satirlar.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400 dark:text-slate-600">
              <Zap size={40} strokeWidth={1} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">Henüz işlem yapılmadı</p>
              <p className="text-xs mt-1">Yukarıdaki kutuya cihaz okutarak başlayın</p>
            </div>
          ) : (
            satirlar.map(s => (
              <div key={s.id} className={`border rounded-lg px-3 py-2 flex items-start gap-2 text-xs ${TONLAR[s.tip]}`}>
                {IKONLAR[s.tip]}
                <span className="font-mono text-[11px] opacity-70 shrink-0">{s.saat}</span>
                <span className="font-bold font-mono shrink-0">{s.baslik}</span>
                <span className="flex-1 min-w-0">{s.detay}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
