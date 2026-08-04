# RemaLab WMS — Frontend Dökümantasyonu

Bu belge `frontend/` klasörünün tamamını kaynak koddan çıkarılmış hâliyle anlatır:
mimari, derleme, backend iletişimi, rotalar, tema, ortak desenler, sayfa envanteri
ve bilinen tuzaklar.

> Belgedeki tüm sayılar ve satır referansları koddan üretilmiştir. Kod değişince
> bu belge de güncellenmelidir; özellikle **Backend İletişim Katmanı** bölümündeki
> kurallar zamanla ayrışırsa sessiz hatalar doğurur.

---

## 1. Genel Bakış

RemaLab WMS bir **masaüstü uygulamasıdır**, ama arayüzü tamamen web teknolojisiyle
yazılmıştır. PySide6 (Qt) bir pencere açar, içine `QWebEngineView` yerleştirir ve
React uygulamasını bu görünümde çalıştırır. Frontend ile Python arasındaki tüm
iletişim **QWebChannel** üzerinden yürür — HTTP REST API **yoktur**.

```
┌──────────────────────────────────────────────────────────┐
│  main.py  →  MainWindow (PySide6)                        │
│                                                          │
│   ┌────────────────────┐      ┌───────────────────────┐  │
│   │ QWebEngineView     │◄────►│ WebBridge (web_bridge)│  │
│   │  React (bu belge)  │ QWeb │  ~190 @Slot metodu    │  │
│   └────────────────────┘Channel└──────────┬────────────┘  │
│                                           │              │
└───────────────────────────────────────────┼──────────────┘
                                            ▼
                                   PostgreSQL (SQLAlchemy)
```

Sonuçları:

- **Ağ katmanı yok.** `axios` bağımlılıklarda duruyor ama hiçbir dosyada
  kullanılmıyor. Veriye erişim tek yoldan: `services/api.js`.
- **Kimlik doğrulama tarayıcı tarafında tutuluyor.** Oturum `localStorage`/
  `sessionStorage`'daki `user` anahtarıdır; sunucu tarafı bir oturum çerezi yoktur.
- **CORS, token, header yönetimi yok.** Buna karşılık QWebChannel'ın kendi katı
  kuralları var (bkz. bölüm 5).

---

## 2. Teknoloji Yığını

`frontend/package.json` içeriğinden:

| Paket | Sürüm | Durum |
|---|---|---|
| `react` / `react-dom` | ^19.2.7 | Çekirdek |
| `react-router-dom` | ^7.18.1 | Rotalar |
| `vite` | ^8.1.1 | Derleyici / dev sunucu |
| `tailwindcss` + `@tailwindcss/vite` | ^4.3.2 | Stil (v4, CSS-first yapılandırma) |
| `lucide-react` | ^1.24.0 | İkonlar — **45 dosyada** kullanılıyor |
| `xlsx` | ^0.18.5 | Excel içe/dışa aktarma — 3 dosyada import ediliyor (`ExcelMappingModal`, `BatchEntry`, `Suppliers`) |
| `react-barcode` | ^1.6.1 | Sadece `WorkOrders.jsx` |
| `oxlint` | ^1.71.0 | `npm run lint` |
| `axios` | ^1.18.1 | **Kullanılmıyor** (0 dosya) |
| `zustand` | ^5.0.14 | **Kullanılmıyor** (0 dosya, `src/store/` boş) |
| `qwebchannel` (npm) | ^6.2.0 | **Kullanılmıyor** — `public/qwebchannel.js` script etiketiyle yükleniyor |

`qwebchannel` npm paketi `import` edilmiyor; `index.html` içindeki
`<script src="/qwebchannel.js"></script>` satırı `public/qwebchannel.js`
dosyasını global `window.QWebChannel` olarak yükler.

---

## 3. Dizin Yapısı

```
frontend/
├── index.html            # Splash ekranı + qwebchannel.js script etiketi
├── vite.config.js        # base:'./', manualChunks, emptyOutDir, api_cache middleware
├── package.json
├── public/
│   ├── qwebchannel.js    # Qt'nin köprü istemcisi (global)
│   ├── logo.png
│   ├── karanlık-mod.png  # koyu tema logosu
│   └── api_cache/
└── src/
    ├── main.jsx          # createRoot + StrictMode + ThemeProvider
    ├── App.jsx           # BrowserRouter + ErrorBoundary + Suspense + rotalar
    ├── index.css         # 389 satır — tema değişkenleri + responsive katmanı
    ├── services/api.js   # 2430 satır — TEK backend erişim noktası (191 fonksiyon)
    ├── layouts/
    │   └── MainLayout.jsx    # 602 satır — kenar çubuğu, menü, üst bar
    ├── context/
    │   └── ThemeContext.jsx  # açık/koyu tema
    ├── constants/
    │   └── faultCatalog.js   # hatalı parça / hata kodu kataloğu
    ├── hooks/
    │   └── useCanvasPanZoom.js
    ├── components/       # 12 bileşen + schema/ (2 dosya)
    ├── pages/            # 35 sayfa, toplam 21.493 satır
    ├── store/            # BOŞ
    └── assets/
```

