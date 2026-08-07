# RemaLab WMS — Çalışma Dökümantasyonu (6 Ağustos 2026)

Bu gün ağırlıklı olarak **veri doğrulama sağlamlaştırması**, kapsamlı bir **güvenlik/
sağlamlık denetimi** ve **Servis Cihaz Sorgulama ekranına Test Sonuç Özeti** özelliği
üzerinde çalışıldı.

**Kullanılan teknolojiler:** Python + PySide6 (QWebChannel/WebSocket köprüsü),
SQLAlchemy ORM, PostgreSQL, React + Vite + Tailwind CSS, PhoneCheck test API'si.

---

## 1. Müşteri Hedef Fiyat Matrisi — Negatif Fiyat Doğrulaması *(geliştirme)*

"Yeni Kural Ekle" ekranında hedef fiyat **negatif** girilebiliyor ve sistem hata
vermiyordu. Bu açık hem arayüz hem backend tarafında kapatıldı:

- **Frontend (`CustomerTargetPriceMatrix.jsx`):** Yeni Kural modalında negatif/geçersiz
  fiyatta input kırmızıya döner, "Hedef fiyat negatif olamaz." uyarısı çıkar ve **Kaydet**
  butonu pasifleşir. Satır içi düzenlemede de negatif/boş kayıt engellendi. Inputlara
  `min="0"` eklendi.
- **Backend (`web_bridge.py`):** `create_customer_target_price`, `update_customer_target_price`
  ve `bulk_import_customer_target_prices` (Excel içe aktarma) metotlarına `price < 0`
  kontrolü eklendi — arayüz atlansa bile veri korunuyor. Sıfır fiyat hâlâ geçerli.

---

## 2. Servis Cihaz Sorgulama — Test Sonuç Özeti *(asıl yenilik)*

Servis Cihaz Sorgulama ekranının **"Test" sekmesine**, mevcut tablolara dokunmadan üst
kısma bir **"Test Sonuç Özeti"** bölümü eklendi. IMEI sorgulandığında cihazın test
sonuçları test aşamasına göre kartlar hâlinde özetleniyor.

**Kartlar ve kaynakları:**
- **Giriş Testi Sonucu** — Cihazı üretime taşıyan İlk test (statü geçişi `103_104`)
  sonucu, PhoneCheck'ten çekilir. Başarılı/Başarısız her durumda gösterilir.
- **Ara Test** — `138_124` / `138_109` geçişleri.
- **Son Test** — `125_126` (başarılı) / `125_109` (başarısız).

**Özellikler:**
- **Başarılı / Başarısız / Bekliyor / Yapılmadı** renkli rozetleri.
- **Akış sırası numarası:** Kartlar cihazın gerçekten yaptığı testlere göre numaralanır
  (Giriş = 1, Ara yapıldıysa 2, Son = sıradaki). Böylece "kaçıncı test" akıştaki konumu
  gösterir (tekrar/deneme sayısı değil).
