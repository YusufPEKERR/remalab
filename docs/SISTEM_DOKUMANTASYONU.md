# RemaLab WMS — Sistem Dökümantasyonu

> Depo ve servis/onarım yönetim sistemi (Warehouse Management System).
> Bu belge; **neyin neyle nasıl bağlantılı olduğunu, sistemin nasıl çalıştığını ve verilerin nereden geldiğini** uçtan uca anlatır.

---

## 1. Sistem Nedir? (Özet)

RemaLab WMS, telefon **yenileme (refurbish) / onarım (repair) / RMA** operasyonlarını yöneten bir **masaüstü uygulamasıdır**. Fiziksel olarak tek bir `.exe`/Python süreci gibi çalışır ama içinde iki dünya barındırır:

- **Arayüz (UI):** Modern bir **React** uygulaması (web teknolojisi).
- **Backend (iş mantığı + veritabanı):** **Python + PySide6 (Qt)**.

Bu ikisi aynı masaüstü penceresi içinde yaşar. React arayüzü, bir tarayıcı motoru (Qt WebEngine = Chromium) içinde açılır; Python tarafı ise verileri ve iş kurallarını yönetir. Aralarındaki konuşma **QWebChannel** adlı bir köprü ile olur.

Veriler **uzaktaki bir PostgreSQL sunucusunda** (`10.200.246.116`, `remalab` veritabanı) tutulur.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Masaüstü kabuk | **PySide6** (Qt for Python) — `QMainWindow` + `QWebEngineView` (Chromium) |
| Frontend | **React 19** + **Vite 8** + **React Router 7** + **Tailwind CSS 4** + **lucide-react** ikonları |
| Frontend yardımcıları | `xlsx` (SheetJS, Excel), `react-barcode`, `zustand` (hafif state), `axios` |
| Köprü (UI ↔ Python) | **QWebChannel** (masaüstünde doğrudan, tarayıcıda WebSocket `ws://…:5174` üzerinden) |
| Backend dili | **Python 3** |
| ORM | **SQLAlchemy** (+ `psycopg2` sürücüsü) |
| Veritabanı | **PostgreSQL** (uzak sunucu, `warehouse` şeması) |
| Kimlik doğrulama | `bcrypt` (parola hash), `PyJWT` (mevcut ama masaüstünde aktif kullanılmıyor) |
| Excel | `openpyxl` + `pandas` |
| Ayrı REST API | **FastAPI** + **Pydantic** + **uvicorn** (uzak sunucuda ayrı çalışır — bkz. §12) |
| Dökümantasyon | **MkDocs** (Material teması, `mkdocstrings`) |

---

## 3. Mimari — Nasıl Çalışıyor?

### 3.1 Büyük resim

```
┌──────────────────────────────────────────────────────────────────────┐
│                    MASAÜSTÜ UYGULAMASI (main.py)                        │
│                                                                        │
│   ┌────────────────────────────┐        ┌──────────────────────────┐  │
│   │  QWebEngineView (Chromium) │        │   Python Backend          │  │
│   │  ── React SPA ──           │◄──────►│   WebBridge (QObject)     │  │
│   │  pages/, components/       │ QWeb   │   core/web_bridge.py      │  │
│   │  services/api.js           │ Channel│   (~6700 satır, kalp)     │  │
│   └────────────┬───────────────┘        └────────────┬─────────────┘  │
│                │ büyük listeler için HTTP             │ SQLAlchemy     │
│                ▼                                       ▼                │
│         /api_cache/*.json  ◄── yazar ──  api_cache/ (yerel disk cache) │
└────────────────────────────────────────────────────────┼──────────────┘
                                                          │ psycopg2
                                                          ▼
                                        ┌──────────────────────────────┐
                                        │  PostgreSQL 10.200.246.116     │
                                        │  veritabanı: remalab           │
                                        │  şema: warehouse.*             │
                                        └──────────────────────────────┘
```

### 3.2 Uygulama açılış akışı (adım adım)

