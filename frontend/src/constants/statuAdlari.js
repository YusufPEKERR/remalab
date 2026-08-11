// Cihaz servis statülerinin Türkçe adları.
//
// Kaynak tablo warehouse.service_statu'nun short_name alanı İNGİLİZCE tutuluyor
// ("Production in Progress", "Awaiting intermediate testing" ...). O alan müşteri
// entegrasyonlarında ve dış sistemlerle eşleşmede kullanıldığı için olduğu gibi
// bırakılıyor; ekranlarda gösterilecek metin buradan çözülür.
//
// Kod tabloda yoksa ya da burada karşılığı yoksa istatuAdi() gelen İngilizce adı
// olduğu gibi döndürür - ekranda boş/"undefined" görünmesindense kaynaktaki ad
// görünsün.
export const STATU_ADLARI = {
  100: "Ön Bildirim Yapıldı",
  101: "Depo Girişi Tamamlandı",
  102: "İlk Teste Aktarıldı",
  103: "İlk Test Bekleniyor",
  104: "İlk Test Tamamlandı",
  105: "Üretim Planlaması Bekleniyor",
  106: "Müşteri Onayına Gönderilecek",
  107: "Müşteri Onayı Bekleniyor",
  109: "Üretim Aşamasında",
  124: "Son Teste Teslim Edilecek",
  125: "Son Teste Kabul Edildi",
  126: "Depoya Sevk Edilecek",
  127: "Müşteriye Sevk Bekleniyor",
  128: "Serbest Bırakıldı",
  133: "Montaj Tamamlandı",
  134: "RMA İncelemesi",
  135: "İade Öncesi Son Teste Gönderildi",
  136: "Müşteri Onay/Red Geldi",
  138: "Ara Test Bekleniyor",
};

/**
 * Statü kodunun ekranda gösterilecek Türkçe adı.
 * @param {number|string} kod  statü kodu
 * @param {string} [ingilizceAd] service_statu.short_name - karşılık yoksa yedek
 */
export function statuAdi(kod, ingilizceAd) {
  const n = Number(kod);
  return STATU_ADLARI[n] || ingilizceAd || (Number.isFinite(n) ? String(n) : "");
}
