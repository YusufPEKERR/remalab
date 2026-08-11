import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Package, Wrench, CheckCircle, AlertTriangle, Pencil, Ban, X, User, ArrowLeftRight, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../services/api";
import PartSelectCombobox from "./PartSelectCombobox";
import { mevcutParcaSiniflari, mevcutParcaKodlari, parcaEngeli } from "../constants/parcaCakismaKurallari";
import EtiketYazdirModal from "./EtiketYazdirModal";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

// ─── DEMONTAJ TEKNİSYENİ ÖZEL PANELİ ─────────────────────────────────
// Eski "Remalab Lifecycle Management Suite" masaüstü uygulamasının "Demontaj" ekranına
// (bkz. proje geçmişi) benzer, TEC_DISMANTLE rolüne özel Servis Onarımları görünümü.
export default function DemontajRepairPanel({ device, repairs, hasAccess, statusAllowsParts = true, statusLabel = "", missionGroups, onRefresh, showNotif }) {
  const [parts, setParts] = useState([]);
  const [partsWarning, setPartsWarning] = useState(null);
  const [itemFaults, setItemFaults] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [testDetectedParts, setTestDetectedParts] = useState([]);
  const [loadingTestParts, setLoadingTestParts] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState("");
  const [faultCode, setFaultCode] = useState("");
  const [missionGroupCode, setMissionGroupCode] = useState("");
  const [availableMissionCodes, setAvailableMissionCodes] = useState([]);
  const [warrantyCode, setWarrantyCode] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [returningDgd, setReturningDgd] = useState(false);
  const [togglingDgdId, setTogglingDgdId] = useState(null);
  const [partPrices, setPartPrices] = useState({}); // { [item_code]: price } - Müşteri Fiyat Matrisi
  // İşçilik artık parça başına sabit bir tarifeden (customer_labour_prices) okunmuyor;
  // seviye modelinden, onarım kaydı bazında geliyor - bkz. iscilikSatirlari.
  const [editingRepairId, setEditingRepairId] = useState(null);
  const [deletingRepairId, setDeletingRepairId] = useState(null);
  const editingRepairIdRef = useRef(null);
  const pendingEditRef = useRef(null); // { faultCode, missionGroupCode, warrantyCode }
  useEffect(() => { editingRepairIdRef.current = editingRepairId; }, [editingRepairId]);

  // Tablodan tıklanarak seçilen satır. "PARÇA EKLE" bu satırın onarımını hedef alır.
  const [selectedRepairId, setSelectedRepairId] = useState(null);
  // Parça barkod etiketi. Ayrı buton ve soru YOK: karar butonu ("Üretime Aktar"
  // ya da "Müşteri Onayı Alınacak") başarılı olur olmaz etiketler doğrudan
  // varsayılan yazıcıya basılır.
  const [etiketBas, setEtiketBas] = useState(false);
  // Seçili onarıma parça ekleme modu: { code, name }. Doluyken Onarım Takımı sabitlenir,
  // eklenen parça YENİ onarım açmaz, aynı görev grubuna ikinci bir satır olarak yazılır.
  const [addToGroup, setAddToGroup] = useState(null);
  const addToGroupRef = useRef(null);
  useEffect(() => { addToGroupRef.current = addToGroup; }, [addToGroup]);

  // Ücret tipi (Ücretli/Ücretsiz Onarım) referans listesi (cihazdan bağımsız) mount'ta bir kez çekilir.
  useEffect(() => {
    api.getRepairItemWarranties().then(res => { if (res && res.success) setWarranties(res.warranties || []); });
  }, []);

  // Akış Durumu (Flow) RMA olan cihazlarda Ücretli/Ücretsiz seçimi kullanıcıya bırakılır;
  // diğer tüm akışlarda otomatik "Ücretli" seçilir ve değiştirilemez.
  const isRmaFlow = device?.customerRequest === "To RMA";
  useEffect(() => {
    if (isRmaFlow) return;
    const paidWarranty = warranties.find(w => w.is_paid_for);
    setWarrantyCode(paidWarranty ? paidWarranty.code : "OOW");
  }, [isRmaFlow, warranties]);

  // Parça listesi cihaza özel: hangi marka/model telefon arandıysa sadece o cihazın
  // reçetesindeki (warehouse.product_bom_node - Product Bom sayfasıyla aynı kaynak)
  // parçalar getirilir - bkz. WebBridge.get_parts_for_device. Aynı kategoriden birden fazla
  // parça varsa sadece bir tanesi gösterilir (liste item_category, item_code sıralı geldiğinden
  // her kategorinin ilk kodu seçilir). Reçete hiç girilmemişse backend bir "warning" döner.
  useEffect(() => {
    if (!device?.model) { setParts([]); setPartsWarning(null); return; }
    api.getPartsForDevice(device.model).then(res => {
      if (!res || !res.success) { setParts([]); setPartsWarning(null); return; }
      setPartsWarning(res.warning || null);
      const seenCategories = new Set();
      const deduped = [];
      for (const p of (res.parts || [])) {
        const cat = p.item_category || p.part_category || '';
        if (seenCategories.has(cat)) continue;
        seenCategories.add(cat);
        deduped.push(p);
      }
      setParts(deduped);
    });
  }, [device?.model]);

  const selectedPart = parts.find(p => String(p.id) === String(selectedPartId));
  const selectedItemCategory = selectedPart?.item_category || "";

  // Arıza Tespiti seçenekleri, seçilen parçanın kategorisine göre filtrelenir
  // (warehouse.item_fault.item_category - bkz. WebBridge.get_item_faults_by_category).
  // Düzenleme modunda (bir satır Düzenle ile açıldıysa) o satırın mevcut arıza tespiti
  // değeri korunur, sıfırlanmaz - bkz. handleEditRow/pendingEditRef.
  useEffect(() => {
    if (!selectedItemCategory) { setItemFaults([]); setFaultCode(""); return; }
    api.getItemFaultsByCategory(selectedItemCategory).then(res => {
      setItemFaults(res && res.success ? (res.item_faults || []) : []);
      const pending = pendingEditRef.current;
      if (pending && pending.faultCode !== undefined) {
        setFaultCode(pending.faultCode);
      } else if (!editingRepairIdRef.current) {
        setFaultCode("");
      }
    });
  }, [selectedItemCategory]);

  // Onarım Takımı dropdown'u, seçilen parçanın kategorisine göre item_category_mission'da
  // tanımlı departmanlarla sınırlanır (kategori için hiç tanım yoksa tüm departmanlara geri
  // düşülür). Kategoriye özel uzman ekip (varsa) ilk değer olarak otomatik seçilir, kullanıcı
  // isterse bu daraltılmış listeden başka birini seçebilir. Düzenleme modunda otomatik öneri
  // devre dışı bırakılır, satırın mevcut takımı korunur.
  useEffect(() => {
    if (!selectedItemCategory) {
      setAvailableMissionCodes([]);
      // Parça ekleme modunda grup seçili onarımdan gelir; parça temizlense de korunur.
      if (!addToGroupRef.current) setMissionGroupCode("");
      return;
    }
    api.getMissionsForItemCategory(selectedItemCategory).then(res => {
      setAvailableMissionCodes(res && res.success ? (res.mission_codes || []) : []);
    });
    const pending = pendingEditRef.current;
    if (pending && pending.missionGroupCode !== undefined) {
      setMissionGroupCode(pending.missionGroupCode);
      if (pending.warrantyCode !== undefined) setWarrantyCode(pending.warrantyCode);
      pendingEditRef.current = null;
    } else if (addToGroupRef.current) {
      // Kategoriye göre otomatik takım önerisi bu modda devre dışı - grup sabit.
      setMissionGroupCode(addToGroupRef.current.code);
    } else if (!editingRepairIdRef.current) {
      setMissionGroupCode("");
      api.getMissionForItemCategory(selectedItemCategory).then(res => {
        if (res && res.success && res.mission_code) setMissionGroupCode(res.mission_code);
      });
    }
  }, [selectedItemCategory]);

  const filteredMissionGroups = availableMissionCodes.length > 0
    ? missionGroups.filter(mg => availableMissionCodes.includes(mg.code))
    : missionGroups;

  // Test aşamasında (QAC) tespit edilen, planlı parçalar — cihaz değiştikçe yeniden çekilir.
  // QAC test ekranı henüz olmadığından bu liste şu an her zaman boş döner.
  useEffect(() => {
    if (!device?.imei) { setTestDetectedParts([]); return; }
    setLoadingTestParts(true);
    api.getTestDetectedParts(device.imei).then(res => {
      setTestDetectedParts(res && res.success ? (res.parts || []) : []);
      setLoadingTestParts(false);
    });
  }, [device?.imei]);

  const resetToolbar = useCallback(() => {
    setSelectedPartId(""); setFaultCode(""); setMissionGroupCode(""); setDescription("");
    setEditingRepairId(null);
    setAddToGroup(null);
    addToGroupRef.current = null; // effect'i beklemeden temizle, aksi halde bir sonraki
                                  // kategori değişiminde eski grup geri yazılırdı
    if (isRmaFlow) setWarrantyCode("");
  }, [isRmaFlow]);

  // "PARÇA EKLE": seçili satırın onarımına ek parça girme moduna geçer.
  const selectedRepair = repairs.find(r => r.id === selectedRepairId) || null;
  const handleStartAddPart = useCallback(() => {
    if (!selectedRepair || selectedRepair.isCancelled) return;
    resetToolbar();
    const grp = { code: selectedRepair.missionGroupCode || "", name: selectedRepair.missionGroup || selectedRepair.missionGroupCode || "" };
    setAddToGroup(grp);
    addToGroupRef.current = grp;
    setMissionGroupCode(grp.code);
  }, [selectedRepair, resetToolbar]);

  const handleAddRow = useCallback(async () => {
    if (!device || !faultCode || !missionGroupCode || adding) return;
    if (!statusAllowsParts) {
      showNotif("warning", "Statü Uygun Değil", "Bu cihaz L1 aşamasında olmadığı için parça eklenemez/güncellenemez.");
      return;
    }
    setAdding(true);
    const selectedPart = parts.find(p => String(p.id) === String(selectedPartId));
    const username = getCurrentUser()?.username;

    const res = editingRepairId
      ? await api.updateRepairRecord(
          editingRepairId, missionGroupCode, warrantyCode, description, username,
          selectedPart?.item_code || "", faultCode, ""
        )
      : await api.addRepairRecord(
          device.workOrderId || device.imei, missionGroupCode, warrantyCode, description, username,
          selectedPart?.item_code || "", faultCode, "", "dismantle"
        );

    setAdding(false);
    if (!res || !res.success) {
      showNotif("error", editingRepairId ? "Güncellenemedi" : "Eklenemedi", res?.message || "İşlem başarısız oldu.");
      return;
    }
    await onRefresh();
    const wasEditing = !!editingRepairId;
    resetToolbar();
    showNotif("success", wasEditing ? "Onarım Güncellendi" : "Parça Eklendi", selectedPart ? (selectedPart.name || selectedPart.item_code) : "Onarım kaydı işlendi.");
  }, [device, missionGroupCode, faultCode, warrantyCode, description, selectedPartId, parts, adding, editingRepairId, statusAllowsParts, onRefresh, showNotif, resetToolbar]);

  // Teklif Parçaları listesindeki bir satırın Düzenle butonu: toolbar'ı (Parça/Arıza
  // Tespiti/Onarım Takımı/Ücret Tipi/Açıklama) satırın mevcut değerleriyle doldurur,
  // EKLE butonu GÜNCELLE'ye döner. Kategori değişince tetiklenen effect'ler faultCode/
  // missionGroupCode'u pendingEditRef üzerinden bu değerlerle geri yükler.
  const handleEditRow = useCallback((repair) => {
    const part = parts.find(p => p.item_code === repair.partItemCode);
    pendingEditRef.current = {
      faultCode: repair.faultCode || "",
      missionGroupCode: repair.missionGroupCode || "",
      warrantyCode: repair.chargeType === "FREE" ? "IW" : "OOW",
    };
    setEditingRepairId(repair.id);
    setDescription(repair.notes && repair.notes !== "N/A" ? repair.notes : "");
    setSelectedPartId(part ? part.id : "");
  }, [parts]);

  // Onarım kaydı hiçbir zaman gerçekten silinmez - repair_result_type_code=1003
  // ("Onarım İptal Edildi") ile işaretlenir, listede "İptal Edildi" rozetiyle görünmeye
  // devam eder. Aynı kategoriye tekrar eklenen onarım her zaman yeni bir repair id alır.
  //
  // TEK KAYIT KAPSAMI. Eskiden updateRepairStatus(1003) çağrılıyordu; o slot onarımı
  // BÜTÜN olarak işler (aynı cihaz + aynı görev grubundaki tüm açık satırlar), yani
  // tek bir parçayı silmek isterken grubun tamamı kapanıyordu. Üretim Kaydını Görüntüle
  // ekranı da aynı sebeple cancelRepairPart'a geçirildi - iki ekran aynı davranmalı.
  // cancel_repair_part ayrıca DGD'yi ve tamamlanmış onarımı korur.
  const handleCancelRow = useCallback(async (repairId) => {
    setDeletingRepairId(repairId);
    const res = await api.cancelRepairPart(repairId, getCurrentUser()?.username);
    setDeletingRepairId(null);
    if (!res || !res.success) {
      showNotif("error", "Silinemedi", res?.message || "İşlem başarısız oldu.");
      return;
    }
    if (editingRepairId === repairId) resetToolbar();
    await onRefresh();
    showNotif("success", "Parça Silindi", "Kayıt listede iptal edildi olarak görünmeye devam edecek.");
  }, [editingRepairId, onRefresh, showNotif, resetToolbar]);

  // Onarım Takımları — repairs içindeki benzersiz, iptal edilmemiş görev gruplarından türetilir.
  const activeMissionGroupCodes = new Set(repairs.filter(r => !r.isCancelled).map(r => r.missionGroupCode).filter(Boolean));

  // DGD işçilik satırı: cihaz Üretime Aktar'da açılınca Flow'a göre otomatik bir işçilik
  // satırı ekleniyor (bkz. WebBridge.open_device_for_dismantle) ve bu satır DISMANTLE
  // takımıyla oluşuyor - bu yüzden her cihazda hep "Demontaj" görünüyordu. Sahada bu iş
  // L1'e ait olduğu için L1 gösterilir.
  //
  // KOD ile ad AYRI alanlarda geliyor: get_repair_operations_by_imei
  //   missionGroupCode = department_mission            -> "DISMANTLE"
  //   missionGroup     = mission_groups.short_name     -> "Demontaj"
  // Karşılaştırma KOD üzerinden yapılmalı; ada bakılırsa hiçbir zaman eşleşmez.
  //
  // DİKKAT: yalnızca GÖRÜNEN ad değişir. Kayıttaki department_mission='DISMANTLE' olduğu
  // gibi kalır, dolayısıyla onarım havuzu yönlendirmesi ve tamamlama kuralları etkilenmez.
  // Görev grubunun ekranda görünen adı. DGD (DISMANTLE) kendi takımı olmayan bir
  // işçilik kaydıdır; cihaz L1'deyse "L1 Onarımı", L2'deyse "L2 Onarımı" görünür.
  // Bu karar BACKEND'de veriliyor (get_repair_operations_by_imei → missionGroup);
  // burada ayrıca hesaplanmaz, yoksa iki ayrı doğruluk kaynağı olur.
  const takimAdi = (kod, hazirAd) => {
    if (hazirAd) return hazirAd;
    if (!kod) return "";
    const mg = missionGroups.find(m => m.code === kod);
    return mg ? mg.short_name : kod;
  };

  // Cihazın Flow'unun (Akış Durumu) onayladığı parça kategorileri (warehouse.
  // service_request_item_category.is_customer_approved) - bkz. WebBridge.get_approved_categories_for_flow.
  const [approvedCategories, setApprovedCategories] = useState([]);
  // Bu akışta müşteri onayı hiç aranmıyor mu? Karar BACKEND'den gelir; burada ayrıca
  // hesaplanmıyor (aşağıdaki açıklamaya bakın).
  const [noApprovalNeeded, setNoApprovalNeeded] = useState(false);
  useEffect(() => {
    if (!device?.customerRequest) { setApprovedCategories([]); setNoApprovalNeeded(false); return; }
    api.getApprovedCategoriesForFlow(device.customerRequest).then(res => {
      setApprovedCategories(res && res.success ? (res.categories || []) : []);
      setNoApprovalNeeded(!!(res && res.success && res.noApprovalNeeded));
    });
  }, [device?.customerRequest]);

  // Eklenen onarımların kategorilerini, cihazın Flow'unun onayladığı kategorilerle karşılaştırıp
  // "Üretime Aktar" mı "Müşteri Onayı Alınacak" mı gerektiğini anlık önizler — gerçek karar
  // submit_dismantle_decision içinde backend'de yeniden ve otoriter şekilde hesaplanır.
  //
  // "Müşteri onayı aranmayan akış" listesi burada TEKRAR EDİLMEZ. Eskiden edilirdi ve
  // ham flow değeriyle ("Refurbish") kod listesini ("to refurbish") karşılaştırdığı için
  // 7644 cihazın tamamı yanlışlıkla "Müşteri Onayı Alınacak" görünüyordu. Karar artık
  // tek kaynaktan, backend'in döndüğü noApprovalNeeded alanından geliyor.
  const isNoApprovalFlow = noApprovalNeeded;
  const approvedCategoriesLower = new Set(approvedCategories.map(c => c.toLowerCase()));
  // İptal edilen onarımlar Üretime Aktar/Müşteri Onayı önizlemesine dahil edilmez -
  // backend'deki submit_dismantle_decision de aynı şekilde is_cancelled kayıtları hariç tutar.
  const activeRepairs = repairs.filter(r => !r.isCancelled);
  const hasRepairs = activeRepairs.length > 0;
  // NOT: Eskiden "cihazda yalnızca DGD varsa Üretime Aktar yapılamaz" kuralı vardı.
  // Kaldırıldı - parça takılmayan, yalnızca DGD işçiliği doğan cihaz da üretime
  // aktarılabiliyor. Böyle bir cihazda parça etiketi basılmaz; yalnızca kontrol
  // etiketleri + "x" basılır ve DGD kontrol etiketinde L1 olarak görünür.
  const allPlanned = hasRepairs && (isNoApprovalFlow || activeRepairs.every(r => r.itemCategory && approvedCategoriesLower.has(r.itemCategory.toLowerCase())));

  // Çakışan parçalar listede kilitlenir (bkz. parcaCakismaKurallari.js). Backend
  // (add_repair_record) aynı kuralı ayrıca uygular; burası yalnızca kullanıcı seçmeden
  // önce görsün diye.
  const parcaSiniflari = useMemo(
    () => mevcutParcaSiniflari(activeRepairs.map(r => r.itemCategory).filter(Boolean)),
    [repairs]  // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Cihaza zaten girilmiş parça kodları — "aynı parça iki kez eklenemez" kuralının
  // ekran karşılığı. İptal edilmiş kayıtlar sayılmaz, o parça yeniden eklenebilir.
  const ekliKodlar = useMemo(
    () => mevcutParcaKodlari(activeRepairs.map(r => r.partItemCode).filter(Boolean)),
    [repairs]  // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [decisionPreview, setDecisionPreview] = useState(null);

  useEffect(() => {
    if (!device?.imei) return;
    api.getDismantleDecisionPreview(device.imei).then(res => {
      if (res && res.success) {
        setDecisionPreview(res);
      }
    });
  }, [device?.imei, repairs]);

  const isPriceExceeded = !!decisionPreview?.price_limit_exceeded;
  const isProductionReady = decisionPreview ? (decisionPreview.decision === "URETIME_AKTAR") : (allPlanned && !isPriceExceeded);

  // Teklif Parçaları tablosundaki "Fiyat" sütunu: görünen tüm parça kodları için Müşteri
  // Fiyat Matrisi fiyatını TEK seferde çeker (get_prices_for_items), parça başına ayrı
  // çağrı yapmaz.
  useEffect(() => {
    const codes = Array.from(new Set(repairs.map(r => r.partItemCode).filter(Boolean)));
    if (codes.length === 0 || !device?.customerNo) return;
    api.getPricesForItems(codes, device.customerNo).then(res => {
      if (res && res.success) {
        setPartPrices(prev => ({ ...prev, ...res.prices }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairs, device?.customerNo]);

  // İşçilik Fiyatı sütunu SEVİYE MODELİNDEN gelir, parça başına sabit bir tarifeden değil:
  // ilk parça eklenen parçalar içindeki EN BASKIN seviyenin fiyatını (customer_level_labour_prices),
  // 2.-5. parça '1-5', 6. ve sonrası '6+' tarifesini alır (customer_partorder_labour_prices).
  // Bu yüzden değer parça KODUNA değil ONARIM KAYDINA bağlıdır - aynı parça başka cihazda,
  // hatta aynı cihazda başka sırada, başka işçilik doğurur. Hesabı backend yapar
  // (_cihaz_fatura_hesabi); ekran tekrar hesaplamaz ki hedef fiyat kontrolüyle aynı
  // rakamı göstersin.
  const iscilikSatirlari = useMemo(() => {
    const m = {};
    for (const s of (decisionPreview?.invoice_lines || [])) {
      if (s.repair_id) m[s.repair_id] = s;
    }
    return m;
  }, [decisionPreview]);

  // Hedef fiyat kontrolünün karşılaştırdığı tutar NİHAİ FATURA TOPLAMIDIR:
  // parça + işçilik + DGD. Backend (_compute_dismantle_decision) bunu hesaplayıp
  // total_price olarak döner; ekran onu gösterir ki teknisyenin gördüğü rakamla
  // kararın dayandığı rakam aynı olsun.
  //
  // Aşağıdaki yerel toplam yalnızca YEDEK: önizleme henüz gelmediyse boş ekran
  // yerine parça toplamı gösterilir.
  const yerelParcaToplami = useMemo(() => {
    return activeRepairs
      .filter(r => r.partItemCode && partPrices[r.partItemCode] !== undefined)
      .reduce((sum, r) => sum + partPrices[r.partItemCode], 0);
  }, [activeRepairs, partPrices]);
  const totalRepairPrice = decisionPreview?.total_price ?? yerelParcaToplami;

  // ── ONARIM TAKIMINA GÖRE GRUPLAMA ──────────────────────────────
  // Tablo her onarım takımını tek satırda "N parça" olarak gösterir; satır açılınca
  // parçalar tek tek görünür. Takımda tek parça olsa bile başlık çizilir - böylece
  // ekranın düzeni cihazdan cihaza değişmez, her takım aynı yerde aynı biçimde durur.
  // ETİKETLER BUNDAN ETKİLENMEZ: barkod hâlâ onarım KAYDI başına basılır, iki
  // parçalı bir takım iki etiket üretir (bkz. EtiketYazdirModal.acikOnarimlar).
  const gruplananOnarimlar = useMemo(() => {
    const sira = [];
    const harita = new Map();
    for (const r of repairs) {
      // GRUPLAMA GÖRÜNEN ADA GÖRE yapılır, ham koda göre değil.
      // Sebebi: DGD'nin takımı sabit değil. Kaydın department_mission'ı DISMANTLE
      // (başlangıç), L1REPAIR ya da L2REPAIR olabilir - "L1/L2 Onarımına Al" düğmesi
      // bunu değiştirir (bkz. handleToggleDgdTeam). DISMANTLE ise ekranda "L1 Onarımı"
      // gösterilir (bkz. takimAdi). Ham koda bakan bir gruplama, ekranda ikisi de
      // "L1 Onarımı" yazan DGD ve L1 satırlarını ayrı gruplara düşürüyordu.
      // Ada göre gruplayınca kod ne olursa olsun ekrandaki adla tutarlı kalır.
      const ad = takimAdi(r.missionGroupCode, r.missionGroup) || "?";
      const anahtar = ad;
      if (!harita.has(anahtar)) {
        harita.set(anahtar, { anahtar, ad, satirlar: [] });
        sira.push(anahtar);
      }
      harita.get(anahtar).satirlar.push(r);
    }
    return sira.map(a => harita.get(a));
  }, [repairs]);

  // Gruplar KAPALI başlar (istenen davranış: "tek satırda 2 parça"). Parça eklenip
  // çıkarıldıkça grupların şekli değişeceği için durum o değiştiğinde sıfırlanır.
  const grupImzasi = gruplananOnarimlar.map(g => `${g.anahtar}:${g.satirlar.length}`).join("|");
  const [acikGruplar, setAcikGruplar] = useState(() => new Set());
  useEffect(() => { setAcikGruplar(new Set()); }, [grupImzasi]);
  const grupAc = (anahtar) => setAcikGruplar(prev => {
    const s = new Set(prev);
    s.has(anahtar) ? s.delete(anahtar) : s.add(anahtar);
    return s;
  });

  const totalPriceBadgeInfo = useMemo(() => {
    const status = device?.serviceStatus || device?.statuCode;
    const isPendingApproval = status === 106 || status === 136 || status === 1005 || isPriceExceeded;
    const isRejected = status === 124 || status === 108 || status === 1003;

    if (isRejected) {
      return {
        bg: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30",
        statusText: "Müşteri Reddi / İade"
      };
    }
    if (isPendingApproval) {
      return {
        bg: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
        statusText: "Müşteri Onayı Bekliyor"
      };
    }
    return {
      bg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
      statusText: "Müşteri Onaylı / Limit İçinde"
    };
  }, [device?.serviceStatus, device?.statuCode, isPriceExceeded]);

  const handleSubmitDecision = useCallback(async () => {
    if (!device?.imei || !hasRepairs || deciding) return;
    setDeciding(true);
    const res = await api.submitDismantleDecision(device.imei, getCurrentUser()?.username);
    setDeciding(false);
    if (res && res.success) {
      // priceLimitExceeded true ise (Hedef Fiyat Matrisi limiti aşıldı) bildirim
      // "success" (yeşil) değil "error" (kırmızı) olmalı - kategori onaylı olsa bile
      // fiyat limiti cihazı Müşteri Onayına zorlamış demektir, bu yeşil bir sonuç değil.
      showNotif(
        res.priceLimitExceeded ? "error" : "success",
        res.decision === "URETIME_AKTAR" ? "Üretime Aktarıldı" : "Müşteri Onayına Gönderildi",
        res.message || ""
      );
      // Karar başarılıysa etiketler SORULMADAN basılır - HER İKİ kararda da
      // (URETIME_AKTAR ve MUSTERI_ONAYI). Müşteri onayına giden cihazın da
      // parçaları fiziksel olarak ayrılıyor, barkodu o anda basılmalı; eskiden
      // yalnızca üretime aktarımda basılıyor, onay yolundaki cihaz etiketsiz
      // kalıyordu. onRefresh() listeyi tazeleyeceği için tetikleme ONDAN ÖNCE
      // yapılır; aksi halde etiket bileşeni parçaları henüz yenilenmiş listeden
      // okuyup boş basıyor.
      setEtiketBas(true);
      await onRefresh();
    } else {
      showNotif("error", "İşlem Başarısız", res?.message || "Statü güncellenemedi.");
    }
  }, [device, hasRepairs, deciding, onRefresh, showNotif]);

  // Cihaz onarılamayıp müşteriye iade edilecekse: aktif DGD işçilik satırlarını (Flow'a göre
  // otomatik eklenen, henüz DGDDEC'e dönüşmemiş) tek bir DGDDEC (iade işçiliği) satırına
  // dönüştürür - bkz. WebBridge.apply_dgd_return.
  const hasActiveDgd = activeRepairs.some(r => r.itemCategory === "DGD" && r.partItemCode !== "DGDDEC");
  const handleApplyDgdReturn = useCallback(async () => {
    if (!device?.imei || !hasActiveDgd || returningDgd) return;
    setReturningDgd(true);
    const res = await api.applyDgdReturn(device.workOrderId || device.imei, getCurrentUser()?.username);
    setReturningDgd(false);
    if (res && res.success) {
      showNotif("success", "DGD İade Edildi", `${res.converted_count || 1} işçilik kaydı DGDDEC'e dönüştürüldü.`);
      await onRefresh();
    } else {
      showNotif("error", "İade Edilemedi", res?.message || "İşlem başarısız oldu.");
    }
  }, [device, hasActiveDgd, returningDgd, onRefresh, showNotif]);

  // DGD satırının onarım takımını (L1 ↔ L2) tek tuşla değiştirir - bkz. WebBridge.toggle_dgd_repair_team.
  const handleToggleDgdTeam = useCallback(async (repair) => {
    if (togglingDgdId) return;
    setTogglingDgdId(repair.id);
    const res = await api.toggleDgdRepairTeam(repair.id, getCurrentUser()?.username);
    setTogglingDgdId(null);
    if (res && res.success) {
      showNotif("success", "Onarım Takımı Değiştirildi", res.new_team === "L2REPAIR" ? "DGD artık L2 onarımına atandı." : "DGD artık L1 onarımına atandı.");
      await onRefresh();
    } else {
      showNotif("error", "Değiştirilemedi", res?.message || "İşlem başarısız oldu.");
    }
  }, [togglingDgdId, onRefresh, showNotif]);

  // Tek bir onarım satırı. Grup başlığı altında ya da (tek parçalı takımlarda)
  // doğrudan çizilir - iki yerde aynı JSX'i tutmamak için fonksiyona alındı.
  const satirCiz = (r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRepairId(r.id)}
                        className={`cursor-pointer transition-colors border-l-[3px] ${
                          r.isCancelled
                            ? "opacity-50 border-l-transparent"
                            : editingRepairId === r.id
                              ? "bg-indigo-50/50 dark:bg-indigo-500/10 border-l-indigo-500"
                              : selectedRepairId === r.id
                                ? "bg-blue-50 dark:bg-blue-500/5 border-l-blue-500"
                                : "border-l-transparent hover:bg-slate-50 dark:hover:bg-[#12141c]"
                        }`}
                      >
                        <td className="px-4 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                          {r.partItemCode || "N/A"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {r.partItemCode && partPrices[r.partItemCode] !== undefined
                            ? `${partPrices[r.partItemCode].toFixed(2)} ${device?.currency || ''}`.trim()
                            : <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        {/* İşçilik Seviyesi: parçanın kategorisinden (item_category.item_labour) gelir.
                            DGD satırı zaten işçilik kaydı olduğundan seviye gösterilmez. */}
                        <td className="px-3 py-2 text-center text-xs">
                          {r.itemCategory !== "DGD" && r.labourLevel
                            ? <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">{r.labourLevel}</span>
                            : <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        {/* İşçilik Fiyatı: seviye modelinden, onarım kaydı bazında
                            (bkz. iscilikSatirlari). Parça eklendikçe/çıkarıldıkça sıralar
                            kayar ve bu değerler backend'de yeniden hesaplanır. */}
                        <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {iscilikSatirlari[r.id]?.faturalanabilir
                            ? `${iscilikSatirlari[r.id].iscilik_fiyat.toFixed(2)} ${device?.currency || ''}`.trim()
                            : <span className="text-slate-400 font-normal">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                          {takimAdi(r.missionGroupCode, r.missionGroup)}
                          {r.isCancelled && <span className="ml-1.5 text-[10px] font-bold text-red-500">(İptal Edildi)</span>}
                        </td>
                        {/* Atama Üretim Teknisyeni ekranından yapılır; burası salt okunur. */}
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                          {r.technician || r.assignedTechnicianName || r.assignedTechnician
                            ? <span className="inline-flex items-center gap-1.5">
                                <User size={11} className="text-blue-500 shrink-0" />
                                {r.technician || r.assignedTechnicianName || r.assignedTechnician}
                              </span>
                            : <span className="italic text-slate-400 dark:text-slate-600">Atanmadı</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${r.chargeType === "FREE" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"}`}>
                            {r.chargeType === "FREE" ? "Ücretsiz" : "Ücretli"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{r.faultName || "N/A"}</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{r.notes || "N/A"}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            {r.itemCategory === "DGD" && r.partItemCode !== "DGDDEC" && (
                              <button
                                type="button"
                                onClick={() => hasAccess && !r.isCancelled && handleToggleDgdTeam(r)}
                                disabled={!hasAccess || r.isCancelled || togglingDgdId === r.id}
                                title={r.missionGroupCode === "L2REPAIR" ? "L1 Onarımına Al" : "L2 Onarımına Al"}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ArrowLeftRight size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => hasAccess && statusAllowsParts && !r.isCancelled && handleEditRow(r)}
                              disabled={!hasAccess || !statusAllowsParts || r.isCancelled}
                              title={statusAllowsParts ? "Düzenle" : "Cihaz L1 aşamasında değil"}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => hasAccess && !r.isCancelled && handleCancelRow(r.id)}
                              disabled={!hasAccess || r.isCancelled || deletingRepairId === r.id}
                              title="İptal Et"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Ban size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
  );

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* ── Sol Panel: Test: Sorun Tespit Edilen Parçalar ── */}
        <div className="bg-[#C6CEE2] dark:bg-[#181a24] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1e222d]">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} className="text-slate-400" /> Test: Sorun Tespit Edilen Parçalar
            </h3>
          </div>
          <div className="flex-1 overflow-auto">
            {loadingTestParts ? (
              <div className="flex items-center justify-center h-full py-12 text-sm text-slate-400">Yükleniyor...</div>
            ) : testDetectedParts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
                <p className="text-sm font-medium">Veri yok</p>
                <p className="text-xs mt-1 text-center px-6">Test aşaması (QAC) bu cihaz için henüz bir tespit kaydı girmedi.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#12141c] sticky top-0">
                  <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-4 py-2.5">Semptom</th>
                    <th className="text-left px-3 py-2.5">Parça Kategorisi</th>
                    <th className="text-left px-3 py-2.5">Parça kodu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
                  {testDetectedParts.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">{p.symptomCode || "N/A"}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{p.partCategory || "N/A"}</td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">{p.partItemCode || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Sağ Panel: Teknik: Teklif Parçaları ── */}
        {/* overflow-hidden burada kasıtlı olarak yok: Parça Seçiniz açılır listesi bu panelin
            içinde absolute konumlanıyor, panelde overflow-hidden olursa liste kırpılır. Alttaki
            tablo zaten kendi overflow-auto'suna sahip, yuvarlak köşe için buna gerek yok. */}
        <div className="bg-[#C6CEE2] dark:bg-[#181a24] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-[#1e222d]">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Wrench size={16} className="text-slate-400" /> Teknik: Teklif Parçaları
            </h3>
          </div>
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1e222d] space-y-2">
            {!statusAllowsParts && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                <Ban size={14} className="shrink-0 mt-0.5" />
                <span>
                  Cihaz L1 aşamasında değil{statusLabel ? ` (mevcut statü: ${statusLabel})` : ""} — bu statüde parça eklenemez veya güncellenemez.
                </span>
              </div>
            )}
            {addToGroup && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 text-xs">
                <Package size={14} className="shrink-0 mt-0.5" />
                <span className="flex-1">
                  <strong>{takimAdi(addToGroup.code, addToGroup.name)}</strong> onarımına parça ekleniyor — yeni bir onarım açılmaz, parça bu onarımın altına yazılır.
                </span>
                <button onClick={resetToolbar} type="button" className="shrink-0 font-bold underline underline-offset-2 hover:opacity-70">
                  Vazgeç
                </button>
              </div>
            )}
            {partsWarning && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{partsWarning}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PartSelectCombobox parts={parts} value={selectedPartId} onChange={setSelectedPartId} placeholder="Parça seçiniz..." labelMode="category" disabled={!!editingRepairId}
                engelSebebi={p => parcaEngeli(p, parcaSiniflari, ekliKodlar)} />
              <select
                value={faultCode}
                onChange={e => setFaultCode(e.target.value)}
                disabled={!selectedItemCategory}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{selectedItemCategory ? "Arıza Tespiti seçiniz..." : "Önce parça seçiniz..."}</option>
                {itemFaults.length > 0
                  ? itemFaults.map(f => <option key={f.code} value={f.code}>{f.short_name}</option>)
                  : selectedItemCategory && <option value="N/A">N/A</option>}
              </select>
              {addToGroup ? (
                <div className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-sm font-semibold flex items-center gap-2">
                  <Wrench size={14} className="shrink-0" />
                  <span className="truncate">{takimAdi(addToGroup.code, addToGroup.name)}</span>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-widest opacity-70 shrink-0">Sabit</span>
                </div>
              ) : (
                <select
                  value={missionGroupCode}
                  onChange={e => setMissionGroupCode(e.target.value)}
                  disabled={!selectedItemCategory}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <option value="">{selectedItemCategory ? "Onarım Takımı seçiniz..." : "Önce parça seçiniz..."}</option>
                  {filteredMissionGroups.map(mg => <option key={mg.code} value={mg.code}>{mg.short_name} ({mg.code})</option>)}
                </select>
              )}
              <select
                value={warrantyCode}
                onChange={e => setWarrantyCode(e.target.value)}
                disabled={!isRmaFlow}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="">Ücretli/Ücretsiz Onarım seçiniz...</option>
                {warranties.map(w => <option key={w.code} value={w.code}>{w.short_name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Açıklama..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12141c] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {editingRepairId && (
                <button
                  onClick={resetToolbar}
                  type="button"
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <X size={14} /> VAZGEÇ
                </button>
              )}
              <button
                onClick={handleAddRow}
                disabled={!hasAccess || !statusAllowsParts || !faultCode || !missionGroupCode || !warrantyCode || adding}
                className={`px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${editingRepairId ? "bg-indigo-600 hover:bg-indigo-700" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {editingRepairId ? <Pencil size={14} /> : <Plus size={14} />}
                {adding ? "Kaydediliyor..." : editingRepairId ? "GÜNCELLE" : addToGroup ? "PARÇA EKLE" : "EKLE"}
              </button>
              {/* Yeni onarım açmadan, tablodan seçilen onarıma ek parça satırı ekler.
                  Düzenleme sürerken kapalıdır - iki mod aynı toolbar'ı kullanıyor. */}
              {!addToGroup && (
                <button
                  onClick={handleStartAddPart}
                  type="button"
                  disabled={!hasAccess || !statusAllowsParts || !!editingRepairId || !selectedRepair || selectedRepair.isCancelled}
                  title={selectedRepair
                    ? `'${takimAdi(selectedRepair.missionGroupCode, selectedRepair.missionGroup)}' onarımına yeni bir parça ekler`
                    : "Önce alttaki tablodan bir onarım satırı seçin"}
                  className="px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-[#12141c] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Package size={14} /> PARÇA EKLE
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto rounded-b-2xl">
            {repairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
                <p className="text-sm font-medium">Henüz teklif parçası eklenmedi</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#12141c] sticky top-0">
                  <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    <th className="text-left px-4 py-2.5">Parça kodu</th>
                    <th className="text-right px-3 py-2.5">Fiyat</th>
                    <th className="text-center px-3 py-2.5">İşçilik Seviyesi</th>
                    <th className="text-right px-3 py-2.5">İşçilik Fiyatı</th>
                    <th className="text-left px-3 py-2.5">Onarım Takımı</th>
                    <th className="text-left px-3 py-2.5">Teknisyen</th>
                    <th className="text-left px-3 py-2.5">Ücret Tipi</th>
                    <th className="text-left px-3 py-2.5">Arıza Tespiti</th>
                    <th className="text-left px-3 py-2.5">Açıklama</th>
                    <th className="text-center px-3 py-2.5">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
                  {gruplananOnarimlar.flatMap(g => {
                    const acik = acikGruplar.has(g.anahtar);
                    const aktif = g.satirlar.filter(r => !r.isCancelled);
                    // DGD bir PARÇA değil, Flow'a göre otomatik eklenen işçilik satırıdır;
                    // "N parça" sayısına katılmaz, ayrıca belirtilir.
                    const dgdVar = aktif.some(r => (r.itemCategory || "").toUpperCase() === "DGD");
                    const parcaAdedi = aktif.filter(r => (r.itemCategory || "").toUpperCase() !== "DGD").length;
                    // Grubun tamamı iptal edilmişse aktif sayısı 0'dır; "0 kayıt" yazmak
                    // yerine iptal edildiği söylenir (tek satırlı gruplar da artık başlık
                    // aldığı için bu durum ekrana düşebiliyor).
                    const ozet = parcaAdedi
                      ? `${parcaAdedi} parça${dgdVar ? " + DGD" : ""}`
                      : (dgdVar ? "DGD işçiliği"
                                : (aktif.length ? `${aktif.length} kayıt`
                                                : `${g.satirlar.length} iptal edilmiş kayıt`));
                    const parcaTut = aktif.reduce((t, r) =>
                      t + (r.partItemCode && partPrices[r.partItemCode] !== undefined ? partPrices[r.partItemCode] : 0), 0);
                    const iscilikTut = aktif.reduce((t, r) =>
                      t + (iscilikSatirlari[r.id]?.faturalanabilir ? iscilikSatirlari[r.id].iscilik_fiyat : 0), 0);
                    return [
                      <tr
                        key={`grup-${g.anahtar}`}
                        onClick={() => grupAc(g.anahtar)}
                        className="cursor-pointer border-l-[3px] border-l-transparent bg-slate-50/70 dark:bg-[#12141c] hover:bg-slate-100 dark:hover:bg-[#181a24] transition-colors"
                      >
                        <td colSpan={4} className="px-4 py-2">
                          <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                            {acik ? <ChevronDown size={14} className="text-slate-400" />
                                  : <ChevronRight size={14} className="text-slate-400" />}
                            {g.ad}
                            <span className="font-semibold text-slate-500">{ozet}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500" colSpan={2}>
                          parça {parcaTut.toFixed(2)} · işçilik {iscilikTut.toFixed(2)} {device?.currency || ''}
                        </td>
                        <td colSpan={4} className="px-3 py-2 text-right text-[11px] text-slate-400">
                          {acik ? "gizlemek için tıklayın" : "ayrıntı için tıklayın"}
                        </td>
                      </tr>,
                      ...(acik ? g.satirlar.map(satirCiz) : []),
                    ];
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Onarım Takımları + Karar ──
          DÜZEN: tek satıra sıkıştırılmıyor. Takım rozetleri, fiyat özeti ve karar
          butonları farklı genişliklerde olduğu için hepsi aynı flex satırındayken
          buton daralıp metni sarıyor, uyarı kutusu da araya sıkışıyordu. Artık:
            üst satır  → takımlar (esner) + fiyat özeti (sabit)
            alt satır  → aksiyon butonları, sağa yaslı, eşit yükseklikte
          Uyarı kutusu kendi tam genişlikli satırında duruyor. */}
      <div className="bg-[#C6CEE2] dark:bg-[#181a24] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden px-5 py-4 space-y-3">

        {/* Üst satır: takımlar + fiyat özeti */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-3">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-2">
              Onarım Takımları
            </label>
            <div className="flex flex-wrap gap-1.5">
              {missionGroups.map(mg => {
                const active = activeMissionGroupCodes.has(mg.code);
                return (
                  <span
                    key={mg.code}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${active ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30" : "bg-white/50 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700"}`}
                  >
                    {active ? <CheckCircle size={11} /> : null} {takimAdi(mg.code, null) || mg.short_name}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Fiyat özeti: toplam ve (varsa) limit yan yana, tek blokta. */}
          {totalRepairPrice > 0 && (
            <div className="shrink-0 flex items-center gap-4 px-3.5 py-2 rounded-xl bg-white/60 dark:bg-[#12141c] border border-slate-200 dark:border-[#1e222d]">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Toplam</div>
                <div className={`text-sm font-extrabold tabular-nums ${isPriceExceeded ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {totalRepairPrice.toFixed(2)} {device?.currency || ''}
                </div>
                {/* Kırılım: toplamın neden bu rakam olduğu görünsün - hedef limit
                    karşılaştırması da bu toplam üzerinden yapılıyor. */}
                {decisionPreview?.labour_total != null && (
                  <div className="text-[9px] text-slate-400 tabular-nums whitespace-nowrap">
                    parça {(decisionPreview.parts_total || 0).toFixed(2)}
                    {' + '}işçilik {(decisionPreview.labour_total || 0).toFixed(2)}
                    {' + '}DGD {(decisionPreview.dgd_fee || 0).toFixed(2)}
                  </div>
                )}
              </div>
              {decisionPreview?.target_price > 0 && (
                <>
                  <div className="w-px h-8 bg-slate-200 dark:bg-[#1e222d]" />
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Hedef Limit</div>
                    <div className="text-sm font-extrabold tabular-nums text-slate-600 dark:text-slate-300">
                      {decisionPreview.target_price.toFixed(2)} {device?.currency || ''}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Uyarı: kendi satırında, tam genişlik - butonu daraltmıyor.
            SEBEP BACKEND'DEN GELİR (onay_sebep_metni): onay iki sebepten gerekebilir -
            kriter dışı parça kategorisi ve/veya hedef fiyat aşımı. Eskiden burada
            yalnızca fiyat aşımı gösteriliyordu; kategori yüzünden onaya gidecek cihazda
            hiçbir uyarı çıkmıyor, kullanıcı butonun neden mor olduğunu göremiyordu. */}
        {!isProductionReady && decisionPreview?.onay_sebep_metni && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
            <span>
              <strong>Müşteri onayı gerekiyor.</strong> {decisionPreview.onay_sebep_metni}
            </span>
          </div>
        )}

        {/* Alt satır: aksiyonlar */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasActiveDgd && (
            <button
              onClick={handleApplyDgdReturn}
              disabled={!hasAccess || returningDgd}
              title="Aktif DGD işçiliğini DGDDEC (iade işçiliği) koduna dönüştürür"
              className="h-11 px-4 rounded-xl border border-amber-500/60 text-amber-600 dark:text-amber-400 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-500/10"
            >
              <Ban size={16} />
              {returningDgd ? "İşleniyor..." : "İade Et"}
            </button>
          )}
          <button
            onClick={handleSubmitDecision}
            /* statusAllowsParts: cihaz DEMONTAJ aşamasında mı. Eskiden kontrol
               edilmiyordu; cihaz 106/107'ye (müşteri onayı) geçtikten sonra bile
               buton basılabiliyor, backend "bu okutmaya uygun statü değil" hatası
               döndürüyordu. Artık buton o statülerde pasif ve sebebini söylüyor. */
            disabled={!hasAccess || !hasRepairs || deciding || !statusAllowsParts}
            title={!statusAllowsParts
              ? `Cihaz artık L1 aşamasında değil${statusLabel ? ` (${statusLabel})` : ""} — bu işlem yapılamaz.`
              : (isProductionReady
                ? "Cihazı üretime aktarır ve parça barkodlarını basar."
                : (isPriceExceeded
                  ? `Toplam tutar (${totalRepairPrice.toFixed(2)} ${device?.currency || 'TL'} = parça + işçilik + DGD), hedef limitini (${(decisionPreview?.target_price || 0).toFixed(2)} ${device?.currency || 'TL'}) aştı — cihaz Müşteri Onayına gönderilecek.`
                  : "Cihazı müşteri onayına gönderir ve parça barkodlarını basar."))}
            className={`h-11 px-5 rounded-xl text-white text-sm font-bold transition-colors shadow-lg disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap ${isProductionReady ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-violet-600 hover:bg-violet-700 shadow-violet-500/20"}`}
          >
            {isProductionReady ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {deciding ? "İşleniyor..." : isProductionReady ? "Üretime Aktar" : "Müşteri Onayı Al"}
          </button>
        </div>
      </div>

      <EtiketYazdirModal
        acik={etiketBas}
        cihaz={device}
        onarimlar={repairs}
        tur="parca"
        ekEtiketler          /* kontrol + "x" etiketleri yalnızca Demontaj'da basılır */
        otomatik             /* soru sorulmaz, doğrudan basılır */
        onKapat={() => setEtiketBas(false)}
      />
    </div>
  );
}
