import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Tag, Save, RotateCcw, Upload, Download, Check, AlertTriangle, X, Printer,
} from "lucide-react";
import { api } from "../services/api";
import EtiketYazdirModal, {
  KAGIT_FORMU_ANAHTARI, secilenKagitFormu, KENAR_PAYI_ANAHTARI, secilenKenarPayi,
  ONIZLEME_ANAHTARI, onizlemeAcikMi,
} from "../components/EtiketYazdirModal";
import {
  ETIKET_TURLERI, YER_TUTUCULAR, VARSAYILAN_SABLONLAR, sablonuDoldur, tasarimOlcusu,
  barkodFontunuYukle,
} from "../constants/etiketSablonlari";

// ─── ETİKET TASARIMI ─────────────────────────────────────────────────
// Etiket düzeni artık kodda sabit değil. Bu ekrandan HTML olarak düzenlenir,
// veritabanında (warehouse.label_templates) saklanır ve basımda oradan okunur.
// Böylece tasarım tüm makinelerde aynı olur ve değiştirmek için sürüm gerekmez.

// Önizlemede kullanılan örnek veri - gerçek basımda bunların yerine cihazın
// kendi bilgileri gelir.
const ORNEK = {
  imei: "358722572508106",
  internalId: "E81C08F0",
  marka: "Samsung",
  model: "Galaxy Z Fold4",
  hafiza: "256GB",
  renk: "Graygreen",
  urun: "Galaxy Z Fold4 256GB Graygreen",
  parti: "Batch 107-007",
  akis: "Refurbish",
  parca: "Back Glass",
  aciklama: "KAPANIP AÇILIYOR TEST EDİLEMEDİ",
  lokasyon: "İST11",
  referans: "016-GR03-REF-O",
  tarih: "04.08.2026 16:20",
  kullanici: "Yusuf PEKER",
};