1. **`start.bat`** çalıştırılır → `.venv` sanal ortamını kurar, `requirements.txt` ve `npm install` ile bağımlılıkları yükler, sonra **`main.py`** başlatır.
2. **`main.py`**:
   - Qt uygulamasını (yüksek DPI, Türkçe yerel ayar) başlatır.
   - **Arka planda** `init_database_schema()` çağırır (uzak DB'ye bağlanıp tabloları kontrol eder). Bu arka planda yapılır ki pencere anında açılsın.
   - **`MainWindow`** penceresini açar.
3. **`core/main_window.py` → `MainWindow`**:
   - Bir **`QWebEngineView`** (gömülü Chromium) oluşturur.
   - **`WebBridge`** nesnesini bir **`QWebChannel`** üzerinden `"backend"` adıyla React'e açar.
   - **5174 portunda** bir WebSocket sunucusu açar (tarayıcı tabanlı QWebChannel bağlantıları için).
   - `DEV_MODE=1` ise: **Vite dev sunucusunu** (`npm run dev`, port 5173) otomatik başlatır ve `http://127.0.0.1:5173` yüklenir.
   - `DEV_MODE=0` ise: derlenmiş `frontend/dist/` klasörünü yerel statik sunucudan servis eder.
4. React uygulaması yüklenir → `getBackend()` (`services/api.js`) QWebChannel ile `backend` nesnesini bulur → artık `backend.<metod>()` çağrıları yapılabilir.

> **`server.py`** ayrıca "başsız (headless)" bir mod sunar: pencere açmadan sadece WebSocket köprüsü + Vite sunucusunu çalıştırır. Normal kullanımda gerekmez.

### 3.3 Frontend ↔ Backend konuşması (veri akışının kalbi)

Tüm iletişim şu desenle çalışır:

```javascript
// frontend/src/services/api.js
createUser: async (userData) => {
    const backend = await getBackend();          // QWebChannel "backend" nesnesi
    return new Promise((resolve) => {
        backend.create_user(username, ..., (res) => resolve(JSON.parse(res)));
        //      └── Python WebBridge.create_user  └── callback: JSON string döner
    });
}
```

- Frontend'deki her `api.xxx()` fonksiyonu, Python'daki bir **`@Slot`** metoduna karşılık gelir.
- Python metodu **her zaman bir JSON string** döner (`{"success": true, ...}` gibi), frontend `JSON.parse` eder.
- `frontend/src/services/api.js` (~1700 satır) bu köprünün tamamını "Promise" haline getiren tek sarmalayıcı katmandır.
- QWebChannel yoksa (ör. saf tarayıcı) `api.js` içinde **mock backend** devreye girer (geliştirme kolaylığı için).

### 3.4 `api_cache` — "Veriler nereden geliyor?" sorusunun kilit noktası

Büyük listeler (parçalar, stok, ürünler) on binlerce satır olabilir. Bu kadar veriyi QWebChannel köprüsünden JSON string olarak geçirmek yavaştır. Çözüm:

1. `get_parts`, `get_stock_status`, `get_products`, `get_critical_stock` gibi metodlar veriyi DB'den çeker, **`api_cache/*.json`** dosyasına yazar (`write_to_cache`).
2. Frontend'e köprüden koca JSON yerine kısa bir cevap döner: `{"success": true, "fetch_url": "/api_cache/parts.json"}`.
3. Frontend bu dosyayı **HTTP ile** indirir (`/api_cache/parts.json` veya dev modda `http://localhost:5173/api_cache/parts.json`).
4. **Otomatik geçersizleştirme:** SQLAlchemy'ye takılı bir dinleyici — `event.listen(Session, 'after_commit', clear_api_cache)` — **her veritabanı commit'inde** `parts.json`, `stock.json`, `critical.json` dosyalarını siler. Böylece bir sonraki okuma güncel veriyi yeniden üretir.

> **Özetle:** `api_cache/` dışarıdan gelen bir API verisi **değildir** — kendi PostgreSQL'inizin, hız için diske serileştirilmiş anlık görüntüsüdür. `.gitignore` içinde olması da bunu doğrular (üretilen, makineye özel veri).

Örnek dosya boyutları: `parts.json` ~12 MB, `stock.json` ~9 MB, `products.json` ~60 KB.

---

## 4. Veritabanı

- **Motor:** PostgreSQL, SQLAlchemy + `psycopg2` üzerinden.
- **Bağlantı bilgileri** `.env` dosyasından okunur (`config/database.py`):
  - `PG_HOST=10.200.246.116`, `PG_PORT=5432`, `PG_DATABASE=remalab`, `PG_USER=postgres`, `PG_PASSWORD=…`
- **Tüm tablolar `warehouse` şemasındadır** (`warehouse.parts`, `warehouse.stock`, …).
- **Tembel (lazy) bağlantı:** Engine ve session ilk kullanımda oluşturulur. Bağlantı ayarları çalışma anında `update_db_settings` ile değiştirilebilir → `reconnect_engine()` motoru yeniden kurar.
- **Dayanıklılık ayarları:** `connect_timeout=5s`, sunucu tarafı `statement_timeout=10s`, TCP keepalive, `pool_pre_ping=True`, `pool_recycle=300` — dalgalı bir LAN bağlantısı için ayarlanmış. Global `handle_error` dinleyicisi bağlantı hatalarını çökertmeden `[WARN]` olarak loglar; UI tarafında **`DbErrorModal`** kullanıcıya bağlantı ayarlarını düzenleme imkânı verir.

### 4.1 Kendi kendine migrasyon (dikkat!)

Klasik migration aracı (Alembic vb.) **yoktur**. Bunun yerine iki mekanizma var:

1. `init_database_schema()` → `Base.metadata.create_all()` (SQLAlchemy modelleri için tabloları oluşturur).
2. **`WebBridge.__init__`** çağrıldığında ~20 adet **`_ensure_*`** metodu çalışır. Bunlar ham SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) ile eksik kolon/tabloları ekler, sistem depolarını ve referans verilerini tohumlar. Yani **şema, uygulama her açıldığında kod tarafından güncel tutulur.**

Örnek `_ensure_*` işleri: `departments`, `service_records`, `work_orders`, `material_requests`, üretim tabloları, `work_order_parts`, `batch_entries`, `item_models`, kullanıcı `gorev`/`fullname` kolonları, sistem lokasyonları vb.

### 4.2 İki tür tablo

- **SQLAlchemy modeli olan tablolar** (`models/` klasörü) — aşağıda §5.
- **Sadece ham SQL ile yönetilen tablolar** (`web_bridge.py` içindeki `_ensure_*` + `text()` sorguları). Bunların ORM modeli yoktur: `work_orders`, `work_order_parts`, `service_records`, `customers`, `material_requests`, `production_runs`, `produced_units`, `production_materials`, `item_models`, `part_suppliers`, `part_supplier_prices`, `bom_items`, `departments`.

---

## 5. Veri Modelleri (ORM) ve İlişkiler

> **Önemli tasarım kararı:** Modellerde **hiç `ForeignKey` ve hiç `relationship()` tanımı yoktur.** Tüm bağlantılar "mantıksal"dır — `part_id`, `location_id` gibi düz `Integer` kolonlar sorgu kodunda elle join edilir. Bu, gevşek bağlı (loosely-coupled) bilinçli bir tercihtir.

### Ana tablolar

