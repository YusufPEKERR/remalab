import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../services/api";
import { VARSAYILAN_SABLONLAR, sablonuDoldur, barkodFontunuYukle }
  from "../constants/etiketSablonlari";
import { Printer, X, Tag } from "lucide-react";

// ─── ETİKET YAZDIRMA ─────────────────────────────────────────────────
// Etiket TASARIMI artık kodda sabit değil: "Etiket Tasarımı" ekranından düzenlenen,
// veritabanında (warehouse.label_templates) saklanan HTML şablonlardan geliyor.
// Şablon yoksa constants/etiketSablonlari.js içindeki varsayılan kullanılır.
//
// Üç etiket türü:
//   parca  — Demontaj > "Üretime Aktar". Her parça için bir etiket, sorulmadan basılır.
//            Başına 2 ek etiket gelir: elle işaretlenen kontrol etiketi ve "x".
//   teslim — "Üretime teslim edilecek (103>104)". Yazdırmadan önce form doldurulur.
//   cihaz  — "Son Test Sonuç" ekranında test başarılı olunca sorulur.
//
// YAZDIRMA - üç ayrı engel vardı, üçü de çözüldü:
//   1) Etiketler modalin içindeydi; modal (overflow-hidden), önizleme kabı
//      (overflow-y:auto) ve index.css'teki body{overflow:hidden} içeriği kırpıyor,
//      baskıya boş alan gidiyordu. Çözüm: baskı kopyası createPortal ile doğrudan
//      <body> altına basılıyor, kırpan atası kalmıyor.
//   2) QtWebEngine'de window.print() tek başına yetmiyor; uygulamanın printRequested
//      sinyalini karşılaması gerek - bkz. core/main_window.py::_yazdirma_istegi.
//   3) Etiket yazıcıları SIFIR KENAR BOŞLUĞU kabul etmiyor. DYMO LabelWriter'da
//      setPageMargins(0) False dönüyor: 53.98x100.89 mm'lik 99014 etiketinde
//      Chromium'a yalnızca 51.44x93.53 mm tuval veriliyor. Kutu medya ölçüsüne
//      (54x101) göre kurulunca 7.4 mm taşıyor, taşan şerit İKİNCİ ETİKETE basılıyor
//      ve iki sayfaya bölünen kutunun kenarları çerçeve gibi görünüyordu. Çözüm:
//      main_window._kagit_ayarla artık setFullPage(True) ile TAM SAYFA modunu açıyor
//      (tuval = medyanın tamamı), ölçü set_label_page_size'dan alınıyor ve kutu
//      aşağıdaki iki payla kuruluyor.
//
// TAŞMAYA KARŞI İKİ PAY - ikisi farklı işler yapar, karıştırılmamalı:
//   SAYFA_TOLERANSI  Kutu sayfadan bu kadar KÜÇÜK kurulur. Amaç yalnızca yuvarlama:
//                    sürücünün formu 53.98x100.89 mm iken şablonda 54x101 yazıyor ve
//                    0.11 mm'lik fark bile Chromium'a yeni bir sayfa açtırıyor.
//   KENAR_PAYI       Tasarım her kenardan bu kadar İÇERİDE kalır. Amaç kırpılma:
//                    tam sayfa modunda yazıcının fiziksel olarak basamadığı en dış
//                    şerit (DYMO'da ~1-1.5 mm) artık kırpılıyor. Rulo/form farkları
//                    için makineye özel ayarlanabilir - bkz. KENAR_PAYI_ANAHTARI.
const SAYFA_TOLERANSI_MM = 0.4;
const VARSAYILAN_KENAR_PAYI_MM = 1.2;

export const KENAR_PAYI_ANAHTARI = "etiket_kenar_payi";
export const secilenKenarPayi = () => {
  try {
    const d = parseFloat(localStorage.getItem(KENAR_PAYI_ANAHTARI));
    return Number.isFinite(d) && d >= 0 && d <= 10 ? d : VARSAYILAN_KENAR_PAYI_MM;
  } catch (_e) { return VARSAYILAN_KENAR_PAYI_MM; }
};