### Boyut dağılımı

Sayfaların yarıdan fazlası birkaç yüz satırken beş dosya toplamın %45'ini tutuyor:

| Dosya | Satır |
|---|---|
| `pages/WorkOrders.jsx` | 3.426 |
| `services/api.js` | 2.430 |
| `pages/BatchEntry.jsx` | 1.817 |
| `pages/TechnicianRepairOperations.jsx` | 1.479 |
| `pages/Users.jsx` | 1.208 |
| `pages/ImeiTracker.jsx` | 1.150 |
| `pages/SchemaMapper.jsx` | 1.138 |

---

## 4. Çalıştırma ve Derleme

### İki mod

`DEV_MODE` ortam değişkeni (`.env`) hangi frontend'in yükleneceğini belirler —
`core/main_window.py:219`:

| DEV_MODE | Davranış | Adres |
|---|---|---|
| `1` (varsayılan) | Vite dev sunucusu; yoksa otomatik başlatılır | `http://127.0.0.1:5173` |
| `0` (bu kurulumdaki ayar) | `frontend/dist` yerleşik Python HTTP sunucusuyla servis edilir | `http://127.0.0.1:5175` |

Sabit port kullanılmasının sebebi **localStorage origin tutarlılığıdır**: port
değişirse tarayıcı depoyu farklı bir origin sayar ve oturum, tema, menü tercihleri
sıfırlanır.

QWebChannel için ayrıca **5174** portunda bir WebSocket sunucusu çalışır; normal
tarayıcıdan (Qt dışından) açıldığında köprü bu porttan kurulur.

### Komutlar

```bash
cd frontend
npm install
npm run dev      # Vite dev sunucusu (DEV_MODE=1 ile)
npm run build    # dist/ üretir (DEV_MODE=0 bunu servis eder)
npm run lint     # oxlint
```

`DEV_MODE=0` iken **kod değişikliği derlenmeden görünmez**:

```bash
cd frontend && npm run build
# sonra uygulamayı yeniden başlat:
python main.py
```

### Önbellek stratejisi

Eski bir `index.html`'in eski bundle'ları yüklemesi bu projede gerçekten yaşanmış
bir sorundur, iki yerden birden kapatılmıştır:

1. **`vite.config.js` → `build.emptyOutDir: true`** — her derlemede `dist/`
   temizlenir, eski hash'li bundle'lar diskte kalmaz.
2. **`core/main_window.py` → `CustomRequestHandler.end_headers`** — `/assets/`
   altındaki hash'li dosyalar `immutable` olarak bir yıl önbelleklenir; `index.html`
   ve diğer sabit adresli dosyalar `no-store, no-cache, must-revalidate` alır.

> **Uyarı:** `dist/assets/` içinde birden fazla `index-*.js` görürseniz derleme
> yarıda kalmış demektir. `rm -rf dist && npm run build` ile temizleyin ve
> `dist/index.html`'in hangi bundle'ı çağırdığını doğrulayın.

### Paket bölme

`vite.config.js` iki mekanizma kullanır:

- **Rota bazlı code splitting** — `App.jsx` içinde `Login`, `Dashboard`,
  `MainLayout` dışındaki 30+ sayfa `lazy()` ile yüklenir. Eskiden 28 sayfa tek
  ~1.4 MB pakette birleşiyordu.
- **`manualChunks`** — `lucide-react` → `icons`, React/router → `vendor`. Bu iki
  paket uygulama kodundan çok daha az değiştiği için tarayıcı önbelleğinde kalır.

---

## 5. Backend İletişim Katmanı — `services/api.js`

**Bu belgenin en kritik bölümü.** Frontend'deki en sık ve en sinsi hata sınıfı
buradadır.

### 5.1 Köprünün kurulması

`getBackend()` (api.js:56) tek seferlik bir promise döndürür ve üç senaryoyu
kapsar:

1. **Qt WebEngine içinde** (`window.qt.webChannelTransport` var) → doğrudan
   `QWebChannel` kurulur.
2. **Normal tarayıcıda** → `ws://<host>:5174` üzerinden WebSocket açılır,
   QWebChannel bunun üstüne kurulur. **3 saniyelik zaman aşımı** vardır.
3. **Hiçbiri olmazsa** → `getMockBackend()` devreye girer: her çağrı
   `{success:false, message:'Veritabanı bağlantısı yok.'}` döner.

Mock backend sayesinde uygulama bağlantısız da açılır, ekranlar beyaz kalmaz.
Ama sadece **12 metodu** taklit eder; listede olmayan bir slot çağrılırsa
`backend.x is not a function` hatası alınır.

