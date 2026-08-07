# RemaLab WMS — Staj Defteri Notları (3–5 Ağustos 2026)

## Proje Hakkında
**RemaLab WMS**, cep telefonu servis/yenileme (refurbishment) sürecini uçtan uca
yöneten web tabanlı bir Depo ve Servis Yönetim Sistemidir. Cihazlar barkod/IMEI ile
takip edilir; arıza kabul → test → demontaj → departman onarımı → son test → sevkiyat
akışından geçer.

**Kullanılan teknolojiler:**
- **Backend:** Python, PySide6 (masaüstü + headless sunucu), QWebChannel & WebSocket
  (arayüz-backend köprüsü), SQLAlchemy ORM
- **Veritabanı:** PostgreSQL
- **Frontend:** React, Vite, Tailwind CSS, React Router
- **Entegrasyon:** PhoneCheck test API'si, barkod/etiket yazdırma

---

## 1. Gün — 3 Ağustos 2026

Bugün ağırlıklı olarak **onarım iş akışı** ekranları geliştirildi.

- **Departman Bazlı Onarım Havuzu ekranı** oluşturuldu. Her departman (Batarya, Kamera,
  Ekran, Kasa, L1/L2/L3) için ayrı havuz; departmandaki tüm onarım kayıtları giriş
  tarihine göre listelenir.
- **Teknisyen canlı atama paneli** eklendi: her teknisyenin kendi barkod okutma kutusu
  var; IMEI okutulunca cihaz o teknisyene anında atanıyor. Teknisyenler üzerlerindeki
  açık iş sayısına göre sıralanıyor.
- **Hızlı Onarım Bitir sayfası** yapıldı: cihaz okutulunca, o görev grubundaki uygun
  onarımlar tek seferde tamamlanıyor.
- **PhoneCheck entegrasyonu** genişletildi: canlı batarya verileri (Battery Cycle,
  Battery Health) çekilip gösterildi; Müşteri Arıza Tespiti ve notlar
  `phonecheck_test_results` tablosundan otomatik alınıyor.
- **DGD modülü** ve **Müşteri Fiyat Matrisi** için arayüz ve backend güncellemeleri.
- Statik web sunucusunda cache-control ve demontaj menüsü düzenlemeleri.

**Öğrendiklerim:** Barkod okutma tabanlı iş akışı tasarımı; bir React ekranının
QWebChannel üzerinden Python backend metotlarını asenkron çağırması; onarım kayıtlarının
departman/görev grubu mantığı.

---

## 2. Gün — 4 Ağustos 2026

Mevcut ekranların **sadeleştirilmesi, entegrasyonu ve kararlılık** düzeltmeleri.

- **Parça Teslim ekranı** baştan sadeleştirildi: teslim edilebilir ve teslim edilmiş
  parçalar tek birleşik listede toplandı; "Teslim Edildi" durumu satır içinde gösteriliyor.
- **Parçayı Geri Al** özelliği eklendi: teslim edilen parça, Good Stock veya DOA Stock
  seçilerek depoya geri alınabiliyor (UUID → int dönüşüm hatası da giderildi).
- **Onarım Havuzu ↔ Teknisyen Paneli çift yönlü entegrasyonu** ve renkli **statü
  rozetleri** eklendi (Atanacak / Atandı / Tamamlandı / İptal).
- **Etiket Tasarımı ve barkod yazdırma** entegrasyonu geliştirildi.
- **Servis statü geçmişi** artık tüm statüleri eksiksiz gösteriyor.
- **Son Test Sonuç** ekranı: test verileri PhoneCheck yerine kendi ekranımızda gösteriliyor.
- **Sunucu kararlılığı:** QWebChannel yükleme/tarayıcı bağlantısı takılması düzeltildi;
  5174 portunu tutan eski "zombie" Python süreçlerini otomatik temizleme; `update.bat`
  iyileştirmeleri; eksik veritabanı indeksleri ve cache hatası düzeltmeleri; veritabanı
  durum kontrolü eklendi.