| Model / Tablo | Amaç | Kilit kolonlar |
|---|---|---|
| `User` / `warehouse.users` | Kullanıcı + org hiyerarşisi | `username`(unique), `tc_no`(unique), `password_hash`, `role`, `gorev`, `fullname`, `account_enabled`, `team_leader`, `operation_manager`, `administrative_manager` |
| `Part` / `warehouse.parts` | Parça ana kataloğu (sistemin merkezi) | `name`, `item_code`, `barcode`, `brand`, `model`, `memory`, `color`, `part_category_id`, `stock_tracking_type`, `department`, `status`, `critical_limit`, `part_type` |
| `PartCategory` / `warehouse.part_categories` | Parça kategorileri | `name`(unique), `part_type`, `flow`, `departments`, `is_active` |
| `Location` / `warehouse.locations` | Depo/lokasyonlar | `name`, `kind` (sistem deposu türü), `description` |
| `Stock` / `warehouse.stock` | (parça, lokasyon) → miktar | `part_id`, `location_id`, `quantity` |
| `StockMovement` / `warehouse.stock_movements` | **Tüm stok hareketlerinin defteri (audit)** | `type`, `quantity`, `part_id`, `source_location_id`, `target_location_id`, `created_by`, `technician`, `unit_price`, `total_cost`, `created_at` |
| `InboundEntry` / `warehouse.inbound_entries` | Mal giriş kayıtları | `part_id`, `quantity`, `unit_price`, `total_cost`, `created_by` |
| `OutboundEntry` / `warehouse.outbound_entries` | Mal çıkış kayıtları | `part_id`, `location_id`, `quantity`, `destination`, `outbound_type` |
| `Product` / `warehouse.products` | Cihaz modeli kataloğu | `item_code`(unique), `brand`, `model`, `memory`, `color` |
| `ProductFamily` / `warehouse.product_families` | Ürün ailesi (master veri) | `name`(unique), `is_active` |
| `ProductBOM` / `warehouse.product_boms` | Ürün reçetesi (model → alt kalem) | `product_model`, `child_item_code`, `quantity`, `status` |
| `ItemBOM` / `warehouse.item_bom` | Kalem reçetesi (parent → child) | `parent_item_id`, `child_item_id`, `quantity` |
| `BatchEntry` / `warehouse.batch_entries` | Cihaz kabul/batch girişi (IMEI, model, GB, renk) | `imei_number`, `serial_number`, `internal_id`, `batch_no`, `model`, `gb`, `color`, `unit_price`, `currency`, `defects`, `flow` |

### 5.1 Varlık ilişkileri (mantıksal)

```
                         warehouse.parts (id)  ◄── sistemin merkezi
              part_id /    |          \ part_id        \ part_id
        ┌───────────┘  part_category_id  └──────────┐   └──────────┐
        ▼                  ▼                          ▼              ▼
   stock (part_id,   part_categories (id)     inbound_entries  stock_movements
    location_id)                                                (part_id,
        │                                                        source_loc_id,
        │ location_id                                            target_loc_id)
        ▼
   locations (id) ◄── outbound_entries.location_id, stock_movements.*_location_id

   products(item_code, model) ◄···· product_boms(child_item_code, product_model)
   item_bom(parent_item_id ──► child_item_id)     [string kodlarla, kendine referanslı]

   product_families / batch_entries / users  → bağımsız (standalone)
```

- **`Part`** hub'dır: stok, giriş, çıkış ve hareketlerin hepsi `parts.id`'ye mantıksal olarak bağlıdır.
- **`Stock`** = (parça, lokasyon) ikilisi; parça ile lokasyon arasındaki pivot.
- **`StockMovement`** = değiştirilemez denetim defteri; her giriş/çıkış/transfer burada bir satır bırakır.
- **BOM tabloları** ürün/kalemleri bileşenlerine **string kodlarla** bağlar (integer FK ile değil).

---

## 6. Katmanlı Mimari (İki farklı yol)

Projede iş mantığına ulaşan **iki paralel yol** vardır:

### Yol A — Temiz katmanlı mimari (`models` → `repositories` → `services`)
Klasik, disiplinli mimari. Masaüstündeki bazı akışlar ve özellikle ayrı FastAPI (§12) bunu kullanır.

- **`repositories/`** — Ham DB erişimi. **Asla commit etmez**, sadece `flush()`. Session dışarıdan verilir.
  - `UserRepository`, `PartRepository`, `LocationRepository`, `StockRepository`, `StockMovementRepository`, `InboundEntryRepository`, `OutboundEntryRepository`.
- **`services/`** — İş mantığı + **transaction sahibi** (`with get_db()` + `commit()`/`rollback()`). Girdi doğrular, domain istisnası fırlatır, UI'a düz dict döner.
  - `UserService`, `PartService`, `LocationService`, `InboundService`, `OutboundService`, `StockService`.
  - Örnek atomik iş: `InboundService.receive_goods` → tek transaction'da `inbound_entries` kaydı + `stock` artışı + `stock_movements` "Inbound" satırı.
- **`services/exceptions.py`** — istisna hiyerarşisi:
  ```
  ServiceError                    (temel; mesajı UI'da göstermek güvenli)
  ├── ValidationError             (hatalı/eksik girdi)
  ├── DuplicateUsernameError      (kullanıcı unique çakışması)
  ├── NotFoundError               (kayıt yok)
  └── InsufficientStockError      (yetersiz stok)
  ```

### Yol B — `core/web_bridge.py` (masaüstünün ASIL çalışan yolu)
Masaüstü UI'ının çağırdığı **~120 `@Slot` metodunun neredeyse tamamı** burada, **doğrudan** veritabanına konuşur (repository/service katmanını çoğunlukla atlar):

- Desen: `db = SessionLocal()` … `try/finally: db.close()`; içinde ya ORM modelleri ya da ham `text()` SQL.
- Modeller/config **tembel import** edilir (her metodun içinde `from models.stock import Stock`) → import maliyeti ve döngüsel import riski azalır.
- Stok etkileyen her işlem `Stock` (bakiye) + `StockMovement` (defter) satırını aynı transaction'da yazar.

> **Pratik sonuç:** "Bir ekran hangi veriyi nasıl alıyor?" sorusunun cevabı çoğu zaman `core/web_bridge.py` içindedir; `services/`+`repositories/` daha çok FastAPI ve temiz-mimari akışları içindir.

---

## 7. Backend API Envanteri (`web_bridge.py` `@Slot` metodları)

Frontend'den `backend.<isim>(...)` ile çağrılabilen uç noktalar, iş alanına göre gruplu:

### Kimlik / Kullanıcı
`login`, `get_users`, `create_user`, `update_user`, `delete_user` (son Admin'i silmeyi engeller).

### Parça / Kategori / Departman / Kalem arama
`get_parts` (→ **parts.json cache**), `create_part`, `update_part`, `delete_part`, `delete_parts_bulk`, `get_item_model`, `get_item_codes_by_model`, `get_item_codes` (**cache**), `get_departments`, `create/update/delete_department`, `get_product_families`, `get_part_categories`, `create/update/delete_part_category`.

### Ürün
`get_products` (→ **products.json cache**), `create_product`, `update_product`, `delete_product`.

### Reçete (BOM)
`get_item_boms`, `get_product_boms` (sayfalı), `create/update/delete_product_bom`, `toggle_product_bom_status`.

### Lokasyon
`get_locations`, `get_system_locations`, `create_location`, `delete_location`.

### Müşteri / Servis Kaydı
`get_customers`, `create/update/delete_customer`, `get_service_records`, `create/update/delete_service_record`, `generate_customer_bulk_template` (Excel şablonu), `bulk_import_customers`, `sync_customers_to_batch_entries`.

### İş Emirleri (Servis + Üretim)
`get_work_orders`, `create_work_order`, `update_work_order`, `delete_work_order`, `create_production_work_order`, `start_production_work_order` (BEKLIYOR→URETIMDE), `complete_production_work_order` (üretim biter, stok işlenir).

### Malzeme İstekleri (üretim tüketimi)
`get_material_requests`, `issue_material_request` (kısmî/tam), `report_material_fire` (fire/hurda bildirimi), `return_bom_part_to_doa`, `issue_extra_bom_materials`, `receive_extra_bom_materials`, `add_material_request`.

### İş Emri Parçaları / Servis Onarım
`get_work_order_parts_by_imei` (IMEI ile), `get_work_order_parts`, `add_work_order_part(s_bulk)`, `deliver_work_order_part`, `mark_work_order_part_waiting`, `revert_work_order_part_status`, `return_part_to_doa`, `remove_work_order_part`, `get_service_repair_details`, `save_service_repair_details`.

### Tedarik İstekleri
`create_supply_request`, `cancel_supply_request`, `get_supply_requests`, `get_supply_request_history`.

### Üretim Koşuları
`get_production_runs`, `create_production_run`, `delete_production_run`.

### Stok / Depo
`get_stock_status` (→ **stock.json cache**), `get_stock_status_paged`, `transfer_stock` (kurallara tabi), `get_stock_movements`, `add_inbound_entry`, `add_outbound_entry`, `get_critical_stock` (→ **critical.json cache**).

### Batch Girişi
`get_batch_entries` (sayfalı), `create/update/delete_batch_entry`, `get_batch_summary`, `clear_all_batch_entries`, `bulk_delete_batch_entries`, `bulk_update_batch_flow`, `lookup_batch_entry` (IMEI/seri ile arama).

### Rapor / Dashboard
`get_reports` (tarih aralığı), `get_dashboard_stats` (KPI'lar).

### Ayarlar / Dev / DB
`get_dev_mode`, `set_dev_mode`, `update_db_settings`, `get/add/create/delete_local_file`, `open_local_folder`, `get/add/delete_data_folder`.

### Genel DB Gezgini (admin)
`get_all_tables_schema`, `get_table_data`, `insert_table_data` (dinamik SELECT/INSERT).

### Excel Dışa Aktarma
`export_table_to_excel` (JSON→DataFrame→xlsx, `~/Downloads`'a yazıp açar), `export_all_tables_to_excel` (tüm tabloları çok sayfalı xlsx).

---

## 8. Frontend Yapısı

### 8.1 Navigasyon menüsü (modül haritası)
`layouts/MainLayout.jsx` içinde tanımlı; gruplu, katlanabilir, renk temalı ve **role göre filtreli**:

| Grup | Modüller (rota) |
|---|---|
| **GENEL BAKIŞ** | Kontrol Paneli (`/dashboard`) |
| **DEPO** | Depo (`/depo`), İrsaliye (`/irsaliye`), İş Emirleri (`/work-orders`), Servis Onarımları (`/servis-onarim`), Tedarik İstekleri (`/supply-requests`), Tedarik Talepleri (`/tedarik-talepleri`), Raporlar (`/raporlar`) |
| **ENVANTER** | Parçalar (`/parts`), Ürün Listesi (`/products`), Müşteriler (`/suppliers`), Lokasyonlar (`/locations`) |
| **KULLANICI & AYARLAR** | Kullanıcılar (`/users`), Batch Girişi (`/batch-entry`), Parça Kategorileri (`/part-categories`), Product Bom (`/item-bom`), Ayarlar (`/settings`), Veri Yönetimi (`/data-management`), Departman Yönetimi (`/departments`) |

### 8.2 Rol bazlı erişim
Kullanıcının `role` değeri küçük harfe çevrilip **normalize edilir**: `developer → admin`; `tec_*`, `staff`, `qac`, `log_p → teknisyen`. Bir `allowedPaths` haritası hangi rolün hangi rotayı göreceğini belirler:

- **admin** — tüm modüller.
- **depo** — depo, irsaliye, work-orders, servis-onarim, raporlar.
- **depo müdürü** — dashboard, depo, irsaliye, work-orders, servis-onarim, supply-requests, raporlar, parts, products, suppliers, locations, tedarik-talepleri, service-records, batch-entry.
- **teknisyen** — dashboard, servis-onarim, quality, refurbishment, priority, batch-entry.
- Özel kural: **Tedarik İstekleri/Talepleri yalnızca `depo müdürü`ne** görünür (admin dahil diğerleri hariç).

> ⚠️ Bu yetkilendirme **yalnızca frontend'de** (menü görünürlüğü) yapılır. Backend `@Slot` metodlarında rol kontrolü **yoktur** (bkz. §11).

### 8.3 Sayfalar (özet)

| Sayfa | Ne yapar | Ana `api` çağrıları |
|---|---|---|
| **Login** | Giriş; kullanıcıyı local/session storage'a yazar | `login` |
| **Dashboard** | KPI kutuları + son stok hareketleri | `getDashboardStats`, `getStockMovements` |
| **Users** | Kullanıcı CRUD + Excel | `getUsers`, `create/update/deleteUser` |
| **Parts** | Parça kataloğu CRUD, toplu sil, Excel | `getParts`, `create/update/deletePart`, `deletePartsBulk`, lookuplar |
| **PartCategories** | Kategori CRUD, lokasyon/departman eşleme | `getPartCategories`, `create/update/deletePartCategory` |
| **Products** | Cihaz modeli kataloğu CRUD | `getProducts`, `create/update/deleteProduct` |
| **Suppliers (Müşteriler)** | Müşteri CRUD, toplu Excel import/şablon | `getCustomers`, `create/update/deleteCustomer`, `bulkImportCustomers` |
| **Locations** | Lokasyon listesi/oluşturma | `getLocations`, `createLocation` |
| **Depo** | Sayfalı, aramalı stok görüntüleyici (salt okunur) | `getStockStatusPaged` |
| **Irsaliye** | Giriş/çıkış kaydı, transfer, hareket görüntüleme | `addInboundEntry`, `addOutboundEntry`, `transferStock`, `getStockMovements` |
| **WorkOrders** | Servis+üretim iş emirleri merkezi; BOM, malzeme, üretim, teslim/iade, barkod | ~40 `api` çağrısı (iş emri/BOM/material/production) |
| **ServisOnarim** | Teknisyen onarım ekranı; cihaz detayı + tüketilen parçalar | `getWorkOrders`, `get/saveServiceRepairDetails`, `getWorkOrderParts` |
| **ImeiTracker** | IMEI ile cihaz takibi; malzeme iste/teslim/iade (WorkOrders içine gömülü) | `getWorkOrderPartsByImei`, `addMaterialRequest`, `deliverWorkOrderPart` |
| **SupplyRequests** | Tedarik istekleri kuyruğu (depo müdürü) | `getSupplyRequests`, `cancelSupplyRequest` |
| **SupplyRequestForm** | Teknisyen tedarik talebi oluşturma + geçmiş | `createSupplyRequest`, `getSupplyRequestHistory` |
| **Raporlar** | Stok/kritik stok/genel raporlar + Excel | `getReports`, `getStockStatus`, `getCriticalStock` |
| **Settings** | DB bağlantı & dev mode, yerel dosya/klasör yönetimi | `get/setDevMode`, `updateDbSettings`, dosya/klasör metodları |
| **Departments** | Departman CRUD | `getDepartments`, `create/update/deleteDepartment` |
| **ServiceRecords** | Servis kayıtları (kabul) CRUD | `getServiceRecords`, `create/update/deleteServiceRecord` |
| **BatchEntry** | Cihaz kabul grid'i; lookup, CRUD, toplu güncelle/sil, Excel import/export | `getBatchEntries`, `lookupBatchEntry`, `bulkUpdateBatchFlow` |
| **DataManagement** | Düşük seviye DB admin; tablo şeması/veri gör, satır ekle, Excel | `getAllTablesSchema`, `getTableData`, `insertTableData` |
| **ItemBOM (Product Bom)** | Ürün ailesi başına reçete yönetimi | `getProductBOMs`, `create/update/deleteProductBOM` |

### 8.4 Yeniden kullanılabilir bileşenler
`Table.jsx` (genel tablo: arama/sıralama/CRUD hook'ları), `DbErrorModal.jsx` (DB hatası + ayar düzenleme), `DeliverPartPopover.jsx`, `StockTransferModal.jsx` (transfer kuralları uygulanır), `PartSupplyMenu.jsx` (parça durum menüsü), `PartSelectCombobox`/`ModelSelectCombobox`/`TextCombobox` (performanslı aramalı açılır listeler, max 60 sonuç), `ExcelMappingModal.jsx` (Excel sütun→DB kolon eşleme sihirbazı), `ErrorBoundary.jsx`.

### 8.5 Tema
`context/ThemeContext.jsx` — light/dark; global (`global_theme`) + **kullanıcıya özel** (`theme_<username>`) tercih. `<html>`'e `dark` sınıfı ekler/çıkarır.

### 8.6 Ek davranışlar (MainLayout)
- **60 saniyede bir** `getCriticalStock()` → zil/bildirim menüsü (okunanlar localStorage'da).
- Giriş yapan kullanıcı local/session storage'dan okunur; `user:updated` olayı ile tazelenir.
- Üst bardaki yenile butonu `app:refresh` özel olayı yayar (sayfalar dinleyip yeniden yükler).

---

## 9. Ana İş Kuralları (Domain)

### 9.1 Sistem depoları (kind)
`web_bridge.py` sabit sistem depoları tanımlar ve otomatik iş akışıyla yönetir:
`good_stock` (Good Stock), `doa_stock` (DOA Stock), `repair_stock` (Repair Stock), `scrap_stock` (Scrap Stock), `out_stock` (Out Stock).

### 9.2 İzin verilen manuel stok transferleri (`SYSTEM_TRANSFER_RULES`)
```
good_stock  → repair_stock
repair_stock → out_stock, doa_stock
doa_stock   → good_stock, scrap_stock
out_stock   → (hiç)
scrap_stock → (hiç)
```
Kaynak bir sistem deposu değilse (ör. özel raf) kısıtlama uygulanmaz. `transfer_stock` bu kuralı denetler.

### 9.3 İş emri tipleri
- **SERVICE** (varsayılan): Servis Kaydı'na bağlı onarım süreci.
- **PRODUCTION**: Bir reçeteye (`ItemBOM`, `target_part_id`) bağlı yarı-mamul üretimi; Servis Kaydı gerektirmez.
- İkisi aynı `work_orders.status` sütununu paylaşır ama farklı değer kümeleri kullanır:
  - Üretim durumları: `BEKLIYOR → URETIMDE → TAMAMLANDI`.
  - Servis durumları: Beklemede/Devam Ediyor/Tamamlandı/…

### 9.4 Malzeme isteği durumu (`material_requests.status`)
Sadece **üretim** iş emirleri için: `WAITING (issued=0) → PARTIAL (0<issued<required) → ISSUED (issued≥required)`. `_compute_material_request_status` ile hesaplanır.

### 9.5 Batch / Müşteri akışı (`flow`)
Kabul edilen değerler: `Refurbish`, `Repair`, `RMA`, `Battery Replacement`. Müşteri toplu yüklemesinde zorunlu sütunlar: IMEI, Seri No, Internal ID, Cihaz Modeli, Flow, Müşteri Şikayeti, Giriş Tarihi.

### 9.6 Stok bütünlüğü
Her giriş/çıkış/transfer/üretim işlemi **tek transaction**'da: `stock` bakiyesini günceller **ve** `stock_movements`'a bir denetim satırı yazar. Bu, "ne oldu, kim yaptı, ne zaman" izini garanti eder.

---

## 10. Kimlik Doğrulama & Yetkilendirme

- **`config/auth.py`:** `bcrypt` ile parola hash/doğrulama; `PyJWT` ile token üretme/çözme fonksiyonları var (`create_access_token`, `decode_access_token`) ama masaüstü akışında **kullanılmıyor**.
- **`config/session.py`:** Singleton `SessionManager` (token/kullanıcı/rol, diske kaydetme). `DEVELOPER` rolü otomatik `Admin` sayılır.
- **Masaüstü gerçeği:** Tek auth girişi `login`'dir → kullanıcıyı bulur, `verify_password` ile bcrypt kontrolü yapar, profili döner. **JWT yok, endpoint bazlı koruma yok.** `username` yazma işlemlerine sadece **denetim/atıf** için parametre olarak geçer.
- **Tek rol kuralı backend'de:** `delete_user`, son kalan Admin'i silmeyi reddeder.

---

## 11. Bilinen Riskler / Güvenlik Notları

Bunlar mevcut durumu belgeler (kod değiştirilmedi):

1. **Endpoint yetkilendirmesi yok:** Rol kontrolü yalnızca frontend menü görünürlüğündedir. `backend.*` metodlarının hepsi köprüye bağlı herkese açıktır.
2. **Genel DB gezgini uçları:** `get_table_data` / `insert_table_data` / `export_all_tables_to_excel` tablo adını f-string ile SQL'e gömer. Şema beyaz listede ama `table_name` değil → pratikte kısıtsız DB okuma/yazma.
3. **Düz metin kimlik bilgileri:** `.env` içinde canlı PostgreSQL parolası düz metin ve depoya işlenmiş; `config/auth.py`'de sabit (hardcoded) yedek `SECRET_KEY` var.
4. **CORS `*`:** Ayrı FastAPI uygulaması (§12) tüm origin'lere açık.

---

## 12. Ayrı FastAPI REST Servisi (`api/`)

QWebChannel köprüsünden **tamamen bağımsız**, aynı `services`/`repositories`/DB yığınını kullanan klasik bir REST API:

- **`api/main.py`:** `FastAPI(title="RemaLab WMS API")`, geniş CORS, `users` + `parts` router'ları, `GET /` sağlık ucu.
- **`api/routers/parts.py`** (`/api/parts`): `GET` (arama), `POST`, `PUT/{id}`, `DELETE/{id}`.
- **`api/routers/users.py`** (`/api/users`): `GET`, `POST`, `PUT/{id}`, `DELETE/{id}`.
- **Şemalar:** Pydantic (`part_schema.py`, `user_schema.py`).
- **Nerede çalışır?** `docs/index.md`'ye göre bu API **yerelde değil**, uzak sunucuda (`10.200.246.116:8000`, Windows Task Scheduler ile kalıcı) çalışır; Swagger: `http://10.200.246.116:8000/docs` (ZeroTier ağı üzerinden). Yani mobil/web/ERP entegrasyonları için ayrı bir yüzeydir; masaüstü uygulaması bunu kullanmaz.

> **Kafa karışıklığı uyarısı:** `api/` (uzak REST API) ile `api_cache/` (masaüstünün yerel DB önbelleği) **isim benzerliğine rağmen alakasızdır.**

---

## 13. Excel İçe/Dışa Aktarma

- **`core/excel_utils.py` → `style_excel_file`:** Üretilmiş bir xlsx'i açıp "premium" görünüm uygular (koyu başlık, zebra satırlar, otomatik sütun genişliği, `freeze_panes='A2'`). Sadece **biçimlendirme** yapar.
- **Import:** `bulk_import_customers` (müşteri), `ExcelMappingModal` (frontend sütun eşleme), açılışta `_ensure_item_bom_data` → **`MioCreate.xlsx`** referans dosyasından `item_bom`/`parts` tohumlama.
- **Export:** `export_table_to_excel`, `export_all_tables_to_excel` → `~/Downloads`'a yazar, `os.startfile` ile açar. Ayrıca birçok sayfada `exportTableToExcel`.

---

## 14. Yardımcı / Bakım Scriptleri (kök dizin)

Bunlar çalışan uygulamanın parçası **değildir**; tek seferlik migrasyon/tohumlama/hata ayıklama araçlarıdır:

| Script | İş |
|---|---|
| `add_columns.py` | `warehouse.parts`'a `part_type` kolonu ekler |
| `add_imei_column.py` | `warehouse.service_records`'a `imei_number` kolonu ekler (idempotent) |
| `check_boms.py` / `check_boms_api.py` / `check_db.py` | Teşhis: BOM/DB içeriğini yazdırır |
| `cleanup.py` | `ui/` altındaki boş `setStyleSheet("")` çağrılarını temizler |
| `fix.py` / `patch.py` / `patch_bridge.py` | Kaynak dosyalara nokta yamalar (web_bridge / WorkOrders.jsx) |
| `resolve_conflicts.py` | Toplu git merge-conflict marker temizleyici |
| `truncate_and_seed.py` | Tabloları boşaltıp yeni transfer kurallarına uygun demo veri tohumlar |
| `update_part.py` | Tek seferlik `UPDATE warehouse.parts …` |

---

## 15. Yapılandırma & Ortam

| Öğe | Yer / Değer |
|---|---|
| DB bağlantısı | `.env` (`PG_HOST/PORT/DATABASE/USER/PASSWORD`) → `config/database.py` |
| Dev/Prod modu | `DEV_MODE` ortam değişkeni (1 = Vite dev sunucusu 5173; 0 = derlenmiş `dist/`) |
| QWebChannel WebSocket | Port **5174** |
| Vite dev sunucusu | Port **5173** |
| Uygulama ayarları | `~/.remalab/settings.json` (yerel dosyalar, veri klasörleri, dev mode) |
| WebEngine profili/cache | `~/.remalab/webengine_data` |
| Oturum (opsiyonel) | proje kökünde `.session` |
| Referans veri | Kök dizinde `MioCreate.xlsx` (ItemBOM tohumlama) |
| Dökümantasyon | `mkdocs.yml` + `docs/` (Material teması) |

---

## 16. Dosya → Sorumluluk Haritası (Hızlı Referans)

| Dosya / Klasör | Sorumluluk |
|---|---|
| `start.bat` | Kurulum + uygulamayı başlatma (Windows) |
| `main.py` | Masaüstü giriş noktası (pencereli) |
| `server.py` | Başsız (headless) sunucu modu |
| `core/main_window.py` | Qt pencere, WebEngine, QWebChannel + WebSocket kurulumu, Vite/statik sunucu |
| `core/web_bridge.py` | **Backend'in kalbi** — ~120 `@Slot` API metodu, iş kuralları, ham SQL migrasyonlar, cache |
| `core/excel_utils.py` | Excel biçimlendirme |
| `config/database.py` | SQLAlchemy engine/session, tembel bağlantı, `create_all`, hata dinleyici |
| `config/auth.py` | bcrypt + JWT yardımcıları |
| `config/session.py` | `SessionManager` singleton |
| `models/` | 13 SQLAlchemy modeli (FK/relationship içermez) |
| `repositories/` | Ham DB erişim katmanı (commit etmez) |
| `services/` | İş mantığı + transaction sahibi + domain istisnaları |
| `api/` | Ayrı, uzak-barındırılan FastAPI REST servisi |
| `api_cache/` | Masaüstünün yerel DB JSON önbelleği (commit'te temizlenir) |
| `frontend/src/services/api.js` | UI ↔ backend köprü sarmalayıcısı (Promise'ler) |
| `frontend/src/layouts/MainLayout.jsx` | Menü, roller, bildirimler, tema kabuğu |
| `frontend/src/pages/` | 22 ekran (modüller) |
| `frontend/src/components/` | Yeniden kullanılabilir UI parçaları |
| `frontend/src/context/ThemeContext.jsx` | Light/dark tema |

---

## 17. Uçtan Uca Örnek Akış: "İrsaliye ile parça girişi"

1. Kullanıcı **İrsaliye** sayfasında parça + lokasyon + adet + birim fiyat girer, kaydeder.
2. Frontend `api.addInboundEntry(...)` çağırır → `services/api.js` `backend.add_inbound_entry(...)`'e köprüler.
3. Python `WebBridge.add_inbound_entry` (web_bridge.py) tek transaction'da:
   - `stock` bakiyesini artırır (yoksa oluşturur),
   - `stock_movements`'a `"Inbound"` satırı yazar (`created_by`, `unit_price`, `total_cost`),
   - `commit()`.
4. Commit → `after_commit` dinleyicisi `stock.json`/`parts.json`/`critical.json` cache'ini **siler**.
5. Frontend `{"success": true}` alır; Depo/Rapor ekranları bir sonraki okumada güncel veriyi (yeniden üretilen cache veya doğrudan sorgu) görür.
6. Kritik limitin altına düşen parça varsa, MainLayout'un 60 sn'lik `getCriticalStock` yoklaması bildirim zilinde gösterir.

---

## 18. İş Emri Oluşturma Akışı (Detaylı)

### 18.0 Temel: Tek tablo, iki tür iş emri

Her şey `warehouse.work_orders` tablosunda tutulur ama `work_order_type` kolonuyla **iki farklı akış** ayrılır. İkisi aynı sütunları paylaşır, farklı durum kümeleri kullanır ve birbirini etkilemez.

| Tür | `work_order_type` | Neye bağlı? | Durum akışı |
|---|---|---|---|
| **SERVICE** (servis/onarım) | `SERVICE` (varsayılan/boş) | Bir **Servis Kaydı** (`service_records`) | Beklemede → Devam Ediyor → Tamamlandı/Başarısız/İptal |
| **PRODUCTION** (yarı mamul üretimi) | `PRODUCTION` | Bir **Reçete** (`item_bom`, `target_part_id`) | BEKLIYOR → URETIMDE → TAMAMLANDI |

### 18.1 Kullanılan arayüzler

| Arayüz (dosya) | Rolü |
|---|---|
| `pages/WorkOrders.jsx` (~3400 satır) | İş emri modülünün merkezi, sekmeli yapı. **Üretim iş emri buradan oluşturulur.** |
| `pages/ServiceRecords.jsx` | Servis kayıtları (cihaz kabul) CRUD — servis iş emrinin **girdisi**. |
| `pages/ServisOnarim.jsx` | Teknisyenin servis iş emrini işlediği ekran (oluşturmaz, **tüketir**). |
| `components/PartSelectCombobox`, `PartSupplyMenu`, `DeliverPartPopover` | Parça seçimi ve teslim/iade aksiyonları. |
| `services/api.js` | Köprü sarmalayıcı: `createWorkOrder`, `createProductionWorkOrder`, `addWorkOrderPartsBulk`. |

WorkOrders.jsx'in **görünür sekmeleri** (`TABS`): `Yarı Mamul Üretimi` · `Hızlı Tekrar Üretim` (dev) · `Malzeme Tüketimi` · `Üretim Raporu` · **`Üretim İş Emirleri`** · `IMEI Parça Takip`.

> ⚠️ **Bulgu:** `'new'` (Yeni İş Emri formu) ve `'list'` (servis iş emri listesi) sekmeleri kodda var ama **TABS listesinde yok**. `'new'` yalnızca `handleOpenForm` ile (o da yalnızca `'list'` içindeki Düzenle butonundan) açılıyor; `'list'` ise yalnızca kayıt sonrası gösteriliyor → **kapalı döngü**. Yani servis iş emri oluşturma formu görünür navigasyondan erişilemiyor (legacy görünüyor). **Şu an canlı ve erişilebilir oluşturma akışı PRODUCTION iş emridir.**

### 18.2 SERVICE iş emri akışı (kodda mevcut, UI'dan erişilemez)

1. **`ServiceRecords.jsx`** → `createServiceRecord` ile `warehouse.service_records`'a cihaz/müşteri/şikayet kaydı girilir.
2. **`WorkOrders.jsx` `'new'` formu**: `service_record_id` zorunlu dropdown (`getServiceRecords`), açıklama, atanan teknisyen (`getUsers`), öncelik, tarihler, **kaynak depo** (`getSystemLocations`), opsiyonel **kullanılan parçalar** (`getParts` + `getStockStatus`).
3. **`handleSave`** (WorkOrders.jsx:674): parça varsa önce frontend'de stok kontrolü → `api.createWorkOrder(payload)`.
4. **Backend `create_work_order`** (`web_bridge.py:2351`):
   - Parça satırları varsa **kaynak depo zorunlu**; her parça için kaynak depoda yeterli stok kontrol edilir — yetersizse **iş emri hiç oluşturulmaz**.
   - Yeterliyse her parçayı **kaynak depodan (Good/DOA Stock) → Repair Stock'a otomatik transfer** eder: `stock` bakiyeleri güncellenir + `stock_movements`'a `"İş Emri: Tamire Alındı"` (Transfer) satırı yazılır.
   - `work_orders`'a `INSERT` (varsayılan durum `Beklemede`, öncelik `Orta`), commit → cache temizlenir.
5. Başarılıysa frontend `addWorkOrderPartsBulk` ile `work_order_parts` satırlarını yazar.
6. Sonrasında **`ServisOnarim.jsx`** bu iş emrini `getWorkOrders` ile listeleyip teknisyene işletir.

**Yazılan tablolar:** `work_orders`, `stock`, `stock_movements`, `work_order_parts`.

### 18.3 PRODUCTION iş emri akışı (canlı / erişilebilir olan)

1. **`Üretim İş Emirleri` sekmesi** → "+ Yeni" → `productionWOForm` açılır.
2. Form alanları (`EMPTY_PRODUCTION_WO_FORM`): **üretilecek yarı mamul** (`target_part_id`, `getItemBOMs`/`getParts`), açıklama, öncelik, **planlanan üretim adedi** (zorunlu, >0), atanan teknisyen, departman.
3. **`handleSaveProductionWorkOrder`** (WorkOrders.jsx:1203) → `api.createProductionWorkOrder(form)`.
4. **Backend `create_production_work_order`** (`web_bridge.py:2565`):
   - `target_part_id`'nin **`item_code`'una karşılık gelen Reçete** (`item_bom WHERE parent_item_id = item_code`) aranır — **yoksa hata**, iş emri oluşmaz.
   - `work_orders`'a `INSERT` (`work_order_type='PRODUCTION'`).
   - Reçetedeki **her alt kalem** için `material_requests`'e satır: `required_quantity = bom.quantity × planlanan_adet`, `issued_quantity = 0`, `status = WAITING`.
   - **Bu aşamada stok düşülmez / transfer yapılmaz** — yalnızca malzeme talepleri açılır. Commit.
5. Frontend başarıda iş emrinin **detay panelini otomatik açar**, `fetchMaterialRequests` ile açılan talepleri gösterir.
6. Sonraki adımlar (bu akışın dışında): `issue_material_request` (malzeme teslimi) → `start/complete_production_work_order` (yaşam döngüsü) → `create_production_run` (üretim kaydı → stok işleme).

**Yazılan tablolar:** `work_orders`, `material_requests`.

> ⚠️ **Kod-belge tutarsızlığı:** `create_production_work_order` docstring'i "durum **BEKLIYOR** ile başlar" der, ama kod aslında `URETIMDE` ile açar (`web_bridge.py:2618`). Yani ayrı bir "Başlat" adımı olmadan doğrudan üretimde başlıyor.

### 18.4 Form verileri nereden geliyor?

| Alan | Kaynak API → Tablo |
|---|---|
| Servis Kaydı dropdown | `getServiceRecords` → `service_records` |
| Atanan teknisyen | `getUsers` → `users` |
| Kaynak/hedef depo | `getSystemLocations` → `locations` (kind'lı) |
| Kullanılan parçalar | `getParts` → `parts` + `getStockStatus` → `stock` |
| Üretilecek yarı mamul / Reçete | `getItemBOMs` → `item_bom` + `getParts` → `parts` |

### 18.5 Özet şeması

```
SERVICE:    service_records → [WorkOrders 'new' formu*] → create_work_order
            → (parça varsa) Good/DOA→Repair transfer → work_orders + work_order_parts
            → ServisOnarim ekranında işlenir
            (* form kodda var ama görünür sekmelerden erişilemez — legacy)

PRODUCTION: parts + item_bom(Reçete) → [WorkOrders "Üretim İş Emirleri" sekmesi]
            → create_production_work_order → work_orders(PRODUCTION)
            → her BOM satırı için material_requests(WAITING)
            → malzeme teslimi → üretim tamamlama → production_runs → stok
            (canlı/erişilebilir akış budur)
```

---

*Bu belge otomatik kod analizi ile üretilmiştir. Kod değiştikçe (özellikle `core/web_bridge.py`'deki `@Slot` metodları ve `models/`) güncel tutulması önerilir.*