### 5.2 Sarmalama deseni

Her fonksiyon aynı kalıptadır:

```js
getParts: async () => {
    const backend = await getBackend();
    return new Promise((resolve) => {
        backend.get_parts((res) => resolve(JSON.parse(res)));
    });
},
```

Kurallar:

- Python tarafı **her zaman JSON string** döner, JS tarafı `JSON.parse` eder.
- Son argüman **daima callback**'tir.
- Dönen nesne sözleşmesi: `{ success: boolean, message?: string, ...veri }`.
- `api.js` şu an **191 fonksiyon** ile **190 farklı slot** çağırıyor.

### 5.3 ⚠ Argüman sayısı kuralı

> **QWebChannel bir slotu eksik veya fazla argümanla çağırırsanız çağrıyı hiç
> yapmaz.** Exception fırlamaz, konsola hata düşmez, callback tetiklenmez.
> `Promise` sonsuza kadar `pending` kalır, `finally` bloğu çalışmaz, buton
> "İşleniyor..." halinde donar.

Belirti her zaman aynıdır: **ekran kilitlenir, hata mesajı çıkmaz.**

Python tarafındaki imza `@Slot(...)` dekoratörüyle sabitlenir ve
**Python'daki varsayılan değerler QWebChannel için geçerli değildir**:

```python
@Slot(str, int, int, int, str, str, str, bool, result=str)
def submit_test_result(self, entry_id, current_statu_code, success_statu_code,
                       fail_statu_code, result, description, faults_json,
                       log_exit_test=False):   # <- bu varsayılan JS tarafını KURTARMAZ
```

`@Slot` 8 tip bildirdiyse JS tarafı **8 argüman + callback** göndermek zorundadır.

Bu kural geçmişte üç yerde ihlal edildi ve üçü de ekran kilitlenmesine yol açtı:

| Slot | JS gönderiyordu | Beklenen | Eksik alan | Etkilenen ekran |
|---|---|---|---|---|
| `submit_test_result` | 7 | 8 | `logExitTest` | Ara Test Sonuç, Son Test Sonuç |
| `create_service_record` | 15 | 16 | `imei_number` | Servis kaydı oluşturma |
| `update_service_record` | 16 | 17 | `imei_number` | Servis kaydı güncelleme |

#### Doğrulama betiği

Yeni bir slot eklerken veya imza değiştirirken bu kontrolü çalıştırın:

```python
# arity.py — SALT OKUNUR
import re, os
ROOT = r"...\remalab-feature-users-module"
api = open(os.path.join(ROOT, "frontend", "src", "services", "api.js"), encoding="utf-8").read()
py  = open(os.path.join(ROOT, "core", "web_bridge.py"), encoding="utf-8").read()

slots = {}
for m in re.finditer(r"@Slot\(([^)]*)\)\s*\n\s*def\s+(\w+)\s*\(", py):
    parts = [p.strip() for p in m.group(1).split(",")
             if p.strip() and not p.strip().startswith("result")]
    slots.setdefault(m.group(2), []).append(len(parts))

for m in re.finditer(r"backend\.(\w+)\s*\(", api):
    name = m.group(1)
    if name not in slots:
        continue
    i, depth = m.end() - 1, 0
    while i < len(api):
        if api[i] in "([{": depth += 1
        elif api[i] in ")]}":
            depth -= 1
            if depth == 0: break
        i += 1
    body, d, n = api[m.end():i], 0, 0
    n = 1 if body.strip() else 0
    for ch in body:
        if ch in "([{": d += 1
        elif ch in ")]}": d -= 1
        elif ch == "," and d == 0: n += 1
    if (n - 1) not in slots[name]:
        print("UYUMSUZ", name, "JS=%d" % (n - 1), "Slot=%s" % slots[name])
```

> Betik üst seviye virgülleri sayar; **argüman listesinin içine virgüllü yorum
> satırı yazarsanız yanlış alarm verir.** Açıklamayı fonksiyonun üstüne koyun.

### 5.4 Modül bölümleri

`api.js` yorum bloklarıyla bölümlenmiştir:

| Satır | Bölüm |
|---|---|
| 155 | Login / Schema Introspection / Kullanıcılar |
| 230 | Parts (Parçalar) |
| 381 | Locations (Lokasyonlar) |
| 479 | Görev Yönetimi (Mission) |
| 861 | Parça Kategorileri |
| 937 | Servis Kayıtları |
| 1081 | İş Emirleri |
| 1151 | Production Work Order (Yarı Mamul Üretim) |
| 1273 | Parça Tedarik Durumu |
| 1402 | Üretim (Yarı Mamul / Malzeme Tüketimi / Geçmiş) |
| 1474 | Products (Ürün Listesi) |
| 1529 | Müşteriler |
| 1614 | Stok & Depo & İrsaliye |
| 1794 | Item BOM |
| 1841 | Product BOM |
| 1917 | Batch Entry |
| 2106 | Local DB & Data Folders |
| 2190 | Dynamic Table Management |
| 2224 | Modül 5: State Machine / Statü Geçiş Ekranları |

