# Geliştirme Raporu — YusufPEKERR

**Dönem:** 31 Temmuz 2026 – 6 Ağustos 2026
**Kapsam:** `git log --author=Yusuf` ile bu tarih aralığında `remalab` deposuna düşen tüm commit'ler

---

## Özet

| | |
|---|---|
| Toplam commit | **70** |
| Eklenen satır | **8.867** |
| Silinen satır | **31.560** |
| Aktif gün | 4 (3–6 Ağustos) |
| İlk commit | 3 Ağustos 13:34 — `413d927` |
| Son commit | 6 Ağustos 15:47 — `72defd3` |

31 Temmuz – 2 Ağustos arasında bu geliştiriciye ait commit **yoktur**; çalışma 3 Ağustos öğleden sonra başlamıştır.

### Günlük dağılım

| Tarih | Commit | Ana odak |
|---|---|---|
| 3 Ağustos | 24 | Android sarmalayıcı, macOS derleme zinciri, DGD modülü |
| 4 Ağustos | 20 | Parça Teslim yeniden tasarımı, parça geri alma, performans |
| 5 Ağustos | 11 | Müşteri Hedef Fiyat Matrisi, Batch Girişi düzeltmeleri |
| 6 Ağustos | 15 | Hedef fiyat limitinin karar akışına bağlanması, İrsaliye stok çıkışı |

### En çok dokunulan dosyalar

| Dosya | Commit | Satır |
|---|---|---|
| `core/web_bridge.py` | 24 | +2.890 / −3.325 |
| `frontend/src/services/api.js` | 12 | +386 / −1.131 |
| `frontend/src/pages/ParcaTeslim.jsx` | 5 | +897 / −744 |
| `frontend/src/pages/CustomerPriceMatrix.jsx` | 4 | +792 / −110 |
| `mac/build_mac_app.sh` | 14 | +115 / −79 |
| `frontend/src/components/DemontajRepairPanel.jsx` | 7 | +174 / −14 |
| `frontend/src/pages/TechnicianRepairOperations.jsx` | 6 | +208 / −115 |

> Silinen satırın eklenenden yüksek olması beklenen bir sonuçtur: `Parts.jsx`, `Irsaliye.jsx`, `DataManagement.jsx`, `Products.jsx` gibi sayfalarda büyük sadeleştirme/yeniden yazım yapılmış, ayrıca üretilmiş `frontend/dist` varlıkları her derlemede yenilenmiştir.

---

## 1. Müşteri Fiyatlandırma Modülü

Dönemin en kapsamlı işi. İki ayrı ama bağlantılı matris kurulmuştur.

### 1.1 Müşteri Fiyat Matrisi (parça bazlı satış fiyatı)

- **Yeni sayfa:** `frontend/src/pages/CustomerPriceMatrix.jsx`
- **Yeni model:** `models/customer_item_price.py` → `warehouse.customer_item_prices`
- **Kural:** bir parçanın müşteriye özel fiyatı varsa o, yoksa `warehouse.item.satis` kullanılır.

Eklenen köprü metotları:

```
get_price_matrix(brand, category, model, product_type)
get_price_matrix_brands / _categories / _models / _product_types / _customers / _items
get_effective_price(item_code, customer_code)
get_prices_for_items(item_codes_csv, customer_code)     ← toplu okuma, N+1 çağrıyı bitirir
save_price_matrix_batch(rows_json, username)
bulk_import_price_matrix(rows_json, username)           ← Excel içe aktarma
```

`get_prices_for_items` sayesinde Demontaj ekranındaki teklif tablosu parça başına ayrı çağrı yapmak yerine tüm fiyatları tek istekte çeker.

### 1.2 Müşteri Hedef Fiyat Matrisi (onarım bütçe limiti)

- **Yeni sayfa:** `frontend/src/pages/CustomerTargetPriceMatrix.jsx`
- **Yeni model:** `models/customer_target_price.py` → `warehouse.customer_target_prices`
- **Anahtar:** müşteri + ürün ailesi + ekran testi sonucu + güç testi sonucu → hedef fiyat

Eklenen köprü metotları:

```
get_customer_target_prices(customer_code)
create_customer_target_price(...) / update_customer_target_price(...) / delete_customer_target_price(...)
get_target_price_customers / _brands / _models
bulk_import_customer_target_prices(rows_json, username)
```

Marka ve ürün tipi bilgisi `product_family_code`'dan türetilir; Müşteri Fiyat Matrisi ile aynı yardımcılar kullanıldığı için iki ekranın marka/model listeleri tutarlı kalır.

### 1.3 Limitin karar akışına bağlanması (6 Ağustos)

Matris yalnızca veri girişi olarak kalmamış, Demontaj kararına bağlanmıştır:

- `_compute_dismantle_decision(db, imei, entry)` — **saf karar hesabı**, statü değiştirmez. Kategori onayı + hedef fiyat limitini birlikte değerlendirip hedef statüyü (109 Üretime Aktar / 106 Müşteri Onayı) döner. Hem `submit_dismantle_decision` hem `add_repair_record`'ın yeniden-karar dalı bu tek fonksiyonu çağırır, kural iki yerde ayrışmaz.
- `get_dismantle_decision_preview(imei)` — aynı hesabı **yazma yapmadan** ekrana açar. Demontaj paneli her onarım ekleme/silme sonrası çağırıp karar butonunu (Üretime Aktar / Müşteri Onayı Al) ve toplam/limit rozetini anlık günceller.
- `_get_effective_price(db, item_code, customer_code)` — `get_effective_price` Slot'unun oturum paylaşan iç sürümü; limit kontrolü için toplam parça tutarını hesaplar.
- Kategori onaylı olsa bile toplam tutar limiti aşarsa karar **zorla** Müşteri Onayına çevrilir.
- Kural bulunamazsa `DEFAULT_TARGET_PRICE = 9999` varsayılanı devreye girer.

İlgili commit'ler: `6ecb486`, `2f5f312`, `1e9d00f`, `72defd3`.

---

## 2. DGD (Demontaj Gerektirmeyen Durum) Modülü

- **Yeni sayfa:** `frontend/src/pages/FlowDgdMapping.jsx`
- **Yeni model:** `models/flow_dgd_mapping.py` → akış (flow) ↔ DGD işçilik kalemi eşlemesi
- **Köprü:** `get_flow_dgd_mappings`, `create_flow_dgd_mapping`, `update_flow_dgd_mapping`, `delete_flow_dgd_mapping`

Akışa göre otomatik DGD işçilik satırı eklenmesi, `apply_dgd_return(device_ref, username)` ile aktif DGD kayıtlarının iade işçiliğine (`DGDDEC`) dönüştürülmesi ve `toggle_dgd_repair_team(repair_id, username)` ile DGD satırının onarım takımı arasında taşınması bu modülle geldi.

Ana commit: `6e1f9a3` — *"DGD modulu, Musteri Fiyat Matrisi ve arayuz guncellemeleri"*.

---

## 3. Parça Teslim Ekranı — Yeniden Tasarım ve Parça Geri Alma

4 Ağustos'un tamamı bu ekrana ayrılmış; `ParcaTeslim.jsx` beş commit'te +897 / −744 satır değişmiş.

**Arayüz sadeleştirmesi (adım adım):**

1. `3940488` — teslim edilebilir / teslim edilmiş parçalar sekmeli tek kartta birleştirildi
2. `74abb74` — sekmeler kaldırıldı, satır içi "Teslim Edildi" durumu ve "Parçayı Geri Al" butonuyla **tek liste**ye indirildi
3. `e5f057f` — "Depo/Teslim" kartı ile "Cihaz Parçaları" kartı tek kontrol paneline birleştirildi
4. `e08e0c4` — seçili parça kutusu ayrı bir blok olmaktan çıkıp liste satırının içine alındı

**İşlevsel eklemeler:**

- `915dfc4` — **Parçayı Geri Alma**: teslim edilmiş parçanın Good Stock veya DOA Stock'a iade edilmesi (`return_delivered_part`)
- `301f0a9` — DGD işçilik kalemleri ve stok takipsiz kalemler Parça Teslim listesinden elendi
- `22cbe9c` — `return_delivered_part` içindeki UUID→int dönüşüm hatası giderildi
- `get_deliverable_parts_for_device`, `get_delivered_parts_for_device` metotları eklendi

Ayrıca **Cihaz İade Prosedürü** (`execute_device_return`) ve iptal koruması (`_repair_cancellation_blocker`) bu dönemde yazıldı: stok takipli bir parça hâlâ "Stoktan Çıktı" durumundayken cihaz iadesi tamamen reddedilir, parçanın önce depoya dönmesi zorunludur.

---

## 4. Platform ve Dağıtım

### 4.1 Android sarmalayıcı (yeni)

`413d927` ile `android/` dizini sıfırdan oluşturuldu — 5 Java sınıfı, 4 layout, 10 vektör ikon, `sites.json` site tanımları, `build_apk.bat`. Özellikler: çoklu site tanımı ve site ayarları ekranı, iki parmak hareketi, üst barın otomatik gizlenmesi.

### 4.2 macOS derleme zinciri

`mac/build_mac_app.sh` 14 commit'te elden geçirildi. Çözülen sorunlar:

- **LaunchServices Error −10661** — boşluklu paket adı yerine `ERPWebApp` kullanıldı (`f57c9ec`, `bcee923`)
- **Intel A1708 desteği** — PyInstaller'a `--target-architecture x86_64`, Intel Homebrew Python'u ile saf x86_64 PyQt6 wheel üretimi (`95f01cb`, `1e727f1`, `3438234`)
- **QtWebEngine kararlılığı** — `AA_ShareOpenGLContexts`, Chromium bayrakları, `QtWebEngineProcess` için 755 izinleri, çökme günlüğü yazıcı (`6b9c91a`, `e30b4ad`, `a2309f1`)
- **Paketleme** — `--collect-all` / `--hidden-import` bayrakları, ICNS dönüşüm hatasına yol açan PNG `--icon` bayrağının kaldırılması, arşivleme için `ditto`
- **CI** — `.github/workflows/build_mac.yml` eklendi; `macos-13` etiketi `macos-15-intel` ile değiştirildi (`541146c`)

### 4.3 Sunucu ve güncelleme altyapısı

- `00b19c8` — `server.py` çalışırken 5174 portunu tutan zombi Python süreçlerini otomatik temizliyor
- `9dc6093` — `qwebchannel.js` yükleme ve tarayıcı bağlantısı takılma sorunu giderildi
- `58eb647` — zararsız socket timeout günlükleri filtrelendi
- `e0357cf` — `update.bat` artık açıkça `origin/main`'i fetch edip reset ediyor
- `5bc996f` — **frontend varlık uyuşmazlığı için kalıcı kendi kendini onarma**: içerik-hash'li chunk'lar eskidiğinde uygulama 404 alıp boş açılmak yerine kendini toparlıyor (`core/main_window.py` +89 satır)
- `d937d29` — varsayılan ERP sunucu adresi Windows / Mac / Android uygulamalarında `http://10.200.246.238` olarak birleştirildi
- `79bcf0e` — Mac'te üst araç çubuğu varsayılan gizli, kısayolla açılıp kapanıyor

---

## 5. Performans

`c7758d6` — Müşteri Fiyat Matrisi'nin yavaşlığı ve `get_critical_stock` önbellek hatası giderildi, eksik indeksler eklendi:

```sql
idx_product_bom_node_parent          (parent_product_code)
idx_product_bom_node_parent_lower    (LOWER(TRIM(parent_product_code)))
idx_product_bom_node_child           (child_item_code)
idx_parts_brand_upper                (UPPER(brand))
idx_parts_item_category              (item_category)
```

---

## 6. Toplu Veri Aktarımı (Excel)

Veri Yönetimi tarafına eklenen toplu içe aktarma metotları:

```
bulk_import_parts / bulk_import_products / bulk_import_product_bom
bulk_import_inbound_entries / bulk_process_batch_entries
bulk_import_price_matrix / bulk_import_customer_target_prices
bulk_insert_table_data(schema, table_name, rows_json)
```

`350aa12` ve `6e8163f` ile Batch Girişi ve İrsaliye tarafındaki Excel içe aktarma akışları yeniden yazıldı: eksik alanlı satırlar sessizce atlanmak yerine toplanıp kullanıcıya hata listesi olarak gösteriliyor (`importing` / `importErrors` durumları).

---

## 7. Diğer Ekran Düzeltmeleri

| Commit | Ekran | Değişiklik |
|---|---|---|
| `c038f06` | İrsaliye | Stok Çıkışı Yap modalına **Kaynak Depo** ve **Hedef Depo** seçimleri eklendi |
| `2c75d6a` | İrsaliye | Çıkış modalinde Kaynak Depo yerine Hedef Depo gösterilmesi düzeltildi |
| `d9c60c9` | Batch Girişi | `setAutoFilledMessage` ReferenceError giderildi |
| `626e660` | Batch Girişi | Model seçimi combobox'a çevrildi |
| `872a779` | Üretim Kaydı | Teknisyen onarım operasyonları ve köprü güncellemeleri |
| `4c03291` | Altyapı | `web_bridge.py` için `sys.path` yedeği — `config` modülü çözümleme hatası |
| `fddd1be` | Altyapı | `core/web_bridge.py` içindeki çift başlık SyntaxError'u |

Ayrıca `open_device_for_dismantle(imei, username)` ile cihazın demontaja açılması, `add_outbound_entry(...)` ile hedef lokasyonlu stok çıkışı eklendi.

---

## Notlar

- Bu rapor yalnızca commit geçmişinden üretilmiştir; kod incelemesi ya da test sonucu içermez.
- `frontend/dist` altındaki değişiklikler derleme çıktısıdır, elle yazılmış kod değildir (26 commit'te güncellenmiş).
- Aynı dosyalarda aynı dönemde başka geliştiriciler de çalışmıştır; burada yalnızca `YusufPEKERR` imzalı commit'ler listelenmiştir.
