// PARÇA ÇAKIŞMA KURALLARI — hangi ikilinin aynı cihazda BİRLİKTE olamayacağı.
//
// LCD komple ekran modülüdür; ön cam, ön çerçeve, arka aydınlatma ve dokunmatik cam zaten
// onun içinde gelir. Batarya flexinden de cihaza yalnızca bir tane girilir. Çakışan iki
// parça birlikte girilirse aynı iş iki kez ücretlendirilir ve depodan gereksiz parça
// çıkar. Kural cihaz genelindedir (onarım grubundan bağımsız).
//
// Buradaki sınıflandırma ve çakışma listesi, backend'deki WebBridge._parca_kisit_sinifi /
// PARCA_CAKISMA_CIFTLERI ile BİREBİR aynı olmalı. Asıl engel backend'dedir
// (add_repair_record); bu dosya yalnızca kullanıcı daha listeden seçerken görsün diye
// vardır — biri değişirse diğeri de değişmeli.
//
// Kategoriler serbest metin olduğu için önce bir SINIFA indirgenir:
//   LCD              -> "LCD", "LCD with Frame", "LCD ORIGINAL", "LCD without panel"
//   FRONT_GLASS      -> "Front Glass", "Front Glass + OCA"
//   FRONT_GLASS_POL  -> "Front Glass with POL"   (kendi sınıfı: Touch Glass ile de çakışır)
//   FRONT_BEZEL      -> "Front Bezel"
//   BACKLIGHT        -> "Backlight"
//   TOUCH_GLASS      -> "Touch Glass", "iPAD Touch Glass"
//   BATTERY_FLEX     -> "Battery Flex", "Cracked Battery Flex", "Diag-Battery Flex",
//                       "Ti-Battery Flex"
//   MAIN_CAMERA      -> "Main Camera" (komple arka kamera modülü)
//   MAIN_CAMERA_LENS -> büyütme oranı yazan tekil objektifler: "5x Main Camera",
//                       "Main Camera_R_5x", "Main Camera_R_1x", "Main Camera_R_0,5x"
//   BACK_COVER       -> "Back Cover"
//   BACK_GLASS       -> "Back Glass"
//   MIDDLE_FRAME     -> "Middle Frame"
//   FRONT_CAMERA     -> "Front Camera"      (üçü de tam ad eşleşmesiyle ayrılır;
//   FRONT_CAMERA_Y   -> "Front Camera_Y"     "Front Camera Repair/Tag-On Flex"
//   FRONT_CAMERA_R   -> "Front Camera_R"     bunlara girmez)
//   KOMBO_FLEX       -> On-Off / Volume Key / Receiver / Flash / NFC flexleri ve bunların
//                       "+" ile birleştirilmiş paketleri. Hepsi aynı fiziksel takımın
//                       farklı satış kombinasyonu olduğu için cihaza yalnızca BİR tanesi
//                       girilir (ör. "Volume Key FPC + On-Off FPC" alındıysa ayrıca
//                       "On-Off FPC" alınmaz).
// "LCD CONNECTOR" bir bağlantı soketidir (L3 lehim işi), ekran modülü değil — dışarıda
// bırakılır. "Back Glass" arka kapaktır, "Front Glass" ön ekiyle karışmaz.
// "Battery" ve "Battery Connector" batarya flexi DEĞİLDİR, sınıfa girmez.
// "Main Camera Glass" objektif camıdır, kamera modülü değil — sınıfa girmez.
// "LCD with Frame" ekrandır, "Middle Frame" ile karışmaz (ön ek eşleşmesi).

// Yalnızca burada YAZAN ikililer engellenir; yazmayanlar birlikte girilebilir
// (ör. Front Glass + Front Bezel serbesttir). Kural simetriktir: çift hangi sırayla
// yazılırsa yazılsın iki yönde de geçerlidir. Bir sınıfın KENDİSİYLE eşleşmesi
// "bu sınıftan yalnızca bir tane girilebilir" demektir.
const CAKISMA_CIFTLERI = [
  ["LCD", "FRONT_GLASS"],
  ["LCD", "FRONT_GLASS_POL"],
  ["LCD", "FRONT_BEZEL"],
  ["LCD", "BACKLIGHT"],
  ["LCD", "TOUCH_GLASS"],
  ["TOUCH_GLASS", "FRONT_GLASS_POL"],
  ["BATTERY_FLEX", "BATTERY_FLEX"],   // cihaza yalnızca bir batarya flexi girilebilir
  ["MAIN_CAMERA", "MAIN_CAMERA_LENS"],
  ["BACK_COVER", "MIDDLE_FRAME"],
  ["BACK_COVER", "BACK_GLASS"],
  ["FRONT_CAMERA", "FRONT_CAMERA_R"],
  ["FRONT_CAMERA_Y", "FRONT_CAMERA_R"],
  ["FRONT_GLASS", "FRONT_GLASS_POL"],
  ["KOMBO_FLEX", "KOMBO_FLEX"],       // bu gruptan cihaza yalnızca bir tane girilebilir
];