---

## 6. Rotalar — `App.jsx`

```
/                            → /login yönlendirmesi
/login                       → Login                        (eager)
└── MainLayout (Outlet)
    /dashboard               → Dashboard                    (eager)
    /statu-kontrol           → StatuKontrol
    /depo                    → Depo
    /parca-teslim            → ParcaTeslim
    /servis                  → Servis
    /irsaliye                → Irsaliye
    /work-orders             → WorkOrders
    /raporlar                → Raporlar
    /parts                   → Parts
    /part-categories         → PartCategories
    /products                → Products
    /suppliers               → Suppliers
    /locations               → Locations
    /users                   → Users
    /batch-entry             → BatchEntry
    /settings                → Settings
    /departments             → Departments
    /flow-dgd-mapping        → FlowDgdMapping
    /customer-price-matrix   → CustomerPriceMatrix
    /service-records         → ServiceRecords
    /data-management         → DataManagement
    /item-bom                → ItemBOM
    /service-transition      → ServiceTransition
    /statu-gecis/MNG1_AS/138_124 → AraTestSonuc     ┐ özel rotalar
    /statu-gecis/QAC/125_126     → SonTestSonuc     ┘ genel rotadan ÖNCE
    /statu-gecis/:groupKey/:code → BatchStatuTransition
    /musteri-onayi           → CustomerApprovalDecision
    /technician-panel        → TechnicianPanel
    /technician-repair       → TechnicianRepairOperations
    /onarim-havuzu/:deptCode → DepartmentRepairPool
    /servis-onarimlari-demontaj → DemontajServisOnarimlari
    /hizli-onarim-bitir/:missionGroup → HizliOnarimBitir
    /schema-mapper           → SchemaMapper
```

### Parametrik rota deseni

Üç ekran aynı bileşeni URL parametresiyle çoğaltır — kodu departman başına
kopyalamak yerine tek bileşen kullanılır:

| Rota | Parametre | Menüdeki giriş sayısı |
|---|---|---|
| `/statu-gecis/:groupKey/:code` | `SPA_P/100_101`, `QAC/102_103` … | 9 |
| `/onarim-havuzu/:deptCode` | `BATTERY`, `CAMERA`, `DISPLAY`, `CASE`, `L1REPAIR`, `L2REPAIR`, `L3REPAIR` | 7 |
| `/hizli-onarim-bitir/:missionGroup` | `BATTERY`, `CAMERA` | 2 |

`BatchStatuTransition` geçiş tanımını `getAllStatuTransitions()` ile çeker ve
`to_dest === groupKey && code === code` eşleşmesini arar. Tanım
`warehouse.service_statu_map` tablosundadır ve `enabled=true` olmalıdır; aksi
hâlde ekran *"Bu statü geçişi bulunamadı veya artık aktif değil"* der.

### Menüde olmayan rotalar

Şu üç ekran rotası tanımlı ama kenar çubuğunda girişi yok — sadece doğrudan
adres yazarak açılır:

- `/service-records`
- `/service-transition`
- `/technician-panel`

`ImeiTracker.jsx` (1.150 satır) hiç rota almaz; `WorkOrders.jsx`'in
"Barkod Parça Takip" sekmesinde bileşen olarak gömülüdür.

### ⚠ Rota koruması yok

`MainLayout` altındaki hiçbir rotada oturum kontrolü yoktur. `MainLayout` kullanıcıyı
`localStorage`'dan okur ama yoksa **yönlendirme yapmaz** — sadece "Misafir" yazar.
Adres çubuğuna `/users` yazan biri giriş yapmadan ekranı görebilir. Menüde de rol
filtresi devre dışıdır (`MainLayout.jsx:241` — *"Rol filtresi kaldırıldı"*).
Yetkilendirme tamamen backend slotlarının sorumluluğundadır.

---

## 7. MainLayout ve Menü

`layouts/MainLayout.jsx` üç şeyi yapar: kenar çubuğu menüsü, üst bar, `<Outlet/>`.

### Menü grupları

`menuGroups` dizisi (MainLayout.jsx:123) 10 grup içerir:

