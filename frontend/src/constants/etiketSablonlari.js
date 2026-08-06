import JsBarcode from "jsbarcode";

// ─── ETİKET ŞABLON MOTORU ────────────────────────────────────────────
// Etiket tasarımı HTML olarak tutulur ve içindeki {{alan}} yer tutucuları basım
// anında gerçek değerlerle değiştirilir. Şablonlar veritabanında saklanır
// (warehouse.label_templates); kayıt yoksa buradaki VARSAYILAN kullanılır.
//
// Neden HTML: kullanıcı tasarımı kendisi değiştirebilsin ve hazır bir şablonu
// dosyadan yükleyebilsin diye. Sürükle-bırak bir tasarımcı yerine HTML seçildi;
// tek dosyada taşınabiliyor, sürüm farkı gözle görülüyor ve baskı motoru zaten
// tarayıcı olduğu için birebir aynı sonucu veriyor.

export const ETIKET_TURLERI = [
  { key: "parca", ad: "Parça Etiketi", nerede: "Demontaj → Üretime Aktar (her parça için bir adet)" },
  { key: "teslim", ad: "Üretime Teslim Etiketi", nerede: "Üretime teslim edilecek (103>104)" },
  { key: "cihaz", ad: "Cihaz Etiketi", nerede: "Son Test Sonuç — test başarılı olduğunda" },
];

// Şablonlarda kullanılabilecek alanlar. Tasarım ekranında liste olarak gösterilir.
export const YER_TUTUCULAR = [
  ["{{barkod}}", "Barkod (IMEI), IDAHC39M yazı tipiyle. Çubuk yüksekliği px: {{barkod:64}}"],
  ["{{barkod2}}", "İkinci barkod (Internal ID). {{barkod2:34}}"],
  ["{{imei}}", "IMEI / seri numarası"],
  ["{{internalId}}", "Internal ID"],
  ["{{marka}}", "Marka"],
  ["{{model}}", "Model"],
  ["{{hafiza}}", "Hafıza (GB)"],
  ["{{renk}}", "Renk"],
  ["{{urun}}", "Model + hafıza + renk"],
  ["{{parti}}", "Parti / batch numarası"],
  ["{{akis}}", "Akış durumu (Flow)"],
  ["{{parca}}", "Parça adı — yalnızca parça etiketinde"],
  ["{{aciklama}}", "Formdaki açıklama — yalnızca üretime teslim"],
  ["{{lokasyon}}", "Formdaki lokasyon — yalnızca üretime teslim"],
  ["{{referans}}", "Formdaki referans kodu — yalnızca üretime teslim"],
  ["{{tarih}}", "Basım tarihi ve saati"],
  ["{{kullanici}}", "Basan kullanıcı"],
];

// ── VARSAYILAN ŞABLONLAR ──
// Etiketin dış kutusu basım tarafında verilir; şablon yalnızca İÇERİĞİ tanımlar.
const VARSAYILAN_PARCA = `<div style="width:100%;height:100%;box-sizing:border-box;padding:0.7mm 2mm;
     display:flex;flex-direction:column;align-items:center;justify-content:center;
     font-family:Arial,Helvetica,sans-serif;color:#000">
  {{barkod:21:1.15}}
  <div style="font-size:5.2px;line-height:1.15;margin-top:0.3mm;white-space:nowrap">
    {{parti}}-{{imei}} {{model}}
  </div>
  <div style="font-size:7.5px;font-weight:700;line-height:1.15;margin-top:0.2mm;white-space:nowrap">
    {{parca}}
  </div>
</div>`;

const VARSAYILAN_TESLIM = `<div style="width:100%;height:100%;box-sizing:border-box;padding:3mm 4mm;
     display:flex;flex-direction:column;align-items:center;justify-content:space-between;
     font-family:Arial,Helvetica,sans-serif;color:#000">
  <!-- IMEI ayrıca yazılmaz: IDAHC39M yazı tipi okunur metni çubukların altına
       kendisi basıyor, iki kere görünüyordu. -->
  <div style="width:100%;text-align:center">
    {{barkod:64:1.5}}
  </div>
  <div style="width:100%;font-size:13px;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden">
    {{aciklama}}
  </div>
  <div style="width:100%;display:flex;gap:4mm;align-items:flex-end">
    <div style="flex:0 0 40%;font-size:13px;font-weight:700">{{lokasyon}}</div>
    <div style="flex:1;font-size:13px;font-weight:700;text-align:right">{{referans}}</div>
  </div>
</div>`;

const VARSAYILAN_CIHAZ = `<div style="width:100%;height:100%;box-sizing:border-box;padding:3mm 4mm;
     display:flex;flex-direction:column;justify-content:space-between;
     font-family:Arial,Helvetica,sans-serif;color:#000">
  <div>
    <div style="font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden">
      <strong>Brand:</strong> {{marka}}
    </div>
    <div style="font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden">
      <strong>Model:</strong> {{urun}}
    </div>
  </div>
  <!-- Okunur metinler yazı tipinden geliyor, ayrıca yazılmıyor. -->
  <div style="text-align:center">
    {{barkod:62:1.5}}
  </div>
  <div style="text-align:center">
    {{barkod2:34:1.5}}
  </div>
</div>`;

