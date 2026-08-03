# 🍎 macOS Web Uygulama Masaüstü Yöneticisi (Web App Wrapper for Mac)

İstediğiniz web sitelerini (ERP, CRM veya özel web uygulamaları) macOS cihazınızda tıpkı yerel bir masaüstü uygulaması gibi çalıştırmanızı sağlayan, **Skia GPU ivmelendirmeli** ve **dinamik logo algılamalı** modern bir masaüstü uygulamasıdır.

---

## ✨ Öne Çıkan Özellikler

- ⚙️ **Dahili Web Sitesi Yöneticisi & Ayarlar**:
  - Uygulama içerisinden dilediğiniz zaman yeni web siteleri (Adı & URL) ekleyin.
  - Mevcut siteleri düzenleyin veya silin.
  - **Varsayılan Site Seçimi**: Uygulama açıldığında hangi sitenin otomatik geleceğini belirleyin.
- 📌 **Hızlı Site Değiştirici**: Kayıtlı web siteleriniz arasında hızlıca geçiş yapın.
- 🖼️ **Dinamik Otomatik Logo Algılama**: Giriş yapılan web sitesinin logosunu/favicon'unu otomatik algılar, pencere ve macOS Dock ikonu yapar.
- 📁 **Özel Logo Desteği**: Klasöre kendi `logo.png` görselinizi koyarsanız öncelikli olarak o kullanılır.
- ⚡ **Donanım İvmelendirmesi (GPU)**: Chromium Skia Renderer ve GPU rasterization ile macOS üzerinde yüksek performans.
- 🚀 **Tek Dosya Mimarisi**: Tüm uygulama mantığı tek bir [main.py](file:///c:/Users/JOSEPH/Documents/erp_web_app/mac/main.py) dosyası içerisinde toplanmıştır.

---

## ⌨️ macOS Klavye Kısayolları

| Kısayol | İşlev |
| :--- | :--- |
| **`F11`** veya **`Ctrl + Cmd + F`** | Tam Ekran Moduna Geç / Çık |
| **`F5`** veya **`Cmd + R`** | Sayfayı Yenile |
| **`Cmd + Shift + S`** veya **`Ctrl + Shift + S`** | Web Sitesi Yöneticisi & Ayarlar Penceresini Aç |

---

## 📁 Proje Klasör Yapısı

```text
mac/
├── main.py            # macOS için ana masaüstü uygulaması & Ayarlar arayüzü
├── build_mac_app.sh   # Otomatik .app derleme ve paketleme scripti
├── sites.json         # Kayıtlı web siteleri ve varsayılan site yapılandırması
├── requirements.txt   # Gerekli bağımlılıklar (PyQt6 & PyQt6-WebEngine)
├── README.md          # macOS Kullanım ve paketleme dokümantasyonu
└── logo.png           # Uygulama ve macOS Dock ikonu
```

---

## 📦 1-Tıkla macOS `.app` Paketi Derleme (En Kolay Yöntem)

Mac bilgisayarınızda Terminal uygulamasını açıp şu komutları sırasıyla çalıştırmanız yeterlidir:

```bash
cd mac
chmod +x build_mac_app.sh
./build_mac_app.sh
```

Bu işlem bittiğinde `dist/` klasörü içinde **`ERPWebApp.app`** masaüstü uygulamanız hazır olacaktır (isimde boşluk kullanılmaz; boşluklu isim macOS'ta LaunchServices Error -10661'e yol açar). Uygulamayı doğrudan tıklayarak açabilir veya `/Applications` (Uygulamalar) klasörünüze taşıyabilirsiniz.

---

## 🚀 Doğrudan Kod Olarak Çalıştırma (Derlemeden)

### 1. Bağımlılıkları Yükleyin
```bash
pip3 install -r requirements.txt
```

### 2. Uygulamayı Başlatın
```bash
python3 main.py
```