| Grup | Başlık rengi | Öğe |
|---|---|---|
| GENEL BAKIŞ | `#5B6EC4` | 3 |
| DEPO | `#C1801C` | 5 |
| ENVANTER | `#8A44C4` | 4 |
| YEDEK PARÇA PERSONELİ | `#CE6320` | 3 |
| TEST PERSONELİ | `#3A76B8` | 4 |
| DEMONTAJ TEKNİSYENİ | `#3B8B76` | 3 |
| ÜRETİM TEKNİSYENİ | `#C0392F` | 3 |
| ONARIM HAVUZU | (varsayılan) | 7 |
| ARA TEST | `#A83EAE` | 3 |
| KULLANICI & AYARLAR | `#C2445F` | 10 |

Grupların açık/kapalı durumu `localStorage.sidebarOpenGroups` içinde saklanır.
Her menü öğesinin rengi `getItemColorConfig(path)` ile **rota yoluna göre**
belirlenir; yeni bir rota eklerken bu `switch`'e de bir `case` eklenmezse öğe
varsayılan mavi (`#00B2FF`) görünür.

### Üst bar

- **Son güncelleme** damgası — `currentTime` bilerek dondurulmuştur; saniye
  sayacı `useEffect` içinde yorum satırına alınmıştır (MainLayout.jsx:63).
- **Sayfayı yenile** butonu — `window.location.reload()`.
- **Tema düğmesi** — `useTheme().toggleTheme`.
- **Bildirimler** — `api.getCriticalStock()` ile **60 saniyede bir** çekilir.
  Okunanlar `localStorage.readNotifications` içinde kayıt `id`'siyle tutulur.
- **Kullanıcı rozeti** — `user.username` baş harfi + rol.

---

## 8. Tema Sistemi

### Mekanizma

`context/ThemeContext.jsx` `<html>` etiketine `dark` sınıfını ekler/çıkarır.
Tailwind v4'te bu bağ `index.css`'in ikinci satırında kurulur:

```css
@custom-variant dark (&:is(.dark, .dark *));
```

Tema **kullanıcı başına** saklanır:

| Anahtar | İçerik |
|---|---|
| `theme_<username>` | O kullanıcının tercihi |
| `global_theme` | Giriş yapılmamışken kullanılan varsayılan (`dark`) |

### Renk sistemi

`index.css` Tailwind'in renk rampalarını **ezerek** tek merkezden tema dağıtır.
Bu, sayfalardaki 1500+ `bg-slate-800` / `text-blue-500` kullanımını dokunmadan
temaya uydurmak içindir.

- `@theme { ... }` bloğu **açık tema** değerlerini tutar (Tailwind'in gerçek
  değerleri).
- `.dark { ... }` bloğu koyu temaya özgü tonları yeniden tanımlar.

> **Tarihçe:** dosya eskiden yalnızca koyu tema için yazılmıştı ve `@theme` içinde
> `slate-50: #090a0f` gibi koyu değerler vardı. 288 yerdeki
> `bg-slate-50 dark:bg-[...]` deseni bu yüzden açık temada da siyah kalıyordu.

Uygulama yüzeyleri CSS değişkenleriyle tanımlanır:

| Sınıf | Amaç |
|---|---|
| `.app-shell` | Uygulama zemini |
| `.app-sidebar` / `.app-header` | Kenar çubuğu ve üst bar |
| `.app-card` | Gölgeli kart |
| `.glass-card` | Sayfa kartı — `box-shadow` **bilerek tanımsız**, Tailwind'in `shadow-md` sınıfları çalışsın diye |
| `.glass-modal` | Modal gövdesi |
| `.surface-solid` | Düz yüzey |

`glass-*` isimleri korunmuştur (45+ kullanım) ama artık `backdrop-filter`
kullanılmaz: zemin iki temada da düz tek renk olduğu için bulanıklaştırılacak
doku yok, blur sadece GPU katmanı maliyeti olurdu.

### Responsive katmanı

`index.css` sonundaki `@layer base` bloğu yapısal taşma sorunlarını tek yerden
kapatır. **Tamamının `@layer base` içinde olması zorunludur** — Tailwind v4'te
katmansız kurallar katmanlı utility'leri yener, yani `img { height: auto }` gibi
bir kural sayfadaki `h-36` sınıfını sessizce ezer.

Katmanın yaptıkları:

1. `html, body` yatay kaymayı engeller.
2. `:has(> table)` ile tablonun ebeveynini kaydırılabilir yapar — 40 tablonun
   18'inde `overflow-x` sarmalayıcısı yoktu.
3. 900px altında tablolara `min-width: 660px` verir (**yalnızca kaydırılabilir
   kapta**; aksi hâlde sayfayı gerer).
4. 1024px altında grid/flex çocuklarına `min-width: 0`.
5. `.fixed.inset-0 > div` modal gövdesine `max-height: 92vh`.
6. 640px altında butonlara `min-height: 36px`.

---

## 9. Durum Yönetimi ve Saklama

Global durum kütüphanesi **yoktur**. `zustand` bağımlılıkta duruyor ama
`src/store/` boş. Durum üç yerde tutulur:

1. **Bileşen içi `useState`** — baskın desen.
2. **`ThemeContext`** — tek React context.
3. **`localStorage` / `sessionStorage`**.

### Saklama anahtarları

| Anahtar | Nerede | Amaç |
|---|---|---|
| `user` | local + session | Oturum. "Beni hatırla" işaretliyse `localStorage`, değilse `sessionStorage` |
| `username` | local | Bazı ekranların backend'e gönderdiği kullanıcı adı |
| `saved_username`, `saved_password` | local | "Beni hatırla" — **parola `btoa()` ile base64**, şifreleme değil |
| `global_theme`, `theme_<username>` | local | Tema |
| `sidebarOpenGroups` | local | Açık menü grupları |
| `readNotifications` | local | Okunmuş kritik stok bildirimleri |
| `deletedRoles`, `deletedGorevs` | local | Kullanıcı ekranında gizlenen roller/görevler |

`MainLayout`, `user:updated` adlı özel bir `window` olayını dinler; kullanıcı
bilgisi değişen ekranlar bunu tetikleyerek üst barın güncellenmesini sağlar.

> **Not:** `saved_password` base64'tür, geri çevrilebilir. Bu bir güvenlik
> önlemi değildir; makineye erişimi olan biri parolayı okuyabilir.

---

## 10. Tekrar Eden Desenler

Sayfalar aynı görsel dili paylaşır. Yeni ekran yazarken bu desenleri kopyalayın.

### Bildirim (toast)

**7 dosyada birebir tekrarlanan** bir `NotificationToast` bileşeni vardır
(`fixed top-6 right-6 z-[110]`). Ortak bir bileşene çıkarılmamıştır.

```jsx
const NotificationToast = ({ notification, onClose }) => { ... };
// tipler: success | error | warning | info
```

Kullanım kalıbı:

```jsx
const [notification, setNotification] = useState(null);
const showNotification = (type, message) => {
  setNotification({ type, message });
  if (type !== "error") setTimeout(() => setNotification(null), 5000);
};
```

`BatchStatuTransition` hata bildirimlerini bilerek otomatik kapatmaz — operatörün
görmesi gerekir.

### Hero banner

Her sayfa gradyanlı bir başlık bandıyla açılır:

```jsx
<div className="relative overflow-hidden rounded-2xl bg-gradient-to-r
                from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c]
                to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 ...">
  {/* ambient grid overlay + blur küre */}
  <div className="relative z-10 ...">
    <div className="inline-flex ... rounded-full ...">DEPARTMAN ETİKETİ</div>
    <h1 className="text-2xl sm:text-3xl font-bold ...">Başlık</h1>
    <p className="text-sm text-[#4A5A9E] dark:text-slate-300">Açıklama</p>
  </div>
</div>
```

### Barkod okutma ekranı

Depo/test/onarım ekranlarının ortak iskeleti:

1. `useRef` ile input'a otomatik odak; her işlem sonunda `inputRef.current?.focus()`.
2. `<form onSubmit>` — barkod okuyucu Enter gönderdiği için buton şart değil.
3. İşlem sonucu renk kodlu **log listesine** eklenir (yeni satır başa veya sona).
4. `finally` bloğunda `setLoading(false)` + input temizleme.

`HizliOnarimBitir.jsx` bu desenin en sade örneğidir (200 satır).

### Modal

```jsx
<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
  <div className="bg-white dark:bg-[#12141c] w-full max-w-lg rounded-2xl
                  border ... max-h-[90vh] flex flex-col">
    {/* başlık / gövde (overflow-y-auto) / alt butonlar */}
  </div>
</div>
```

`index.css` içindeki `.fixed.inset-0 > div { max-height: 92vh }` kuralı bu deseni
dar ekranlarda otomatik düzeltir.

---

## 11. Ortak Bileşenler

`components/` altındaki 12 bileşen ve gerçek kullanım sayıları:

| Bileşen | Satır | Kullanan dosya | Açıklama |
|---|---|---|---|
| `ExcelMappingModal` | 269 | 6 | Excel sütunlarını alanlara eşleyen modal |
| `PartSelectCombobox` | 138 | 5 | Parça arama/seçme |
| `TestResultScreen` | 287 | 2 | Ara Test + Son Test ekranlarının gövdesi |
| `DemontajRepairPanel` | 573 | 1 | Demontaj onarım tablosu + parça ekleme |
| `StockTransferModal` | 336 | 1 | Stok transferi |
| `ModelSelectCombobox` | 131 | 1 | Model seçimi |
| `TextCombobox` | 51 | 1 | Serbest metin + öneri |
| `PartSupplyMenu` | 61 | 1 | Parça tedarik durumu menüsü |
| `DeliverPartPopover` | 72 | 1 | Parça teslim popover'ı |
| `ErrorBoundary` | 49 | 1 | `App.jsx`'te tüm ağacı sarar |
| `schema/TableNode` | 206 | 1 | Schema Mapper düğümü |
| `schema/BezierEdge` | 109 | 1 | Schema Mapper bağlantısı |
| `Table` | 141 | **0** | **Ölü kod** |
| `DbErrorModal` | 149 | **0** | **Ölü kod** — DB ayarlarını düzenleme modali, hiç bağlanmamış |