// widthMm / heightMm = YAZICIYA GİDEN MEDYA ölçüsü (rulodaki etiketin fiziksel
// ölçüsü). DYMO 99014 = 54 x 101 mm dikey.
// rotate = tasarım 90° döndürülerek basılsın mı. Dikey bir etikete geniş bir tasarım
// (barkodun uzun kenar boyunca uzanması) ancak böyle sığar; Code 39 + 15 hane
// yalnızca 46 mm'ye sıkıştırılırsa çubuklar okunamayacak kadar incelir.
export const VARSAYILAN_SABLONLAR = {
  parca: { key: "parca", name: "Parça Etiketi", widthMm: 54, heightMm: 101, rotate: true, html: VARSAYILAN_PARCA },
  teslim: { key: "teslim", name: "Üretime Teslim Etiketi", widthMm: 54, heightMm: 101, rotate: true, html: VARSAYILAN_TESLIM },
  cihaz: { key: "cihaz", name: "Cihaz Etiketi", widthMm: 54, heightMm: 101, rotate: true, html: VARSAYILAN_CIHAZ },
};

// Tasarım alanının ölçüsü: döndürülüyorsa medyanın kenarları yer değiştirir.
export const tasarimOlcusu = (s) => (s && s.rotate)
  ? { en: s.heightMm, boy: s.widthMm }
  : { en: s.widthMm, boy: s.heightMm };

// ── BARKOD ÇİZİMİ ──
// Code 39, **IDAHC39M Code 39 Barcode** (IDAutomationHC39M) yazı tipiyle çizilir;
// yazı tipi tanımı index.css'te, dosyası public/fonts/ içinde.
//
// Yazı tipi yüklenemezse (silinmiş, engellenmiş, eski önbellek) barkod SESSİZCE
// DÜZ METİN olarak basılır ve okunmaz - sahada en tehlikeli hata bu. Bu yüzden
// yazı tipi basımdan önce yüklenip DOĞRULANIR (barkodFontunuYukle) ve yoksa
// otomatik olarak JsBarcode SVG çizimine düşülür. Etiket her hâlükârda okunur.

export const BARKOD_FONTU = "IDAHC39M Code 39 Barcode";

// Yazı tipinin gerçek metrikleri (fontTools ile ölçüldü, unitsPerEm = 1000):
//   çubuklar taban çizgisinin 3063 birim ÜSTÜNE çıkar,
//   okunur metin 539 birim ALTINA iner  -> doğal satır yüksekliği 3602 birim,
//   her karakter 971 birim geniştir.
// Şablondaki {{barkod:YÜKSEKLİK}} değeri eskiden JsBarcode'un çubuk yüksekliğiydi;
// aynı anlamı korumak için punto = YÜKSEKLİK / 3.063 seçilir, böylece çubuklar
// istenen piksel yüksekliğinde çıkar ve mevcut şablonlar bozulmaz.
const CUBUK_ORANI = 3.063;      // çubuk yüksekliği / punto
const SATIR_ORANI = 3.602;      // doğal satır yüksekliği / punto
const KARAKTER_ORANI = 0.971;   // karakter genişliği / punto

// Code 39 alfabesi. Kapsam dışı karakter kodlanamaz; okunmayan bir barkod basmaktansa
// temizlenir (küçük harfler büyütülür, kalanlar atılır).
const CODE39_GECERLI = /[^0-9A-Z\-. $/+%]/g;
const code39Temizle = (deger) =>
  String(deger == null ? "" : deger).trim().toUpperCase().replace(CODE39_GECERLI, "");

// Yazı tipi kullanılabilir mi. Basımdan ve önizlemeden önce barkodFontunuYukle ile
// belirlenir; senkron olan sablonuDoldur bunu okur.
let fontKullanilabilir = false;
export const barkodFontuHazirMi = () => fontKullanilabilir;

/**
 * Barkod yazı tipini yükler ve gerçekten kullanılabilir olduğunu doğrular.
 * Basımdan ÖNCE beklenmelidir: Chromium yazı tipini ilk kullanımda yüklüyor ve
 * window.print() daha erken çalışırsa barkod düz metin olarak kâğıda gidiyor.
 * @returns {Promise<boolean>} yazı tipi kullanılabiliyorsa true
 */
export async function barkodFontunuYukle() {
  try {
    if (!document.fonts) return (fontKullanilabilir = false);
    // Başlangıç/bitiş karakterleri de örnek metne konur ki Chromium onların
    // gliflerini de basımdan önce yüklesin (bkz. barkodCiz - parantez kullanılıyor).
    await document.fonts.load(`16px "${BARKOD_FONTU}"`, "()*0123456789ABC");
    fontKullanilabilir = document.fonts.check(`16px "${BARKOD_FONTU}"`);
  } catch (_e) {
    fontKullanilabilir = false;
  }
  return fontKullanilabilir;
}