// KOMBO_FLEX kategorileri "+" ile birleşik yazılır ("Volume Key FPC + On-Off FPC").
// Kategori, "+" ile parçalanıp her parçası tanınıyorsa VE en az bir ÇEKİRDEK parça
// içeriyorsa gruba girer. Böylece yeni model kombinasyonları (ör. "Volume Key FPC +
// Flash FPC") listeye elle eklenmeden kendiliğinden kapsanır.
// ÇEKİRDEK: kuralın konusu olan parçalar. YARDIMCI: yalnız başına gruba sokmayan, ama bir
// çekirdeğin yanında paketlenebilen parçalar — "Wifi Antenna" tek başına bu kuralla
// ilgisizdir, "Receiver + Wifi Antenna" ise Receiver yüzünden dahildir.
// "NFC IC200VB111", "NFC-F60V2" gibi ÇİP kodları tanınmadığı için gruba GİRMEZ; onlar
// L3 lehim kalemidir, flex değil.
const KOMBO_FLEX_CEKIRDEK = new Set([
  "ON-OFF FPC", "VOLUME KEY FPC", "RECEIVER",
  "FLASH FPC", "FLASH FLEX", "NFC", "NFC FLEX", "NFC ANTENNA",
]);
const KOMBO_FLEX_YARDIMCI = new Set(["WIFI ANTENNA"]);

function komboFlexMi(kat) {
  const parcalar = kat.split("+").map(p => p.trim());
  if (!parcalar.every(p => KOMBO_FLEX_CEKIRDEK.has(p) || KOMBO_FLEX_YARDIMCI.has(p))) return false;
  return parcalar.some(p => KOMBO_FLEX_CEKIRDEK.has(p));
}

// Tam ad eşleşmesi: "Front Camera Repair Flex" / "Front Camera Tag-On Flex" ayrı
// parçalardır, bu kurala girmemeli.
const FRONT_CAMERA_SINIFLARI = {
  "FRONT CAMERA": "FRONT_CAMERA",
  "FRONT CAMERA_Y": "FRONT_CAMERA_Y",
  "FRONT CAMERA_R": "FRONT_CAMERA_R",
};

// Büyütme oranı işareti: "5x", "1x", "0,5x", "0.5x". Sayı+X'in kendi başına bir parça
// olması gerekir; "MAX", "XR" gibi model adlarına takılmasın diye harflerle bitişik
// olanlar sayılmaz.
const BUYUTME_ORANI = /(^|[^A-Z0-9])\d+([.,]\d+)?X([^A-Z0-9]|$)/;

export function parcaKisitSinifi(itemCategory) {
  const kat = String(itemCategory || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!kat) return null;
  if (kat.startsWith("LCD") && !kat.includes("CONNECTOR")) return "LCD";
  // iPAD Touch Glass gibi ön eki farklı olanlar da sayılsın diye içerik araması.
  if (kat.includes("TOUCH GLASS")) return "TOUCH_GLASS";
  // "Cracked/Diag-/Ti-" ön ekleri de aynı sınıf: hepsi batarya flexi.
  if (kat.includes("BATTERY FLEX")) return "BATTERY_FLEX";
  // Objektif önce sorulur: "5x Main Camera" hem MAIN CAMERA içerir hem oran taşır.
  if (kat.includes("MAIN CAMERA") && BUYUTME_ORANI.test(kat)) return "MAIN_CAMERA_LENS";
  if (kat === "MAIN CAMERA") return "MAIN_CAMERA";
  if (kat.startsWith("BACK COVER")) return "BACK_COVER";
  if (kat.startsWith("BACK GLASS")) return "BACK_GLASS";
  if (kat.startsWith("MIDDLE FRAME")) return "MIDDLE_FRAME";
  if (FRONT_CAMERA_SINIFLARI[kat]) return FRONT_CAMERA_SINIFLARI[kat];
  if (komboFlexMi(kat)) return "KOMBO_FLEX";
  if (kat.startsWith("FRONT GLASS")) {
    return kat.split(" ").includes("POL") ? "FRONT_GLASS_POL" : "FRONT_GLASS";
  }
  if (kat.startsWith("FRONT BEZEL")) return "FRONT_BEZEL";
  if (kat.startsWith("BACKLIGHT") || kat.startsWith("BACK LIGHT")) return "BACKLIGHT";
  return null;
}

export function parcalarCakisiyorMu(a, b) {
  if (!a || !b) return false;
  return CAKISMA_CIFTLERI.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// Cihazda halihazırda duran (iptal edilmemiş) kategorilerden kurala giren sınıfları,
// okunur adıyla birlikte çıkarır.
export function mevcutParcaSiniflari(mevcutKategoriler = []) {
  const bulunan = [];
  for (const kategori of mevcutKategoriler) {
    const sinif = parcaKisitSinifi(kategori);
    if (sinif) bulunan.push({ sinif, kategori: String(kategori).trim() });
  }
  return bulunan;
}

// Bir parça satırı için engel metni ("" ise seçilebilir). PartSelectCombobox'a
// doğrudan engelSebebi olarak verilir.
export function parcaEngeli(part, mevcutlar) {
  if (!mevcutlar || mevcutlar.length === 0) return "";
  const sinif = parcaKisitSinifi(part?.item_category || part?.part_category);
  if (!sinif) return "";
  const carpisan = mevcutlar.find(m => parcalarCakisiyorMu(sinif, m.sinif));
  return carpisan ? `Bu cihazda '${carpisan.kategori}' var — birlikte girilemez` : "";
}