- **Başarısız test listesi:** Kalınan testler **Test 1, Test 2 … (10'a kadar)** diye
  listelenir.
  - Giriş testinde kaynak: PhoneCheck'in `Failed` alanı.
  - Son testte kaynak: **yapısal `test_result_faults` tablosu** (`hata1…hata10`,
    `hatali_parca1…10`) ve kaydın **açıklaması (`description`)** birlikte gösterilir.

**Dokunulan yerler:**
- `core/web_bridge.py` → yeni `get_test_summary_by_imei` slot'u + `_parse_failed_tests`
  ve `son_test_fault_detail` yardımcıları (yalnızca okur; hiçbir tabloyu/statüyü değiştirmez).
- `frontend/src/services/api.js` → `getTestSummaryByImei` sarmalayıcısı.
- `frontend/src/pages/Servis.jsx` → "Test Sonuç Özeti" kartları (`TestSummary`,
  `TestSummaryCard`).

---

## 3. Güvenlik ve Sağlamlık Denetimi *(analiz + bulgular)*

Uygulama, kötü/akış-dışı verilerle sistematik olarak test edildi. Tespit edilen açıklar
önem sırasına göre kayıt altına alındı. (Negatif fiyat dışındakiler bulgu/öneri
aşamasındadır; düzeltme planı çıkarıldı.)

### 3.1 SQL Enjeksiyonu
Genel "Veri Yönetimi" akışındaki 3 slot (`get_table_data`, `insert_table_data`,
`bulk_insert_table_data`) tablo adını ve JSON kolon anahtarlarını doğrudan SQL'e gömüyor.
`schema` allowlist'te olsa da `table_name` doğrulanmıyor → identifier kaçışıyla keyfi SQL
çalıştırılabiliyor. **Öneri:** tablo/kolon adlarını `information_schema` ile doğrula.

### 3.2 Kimlik Doğrulama / Yetkilendirme
- Backend'de per-bağlantı kimlik yok; WebSocket'e bağlanan herkes tüm slot'ları
  (kullanıcı silme, fiyat değiştirme, `DROP TABLE`) çağırabiliyor.
- `login` şifreyi doğru kontrol ediyor ama oturum/token üretmiyor ve `account_enabled`
  bakmıyor (pasif hesap giriş yapabiliyor).
- Tek yetki kontrolü (`drop_schema_table`) rolü istemcinin gönderdiği `username`'den
  okuyor → kolayca taklit edilebiliyor.

### 3.3 Girdi Doğrulama Açıkları
- **`add_outbound_entry` (kritik):** negatif miktar reddedilmiyor → stok sıfırdan
  yaratılıyor ("hayalet stok"). Daha önce düzeltilmiş `transfer_stock`'un kardeşi.
- `add_inbound_entry` negatif miktar/fiyat; BOM/malzeme talebi/üretim/parça alanlarında
  negatif değer kontrolleri eksik.

### 3.4 Statü Akışı Sapmaları
- **`admin_set_batch_entry_statu`:** statü haritasını (`validate_transition`) tamamen
  atlayıp cihazı herhangi bir statüye taşıyor (yetki kontrolü de yok).
- **`execute_transition`:** tanımlı olmayan `ServiceTestResultType`'ı kullandığı için
  test sonuçlu geçişlerde `NameError` veriyor (PhoneCheck otomatik ilerletme kırık).
- Normal ekran akışı ise çift doğrulamayla (mevcut statü eşleşmesi + geçiş haritası)
  korunuyor — buradan keyfi atlama yapılamıyor.

### 3.5 Teknisyen Atama / Onarım Havuzu
`assign_repair_to_technician` slot'unda:
- **İş gaspı:** filtre `NOT IN (1002,1003)` olduğu için zaten atanmış (1001) bir onarım
  başka teknisyene sessizce devredilebiliyor (docstring "engellenir" dese de engellemiyor).
- **Statü gerilemesi:** Bitiş testindeki (1006) cihaz kutuya okutulunca 1001'e geri düşüyor.
- Pasif kullanıcıya ve yanlış departman teknisyenine atama yapılabiliyor; `assigned_by`
  yanlış (teknisyenin kendisi) yazılıyor.
- **Öneri:** atanacak kaydı `= 1000` ile sınırla, teknisyende `account_enabled` ve
  departman/görev eşleşmesini doğrula, `assigned_by`'a gerçek işlemi yapanı yaz.

---

## 4. Test / Doğrulama
- `core/web_bridge.py` sözdizimi kontrolü (Python `ast`) — **başarılı**.
- Frontend üretim derlemesi (`npm run build`) — **hatasız**.
- Test Sonuç Özeti akışı: giriş/ara/son test kartları, akış-sıra numarası, başarısız test
  listesi ve açıklama uçtan uca doğrulandı.

## Öğrendiklerim
- Girdi doğrulamasının **hem arayüzde hem backend'de** yapılması gerektiği (istemciye
  asla güvenilmez); "neyi hariç tut" yerine "neyi dahil et" filtresinin daha güvenli olduğu.
- Bir durum makinesinde (statü akışı) haritayı atlayan yolların (idari/manuel slot'lar)
  nasıl sapma yarattığı.
- SQL'de identifier (tablo/kolon adı) enjeksiyonu ve parametreli sorgunun önemi.
- Yapısal veriyi (test_result_faults) serbest metin/nottan ayrıştırmak yerine doğrudan
  kolonlarından okumanın daha güvenilir olduğu.
- Kapsamlı bir kod tabanında, mevcut mimariye dokunmadan (tabloları/akışı bozmadan)
  salt-okunur bir özet katmanı eklemek.
