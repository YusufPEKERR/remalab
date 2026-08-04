# Hızlı Onarım Bitir — Analiz ve Tasarım Notu

> **Durum: KARARLAR ALINDI — kod yazılmadı.** Açık soruların 5'i yanıtlandı, 1'i
> beklemede. Onay verilmeden hiçbir değişiklik yapılmayacaktır.
>
> Oluşturma: 3 Ağustos 2026 · Son güncelleme: 3 Ağustos 2026 (kararlar işlendi)

---

## 1. Kaynak

İstek iki görselle iletildi.

### 1.1 El yazısı not

```
• BATARYA  ──┐
○ KAMERA   ──┴──►  HIZLI ONARIM BİTİR
+ EKRAN
+ KASA
+ L1
+ L2
+ L3
   ─────────────────────────────────────────────
   → Bu iki departman için teknisyen aldı ve
     parçalar stoktan çıktı ise, bu ekranda
     otomatik olarak onarım tamamlandı yapılacaktır.
```

### 1.2 Eski uygulamadan ekran görüntüsü

`Remalab Teknoloji Lifecycle Management Suite V5 [5.1.1.85]` → **Araçlar** menüsü →
**"BATTERY Onarımı Hızlı Bitiş"** penceresi:

| Alan | Tip |
|---|---|
| `IMEI / Seri Numara / Internal ID:` | tek satır giriş (barkod okutma) |
| `İşlem Durumu` | büyük, salt okunur log alanı |

Başka hiçbir buton yok. Akış: **barkod okut → işlem kendiliğinden çalışsın → sonucu
log alanına yaz.** Pencere başlığındaki `BATTERY` sabit değil, departman adı; eski
uygulamada her departman için ayrı pencere vardı.

---

## 2. Alınan kararlar

| # | Soru | **Karar** |
|---|---|---|
| 1 | Kapsam: iki departman mı, listenin tamamı mı? | **Sadece 2 departman: BATARYA ve KAMERA** |
| 2 | "L5" mi "L3" mü? | **L3** (`L3REPAIR`) — zaten tanımlı, bu iş için kapsam dışı |
| 3 | `BATTERY`/`CAMERA`/`CASE` grupları tanımlanacak mı? | **Gerek yok — zaten tanımlılar** (aşağıdaki düzeltmeye bakınız) |
| 4 | Aynı departmanda birden fazla onarım varsa hepsi kapansın mı? | **Hayır, hepsi kapanmasın** |
| 5 | Stok takipsiz parça tek başına yeterli mi? | **Beklemede** — öğrenilip bildirilecek |
| 6 | Tek ekran + seçici mi, departman başına ayrı mı? | **Ayrı ekranlar** |