### `ErrorBoundary`

`App.jsx`'te `BrowserRouter` ile `Suspense` arasında durur. Bir sayfa render
sırasında patlarsa beyaz ekran yerine hata kartı gösterir ve `componentDidCatch`
ile konsola `componentStack` yazar. **Olay yakalayıcılarındaki (`onClick`,
`async`) hataları yakalamaz** — React Error Boundary'lerin genel sınırı.

### `TestResultScreen`

İki sayfa bu bileşenin ince sarmalayıcısıdır:

```jsx
// SonTestSonuc.jsx — 14 satır
<TestResultScreen title="Son Test Sonuç" sourceStatuCode={125}
                  successStatuCode={126} failStatuCode={109} logExitTest />

// AraTestSonuc.jsx — 13 satır
<TestResultScreen title="Ara Test Sonuç" sourceStatuCode={138}
                  successStatuCode={124} failStatuCode={109} />
```

Sol sütun "Test Başarılı (Onay)", sağ sütun "Test Başarısız (Geri Çevrim)".
Başarısız tarafta `constants/faultCatalog.js`'ten gelen kategoriler kutucuk
listesi olarak çizilir; **en az 1, en fazla 10** seçilebilir ve açıklama
zorunludur.

---

## 12. Sayfa Envanteri

| Sayfa | Satır | Rota | Kısaca |
|---|---|---|---|
| `Login` | 616 | `/login` | Giriş, "beni hatırla", role göre yönlendirme |
| `Dashboard` | 438 | `/dashboard` | Kontrol paneli |
| `StatuKontrol` | 208 | `/statu-kontrol` | Statü sorgulama |
| `Servis` | 364 | `/servis` | IMEI ile cihaz/PhoneCheck sorgulama, kritik parça çipleri |
| `Depo` | 289 | `/depo` | Depo görünümü |
| `ParcaTeslim` | 429 | `/parca-teslim` | Parça teslim ekranı |
| `Irsaliye` | 787 | `/irsaliye` | İrsaliye |
| `WorkOrders` | 3.426 | `/work-orders` | 8 sekmeli iş emri merkezi |
| `Raporlar` | 727 | `/raporlar` | Raporlar |
| `Parts` | 746 | `/parts` | Parça kartları |
| `PartCategories` | 387 | `/part-categories` | Kategoriler |
| `Products` | 526 | `/products` | Ürün listesi |
| `Suppliers` | 743 | `/suppliers` | Müşteriler/tedarikçiler |
| `Locations` | 232 | `/locations` | Lokasyonlar |
| `Users` | 1.208 | `/users` | Kullanıcı ve görev yönetimi |
| `BatchEntry` | 1.817 | `/batch-entry` | Toplu cihaz girişi + Excel |
| `Settings` | 447 | `/settings` | Ayarlar |
| `Departments` | 332 | `/departments` | Departman yönetimi |
| `FlowDgdMapping` | 191 | `/flow-dgd-mapping` | Flow → DGD eşlemesi |
| `CustomerPriceMatrix` | 206 | `/customer-price-matrix` | Fiyat matrisi |
| `ServiceRecords` | 556 | `/service-records` | Servis kayıtları (menüde yok) |
| `DataManagement` | 442 | `/data-management` | Veri yönetimi |
| `ItemBOM` | 470 | `/item-bom` | Ürün ağacı |
| `ServiceTransition` | 238 | `/service-transition` | Statü geçiş menüsü (menüde yok) |
| `BatchStatuTransition` | 526 | `/statu-gecis/:groupKey/:code` | **9 menü öğesinin ortak ekranı** |
| `AraTestSonuc` | 13 | `/statu-gecis/MNG1_AS/138_124` | `TestResultScreen` sarmalayıcısı |
| `SonTestSonuc` | 14 | `/statu-gecis/QAC/125_126` | `TestResultScreen` sarmalayıcısı |
| `CustomerApprovalDecision` | 204 | `/musteri-onayi` | Müşteri onay/red |
| `TechnicianPanel` | 159 | `/technician-panel` | (menüde yok) |
| `TechnicianRepairOperations` | 1.479 | `/technician-repair` | Üretim Kaydını Görüntüle |
| `DepartmentRepairPool` | 388 | `/onarim-havuzu/:deptCode` | 7 departmanın ortak havuzu |
| `DemontajServisOnarimlari` | 397 | `/servis-onarimlari-demontaj` | Üretime Aktar |
| `HizliOnarimBitir` | 200 | `/hizli-onarim-bitir/:missionGroup` | Barkod okutup onarım kapatma |
| `SchemaMapper` | 1.138 | `/schema-mapper` | Şema görselleştirme |
| `ImeiTracker` | 1.150 | *(rota yok)* | `WorkOrders` içinde sekme |