// BASKI ÖNİZLEME. Windows'un yazdırma penceresindeki önizleme alanı Qt uygulamalarında
// "Bu uygulama yazdırma önizlemesini desteklemiyor" der ve doldurulamaz; bu yüzden yazıcı
// seçimi + önizleme uygulamanın kendi penceresindedir (core/main_window.py::_baski_penceresi)
// ve Windows'un penceresi hiç açılmaz.
// TÜM basım noktalarında geçerlidir - Demontaj → "Üretime Aktar" dahil. Barkod okutup
// beklemeden basmak isteyen bu anahtarı kapatır; kapalıyken hiçbir pencere açılmaz.
export const ONIZLEME_ANAHTARI = "etiket_baski_onizleme";
export const onizlemeAcikMi = () => {
  try { return localStorage.getItem(ONIZLEME_ANAHTARI) !== "0"; } catch (_e) { return true; }
};

// Etiket yazıcılarında medya (rulo) fiziksel olarak sabittir: DYMO 99014 = 54 mm
// geniş, 101 mm uzun. Şablondaki widthMm/heightMm bu MEDYA ölçüsüdür.
//
// Sürücüye "yatay bas" demek İŞE YARAMIYOR - çıktı yine dikey geliyor ve geniş tasarım
// sığdırılmak için KÜÇÜLTÜLÜYOR (ölçüldü: içerik sayfanın yalnızca %53 x %29'unu
// kaplıyordu, yani ~1/4). Bu yüzden döndürmeyi CSS yapar: sayfa medyayla aynı yönde
// bildirilir, tasarım 90° döndürülüp ortalanır. Ölçüldü: içerik sayfanın %100'ünü
// kaplıyor.
const yazdirmaCss = (mEn, mBoy, dondur, kenarPayi) => {
  const tEn = dondur ? mBoy : mEn;              // tasarım alanı
  const tBoy = dondur ? mEn : mBoy;
  // Döndürüldükten SONRA sayfada kapladığı yer (ayak izi)
  const ayakEn = dondur ? tBoy : tEn;
  const ayakBoy = dondur ? tEn : tBoy;

  // TEK SAYFAYA SIĞDIR: tasarım ne olursa olsun sayfaya oranlanarak küçültülür,
  // asla büyütülmez. Her kenardan kenarPayi kadar boş bırakılır (kırpılma payı).
  const pay = Math.max(0, Number(kenarPayi) || 0);
  const olcek = Math.min(
    Math.max(mEn - 2 * pay, 1) / ayakEn,
    Math.max(mBoy - 2 * pay, 1) / ayakBoy,
    1
  );
  // Kutu sayfadan SAYFA_TOLERANSI kadar küçük kurulur: sayfayı tam dolduran bir
  // kutu, mm→px yuvarlaması yüzünden kıl payı taşıp ikinci sayfa açtırabiliyor.
  // Yatayda da düşülür; şablondaki 54 mm, sürücünün 53.98 mm'lik formundan büyük.
  const sarmalEn = Math.max(mEn - SAYFA_TOLERANSI_MM, 4);
  const sarmalBoy = Math.max(mBoy - SAYFA_TOLERANSI_MM, 4);
  // Sayfa oranı sabit; --olcek ise basımdan hemen önce ölçülen İÇERİK oranı
  // (sığdır()). İkisi çarpılır, böylece hem kutu sayfaya hem içerik kutuya sığar.
  const donusum = [
    "translate(-50%, -50%)",
    dondur ? "rotate(90deg)" : "",
    `scale(calc(${olcek.toFixed(4)} * var(--olcek, 1)))`,
  ].filter(Boolean).join(" ");

  return `
@media print {
  @page { size: ${mEn}mm ${mBoy}mm; margin: 0; }
  html, body {
    margin: 0 !important; padding: 0 !important; background: #fff !important;
    overflow: hidden !important; height: auto !important; width: auto !important;
  }
  body > *:not(#etiket-baski) { display: none !important; }
  #etiket-baski {
    position: static !important; left: auto !important; top: auto !important;
    display: block !important; background: #fff !important;
    /* Kabın kendisine mm cinsinden genişlik VERİLMEZ: şablondaki 54 mm sürücünün
       53.98 mm'lik sayfasından büyük olduğunda kap taşıyor, Chromium fazladan
       sayfa açıyordu. Sayfa genişliğini kendisi alsın, sarmallar içine otursun. */
    width: auto !important; margin: 0 !important; padding: 0 !important;
    overflow: hidden !important;
  }
  /* Her etiket bir sayfa: sarmal sayfayı kaplar, tasarım içine ölçeklenerek oturur.
     Sarmal sayfadan biraz dar olduğu için yatayda ortalanır (margin: 0 auto). */
  #etiket-baski .etiket-sarmal {
    width: ${sarmalEn}mm !important; height: ${sarmalBoy}mm !important;
    max-width: ${sarmalEn}mm !important; max-height: ${sarmalBoy}mm !important;
    position: relative !important; overflow: hidden !important;
    margin: 0 auto !important; padding: 0 !important; background: #fff !important;
    border: none !important; box-shadow: none !important;
    page-break-after: always; break-after: page;
    page-break-inside: avoid; break-inside: avoid;
  }
  #etiket-baski .etiket-sarmal:last-child { page-break-after: auto; break-after: auto; }
  #etiket-baski .etiket {
    position: absolute !important; top: 50% !important; left: 50% !important;
    width: ${tEn}mm !important; height: ${tBoy}mm !important;
    margin: 0 !important; border: none !important; box-shadow: none !important;
    overflow: hidden !important;
    transform: ${donusum} !important;
    transform-origin: 50% 50% !important;
    background: #fff; color: #000;
  }
  #etiket-baski svg { display: block; max-width: 100%; }
}
`;
};

