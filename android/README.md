# 📱 ERP Web App - Android Uygulaması (APK)

Bu klasör, Windows masaüstü uygulamasının (`windows/main.py`) **birebir aynısını** Android akıllı telefonlarda çalıştıracak şekilde tasarlanmış yerel (Native Kotlin) Android projesini içerir.

---

## ✨ Öne Çıkan Özellikler

- ⚙️ **Dahili Web Sitesi Yöneticisi & Ayarlar**:
  - Uygulama içerisinden dilediğiniz zaman yeni web siteleri (Adı & URL) ekleyin.
  - Mevcut siteleri düzenleyin veya silin.
  - **Varsayılan Site Seçimi**: Uygulama her açıldığında hangi sitenin otomatik yükleneceğini seçin.
- 📌 **Hızlı Site Değiştirici**: Üst barda bulunan açılır (Spinner) menüden kayıtlı web siteleriniz arasında tek tıkla geçiş yapın.
- 🔄 **Yenile & Ana Sayfa Butonları**: Sayfayı yenileyin veya varsayılan sitenize dönün.
- 📱 **Mobil Pull-to-Refresh**: Ekranı aşağı çekerek sayfayı anında yenileyin.
- 🌐 **Yerel Ağ ve Canlı URL Desteği**: `http://192.168.x.x:5173`, `http://10.0.2.2:5173` (emülatör) ve tüm `https://` sitelerini sorunsuz yükler (`usesCleartextTraffic` aktif).
- 📁 **JSON Veri Uyumluluğu**: Windows uygulamasındaki `sites.json` yapısı ile %100 aynı veri formatını kullanır.

---

## 🚀 APK Oluşturma ve Kurulum

### Yöntem 1: Otomatik Derleme Scripti (Önerilen)
1. `android/` klasöründeki **`build_apk.bat`** dosyasına çift tıklayın.
2. Derleme tamamlandığında `ERP_Web_App.apk` dosyası bu klasörde oluşturulacaktır.
3. `.apk` dosyasını telefonunuza transfer edip yükleyin.

### Yöntem 2: Android Studio İle Açıp Derleme
1. **Android Studio**'yu açın.
2. `Open` diyerek `c:\Users\JOSEPH\Documents\erp_web_app\android` klasörünü seçin.
3. Üst menüden **Build > Build Bundle(s) / APK(s) > Build APK(s)** seçeneğine tıklayın.
4. Çıkan APK'yi telefonunuza yükleyin.

---

## 💡 Yerel (Localhost) ERP Sunucusuna Bağlanma İpucu
Bilgisayarınızda (örneğin Vite / Node.js ile) çalışan bir ERP web sunucusunu Android telefonunuzdan açmak için:
1. Bilgisayarınız ve telefonunuz aynı Wi-Fi ağına bağlı olmalıdır.
2. Bilgisayarınızın yerel IP adresini öğrenin (örneğin `192.168.1.50`).
3. Uygulamanın **Ayarlar (⚙️)** bölümünden site URL'sini `http://192.168.1.50:5173` şeklinde kaydedin.