### `WorkOrders` sekmeleri

`TABS` dizisi (WorkOrders.jsx:1299). Ekran `activeTab = 'production'` ile açılır,
bu yüzden o sekme listenin de başındadır:

1. **Yarı Mamul Üretimi** (varsayılan)
2. Servis İş Emirleri
3. Yeni İş Emri
4. Hızlı Tekrar Üretim *(yalnızca geliştirici rolünde)*
5. Malzeme Tüketimi
6. Üretim Raporu
7. Üretim İş Emirleri
8. Barkod Parça Takip (`ImeiTracker`)

---

## 13. Bilinen Sorunlar ve Dikkat Edilecekler

| # | Konu | Etki | Durum |
|---|---|---|---|
| 1 | **Slot argüman sayısı** uyuşmazlığı | Ekran sessizce kilitlenir | 3 vaka düzeltildi; betikle kontrol edilmeli |
| 2 | `dist/` içinde birden fazla `index-*.js` | Yeni derleme görünmez | `emptyOutDir` + `no-store` ile kapatıldı |
| 3 | Rota koruması yok | Giriş yapmadan ekranlara erişilebilir | Açık — yetki backend'de |
| 4 | Menüde rol filtresi devre dışı | Herkes tüm menüyü görür | Bilinçli tercih (MainLayout.jsx:241) |
| 5 | `Table.jsx`, `DbErrorModal.jsx` ölü kod | — | Temizlenebilir |
| 6 | `zustand`, `axios`, `qwebchannel` npm paketleri kullanılmıyor | Gereksiz bağımlılık | Temizlenebilir |
| 7 | `NotificationToast` 7 dosyada tekrar | Bakım maliyeti | Ortak bileşene çıkarılabilir |
| 8 | `saved_password` base64 | Şifreleme değil | Bilinçli, ama not edilmeli |
| 9 | `getMockBackend` yalnızca 12 metodu taklit eder | Bağlantısızken bazı ekranlar `is not a function` verir | Açık |
| 10 | `WorkOrders.jsx` 3.426 satır | Okunabilirlik | Açık |

### Hata ayıklama sırası

Bir ekran "İşleniyor..." / "Yükleniyor..." halinde donduğunda:

1. **Argüman sayısını kontrol edin** (bölüm 5.3 betiği). En olası sebep budur.
2. Konsolda `backend.x is not a function` var mı? → Slot adı yanlış veya mock
   backend devrede.
3. `getBackend()` mock'a mı düştü? Konsolda
   *"WebSocket connection timed out (3s). Falling back to mock backend."* arayın.
4. Veritabanı erişilebilir mi? Sunucu `10.200.246.238:5432`. Erişilemezse
   `main.py` konsola `[WARN] Database tables could not be auto-initialized` yazar.
5. `dist` güncel mi? `frontend/dist/index.html`'in çağırdığı bundle içinde
   beklediğiniz kodun olduğunu doğrulayın.

---

## 14. Yeni Ekran Ekleme Kontrol Listesi

1. **Backend slot'unu yaz** — `core/web_bridge.py` içinde `@Slot(...)`, JSON string
   döndür, `{success, message}` sözleşmesine uy.
2. **`api.js`'e sarmalayıcı ekle** — argüman sayısı `@Slot` ile birebir aynı olsun,
   son argüman callback. İlgili modül bölümünün altına koy.
3. **Sayfayı `pages/` altında oluştur** — hero banner + toast + kart desenini
   kopyala.
4. **`App.jsx`'e `lazy()` import + `<Route>` ekle** — parametrik rota gerekiyorsa
   özel rotaları genel olandan önce yaz.
5. **`MainLayout.jsx`'e menü öğesi ekle** — `menuGroups` içine giriş **ve**
   `getItemColorConfig` içine `case`; ikincisi unutulursa öğe varsayılan mavi olur.
6. **Argüman kontrol betiğini çalıştır** (bölüm 5.3).
7. **`npm run build`** ve uygulamayı yeniden başlat.

---

## 15. İlgili Belgeler

- `docs/SISTEM_DOKUMANTASYONU.md` — sistemin geneli
- `docs/HIZLI_ONARIM_BITIR.md` — Hızlı Onarım Bitiş tasarım kararları
- `docs/api_reference.md` — backend slot referansı
- `docs/SISTEM_HARITASI.html` — sistem haritası

HTML sürümünü üretmek için:

```bash
cd docs
python _render_doc.py FRONTEND "Frontend Dökümantasyonu"
```
