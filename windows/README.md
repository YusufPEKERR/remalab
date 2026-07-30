# 🌐 Web Sitesi Masaüstü Uygulaması (Web App Wrapper)

İstediğiniz web sitelerini tıpkı bir masaüstü uygulaması gibi çalıştırmanızı sağlayan, **en son donanım ivmelendirmesi (GPU)** ve **dinamik logo algılama** teknolojilerine sahip modern bir masaüstü uygulamasıdır.

---

## ✨ Öne Çıkan Özellikler

- ⚙️ **Dahili Web Sitesi Yöneticisi & Ayarlar**:
  - Uygulama içerisinden dilediğiniz zaman yeni web siteleri (Adı & URL) ekleyin.
  - Mevcut siteleri düzenleyin veya silin.
  - **Varsayılan Site Seçimi**: Uygulama her açıldığında hangi sitenin otomatik geleceğini seçin.
- 📌 **Hızlı Site Değiştirici**: Üst barda bulunan açılır menüden kayıtlı web siteleriniz arasında tek tıkla geçiş yapın.
- 🖼️ **Dinamik Otomatik Logo Algılama**: Giriş yapılan web sitesinin logosunu/favicon'unu otomatik algılar ve uygulama ikonu yapar.
- 📁 **Özel Logo Desteği**: Klasöre kendi `logo.png` görselinizi koyarsanız öncelikli olarak o kullanılır.
- ⚡ **Donanım İvmelendirmesi (GPU)**: Chromium Skia Renderer ve GPU rasterization ile 60+ FPS yüksek performans.
- 🚀 **Tek Dosya Mimarisi**: Tüm uygulama mantığı tek bir [main.py](file:///C:/Users/JOSEPH/.gemini/antigravity-ide/scratch/web_app_wrapper/main.py) dosyası içerisinde toplanmıştır.

---

## ⌨️ Klavye Kısayolları

| Kısayol | İşlev |
| :--- | :--- |
| **`F11`** | Tam Ekran Moduna Geç / Çık |
| **`F5`** veya **`Ctrl + R`** | Sayfayı Yenile |
| **`Ctrl + Shift + S`** | Web Sitesi Yöneticisi & Ayarlar Penceresini Aç |

---

## 📁 Proje Klasör Yapısı

```text
web_app_wrapper/
├── main.py            # Ana masaüstü uygulaması & Ayarlar arayüzü (Tek dosya)
├── sites.json         # Kayıtlı web siteleri ve varsayılan site yapılandırması
├── requirements.txt   # Gerekli bağımlılıklar (PyQt6 & PyQt6-WebEngine)
├── README.md          # Kullanım ve proje dokümantasyonu
└── logo.png (Opsiyonel)# Özel uygulama ikonu (varsa öncelikli kullanılır)
```

---

## 🚀 Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleyin
```bash
pip install -r requirements.txt
```

### 2. Uygulamayı Başlatın
```bash
python main.py
```

---

## 💡 İpuçları & Kullanım
- **Farklı bir siteyi varsayılan yapmak**: `⚙️ Ayarlar` butonuna basıp listeden siteyi seçin ve **"⭐ Varsayılan Yap"** butonuna tıklayın.
- **Kendi logonuzu kullanmak**: Klasör içerisine `logo.png` isminde bir resim koyduğunuzda uygulama doğrudan sizin logonuzu kullanacaktır. Klasörde resim yoksa web sitelerinin logosu otomatik kullanılır.