> **Düzeltme (#3):** Bu belgenin ilk sürümünde "`BATTERY`, `CAMERA`, `CASE` görev
> grubu olarak tanımlı değil" yazıyordu. **Bu yanlıştı** — sorgu çıktısı kırpıldığı
> için ilk satırlar görülmemişti. Sistemde **17 görev grubu** var ve üçü de mevcut:
> `BATTERY` (Batarya Onarımı), `CAMERA` (Kamera Onarımı), `CASE` (Kasa Onarımı).
> İlgili görevler de doğru gruplara bağlı: `TEC_BATTERY`, `TEC_TL_BATTERY`,
> `TEC_CAMERA`, `TEC_TL_CAMERA`, `QAC_CAMERA`, `TEC_CASE`, `TEC_TL_CASE`, `QAC_CASE`.
> Yapılacak bir tanımlama yok.

---

## 3. İstenen davranış

Bir cihaz barkodu okutulduğunda, ekranın ait olduğu departmandaki onarım kayıtları
için şu iki şart sağlanıyorsa onarım **otomatik olarak "Tamamlandı" (1002)** yapılır:

1. Onarım bir **teknisyene atanmış** olmalı,
2. Onarıma ait **parçalar stoktan çıkmış** olmalı.

Şartlar sağlanmıyorsa o kayıt kapatılmaz ve sebebi `İşlem Durumu` alanına yazılır.

---

## 4. Mevcut sistemde ne var

**İş kuralı zaten yazılmış ve çalışıyor.** `WebBridge.update_repair_status` içinde,
hedef statü 1002 olduğunda tam olarak bu iki şart aranıyor:

| Şart | Davranış |
|---|---|
| Teknisyen ataması | Atama yoksa: *"Kayıt henüz bir teknisyene atanmamış"* |
| Parça stoktan çıkmış | Stok takipliyse `supply_status_code = 'Stoktan Çıktı'` şartı; stok takipsiz parçada bu şart aranmaz |

Stok takibi tipi `parts.stock_tracking_type` boşsa `part_categories`'e düşülür
(`_is_part_stock_tracked`).

Arayüzde de aynı iki şart `TechnicianRepairOperations.jsx` içindeki
`completeBlockReason` ile "Onarımı Tamamla" butonunu önden kilitliyor.

**Eksik olan iş kuralı değil, hızlı çalışan bir giriş ekranı.**

---

## 5. Kapsam

Karar #1 gereği yalnızca iki departman:

| Departman | Görev grubu kodu | `mission_groups`'ta | `repair_records`'ta kullanım |
|---|---|---|---|
| BATARYA | `BATTERY` | ✅ Batarya Onarımı | 18 kayıt |
| KAMERA | `CAMERA` | ✅ Kamera Onarımı | 7 kayıt |

El yazısındaki diğer departmanlar (EKRAN, KASA, L1, L2, L3) **bu iş için kapsam
dışı** — mevcut "Üretim Kaydını Görüntüle" ekranından tamamlanmaya devam edecekler.

---

## 6. Tasarım

### 6.1 Ekranlar

Karar #6 gereği **departman başına ayrı ekran**, eski uygulamadaki gibi. İki yeni
menü öğesi:

```
ÜRETİM TEKNİSYENİ
  ├─ Üretim Kaydını Görüntüle          (mevcut)
  ├─ BATARYA Onarımı Hızlı Bitiş       (yeni)
  └─ KAMERA Onarımı Hızlı Bitiş        (yeni)
```

Rota: `/hizli-onarim-bitir/BATTERY` ve `/hizli-onarim-bitir/CAMERA`.

> Ekranlar ayrı **görünecek** ama tek bir React bileşeni görev grubunu rotadan
> okuyacak. Aynı kodu iki kez yazmak, ileride biri düzeltilip diğeri unutulduğunda
> sessiz tutarsızlık üretir.

```
┌─ BATARYA Onarımı Hızlı Bitiş ───────────────────────┐
│  IMEI / Seri Numara / Internal ID:                  │
│  [___________________________________]  (otofokus)  │
│                                                     │
│  İşlem Durumu                                       │
│  ┌───────────────────────────────────────────────┐  │
│  │ 12:04:11  358964586438090                     │  │
│  │           ✓ iP15Bat · Ahmet Y. → Tamamlandı   │  │
│  │ 12:04:18  358964586438090                     │  │
│  │           ✗ iP15BGBLC · parça depodan çıkmamış│  │
│  │ 12:04:29  359817438156253                     │  │
│  │           ✗ BATARYA için açık onarım yok      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

Barkod okutulur → Enter → sonuç log'a eklenir → kutu temizlenir, odak kutuda kalır.
Buton yok; art arda okutmaya uygun. Log satırları renk kodlu, eskiler silinmez.

### 6.2 Kısmi kapatma (karar #4)

Bir cihazda aynı departmanda birden fazla onarım kaydı olabilir. Karar gereği
**hepsi birden kapatılmaz**; her kayıt **tek tek** değerlendirilir:

- Şartları sağlayan kayıtlar → 1002 yapılır,
- Sağlamayanlar → **olduğu gibi bırakılır**, sebebi log'a yazılır.

Yani bir cihazda 3 kayıt varsa ve 2'si hazırsa, o 2'si kapanır, 3'üncü açık kalır.
Log her kayıt için ayrı satır gösterir ki operatör neyin kaldığını görsün.

### 6.3 Backend

```
quick_complete_repair(device_ref, mission_group_code, username) -> JSON
```

1. Cihazı bul (IMEI / seri no / internal ID).
2. O cihazın verilen görev grubundaki **iptal edilmemiş ve tamamlanmamış** kayıtları al.
3. Kayıt yoksa: *"Bu cihazda &lt;departman&gt; için açık onarım yok."*
4. **Her kayıt için ayrı ayrı** mevcut 1002 şartlarını uygula.
5. Uygun olanları 1002 yap, olmayanları atla; her kayıt için sonuç satırı dön.

> **Kural tekrarı yapılmamalı.** `update_repair_status`'taki 1002 kontrolleri ortak
> bir yardımcıya çıkarılıp iki yerden de çağrılmalı. İki yerde ayrı yazılırsa zamanla
> birbirinden ayrışır — bu projede aynı hata daha önce depo listesi ile teslim
> kontrolü arasında yaşandı.

### 6.4 Yetki

Mevcut desen korunur: `_get_user_missions` + cihazın statüsünün gerektirdiği görev.
Ek olarak operatörün **o departmana** yetkisi kontrol edilmeli — yoksa bir batarya
teknisyeni kamera onarımlarını kapatabilir. Kontrol `mission_groups` → `missions`
bağı üzerinden yapılır (`TEC_BATTERY` → `BATTERY`).

---

## 7. Kalan açık konu

**Soru #5 — stok takipsiz parçalar.** Mevcut kural, stok takipsiz parçada "stoktan
çıktı" şartını aramıyor; yani böyle bir parça tek başına onarımın tamamlanmasına
engel olmuyor (ESMA #2 gereği). Hızlı Bitiş ekranının da aynı davranması bekleniyor
ama bu teyit edilmedi.

**Teyit gelene kadar varsayım:** mevcut davranış aynen korunur. Farklı olması
gerekiyorsa hem bu ekran hem `update_repair_status` birlikte değişmeli — ikisi ayrı
davranırsa aynı onarım bir ekrandan kapanıp diğerinden kapanmaz.

---

## 8. Yapılacaklar (onay sonrası)

- [ ] 1002 şartlarının ortak yardımcıya çıkarılması (kural tekrarını önlemek için)
- [ ] `quick_complete_repair` metodu — kayıt bazlı kısmi kapatma
- [ ] Departman bazlı yetki kontrolü
- [ ] `HizliOnarimBitir` bileşeni (görev grubunu rotadan okur)
- [ ] İki rota + iki menü öğesi (BATARYA, KAMERA)
- [ ] Soru #5'in yanıtına göre stok takipsiz davranışının teyidi

~~Görev gruplarının tanımlanması~~ — gerekmiyor, zaten tanımlılar.