**Öğrendiklerim:** Kullanıcı arayüzünde "tek liste + satır içi aksiyon" yaklaşımının
karmaşık iki-panelli tasarımlara üstünlüğü; stok hareketlerinde Good/DOA ayrımı; sunucu
tarafı süreç yönetimi ve port çakışması sorunlarının çözümü.

---

## 3. Gün — 5 Ağustos 2026

**Onarım Bitiş Testi** akışının tasarlanıp eklenmesi ve statü akışı düzeltmeleri.

- **Müşteri Hedef Fiyat Matrisi** modülü ve batch girişinde model seçim kutusu güncellemeleri.
- **Havuz–Üretim teknisyen atama bağlantısı** ve tüm tarihlerin Türkiye saatine (UTC+3)
  çevrilmesi; statü geçmişinin saniye hassasiyetinde en yeniden en eskiye sıralanması.

### Onarım Bitiş Testi (asıl yenilik)
Kamera, L3, Ekran ve Kasa departmanları için **onarım bitiş testi** akışı sıfırdan tasarlandı:

- Teknisyen bu 4 departmanda onarımı bitirdiğinde kayıt doğrudan "Tamamlandı" olmuyor;
  önce **"Onarım Bitiş Testine Aktarıldı" (statü 1006)** durumuna geçiyor.
- Yeni **Onarım Bitiş Testi ekranı** yapıldı (departman bazlı, menüde ayrı grup). Testçi
  her kayıt için karar veriyor:
  - **Başarılı → Onarım Tamamlandı (1002)**
  - **Başarısız → Teknisyene Atandı (1001)** — kayıt teknisyene geri döner; bu durumda
    **açıklama (arıza nedeni) girmek zorunludur.**
- Onarım Havuzu'nda 1006 durumu için özel "Bitiş Testinde" rozeti eklendi.

### Müşteri Onayı Engeli Düzeltmeleri
Onarım tamamlama kuralında iki hata tespit edilip düzeltildi:
- **"Battery only" (batarya değişimi)** akışı yanlışlıkla müşteri onayı gerektiriyor
  sayılıyordu; oysa bu akış onay adımından geçmez. Onaysız akışlar listesine eklendi.
- **"To repair"** akışında, cihaz müşteri onayından geçmiş (statü 109) olsa bile engel
  çıkıyordu. Kural **statü-farkında** yapıldı: engel yalnızca cihaz gerçekten onay
  beklerken (statü 106/107/136) çıkıyor; onay verilip cihaz üretime (109) geçtiğinde
  kalkıyor.

### Test / Doğrulama
Değişiklikler, gerçek backend metotları çağrılarak uçtan uca test edildi (geçici kayıtlar
oluşturulup akıştan geçirildikten sonra silindi):
- Ana statü akışı: **14/14 kontrol başarılı**
- Onay engeli mantığı (battery only / to repair, 106/107/136 vs 109): **4/4 başarılı**

**Öğrendiklerim:** Bir iş kuralı (state machine) tasarlarken durum kodlarının ve
geçişlerinin önemi; "onaydan geçti mi" bilgisinin akış alanı yerine cihazın güncel
statüsünden okunmasının doğru yaklaşım olması; canlı veritabanına dokunmadan güvenli
(oluştur–test et–sil) test yazma yöntemi.

---

## Özet Kazanımlar
- Gerçek bir kurumsal yazılımda uçtan uca özellik geliştirme (arayüz + backend + veritabanı)
- Durum makinesi (statü akışı) mantığı ve iş kurallarının kodlanması
- React + Python (QWebChannel/WebSocket) mimarisinde çalışma
- PostgreSQL üzerinde sorgulama, veri analizi ve güvenli test
- Kod okunabilirliği, mevcut mimariye uyum ve hata ayıklama pratiği