const Bildirim = ({ bildirim, onKapat }) => {
  if (!bildirim) return null;
  const renk = bildirim.tip === "error"
    ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
    : "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  return (
    <div className={`fixed top-6 right-6 z-[110] max-w-sm w-full border rounded-xl px-4 py-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-3 fade-in duration-300 ${renk}`}>
      <span className="mt-0.5 shrink-0">
        {bildirim.tip === "error" ? <AlertTriangle size={18} className="text-red-500" />
          : <Check size={18} className="text-emerald-500" />}
      </span>
      <p className="text-sm font-medium leading-snug flex-1">{bildirim.mesaj}</p>
      <button onClick={onKapat} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

export default function EtiketTasarimi() {
  const [aktif, setAktif] = useState("teslim");
  const [sablonlar, setSablonlar] = useState({});   // key -> {name,widthMm,heightMm,html,...}
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [bildirim, setBildirim] = useState(null);
  const dosyaRef = useRef(null);
  // Deneme basımı: gerçek basımla AYNI bileşeni ve aynı yolu kullanır, böylece
  // "ekranda doğru ama kağıtta yanlış" durumu burada da yakalanır.
  const [deneme, setDeneme] = useState(false);

  const bildir = (tip, mesaj) => {
    setBildirim({ tip, mesaj });
    setTimeout(() => setBildirim(null), 5000);
  };

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const res = await api.getLabelTemplates();
    const gelen = {};
    if (res && res.success) for (const t of (res.templates || [])) gelen[t.key] = t;
    // Kayıt yoksa varsayılanla başla - kullanıcı boş ekranla karşılaşmasın.
    const birlesik = {};
    for (const t of ETIKET_TURLERI) {
      birlesik[t.key] = gelen[t.key] || { ...VARSAYILAN_SABLONLAR[t.key], kayitli: false };
      if (gelen[t.key]) birlesik[t.key].kayitli = true;
    }
    setSablonlar(birlesik);
    setYukleniyor(false);
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  // Barkod yazı tipi hazır olunca önizleme yeniden çizilir; yoksa önizlemede SVG
  // görünür ama kâğıda yazı tipi giderdi (ikisi farklı görünüyor).
  const [fontDurumu, setFontDurumu] = useState(0);
  useEffect(() => { barkodFontunuYukle().then(() => setFontDurumu(n => n + 1)); }, []);

  const s = sablonlar[aktif];
  const guncelle = (alan, deger) =>
    setSablonlar(p => ({ ...p, [aktif]: { ...p[aktif], [alan]: deger } }));

  const kaydet = async () => {
    if (!s) return;
    setKaydediyor(true);
    let kullanici = "";
    try {
      const u = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
      kullanici = u?.username || "";
    } catch (_e) { /* isim olmadan da kaydedilir */ }
    const res = await api.saveLabelTemplate(aktif, s.name, s.widthMm, s.heightMm, s.html,
                                            !!s.rotate, kullanici);
    setKaydediyor(false);
    if (res && res.success) { bildir("success", "Şablon kaydedildi. Bundan sonraki basımlar bunu kullanır."); yukle(); }
    else bildir("error", (res && res.message) || "Şablon kaydedilemedi.");
  };

  const varsayilanaDon = async () => {
    if (!window.confirm("Bu etiketin tasarımı varsayılana dönecek. Emin misiniz?")) return;
    const res = await api.deleteLabelTemplate(aktif);
    if (res && res.success) {
      setSablonlar(p => ({ ...p, [aktif]: { ...VARSAYILAN_SABLONLAR[aktif], kayitli: false } }));
      bildir("success", "Varsayılan tasarıma dönüldü.");
    } else bildir("error", (res && res.message) || "İşlem başarısız.");
  };

  const dosyaSec = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      guncelle("html", String(okuyucu.result || ""));
      bildir("success", `"${f.name}" yüklendi. Önizlemeyi kontrol edip Kaydet'e basın.`);
    };
    okuyucu.onerror = () => bildir("error", "Dosya okunamadı.");
    okuyucu.readAsText(f, "utf-8");
    e.target.value = "";   // aynı dosya tekrar seçilebilsin
  };

  const indir = () => {
    if (!s) return;
    const blob = new Blob([s.html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `etiket-${aktif}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Yazıcının kağıt formları ve seçili form. Seçim bu bilgisayara özeldir
  // (localStorage); şablonla birlikte veritabanına yazılmaz, çünkü aynı tasarım
  // başka bilgisayarda başka yazıcıya basılıyor.
  const [formlar, setFormlar] = useState([]);
  const [yaziciAdi, setYaziciAdi] = useState("");
  const [kagitFormu, setKagitFormu] = useState(secilenKagitFormu);
  useEffect(() => {
    let alive = true;
    api.getPrinterForms().then(r => {
      if (!alive || !r || !r.success) return;
      setFormlar(r.forms || []);
      setYaziciAdi(r.printer || "");
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const kagitFormuSec = useCallback((ad) => {
    setKagitFormu(ad);
    try { localStorage.setItem(KAGIT_FORMU_ANAHTARI, ad); } catch (_e) { /* onemsiz */ }
    api.setLabelForm(ad).catch(() => {});
  }, []);

  // Kenar payı: basım tam sayfa modunda yapıldığı için yazıcının fiziksel olarak
  // basamadığı en dış şerit kırpılır. Tasarım her kenardan bu kadar içeride tutulur.
  // Rulodan ruloya, formdan forma değiştiği için makineye özel (localStorage).
  const [kenarPayi, setKenarPayi] = useState(secilenKenarPayi);
  const kenarPayiYaz = useCallback((deger) => {
    setKenarPayi(deger);
    try { localStorage.setItem(KENAR_PAYI_ANAHTARI, String(deger)); } catch (_e) { /* onemsiz */ }
  }, []);

  // Baskı önizleme: yazıcı seçim penceresinden önce gerçek çıktı gösterilsin mi.
  // Otomatik basımda (Demontaj) bu ayardan bağımsız olarak hiç açılmaz.
  const [baskiOnizleme, setBaskiOnizleme] = useState(onizlemeAcikMi);
  const baskiOnizlemeYaz = useCallback((acik) => {
    setBaskiOnizleme(acik);
    try { localStorage.setItem(ONIZLEME_ANAHTARI, acik ? "1" : "0"); } catch (_e) { /* onemsiz */ }
  }, []);

  // Önizleme: şablon örnek veriyle doldurulur. Hatalı HTML ekranı bozmasın diye
  // sabit ölçülü bir kutu içinde ve overflow:hidden ile gösterilir.
  const onizleme = useMemo(() => {
    if (!s) return "";
    try { return sablonuDoldur(s.html, ORNEK); }
    catch (e) { return `<div style="color:#c00;font-size:10px;padding:4px">Şablon hatası: ${e.message}</div>`; }
    // fontDurumu: yazı tipi geldiğinde barkodun yeniden çizilmesi için.
  }, [s, fontDurumu]);

  if (yukleniyor || !s) {
    return <div className="flex items-center justify-center h-full py-24 text-slate-400 text-sm">Yükleniyor...</div>;
  }

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <Bildirim bildirim={bildirim} onKapat={() => setBildirim(null)} />

      {/* Deneme basımı - örnek cihazla, gerçek basım yolunun aynısı. Kaydedilmemiş
          değişiklikleri de görebilmek için şablon doğrudan aktarılır. */}
      <EtiketYazdirModal
        acik={deneme}
        tur={aktif}
        sablonUstuneYaz={s}
        cihaz={{
          imei: ORNEK.imei, internalId: ORNEK.internalId, brand: ORNEK.marka,
          model: ORNEK.model, gb: ORNEK.hafiza, color: ORNEK.renk,
          productCode: ORNEK.parti, customerRequest: ORNEK.akis,
          productInfo: ORNEK.urun,
        }}
        onarimlar={[{ id: "deneme", itemCategory: ORNEK.parca }]}
        soruMetni="Deneme etiketi — yazdırmak ister misiniz?"
        onKapat={() => setDeneme(false)}
      />

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-400/30 text-violet-700 dark:text-violet-300 text-xs font-semibold tracking-wide">
            <Tag size={13} /> ETİKET TASARIMI
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Etiket Şablonları</h1>
          <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
            Yazdırılan etiketlerin düzenini buradan değiştirebilirsiniz. Şablon HTML olarak
            tutulur; içindeki <code className="font-mono text-violet-500">{"{{alan}}"}</code> yer
            tutucuları basım anında cihazın kendi bilgileriyle dolar. Kaydettiğiniz tasarım
            tüm makinelerde geçerli olur.
          </p>
        </div>
      </div>

      {/* ── TÜR SEKMELERİ ── */}
      <div className="glass-card rounded-2xl p-3 shadow-md flex flex-wrap gap-2">
        {ETIKET_TURLERI.map(t => {
          const secili = t.key === aktif;
          const kayitli = sablonlar[t.key]?.kayitli;
          return (
            <button key={t.key} onClick={() => setAktif(t.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                secili ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                       : "bg-slate-100 dark:bg-[#1a1d27] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#242836]"}`}>
              <Tag size={14} /> {t.ad}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                kayitli ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-400/20 text-slate-400"}`}>
                {kayitli ? "özel" : "varsayılan"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3 px-1">
        {ETIKET_TURLERI.find(t => t.key === aktif)?.nerede}
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── SOL: DÜZENLEYİCİ ── */}
        <div className="xl:col-span-3 glass-card rounded-2xl shadow-md p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Şablon Adı</label>
              <input type="text" value={s.name || ""} onChange={e => guncelle("name", e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Genişlik (mm)</label>
              <input type="number" min="10" step="0.5" value={s.widthMm}
                onChange={e => guncelle("widthMm", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Yükseklik (mm)</label>
              <input type="number" min="5" step="0.5" value={s.heightMm}
                onChange={e => guncelle("heightMm", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500" />
            </div>
          </div>

          {/* Yön: etiket rulosu fiziksel olarak sabit yöndedir. Geniş bir tasarım
              ancak 90° döndürülerek sığar - sürücüye "yatay bas" demek işe yaramıyor. */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tasarım Yönü</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => guncelle("rotate", false)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  !s.rotate ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-[#242836] text-slate-600 dark:text-slate-400"}`}>
                Dikey ({s.widthMm} × {s.heightMm})
              </button>
              <button type="button" onClick={() => guncelle("rotate", true)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  s.rotate ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-[#242836] text-slate-600 dark:text-slate-400"}`}>
                Yatay ({s.heightMm} × {s.widthMm}) — 90° döndürülür
              </button>
            </div>
            <span className="text-[11px] text-slate-400 flex-1 min-w-[220px] leading-snug">
              Genişlik/yükseklik <strong>etiketin fiziksel ölçüsüdür</strong>. Yatay seçilirse
              tasarım alanı döner ve basımda 90° çevrilir.
            </span>
          </div>

          {/* YAZICI KAĞIT FORMU — Yazdır penceresindeki "Kağıt boyutu" listesinin aynısı.
              Ölçüye göre otomatik seçim her zaman doğru formu bulmuyor: DYMO'da
              53.98 × 100.89 mm ölçüsünü üç ayrı form paylaşıyor ve yanlış form
              seçilince sürücü kendi kenar boşluklarıyla basıyor; etiket ikiye
              bölünüp çerçeve ve boş etiket çıkıyor. Seçim bu bilgisayara özeldir. */}
          <div className="bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-black/20">
              <Printer size={13} className="text-violet-500 shrink-0" />
              <span className="text-[11px] font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                Yazıcı Ayarları
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto truncate">
                {yaziciAdi || "yazıcı bulunamadı"} · bu bilgisayara özel
              </span>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Kağıt Formu
                  </label>
                  <select value={kagitFormu} onChange={(e) => kagitFormuSec(e.target.value)}
                    className="w-full bg-white dark:bg-[#0e1017] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500">
                    <option value="">Otomatik — ölçüye en yakın form</option>
                    {formlar.map((f, i) => (
                      <option key={`${f.name}-${i}`} value={f.name}>
                        {f.name} ({f.width} × {f.height} mm)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Kenar Payı
                  </label>
                  <div className="relative">
                    <input type="number" min="0" max="10" step="0.1" value={kenarPayi}
                      onChange={(e) => kenarPayiYaz(Number(e.target.value))}
                      className="w-28 bg-white dark:bg-[#0e1017] border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-9 py-2 text-xs font-mono focus:outline-none focus:border-violet-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 pointer-events-none">
                      mm
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">
                {yaziciAdi
                  ? <>Ölçüye göre otomatik seçim her zaman doğru formu bulmuyor — DYMO'da
                      53.98 × 100.89 mm ölçüsünü üç form paylaşıyor. Çıktıda sorun varsa
                      formu elle seçin. <strong>Kenar payı</strong>, tasarımın etiketin her
                      kenarından ne kadar içeride kalacağıdır: kenarlar kırpılıyorsa artırın,
                      etiket gereğinden küçük kalıyorsa azaltın (varsayılan 1.2 mm).</>
                  : "Varsayılan yazıcı bulunamadı; form listesi boş. Yazıcı kurulduktan sonra sayfayı yenileyin."}
              </p>

              {/* BASKI ÖNİZLEME — Windows'un yazdırma penceresindeki önizleme alanı
                  "Bu uygulama yazdırma önizlemesini desteklemiyor" der ve Qt tarafından
                  doldurulamaz. Bu yüzden yazıcı seçimi + önizleme uygulamanın kendi
                  penceresinde gösterilir, Windows'un penceresi hiç açılmaz. */}
              <label className="flex items-start gap-2.5 pt-3.5 border-t border-slate-200 dark:border-slate-700 cursor-pointer group">
                <input type="checkbox" checked={baskiOnizleme}
                  onChange={(e) => baskiOnizlemeYaz(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-violet-600 shrink-0" />
                <span className="text-[11px] text-slate-400 leading-snug">
                  <strong className="text-slate-600 dark:text-slate-300 group-hover:text-violet-500 transition-colors">
                    Yazdırmadan önce baskı önizlemesi göster
                  </strong><br />
                  Kâğıda gidecek olan, yazıcı seçimiyle aynı pencerede gösterilir. Tasarım
                  etikete sığmayıp bölünüyorsa etiket harcamadan orada uyarı çıkar.
                  <strong className="text-slate-600 dark:text-slate-300"> Tüm basım
                  noktalarında geçerlidir</strong> — L1 → "Üretime Aktar" dahil.
                  Barkod okutup beklemeden basmak istiyorsanız bu kutuyu kapatın; o zaman
                  hiçbir pencere açılmaz.
                </span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between mb-1 gap-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Şablon (HTML)</label>
              <div className="flex gap-2">
                <input ref={dosyaRef} type="file" accept=".html,.htm,.txt" onChange={dosyaSec} className="hidden" />
                <button onClick={() => dosyaRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1a1d27] hover:bg-slate-200 dark:hover:bg-[#242836] text-[11px] font-semibold flex items-center gap-1.5 transition-colors">
                  <Upload size={13} /> Şablon Yükle
                </button>
                <button onClick={indir}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1a1d27] hover:bg-slate-200 dark:hover:bg-[#242836] text-[11px] font-semibold flex items-center gap-1.5 transition-colors">
                  <Download size={13} /> İndir
                </button>
              </div>
            </div>
            <textarea value={s.html} onChange={e => guncelle("html", e.target.value)} spellCheck={false}
              rows={20}
              className="w-full bg-slate-50 dark:bg-[#0e1017] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-[12px] font-mono leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none focus:border-violet-500 resize-y" />
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <button onClick={varsayilanaDon}
              className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-xs font-bold flex items-center gap-2 transition-colors">
              <RotateCcw size={14} /> Varsayılana Dön
            </button>
            <button onClick={() => setDeneme(true)}
              className="px-4 py-2.5 rounded-xl border border-blue-300 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-xs font-bold flex items-center gap-2 transition-colors">
              <Printer size={14} /> Deneme Yazdır
            </button>
            <button onClick={kaydet} disabled={kaydediyor}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-violet-900/20 transition-colors">
              <Save size={14} /> {kaydediyor ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>

        {/* ── SAĞ: ÖNİZLEME + YER TUTUCULAR ── */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
              <Printer size={15} className="text-violet-500" /> Önizleme
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Tasarım alanı {tasarimOlcusu(s).en} × {tasarimOlcusu(s).boy} mm · etiket
              {" "}{s.widthMm} × {s.heightMm} mm{s.rotate ? " (90° döndürülerek basılır)" : ""}
            </p>
            {/* Zemin koyu temada da beyaz: etiketin çevresinde siyah bir çerçeve
                varmış gibi görünmesin, ekrandaki görüntü kâğıttakiyle aynı olsun.
                Etikete kenarlık da çizilmez — basımda çerçeve yok. */}
            <div className="flex justify-center bg-white rounded-xl p-4 overflow-auto">
              <div style={{
                width: `${tasarimOlcusu(s).en}mm`, height: `${tasarimOlcusu(s).boy}mm`,
                boxSizing: "border-box", background: "#fff", color: "#000",
                overflow: "hidden", border: "none", flexShrink: 0,
              }} dangerouslySetInnerHTML={{ __html: onizleme }} />
            </div>
          </div>

          <div className="glass-card rounded-2xl shadow-md p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Kullanılabilir Alanlar</h3>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {YER_TUTUCULAR.map(([kod, aciklama]) => (
                <button key={kod} type="button"
                  onClick={() => { navigator.clipboard?.writeText(kod); bildir("success", `${kod} kopyalandı.`); }}
                  title="Tıkla, kopyala"
                  className="w-full text-left flex items-start gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1d27] transition-colors">
                  <code className="text-[11px] font-mono font-bold text-violet-600 dark:text-violet-400 shrink-0">{kod}</code>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{aciklama}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-3 leading-snug border-t border-slate-200 dark:border-slate-700 pt-3">
              Barkod <strong>Code 39</strong> olarak çizilir. Yükseklik ve çubuk kalınlığını
              <code className="font-mono mx-1">{"{{barkod:92:1.5}}"}</code> şeklinde verebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
