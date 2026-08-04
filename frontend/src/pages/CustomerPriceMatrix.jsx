import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { DollarSign, Save, Search, FileSpreadsheet, RefreshCw, Filter } from 'lucide-react';
import { api } from '../services/api';

const ROW_HEIGHT_FALLBACK = 42; // ilk ölçüm gelene kadar kullanılan tahmini satır yüksekliği
const OVERSCAN_ROWS = 8; // görünür alanın üstünde/altında ekstra render edilen satır sayısı
const SEARCH_DEBOUNCE_MS = 150;

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
const PriceMatrixRow = memo(function PriceMatrixRow({ item, customers, dirtyRow, priceRow, onCellChange, measureRef }) {
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

export default function CustomerPriceMatrix() {
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
  // göre daralır (bkz. get_price_matrix_models/get_price_matrix_categories'in
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
        api.getPriceMatrixCustomers(),
        api.getPriceMatrixBrands(),
      ]);
      if (custRes.success) setCustomers(custRes.customers || []);
      if (brandRes.success) setBrands(brandRes.brands || []);
      setDirty({});
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => { loadStatic(); }, [loadStatic]);

  // Varsayılan görünüm (hiçbir filtre seçilmeden) TÜM katalogdur - parçalar VE işçilik
  // (DGD) kodları dahil, ne varsa gösterilir. Marka/model/kategori/ürün tipi sadece
  // isteğe bağlı daraltma filtreleridir, artık zorunlu değildir. Bu, filtresiz haldeyken
  // bile hızlı kalır çünkü hem items hem prices filtresiz çağrıldığında backend'de
  // api_cache/*.json + fetch_url deseniyle (QWebChannel yerine HTTP ile) döner, tablo da
  // sanallaştırılmış (virtualized) render edildiğinden binlerce satır DOM'u zorlamaz.
  const loadItems = useCallback(async (brand, productType, model, category) => {
    setItemsLoading(true);
    try {
      const [itemRes, priceRes] = await Promise.all([
        api.getPriceMatrixItems('', brand, category, model, productType),
        api.getPriceMatrix(brand, category, model, productType),
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
    api.getPriceMatrixProductTypes(selectedBrand)
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
    api.getPriceMatrixModels(selectedBrand, selectedProductType)
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
    api.getPriceMatrixCategories(selectedBrand, selectedModel, selectedProductType)
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
    await loadItems(selectedBrand, selectedProductType, selectedModel, selectedCategory);
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
    const res = await api.savePriceMatrixBatch(rows, getCurrentUser()?.username);
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
    await api.exportTableToExcel(exportData, 'musteri_fiyat_matrisi.xlsx');
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
              <DollarSign size={13} className="text-emerald-400" /> FİYATLANDIRMA
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Müşteri Fiyat Matrisi
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Varsayılan olarak tüm parçalar ve işçilik (DGD) kodları listelenir; isterseniz marka, ürün tipi, model ve/veya kategoriyle daraltın.
              Boş hücre, genel (item.satis) fiyata geri düşer.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={handleExport}
              disabled={totalRows === 0}
              className="flex items-center gap-2 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={15} /> Dışa Aktar
            </button>
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
                    <PriceMatrixRow
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
    </div>
  );
}