// Yazı tipi bulunamadığında kullanılan geri düşüş. Görüntü olarak farklıdır
// (okunur metin yoktur) ama okunur bir Code 39 barkodudur.
function barkodSvg(deger, yukseklik, kalinlik) {
  const v = code39Temizle(deger);
  if (!v) return '<div style="font-size:7px">Barkod değeri yok</div>';
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, v, {
      format: "CODE39",
      width: Number(kalinlik) || 1.5,
      height: Number(yukseklik) || 60,
      displayValue: false,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    });
    svg.style.display = "block";
    svg.style.margin = "0 auto";
    return svg.outerHTML;
  } catch (e) {
    return `<div style="font-size:7px;color:#000">Barkod üretilemedi: ${v}</div>`;
  }
}

function barkodCiz(deger, yukseklik, kalinlik) {
  if (!fontKullanilabilir) return barkodSvg(deger, yukseklik, kalinlik);

  const v = code39Temizle(deger);
  if (!v) return '<div style="font-size:7px">Barkod değeri yok</div>';

  const punto = (Number(yukseklik) || 60) / CUBUK_ORANI;
  const genislik = (v.length + 2) * KARAKTER_ORANI * punto;   // (DEĞER) -> +2 karakter
  // Code 39 BAŞLANGIÇ/BİTİŞ karakteri. Değer bu karakterlerin arasına alınmazsa
  // okuyucu barkodu hiç görmez.
  //
  // Yıldız yerine PARANTEZ kullanılıyor: IDAHC39M yazı tipinde "(" ve ")" glifleri
  // yıldızla BİREBİR AYNI çubuk desenini taşır (aynı kontur x kenarları: 2, 58, 245,
  // 301, 366, 544, 609, 786, 852, 908 - fontTools ile doğrulandı), tek farkı taban
  // çizgisinin altında okunur karakter ÇİZMEMELERİ. Yani barkod aynı şekilde okunur,
  // etikette artık "*" görünmez. Okuyucu yine ham değeri döner - parantez de yıldız
  // gibi yalnızca çerçevedir, veriye karışmaz.
  return `<div style="font-family:'${BARKOD_FONTU}';font-size:${punto.toFixed(2)}px;`
       + `line-height:${SATIR_ORANI};height:${(punto * SATIR_ORANI).toFixed(2)}px;`
       + `width:${genislik.toFixed(2)}px;max-width:100%;margin:0 auto;`
       + `white-space:nowrap;text-align:center;color:#000;font-weight:400;`
       + `letter-spacing:0">(${v})</div>`;
}

const kacisla = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Şablondaki {{alan}} yer tutucularını gerçek değerlerle doldurur.
 * @param {string} html   şablon
 * @param {object} veri   { imei, internalId, marka, model, ... }
 * @returns {string} basıma hazır HTML
 */
export function sablonuDoldur(html, veri) {
  const d = veri || {};
  let cikti = String(html || "");

  // Önce barkodlar: {{barkod}} / {{barkod:yukseklik}} / {{barkod:yukseklik:kalinlik}}
  // "kalinlik" yalnızca SVG geri düşüşünde kullanılır: yazı tipiyle çizimde çubuk
  // kalınlığı puntoya bağlıdır, ayrı verilemez. Eski şablonlar bozulmasın diye
  // parametre kabul edilmeye devam ediyor.
  cikti = cikti.replace(/\{\{barkod2(?::(\d+(?:\.\d+)?))?(?::(\d+(?:\.\d+)?))?\}\}/g,
    (_m, y, k) => barkodCiz(d.internalId, y || 34, k || 1.5));
  cikti = cikti.replace(/\{\{barkod(?::(\d+(?:\.\d+)?))?(?::(\d+(?:\.\d+)?))?\}\}/g,
    (_m, y, k) => barkodCiz(d.imei, y || 60, k || 1.5));

  // Sonra metin alanları. HTML kaçışı yapılır ki şablona giren veri tasarımı bozmasın.
  const alanlar = {
    imei: d.imei, internalId: d.internalId, marka: d.marka, model: d.model,
    hafiza: d.hafiza, renk: d.renk, urun: d.urun, parti: d.parti, akis: d.akis,
    parca: d.parca, aciklama: d.aciklama, lokasyon: d.lokasyon, referans: d.referans,
    tarih: d.tarih, kullanici: d.kullanici,
  };
  for (const [ad, deger] of Object.entries(alanlar)) {
    cikti = cikti.replace(new RegExp(`\\{\\{${ad}\\}\\}`, "g"), kacisla(deger));
  }
  // Tanımsız kalan yer tutucular etikete basılmasın.
  cikti = cikti.replace(/\{\{[^}]*\}\}/g, "");
  return cikti;
}