// Parça etiketlerinin ÖNÜNE basılan üç etiket (yalnızca Demontaj → Üretime Aktar).
// Hiçbir parçaya karşılık gelmez ama sayıya dahildir: 33 parça -> 36 etiket.
// "x" etiketinden İKİ adet basılır; anahtarlar farklı olmalı, React aynı anahtarlı
// iki kardeşi tek düğüm sanıp ikincisini çizmez.
const EK_ETIKETLER = [
  { anahtar: "__kontrol", parca: "Ekran ( )   Batarya ( )   Kamera ( )   Kasa ( )   L3 ( )" },
  { anahtar: "__x", parca: "x" },
  { anahtar: "__x2", parca: "x" },
];

// Seçilen yazıcı kağıt formu MAKİNEYE özeldir (aynı tasarım başka bilgisayarda
// başka yazıcıya basılır), bu yüzden şablonla birlikte veritabanında değil
// localStorage'da tutulur. Etiket Tasarımı ekranından seçilir.
export const KAGIT_FORMU_ANAHTARI = "etiket_kagit_formu";
export const secilenKagitFormu = () => {
  try { return localStorage.getItem(KAGIT_FORMU_ANAHTARI) || ""; } catch (_e) { return ""; }
};

export default function EtiketYazdirModal({
  acik,
  cihaz,
  onarimlar = [],
  onKapat,
  soruMetni = "",          // doluysa modal bir onay sorusu gibi davranır
  tur = "parca",           // "parca" | "teslim" | "cihaz"
  ekEtiketler = false,     // Demontaj: kontrol + "x" etiketlerini de bas
  otomatik = false,        // true: soru sorma, açılır açılmaz bas ve kapan
  sablonUstuneYaz = null,  // Etiket Tasarımı ekranındaki deneme basımı için
  // Etiket alanlarının açılıştaki değerleri (yalnızca "teslim"):
  // { aciklama, lokasyon, referans }. "Test Verisini Elle Doldur" formu üçünü de
  // kendi içinde topladığı için oradan geldiğinde bu pencere hiç soru sormaz
  // (otomatik=true ile doğrudan basar) - kullanıcı iki ayrı form doldurmasın.
  varsayilanForm = null,
}) {
  const [form, setForm] = useState({ aciklama: "", lokasyon: "", referans: "" });
  const [yazdiriliyor, setYazdiriliyor] = useState(false);
  const [mesgul, setMesgul] = useState(false);   // "Yazdır" kilidi (iş bitene kadar)
  const [engel, setEngel] = useState("");
  const [sablon, setSablon] = useState(null);
  // Yazıcının gerçek basılabilir alanı (mm). Etiket yazıcıları sıfır kenar boşluğu
  // kabul etmediği için bu, medya ölçüsünden küçüktür; kutuyu buna göre kurmazsak
  // taşan şerit ikinci etikete basılıyor.
  const [basilabilir, setBasilabilir] = useState(null);
  // Kenar payı makineye özeldir (Etiket Tasarımı ekranından ayarlanır, localStorage'da
  // durur). Pencere her açıldığında yeniden okunur ki ayar hemen etkili olsun.
  const [kenarPayi, setKenarPayi] = useState(secilenKenarPayi);

  // Barkod yazı tipi hazır mı. Yüklenince yeniden çizilir: sablonuDoldur senkron
  // olduğu için yazı tipi gelmeden çizilen barkodlar SVG'ye düşmüş olurdu.
  const [fontDurumu, setFontDurumu] = useState(0);

  // Açılışta form, çağıran ekranın verdiği değerlerle dolar. "Üretime teslim
  // edilecek"te cihaz Phonecheck'te bulunamayınca test verisi elle doldurulur;
  // orada yazılan ZORUNLU açıklama ("KAPANIP AÇILIYOR TEST EDİLEMEDİ" gibi) ve
  // aynı formdaki Lokasyon/Referans doğrudan buraya taşınır.
  useEffect(() => {
    if (!acik) { setForm({ aciklama: "", lokasyon: "", referans: "" }); setEngel(""); }
    else {
      setForm({
        aciklama: varsayilanForm?.aciklama || "",
        lokasyon: varsayilanForm?.lokasyon || "",
        referans: varsayilanForm?.referans || "",
      });
      setKenarPayi(secilenKenarPayi());
      barkodFontunuYukle().then(() => setFontDurumu(n => n + 1));
    }
  }, [acik, varsayilanForm]);

  useEffect(() => {
    if (!yazdiriliyor) return;
    const t = setTimeout(() => setYazdiriliyor(false), 3000);
    return () => clearTimeout(t);
  }, [yazdiriliyor]);

  // Şablonu veritabanından çek; yoksa varsayılana düş.
  // sablonUstuneYaz verilmişse (tasarım ekranındaki deneme) o kullanılır - kullanıcı
  // kaydetmeden önce de deneyebilsin.
  useEffect(() => {
    if (sablonUstuneYaz) { setSablon(sablonUstuneYaz); return; }
    let alive = true;
    api.getLabelTemplates().then(res => {
      if (!alive) return;
      const kayitli = res && res.success
        ? (res.templates || []).find(t => t.key === tur) : null;
      setSablon(kayitli || VARSAYILAN_SABLONLAR[tur] || VARSAYILAN_SABLONLAR.parca);
    }).catch(() => {
      if (alive) setSablon(VARSAYILAN_SABLONLAR[tur] || VARSAYILAN_SABLONLAR.parca);
    });
    return () => { alive = false; };
  }, [tur, acik, sablonUstuneYaz]);

  const acikOnarimlar = useMemo(
    () => (onarimlar || []).filter(
      r => !r.isCancelled && (r.itemCategory || "").toUpperCase() !== "DGD"
    ),
    [onarimlar]
  );

  const olcu = sablon || VARSAYILAN_SABLONLAR[tur] || VARSAYILAN_SABLONLAR.parca;
  const barkodDegeri = ((cihaz && (cihaz.imei || cihaz.serialNo || cihaz.internalId)) || "")
    .trim().toUpperCase();

  // Basılabilir alan pencere açılırken ölçülür; basım anında beklenmez, çünkü CSS'in
  // window.print() çağrılmadan ÖNCE hazır olması gerekiyor.
  useEffect(() => {
    if (!acik || !olcu) return;
    let alive = true;
    // Kağıt formu ölçümden ÖNCE bildirilir: basılabilir alan seçilen forma göre değişir.
    api.setLabelForm(secilenKagitFormu())
      .catch(() => {})
      .then(() => api.setLabelPageSize(olcu.widthMm, olcu.heightMm))
      .then(r => { if (alive && r && r.success && r.printable) setBasilabilir(r.printable); })
      .catch(() => { /* ölçülemezse medya ölçüsüyle devam edilir */ });
    return () => { alive = false; };
  }, [acik, olcu.widthMm, olcu.heightMm]);

  // Baskı kutusunun ölçüsü: ölçülebildiyse yazıcının basılabilir alanı, yoksa medya.
  const sayfaEn = (basilabilir && basilabilir.olculdu) ? basilabilir.width : olcu.widthMm;
  const sayfaBoy = (basilabilir && basilabilir.olculdu) ? basilabilir.height : olcu.heightMm;

  // TEK SAYFAYA SIĞDIR — içerik ölçümü.
  // Baskı CSS'i tasarım KUTUSUNU sayfaya oranlar; bu ise kutuya sığmayan İÇERİĞİ
  // ölçüp ek bir küçültme uygular. Şablonu kullanıcı yazdığı için içerik kutudan
  // taşabiliyor: taşan kısım ya kırpılırdı ya da ikinci sayfaya düşerdi. Ölçülen
  // oran her etikete ayrı ayrı --olcek olarak yazılır (yazdırma CSS'i bunu kullanır).
  const sigdir = () => {
    const kap = document.getElementById("etiket-baski");
    if (!kap) return;
    kap.querySelectorAll(".etiket").forEach((el) => {
      el.style.removeProperty("--olcek");
      const kEn = el.clientWidth, kBoy = el.clientHeight;
      if (!kEn || !kBoy) return;
      // overflow:hidden altında da scrollWidth/Height taşan içeriği bildirir.
      const iEn = Math.max(el.scrollWidth, kEn), iBoy = Math.max(el.scrollHeight, kBoy);
      const k = Math.min(kEn / iEn, kBoy / iBoy, 1);
      // 1 px'lik yuvarlama farkı için küçültme yapılmaz.
      if (k < 0.995) el.style.setProperty("--olcek", k.toFixed(4));
    });
  };

  const yazdir = useMemo(() => async () => {
    setEngel("");
    // Barkod yazı tipi HAZIR OLMADAN basılırsa Chromium onu düz metin olarak çizer
    // ve etiket okunmaz çıkar. Burada beklenir; gelmezse barkod SVG'ye düşer.
    await barkodFontunuYukle();
    setFontDurumu(n => n + 1);
    let destek = null;
    try { destek = await api.getPrintSupport(); } catch (_e) { /* aşağıda ele alınır */ }
    if (!destek || !destek.supported) {
      setEngel(destek && destek.reason === "eski_surum"
        ? "Uygulamanın eski bir süreci çalışıyor: yazdırma desteği bu sürümde yok. "
          + "Uygulamayı tamamen kapatıp 'python main.py' ile yeniden başlatın."
        : "Yazdırma başlatılamadı. Uygulamayı yeniden başlatmayı deneyin.");
      return;
    }
    setYazdiriliyor(true);
    try {
      await api.setLabelForm(secilenKagitFormu());
      await api.setLabelPageSize(olcu.widthMm, olcu.heightMm);
      // Önizleme TÜM basım noktalarında aynı davranır (Üretime Aktar dahil): tek
      // ayar, tek pencere. Kapatmak isteyen Etiket Tasarımı'ndaki anahtarı kullanır.
      // Tema <html> sınıfından okunur (bağlam gerekmez, her sayfada doğru çalışır);
      // etiket sayısı pencerede ÜRETİLEN SAYFA sayısıyla karşılaştırılır, fazlaysa
      // tasarım sığmıyor demektir ve uyarı orada gösterilir.
      // Sayı DOM'dan okunur: basılacak olanın kendisidir ve useMemo'nun eski
      // kapanışından gelen bayat bir değer olamaz.
      await api.setPrintPreview(
        onizlemeAcikMi(),
        document.documentElement.classList.contains("dark") ? "dark" : "light",
        document.querySelectorAll("#etiket-baski .etiket-sarmal").length,
      );
    } catch (_e) { /* yine de bas */ }
    sigdir();
    window.print();

  }, [olcu.widthMm, olcu.heightMm, otomatik]);

  // OTOMATİK BASIM (Demontaj → Üretime Aktar). Modal, iş GERÇEKTEN bitene kadar açık
  // kalmalı: window.print() Qt tarafında eş zamansızdır ve baskı önizlemesi açıksa asıl
  // basım kullanıcı "Yazdır" diyene kadar hiç başlamaz. Modal önce kapanırsa
  // #etiket-baski DOM'dan silinir ve yazıcıya BOŞ sayfa gider.
  //
  // Eskiden sabit 8 sn beklenirdi; bu, önizleme penceresinde 8 saniyeden fazla kalan
  // herkes için boş etiket demekti. Artık işin sonucu sorulur ve ancak sonuçlandığında
  // (tamamlandı / iptal / hata) kapatılır.
  const basildi = useRef(false);
  const zamanlayiciRef = useRef(null);
  const iptalRef = useRef(false);
  // Basım sürerken "Yazdır" kilitli. Ayrı bir bayrak: yazdiriliyor 3 sn sonra
  // kendiliğinden sönüyor (bildirim içindir), oysa kilit iş bitene kadar sürmeli.
  const mesgulRef = useRef(false);
  const onKapatRef = useRef(onKapat);
  const yazdirRef = useRef(yazdir);
  useEffect(() => { onKapatRef.current = onKapat; }, [onKapat]);
  useEffect(() => { yazdirRef.current = yazdir; }, [yazdir]);
  // İş sonuçlanana kadar bekler ve sonucu döner (yoksa null). Üst sınır, sonuç hiç
  // gelmezse modalin sonsuza kadar açık kalmaması içindir. Bayat sonuç riski yok:
  // set_print_preview her basımdan hemen önce önceki sonucu siliyor.
  const sonucuBekle = useCallback(async () => {
    const bitis = Date.now() + 180000;
    while (!iptalRef.current && Date.now() < bitis) {
      await new Promise(r => { zamanlayiciRef.current = setTimeout(r, 700); });
      if (iptalRef.current) return null;
      try {
        const r = await api.getLastPrintResult();
        if (r && (r.durum === "tamamlandi" || r.durum === "iptal" || r.durum === "hata")) return r;
      } catch (_e) { /* sonuç okunamazsa beklemeye devam */ }
    }
    return null;
  }, []);

  // "YAZDIR" BUTONU. Basıldığı anda buton kilitlenir, iş bitince pencere KENDİ
  // kapanır - aynı etiketin iki kez basılması ya da kullanıcının basılmış bir
  // pencereyle baş başa kalması böylece mümkün değil. Pencere basımdan HEMEN
  // sonra kapatılamaz: #etiket-baski DOM'dan silinince yazıcıya boş sayfa gider,
  // bu yüzden iş sonuçlanana kadar (otomatik basımdaki gibi) beklenir.
  // İptal ya da hata durumunda pencere açık kalır; iş basılmadığı için kullanıcı
  // tekrar deneyebilsin.
  const yazdirVeKapat = useCallback(async () => {
    if (mesgulRef.current) return;
    mesgulRef.current = true;
    setMesgul(true);
    try {
      await yazdir();
      const r = await sonucuBekle();
      if (iptalRef.current) return;
      if (!r || r.durum === "tamamlandi") {
        if (onKapatRef.current) onKapatRef.current();
        return;
      }
      if (r.durum === "hata") setEngel(r.mesaj || "Yazdırma başarısız.");
      setYazdiriliyor(false);
    } finally {
      mesgulRef.current = false;
      setMesgul(false);
    }
  }, [yazdir, sonucuBekle]);

  useEffect(() => {
    if (!acik || !otomatik || !cihaz || !barkodDegeri || !sablon || basildi.current) return;
    basildi.current = true;
    zamanlayiciRef.current = setTimeout(() => {
      yazdirRef.current()
        .then(sonucuBekle)
        .finally(() => {
          if (!iptalRef.current && onKapatRef.current) onKapatRef.current();
        });
    }, 350);
  }, [acik, otomatik, cihaz, barkodDegeri, sablon, sonucuBekle]);
  useEffect(() => {
    if (!acik) {
      basildi.current = false; iptalRef.current = false;
      mesgulRef.current = false; setMesgul(false);
    }
  }, [acik]);
  useEffect(() => () => {
    iptalRef.current = true;
    if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);
  }, []);

  // Basılacak etiketlerin verisi. Her etiket = şablona doldurulacak bir veri kümesi.
  const etiketVerileri = useMemo(() => {
    if (!cihaz) return [];
    const ortak = {
      imei: barkodDegeri,
      internalId: (cihaz.internalId || "").trim().toUpperCase(),
      marka: cihaz.brand || "",
      model: cihaz.model || "",
      hafiza: cihaz.gb || "",
      renk: cihaz.color || "",
      urun: [cihaz.model, cihaz.gb, cihaz.color].filter(Boolean).join(" ") || cihaz.productInfo || "",
      // batch_no çoğu kayıtta zaten "Batch 107-007" şeklinde; başına körü körüne
      // "Batch " eklenirse "Batch Batch 107-007" çıkıyordu.
      parti: (() => {
        const b = (cihaz.productCode || "").trim();
        return !b ? "" : (/^batch\b/i.test(b) ? b : `Batch ${b}`);
      })(),
      akis: cihaz.customerRequest || "",
      aciklama: form.aciklama, lokasyon: form.lokasyon, referans: form.referans,
      tarih: new Date().toLocaleString("tr-TR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      kullanici: (() => {
        try {
          const u = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
          return u?.fullname || u?.username || "";
        } catch (_e) { return ""; }
      })(),
    };

    if (tur !== "parca") return [{ anahtar: "__tek", ...ortak }];

    // Parça adı: item_category okunabilir adı tutuyor ("Back Glass", "Battery Flex"),
    // parts.name ise çoğu kayıtta item_code ile aynı.
    const parcalar = acikOnarimlar.length
      ? acikOnarimlar.map((r, i) => ({
          anahtar: r.id || i, ...ortak,
          parca: r.itemCategory || r.partName || r.partItemCode || r.missionGroup || "PARÇA",
        }))
      : [{ anahtar: "cihaz", ...ortak, parca: ortak.urun || "CİHAZ" }];
    return ekEtiketler
      ? [...EK_ETIKETLER.map(e => ({ ...ortak, ...e })), ...parcalar]
      : parcalar;
  }, [cihaz, barkodDegeri, tur, acikOnarimlar, ekEtiketler, form]);

  if (!acik || !cihaz || !sablon) return null;

  // Kutu, basilacak alanla ayni olcude: onizleme ciktinin birebir kopyasi olsun.
  const t = olcu.rotate ? { en: sayfaBoy, boy: sayfaEn } : { en: sayfaEn, boy: sayfaBoy };
  const etiketCiz = (v) => (
    <div key={v.anahtar} className="etiket"
         style={{ width: `${t.en}mm`, height: `${t.boy}mm`,
                  boxSizing: "border-box", background: "#fff", color: "#000", overflow: "hidden" }}
         dangerouslySetInnerHTML={{ __html: sablonuDoldur(sablon.html, v) }} />
  );

  const bildirim = (renk, kenar, icerik) => (
    <div style={{
      position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, maxWidth: 560, padding: "13px 22px", borderRadius: 14,
      background: renk, color: "#fff", border: `1px solid ${kenar}`,
      boxShadow: "0 12px 34px rgba(0,0,0,.5)", fontSize: 13, fontWeight: 600, lineHeight: 1.45,
    }}>{icerik}</div>
  );

  const baskiKopyasi = createPortal(
    <>
      <style>{yazdirmaCss(sayfaEn, sayfaBoy, !!olcu.rotate, kenarPayi)}</style>
      {/* key: barkod yazı tipi sonradan hazır olduğunda etiketler SVG çiziminden
          yazı tipine geçer; düğümler tazelensin diye kap yeniden kurulur. */}
      <div id="etiket-baski" key={fontDurumu}
           style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
        {etiketVerileri.map(v => (
          <div key={v.anahtar} className="etiket-sarmal">{etiketCiz(v)}</div>
        ))}
      </div>
      {engel && bildirim("rgba(60,16,16,.96)", "rgba(255,80,80,.45)", <>⚠ {engel}</>)}
      {/* Başarı bildirimi YOK: iş bitince pencere zaten kapanıyor, bildirimi
          gösterecek kimse kalmıyor. Ayakta kalan tek durum hata/iptal. */}
      {yazdiriliyor && !engel && bildirim("rgba(17,20,28,.94)", "rgba(255,255,255,.14)",
        etiketVerileri.length > 1
          ? `${etiketVerileri.length} etiket hazır — yazıcı penceresi açılıyor...`
          : "Yazıcı penceresi açılıyor...")}
    </>,
    document.body
  );

  if (otomatik) return baskiKopyasi;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4">
      {baskiKopyasi}

      <div className="bg-white dark:bg-[#12141c] w-full max-w-[620px] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#181a24] shrink-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Tag size={18} className="text-blue-500" /> {soruMetni || sablon.name || "Etiket"}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              {etiketVerileri.length} etiket · {olcu.widthMm} × {olcu.heightMm} mm
            </span>
            <button onClick={onKapat} className="p-1 rounded-md text-slate-400 hover:bg-black/5 dark:hover:bg-white/5">
              <X size={18} />
            </button>
          </div>
        </div>

        {tur === "teslim" && (
          <div className="px-5 pt-5 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {/* Açıklama BURADA YAZILMAZ: testte girilen zorunlu açıklama neyse etikete
                o basılır. Aynı metnin iki kez yazılması, ikisinin farklı olması ve
                etikette testtekinden başka bir şey görünmesi böylece imkânsız. */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Açıklama / Durum <span className="font-normal text-slate-400">· testte girilen</span>
              </label>
              <div className="w-full bg-slate-100 dark:bg-[#0f111a] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm min-h-[38px] flex items-center">
                {form.aciklama
                  ? <span className="text-slate-800 dark:text-slate-200 break-words">{form.aciklama}</span>
                  : <span className="text-slate-400 italic">Testte açıklama girilmedi</span>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Lokasyon</label>
              <input type="text" autoFocus value={form.lokasyon}
                onChange={(e) => setForm(f => ({ ...f, lokasyon: e.target.value }))}
                placeholder="ör. İST11"
                className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Referans Kodu</label>
              <input type="text" value={form.referans}
                onChange={(e) => setForm(f => ({ ...f, referans: e.target.value }))}
                placeholder="ör. 016-GR03-REF-O"
                className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <p className="sm:col-span-2 text-[11px] text-slate-400 leading-snug">
              Tasarımı değiştirmek için <strong>Kullanıcı &amp; Ayarlar → Etiket Tasarımı</strong>.
            </p>
          </div>
        )}

        {/* Önizleme zemini koyu temada da beyaz ve etiketlere kenarlık çizilmez:
            ekranda görünen, kâğıda basılanla birebir aynı olsun. Kenarlık yalnızca
            önizlemedeydi ama "etiketin çevresinde çerçeve var" izlenimi veriyordu. */}
        <div className="p-5 bg-white overflow-y-auto">
          <div className="flex flex-col items-center gap-3">
            {etiketVerileri.map(etiketCiz)}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#181a24] flex justify-between items-center gap-3 shrink-0">
          <p className="text-[11px] leading-snug">
            {engel ? <span className="text-red-500 font-semibold">{engel}</span>
              : barkodDegeri ? (
                <span className="text-slate-400">
                  <strong>Yazıcı seçim penceresi</strong> açılır · kağıt {olcu.widthMm} × {olcu.heightMm} mm
                </span>
              ) : (
                <span className="text-amber-500 font-semibold">
                  Bu cihazın IMEI / seri numarası yok, barkod üretilemiyor.
                </span>
              )}
          </p>
          <div className="flex gap-3 shrink-0">
            <button onClick={onKapat} disabled={mesgul}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {soruMetni ? "Hayır" : "Kapat"}
            </button>
            <button onClick={yazdirVeKapat} disabled={!barkodDegeri || mesgul}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2">
              <Printer size={16} /> {mesgul ? "Yazdırılıyor..." : (soruMetni ? "Evet, Yazdır" : "Yazdır")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
