import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import * as XLSX from 'xlsx';
import { Wrench, Save, Search, FileSpreadsheet, RefreshCw, Filter, AlertCircle, X } from 'lucide-react';
import { api } from '../services/api';

const ROW_HEIGHT_FALLBACK = 42; // ilk ölçüm gelene kadar kullanılan tahmini satır yüksekliği
const OVERSCAN_ROWS = 8; // görünür alanın üstünde/altında ekstra render edilen satır sayısı
const SEARCH_DEBOUNCE_MS = 150;

// İçe aktarma, Dışa Aktar ile BİREBİR AYNI "geniş" (wide) formatı bekler: her satır bir
// parça, her müşteri kendi sütununda. Sabit sütunlu ExcelMappingModal bu değişken sütun
// sayısına (müşteri sayısı kadar) uymadığından burada dosya doğrudan xlsx ile okunur.
const ITEM_CODE_HEADER_ALIASES = ['item kodu', 'item_code', 'parça kodu', 'parca kodu'];
const SKIP_HEADER_ALIASES = ['ad', 'tip', 'name', 'item_type'];

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

const selectClass = "px-3 py-2 bg-white dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";

// Tek bir satırı temsil eder. Sadece kendi item'ının fiyat/kirli verisi değiştiğinde
// yeniden render olur (dirty[itemCode] ve prices[itemCode] referansları başka satır
// düzenlenirken sabit kalır) - böylece bir hücreye yazmak binlerce input'u tekrar
// render etmeye zorlamaz.
const LabourMatrixRow = memo(function LabourMatrixRow({ item, customers, dirtyRow, priceRow, onCellChange, measureRef }) {
  const getCellValue = (customerCode) => {
    if (dirtyRow && Object.prototype.hasOwnProperty.call(dirtyRow, customerCode)) {
      return dirtyRow[customerCode];
    }
    return priceRow?.[customerCode] ?? '';
  };

  return (
    <tr ref={measureRef} className="hover:bg-slate-100 dark:hover:bg-[#1e222d] transition-colors">
      <td className="px-4 py-2 sticky left-0 bg-white dark:bg-[#12141c] z-10 font-mono text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.item_type === 'İşçilik' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-500/20 text-slate-500'}`}>
            {item.item_type}
          </span>
          <span>{item.item_code}</span>
        </div>
      </td>
      {customers.map(c => (
        <td key={c.code} className="px-2 py-1.5 text-center">
          <input
            type="number" step="0.01"
            value={getCellValue(c.code)}
            onChange={e => onCellChange(item.item_code, c.code, e.target.value)}
            placeholder="-"
            className="w-24 text-center px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#181a24] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
      ))}
    </tr>
  );
});

export default function CustomerLabourPriceMatrix() {
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [prices, setPrices] = useState({}); // { item_code: { customer_code: price } }
  const [dirty, setDirty] = useState({}); // aynı şekil, sadece değiştirilen hücreler
  const [initializing, setInitializing] = useState(false); // müşteri/marka/fiyat ilk yükleme
  const [itemsLoading, setItemsLoading] = useState(false); // seçili marka/kategoriye göre parça yükleme
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Marka → Ürün Tipi → Model → Kategori kademeli filtreleri: sistem artık
  // varsayılan olarak 30 bin+ satırlık tüm katalogu değil, yalnızca seçilen
  // markanın (isteğe bağlı olarak ürün tipi/model/kategoriyle daha da
  // daraltılmış) parçalarını yükler. Hepsi birbiriyle uyumlu çalışır: ürün
  // tipi seçilince model listesi, model seçilince kategori listesi o seçime
  // göre daralır (bkz. get_labour_matrix_models/get_labour_matrix_categories'in
  // product_type/model parametreleri).
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [productTypes, setProductTypes] = useState([]);
  const [productTypesLoading, setProductTypesLoading] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState('');
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null); // { done, total }
  const [importErrors, setImportErrors] = useState([]);
  const [importPartialSuccess, setImportPartialSuccess] = useState(false);
  const importFileInputRef = useRef(null);

  const loading = initializing || itemsLoading;

  // Satır sanallaştırma (virtualization) durumu: binlerce parça x müşteri hücresi
  // için tamamı DOM'a basılırsa tarayıcı kilitlenir. Sadece görünür aralık render edilir.
  const scrollContainerRef = useRef(null);
  const rowMeasureRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT_FALLBACK);

  const loadStatic = useCallback(async () => {
    setInitializing(true);
    try {
      const [custRes, brandRes] = await Promise.all([
        api.getLabourMatrixCustomers(),
        api.getLabourMatrixBrands(),
      ]);
      if (custRes.success) setCustomers(custRes.customers || []);
      if (brandRes.success) setBrands(brandRes.brands || []);
      setDirty({});
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => { loadStatic(); }, [loadStatic]);

  // Marka seçilmeden TÜM katalogu (parçalar + işçilik/DGD, 30 bin+ satır) filtresiz
  // çekmek denendi - cache ve sanallaştırmaya (virtualization) rağmen ilk giriş gözle
  // görülür şekilde yavaş kalıyordu (tek seferlik büyük JSON indirme + parse maliyeti).
  // Bu yüzden artık marka ZORUNLU: hiçbir marka seçilmemişken bu fonksiyon hiç
  // çağrılmaz (bkz. aşağıdaki useEffect'teki guard), tablo boş/"marka seçin" durumunda
  // kalır. Marka seçildikten sonra ürün tipi/model/kategoriyle daha da daraltılabilir.
  const loadItems = useCallback(async (brand, productType, model, category) => {
    setItemsLoading(true);
    try {
      const [itemRes, priceRes] = await Promise.all([
        api.getLabourMatrixItems('', brand, category, model, productType),
        api.getLabourMatrix(brand, category, model, productType),
      ]);
      if (itemRes.success) setItems(itemRes.items || []);
      if (priceRes.success) {
        const map = {};
        for (const p of (priceRes.prices || [])) {
          if (!map[p.item_code]) map[p.item_code] = {};
          map[p.item_code][p.customer_code] = p.price;
        }
        setPrices(map);
      } else {
        setPrices({});
      }
    } catch (_e) {
      setItems([]);
      setPrices({});
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedBrand) {
      setItems([]);
      setPrices({});
      return;
    }
    loadItems(selectedBrand, selectedProductType, selectedModel, selectedCategory);
  }, [selectedBrand, selectedProductType, selectedModel, selectedCategory, loadItems]);

  // Marka değiştiğinde o markaya ait ürün tipi listesini getir; ürün tipi
  // seçimini sıfırla (önceki markanın ürün tipi yeni markada geçerli olmayabilir).
  useEffect(() => {
    setSelectedProductType('');
    if (!selectedBrand || selectedBrand === '__DGD__') {
      setProductTypes([]);
      return undefined;
    }
    let cancelled = false;
    setProductTypesLoading(true);
    api.getLabourMatrixProductTypes(selectedBrand)
      .then(res => {
        if (cancelled) return;
        if (res.success) setProductTypes(res.product_types || []);
      })
      .catch(() => { if (!cancelled) setProductTypes([]); })
      .finally(() => { if (!cancelled) setProductTypesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBrand]);

  // Marka veya ürün tipi değiştiğinde o ikiliye ait model listesini getir (ürün
  // tipi ile 'uyumlu' çalışır - tip seçiliyse modeller de SADECE o tipe göre
  // daralır); model seçimini sıfırla (önceki seçim yeni marka/tipte geçerli olmayabilir).
  useEffect(() => {
    setSelectedModel('');
    if (!selectedBrand || selectedBrand === '__DGD__') {
      setModels([]);
      return undefined;
    }
    let cancelled = false;
    setModelsLoading(true);
    api.getLabourMatrixModels(selectedBrand, selectedProductType)
      .then(res => {
        if (cancelled) return;
        if (res.success) setModels(res.models || []);
      })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBrand, selectedProductType]);

  // Marka/ürün tipi/model değiştiğinde o üçlüye ait kategori listesini getir
  // (hepsiyle 'uyumlu' çalışır - seçiliyse kategoriler de SADECE o alt kümeye
  // göre daralır); kategori seçimini sıfırla (önceki seçim artık geçerli olmayabilir).
  useEffect(() => {
    setSelectedCategory('');
    if (!selectedBrand || selectedBrand === '__DGD__') {
      setCategories([]);
      return undefined;
    }
    let cancelled = false;
    setCategoriesLoading(true);
    api.getLabourMatrixCategories(selectedBrand, selectedModel, selectedProductType)
      .then(res => {
        if (cancelled) return;
        if (res.success) setCategories(res.categories || []);
      })
      .catch(() => { if (!cancelled) setCategories([]); })
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBrand, selectedProductType, selectedModel]);

  // Arama kutusuna yazarken seçili marka/kategori alt kümesi üzerinde her tuş
  // vuruşunda filtrelemek yerine kısa bir debounce uygulanır.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const filteredItems = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter(i => i.item_code.toLowerCase().includes(term) || (i.name || '').toLowerCase().includes(term));
  }, [items, debouncedSearch]);

  // Marka/ürün tipi/model/kategori/arama değiştiğinde sanallaştırma indekslerinin
  // eski kaydırma konumuyla uyuşmaması için görünümü başa sar.
  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [debouncedSearch, selectedBrand, selectedProductType, selectedModel, selectedCategory]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return undefined;
    setViewportHeight(el.clientHeight);
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  // İlk render edilen satırın gerçek yüksekliğini ölç ki sanallaştırma boşluk
  // (spacer) hesapları tahmini değil gerçek satır boyuna göre yapılsın.
  const measureRow = useCallback((node) => {
    rowMeasureRef.current = node;
    if (node) {
      const h = node.getBoundingClientRect().height;
      if (h > 0) {
        setRowHeight(prev => (Math.abs(prev - h) > 0.5 ? h : prev));
      }
    }
  }, []);

  const totalRows = filteredItems.length;
  const startIndex = loading ? 0 : Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + OVERSCAN_ROWS * 2;
  const endIndex = loading ? 0 : Math.min(totalRows, startIndex + visibleCount);
  const visibleItems = useMemo(() => filteredItems.slice(startIndex, endIndex), [filteredItems, startIndex, endIndex]);
  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = (totalRows - endIndex) * rowHeight;

  const getCellValue = (itemCode, customerCode) => {
    if (dirty[itemCode] && Object.prototype.hasOwnProperty.call(dirty[itemCode], customerCode)) {
      return dirty[itemCode][customerCode];
    }
    return prices[itemCode]?.[customerCode] ?? '';
  };

  const handleCellChange = useCallback((itemCode, customerCode, value) => {
    setDirty(prev => ({
      ...prev,
      [itemCode]: { ...(prev[itemCode] || {}), [customerCode]: value },
    }));
  }, []);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const itemCode of Object.keys(dirty)) n += Object.keys(dirty[itemCode]).length;
    return n;
  }, [dirty]);

  const handleRefresh = async () => {
    await loadStatic();
    if (selectedBrand) {
      await loadItems(selectedBrand, selectedProductType, selectedModel, selectedCategory);
    }
  };

  const handleSave = async () => {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    const rows = [];
    for (const itemCode of Object.keys(dirty)) {
      for (const customerCode of Object.keys(dirty[itemCode])) {
        const raw = dirty[itemCode][customerCode];
        const price = raw === '' || raw === null || raw === undefined ? null : Number(raw);
        rows.push({ item_code: itemCode, customer_code: customerCode, price });
      }
    }
    const res = await api.saveLabourMatrixBatch(rows, getCurrentUser()?.username);
    setSaving(false);
    if (res.success) {
      await handleRefresh();
    } else {
      alert(res.message || 'Kaydetme başarısız oldu.');
    }
  };

  const handleExport = async () => {
    const exportData = filteredItems.map(item => {
      const row = { 'Item Kodu': item.item_code, 'Ad': item.name, 'Tip': item.item_type };
      for (const c of customers) {
        row[c.short_name] = getCellValue(item.item_code, c.code);
      }
      return row;
    });
    await api.exportTableToExcel(exportData, 'musteri_iscilik_fiyat_matrisi.xlsx');
  };

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';

    if (action === 'download_template') {
      // Şablon, Dışa Aktar ile BİREBİR AYNI "geniş" formatta: her müşteri kendi sütununda.
      const row = { 'Item Kodu': 'ABC123', 'Ad': 'Örnek Parça', 'Tip': 'Parça' };
      for (const c of customers) row[c.short_name] = '';
      if (customers[0]) row[customers[0].short_name] = 25;
      await api.exportTableToExcel([row], 'musteri_iscilik_fiyat_matrisi_sablonu.xlsx');
    } else if (action === 'export') {
      await handleExport();
    } else if (action === 'import') {
      setImportErrors([]);
      importFileInputRef.current?.click();
    }
  };

  // Dışa Aktar ile aynı "geniş" formattaki Excel'i okur: ilk sütun parça kodu, her müşteri
  // adı sütunu o müşterinin fiyatı. "Ad"/"Tip" gibi bilgi amaçlı sütunlar atlanır. Sonuç,
  // backend'in (bulk_import_labour_matrix) beklediği düz {item_code, musteri, fiyat} satır
  // listesine dönüştürülüp aynı doğrulama/kaydetme akışına (handleExcelImport) verilir.
  const handleWideExcelFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(worksheet);

        if (!rawRows || rawRows.length === 0) {
          setImportErrors([{ row: '-', field: '-', message: 'Seçilen Excel dosyasında veri bulunamadı.' }]);
          return;
        }

        const headers = Object.keys(rawRows[0]);
        const itemCodeHeader = headers.find(h => ITEM_CODE_HEADER_ALIASES.includes(h.trim().toLowerCase()));
        if (!itemCodeHeader) {
          setImportErrors([{ row: '-', field: '-', message: '"Item Kodu" sütunu bulunamadı. Lütfen "Boş Şablon İndir" ile indirilen formatı kullanın.' }]);
          return;
        }
        const customerHeaders = headers.filter(h =>
          h !== itemCodeHeader && !SKIP_HEADER_ALIASES.includes(h.trim().toLowerCase())
        );

        const flatRows = [];
        rawRows.forEach((r) => {
          const itemCode = String(r[itemCodeHeader] ?? '').trim();
          if (!itemCode) return;
          for (const custHeader of customerHeaders) {
            const val = r[custHeader];
            if (val === undefined || val === null || String(val).trim() === '') continue;
            flatRows.push({ item_code: itemCode, musteri: custHeader, fiyat: String(val) });
          }
        });

        if (flatRows.length === 0) {
          setImportErrors([{ row: '-', field: '-', message: 'Doldurulmuş hiçbir fiyat hücresi bulunamadı.' }]);
          return;
        }

        await handleExcelImport(flatRows);
      } catch (err) {
        setImportErrors([{ row: '-', field: '-', message: 'Excel dosyası okunurken hata oluştu: ' + err.message }]);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // QWebChannel/WebSocket köprüsü tek bir dev payload'a (yüz binlerce satırlık JSON) uygun
  // değil - büyük dosyalarda köprü mesajı çok büyüyüp "yanıt vermiyor" hissi yaratıyordu.
  // Bunun yerine satırlar sabit boyutlu (5000) gruplar hâlinde ARDI ARDINA gönderilir, her
  // grup kendi (hızlı, ~1sn) backend çağrısını yapar; sonuçlar (eklenen/atlanan/hatalar)
  // biriktirilip sonda tek özet olarak gösterilir. İlerleme "İçe aktarılıyor..." panelinde
  // canlı güncellenir.
  const IMPORT_CHUNK_SIZE = 5000;

  const handleExcelImport = async (mappedRows) => {
    setImporting(true);
    setImportProgress({ done: 0, total: mappedRows.length });

    let totalImported = 0;
    let totalSkipped = 0;
    const allErrors = [];
    let hardFailure = null;

    for (let i = 0; i < mappedRows.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = mappedRows.slice(i, i + IMPORT_CHUNK_SIZE);
      const res = await api.bulkImportLabourMatrix(chunk, getCurrentUser()?.username);
      if (res.success) {
        totalImported += res.imported || 0;
        totalSkipped += res.skipped || 0;
        if (res.errors) allErrors.push(...res.errors);
      } else {
        hardFailure = res;
        if (res.errors) allErrors.push(...res.errors);
      }
      setImportProgress({ done: Math.min(i + IMPORT_CHUNK_SIZE, mappedRows.length), total: mappedRows.length });
    }

    setImporting(false);
    setImportProgress(null);
    await handleRefresh();

    if (totalImported === 0 && hardFailure) {
      setImportPartialSuccess(false);
      setImportErrors(allErrors.length > 0 ? allErrors.slice(0, 200) : [{ row: '-', field: '-', message: hardFailure.message || 'İçe aktarma başarısız oldu.' }]);
      return;
    }

    if (totalSkipped > 0 && allErrors.length > 0) {
      setImportPartialSuccess(true);
      setImportErrors(allErrors.slice(0, 200));
    } else {
      setImportPartialSuccess(false);
      setImportErrors([]);
    }
    alert(totalSkipped > 0
      ? `${totalImported} fiyat içe aktarıldı, ${totalSkipped} satır atlandı (hatalı).`
      : `${totalImported} fiyat başarıyla içe aktarıldı.`);
  };

  const productTypeSelectDisabled = !selectedBrand || selectedBrand === '__DGD__' || productTypesLoading;
  const modelSelectDisabled = !selectedBrand || selectedBrand === '__DGD__' || modelsLoading;
  const categorySelectDisabled = !selectedBrand || selectedBrand === '__DGD__' || categoriesLoading;

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(47, 168, 110,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(47, 168, 110,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <Wrench size={13} className="text-emerald-400" /> İŞÇİLİK FİYATLANDIRMA
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Müşteri İşçilik Fiyatı Matrisi
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Tabloyu görüntülemek için önce bir marka seçin; isterseniz ürün tipi, model ve/veya kategoriyle daha da daraltın.
              Her parçanın müşteriye özel işçilik fiyatı bu matriste tutulur.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="relative">
              <select
                onChange={handleExcelAction}
                defaultValue=""
                className="appearance-none bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl px-4 py-2.5 pr-9 text-xs font-bold transition-all cursor-pointer focus:outline-none"
              >
                <option value="">Excel İşlemleri...</option>
                <option value="download_template">Boş Şablon İndir</option>
                <option value="export">Dışa Aktar</option>
                <option value="import">Excel'den İçe Aktar</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2.5 pointer-events-none text-[#5A6685] dark:text-[#8892B5]">
                <FileSpreadsheet size={15} />
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
              title="Yeniden Yükle"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleSave}
              disabled={dirtyCount === 0 || saving}
              className="flex items-center gap-2 bg-[#00B2FF] hover:bg-[#1e222d] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Save size={16} /> {saving ? 'Kaydediliyor...' : `Kaydet${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#DCE1F1] dark:border-[#1e222d] bg-[#F5F7FC] dark:bg-[#181a24] flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter size={15} />
          </div>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className={selectClass}
          >
            <option value="">Tüm markalar</option>
            {brands.map(b => (
              <option key={b.value} value={b.value}>{b.label} ({b.count})</option>
            ))}
          </select>

          <select
            value={selectedProductType}
            onChange={(e) => setSelectedProductType(e.target.value)}
            disabled={productTypeSelectDisabled}
            className={selectClass}
          >
            <option value="">{productTypesLoading ? 'Ürün tipleri yükleniyor...' : 'Tüm ürün tipleri'}</option>
            {productTypes.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.label} ({pt.count})</option>
            ))}
          </select>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={modelSelectDisabled}
            className={selectClass}
          >
            <option value="">{modelsLoading ? 'Modeller yükleniyor...' : 'Tüm modeller'}</option>
            {models.map(m => (
              <option key={m.value} value={m.value}>{m.label} ({m.count})</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={categorySelectDisabled}
            className={selectClass}
          >
            <option value="">{categoriesLoading ? 'Kategoriler yükleniyor...' : 'Tüm kategoriler'}</option>
            {categories.map(c => (
              <option key={c.value} value={c.value}>{c.label} ({c.count})</option>
            ))}
          </select>

          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Item kodu veya ad ile ara..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          {!loading && (
            <span className="text-xs text-slate-400 font-medium shrink-0">{totalRows} kayıt</span>
          )}
        </div>

        <div ref={scrollContainerRef} className="overflow-auto max-h-[65vh]">
          <table className="text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#181a24] text-slate-400 font-semibold uppercase tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 sticky left-0 bg-slate-50 dark:bg-[#181a24] z-30 min-w-[220px]">Item Kodu</th>
                {customers.map(c => (
                  <th key={c.code} className="px-4 py-3 min-w-[120px] text-center">{c.short_name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {loading ? (
                <tr><td colSpan={customers.length + 1} className="px-6 py-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-400" /></td></tr>
              ) : !selectedBrand ? (
                <tr><td colSpan={customers.length + 1} className="px-6 py-8 text-center text-slate-500">Tabloyu görüntülemek için yukarıdan bir marka seçin.</td></tr>
              ) : totalRows === 0 ? (
                <tr><td colSpan={customers.length + 1} className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              ) : (
                <>
                  {topSpacerHeight > 0 && (
                    <tr aria-hidden="true" style={{ height: topSpacerHeight }}>
                      <td colSpan={customers.length + 1} style={{ padding: 0, border: 0 }} />
                    </tr>
                  )}
                  {visibleItems.map((item, i) => (
                    <LabourMatrixRow
                      key={item.item_code}
                      item={item}
                      customers={customers}
                      dirtyRow={dirty[item.item_code]}
                      priceRow={prices[item.item_code]}
                      onCellChange={handleCellChange}
                      measureRef={i === 0 ? measureRow : undefined}
                    />
                  ))}
                  {bottomSpacerHeight > 0 && (
                    <tr aria-hidden="true" style={{ height: bottomSpacerHeight }}>
                      <td colSpan={customers.length + 1} style={{ padding: 0, border: 0 }} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <input
        type="file"
        ref={importFileInputRef}
        accept=".xlsx,.xls"
        onChange={handleWideExcelFile}
        style={{ display: 'none' }}
      />
      {importing && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/40">
          <div className="bg-white dark:bg-[#181a24] rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3 min-w-[240px]">
            <RefreshCw size={18} className="animate-spin text-blue-500 shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                İçe aktarılıyor{importProgress ? ` (${importProgress.done.toLocaleString('tr-TR')} / ${importProgress.total.toLocaleString('tr-TR')})` : '...'}
              </span>
              {importProgress && (
                <div className="mt-1.5 h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-200"
                    style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {importErrors.length > 0 && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-[#181a24] p-4 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between gap-2 text-red-700 dark:text-red-400 font-semibold text-sm mb-2">
              <span className="flex items-center gap-2">
                <AlertCircle size={16} />
                {importPartialSuccess
                  ? `Geçerli satırlar içe aktarıldı, ${importErrors.length} satır atlandı (hatalı)`
                  : `İçe aktarma başarısız — hiçbir kayıt eklenmedi (${importErrors.length} hata)`}
              </span>
              <button onClick={() => { setImportErrors([]); setImportPartialSuccess(false); }} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {importErrors.map((err, i) => (
                <div key={i} className="text-xs text-red-600 dark:text-red-400">
                  Satır {err.row} — <span className="font-semibold">{err.field}:</span> {err.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
