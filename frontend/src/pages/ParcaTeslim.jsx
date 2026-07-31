import { useState, useEffect, useRef } from 'react';
import { Scan, Info, Layers, Package, Search, RefreshCw, CheckCircle, AlertCircle, User, Filter, Tag } from 'lucide-react';
import { api } from '../services/api';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

export default function ParcaTeslim() {
  const [imeiInput, setImeiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Batch Girişi'nden (warehouse.batch_entries) gelen cihaz bilgisi
  const [device, setDevice] = useState(null);
  
  // Cihazın Marka, Model ve Rengine göre teslim edilebilecek parçalar
  const [deliverableParts, setDeliverableParts] = useState([]);
  const [selectedPartCode, setSelectedPartCode] = useState(null);
  const [stockQty, setStockQty] = useState(null);
  const [serviceStatuList, setServiceStatuList] = useState([]);
  
  // Filtreleme & Arama State'leri
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Hepsi');

  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const issuingRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    api.getServiceStatuList().then(res => {
      if (res && res.success) setServiceStatuList(res.service_statu || []);
    });
  }, []);

  const selectedPart = deliverableParts.find(p => p.itemCode === selectedPartCode) || null;

  // Seçili parçanın Good Stock'taki miktarını güncelle
  useEffect(() => {
    if (!selectedPart?.itemCode) { setStockQty(null); return; }
    api.getStockByItemCode(selectedPart.itemCode).then(res => {
      if (res && res.success) setStockQty(res.quantity);
    });
  }, [selectedPart?.itemCode]);

  const statuName = (code) => {
    const s = serviceStatuList.find(x => x.code === code);
    return s ? s.short_name : (code != null ? String(code) : "-");
  };

  // Cihaza Uygun Teslim Edilebilir Parçaları Getir
  const fetchDeliverableParts = async (brand, model, color) => {
    try {
      const res = await api.getDeliverablePartsForDevice(brand, model, color);
      if (res && res.success) {
        const partsList = res.parts || [];
        setDeliverableParts(partsList);
        if (partsList.length > 0) {
          // İlk uygun (stokta olan) parçayı varsayılan olarak seç
          const firstInStock = partsList.find(p => p.isAvailable) || partsList[0];
          setSelectedPartCode(firstInStock.itemCode);
        }
      }
    } catch (err) {
      console.error('Teslim edilebilir parçaları alma hatası:', err);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const query = imeiInput.trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setDevice(null);
    setDeliverableParts([]);
    setSelectedPartCode(null);

    try {
      // 1) Cihazı Batch Girişi'nden bul (warehouse.batch_entries)
      const devRes = await api.lookupBatchEntry(query);
      if (!devRes || !devRes.success || !devRes.found || !devRes.data) {
        setError('Bu IMEI/Seri No için kayıtlı cihaz bulunamadı.');
        return;
      }
      const devData = devRes.data;
      setDevice(devData);

      // 2) Cihazın Marka, Model ve Rengine göre teslim edilebilecek parçaları getir
      await fetchDeliverableParts(devData.brand, devData.model, devData.color);

    } catch (err) {
      console.error('Arama hatası:', err);
      setError('Barkod / IMEI arama işlemi sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Parça Çıkışı / Teslim Et İşlemi
  const handleDeliverPart = async () => {
    if (issuingRef.current) return;
    if (!selectedPart) {
      setError('Lütfen teslim edilecek bir parça seçin.');
      return;
    }
    if (selectedPart.goodStockQty < 1) {
      setError('Seçili parça Good Stock depoda tükenmiştir.');
      return;
    }

    issuingRef.current = true;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const username = getCurrentUser()?.username;
      const imeiOrSerial = device?.imei_number || device?.serial_number || imeiInput;

      const res = await api.deliverPartToDevice(imeiOrSerial, selectedPart.itemCode, username);
      if (!res || !res.success) {
        setError(res?.message || 'Parça teslimatı başarısız oldu.');
        return;
      }

      setSuccessMsg(res.message || `'${selectedPart.partName}' (${selectedPart.itemCode}) teslim edildi.`);
      
      // Parça listesindeki stok miktarını yerel olarak güncelle (-1)
      setDeliverableParts(prev => prev.map(p => {
        if (p.itemCode === selectedPart.itemCode) {
          const newQty = Math.max(0, p.goodStockQty - 1);
          return { ...p, goodStockQty: newQty, isAvailable: newQty > 0 };
        }
        return p;
      }));

      // Güncel Good Stock miktarını çek
      setStockQty(prev => prev !== null ? Math.max(0, prev - 1) : null);

    } catch (err) {
      setError('Parça teslimatı sırasında beklenmeyen hata: ' + err.message);
    } finally {
      issuingRef.current = false;
      setSubmitting(false);
    }
  };

  const phoneInfo = device ? [device.brand, device.model, device.gb, device.color].filter(Boolean).join(' ') || '-' : '-';

  // Kategoriler Listesi (Filtreleme için)
  const categories = ['Hepsi', ...new Set(deliverableParts.map(p => p.itemCategory).filter(Boolean))];

  // Filtrelenmiş Parçalar
  const filteredParts = deliverableParts.filter(p => {
    const matchesCat = categoryFilter === 'Hepsi' || p.itemCategory === categoryFilter;
    const matchesSearch = !searchFilter.trim() || 
      (p.partName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.itemCode || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.itemCategory || '').toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── BARKOD SORGULA ÜST KART ── */}
      <div className="app-card rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-[#12141c] transition-colors">
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 mb-1">
            <Scan size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">IMEI / Seri No ile Parça Teslimi</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Cihaza uygun teslim edilebilir parçaları listelemek için IMEI veya Seri No okutunuz.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={imeiInput}
                onChange={(e) => setImeiInput(e.target.value)}
                placeholder="IMEI veya Seri No giriniz..."
                className="w-full bg-slate-50 dark:bg-[#090a0f] border border-slate-300 dark:border-slate-700/80 rounded-xl px-5 py-3 text-center font-mono text-base font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
              Sorgula
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {successMsg && (
            <div className="text-sm text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> {successMsg}
            </div>
          )}
        </form>
      </div>

      {/* ── 3 SÜTUNLU DETAY VE KONTROL KARTLARI ── */}
      {device && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-300">

          {/* KART 1: Genel Bilgiler */}
          <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12141c] shadow-lg flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Info size={20} />
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Cihaz Bilgileri</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">IMEI / Seri No:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{device.imei_number || device.serial_number}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Marka / Model:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{phoneInfo}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Cihaz Rengi:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs">
                  {device.color || "Belirtilmedi"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Müşteri:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">{device.customer_name || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Batch No:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{device.batch_no || "-"}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500 dark:text-slate-400">Statü:</span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {statuName(device.statu_code)}
                </span>
              </div>
            </div>
          </div>

          {/* KART 2: Depo / Teslim İşlemi */}
          <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12141c] shadow-lg flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2 text-purple-500 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Layers size={20} />
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Depo / Teslim İşlemi</h2>
            </div>

            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Kaynak Depo:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Good Stock (Ana Depo)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Hedef Depo:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Repair Stock (Teknisyen)</span>
              </div>

              {selectedPart ? (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Seçili Parça Adı:</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[170px]" title={selectedPart.partName}>{selectedPart.partName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Parça Kodu:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-[#00b2ff]">{selectedPart.itemCode}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Kategori / Renk:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{selectedPart.itemCategory || "-"} {selectedPart.color ? `(${selectedPart.color})` : ''}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <span>Good Stock Miktarı:</span>
                    <span className={`font-bold ${selectedPart.goodStockQty > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {selectedPart.goodStockQty > 0 ? `${selectedPart.goodStockQty} adet mevcut` : "Tükenmiş"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 pt-2">Teslim edilecek parçayı sağdaki listeden seçiniz.</p>
              )}
            </div>

            <button
              onClick={handleDeliverPart}
              disabled={submitting || !selectedPart || !selectedPart.isAvailable}
              className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <RefreshCw size={18} className="animate-spin" /> : <Package size={18} />}
              Parça Çıkışı Yap / Teslim Et
            </button>
          </div>

          {/* KART 3: Teslim Edilebilecek Parçalar (Marka/Model/Renge Göre) */}
          <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12141c] shadow-lg flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
                <Package size={20} />
                <h2 className="font-bold text-slate-800 dark:text-slate-100">Teslim Edilebilecek Parçalar</h2>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                {filteredParts.length} Parça
              </span>
            </div>

            {/* Arama & Kategori Filtre Toolbar */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Parça adı veya kodu ara..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#090a0f] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {categories.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Parçalar Listesi */}
            <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
              {filteredParts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-1">
                  <Package size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-semibold">Bu cihaza uygun teslim edilebilir parça bulunamadı.</p>
                  <p className="text-[11px] text-slate-400">Cihazın marka/model bilgisine uygun parçaları envanterden kontrol edin.</p>
                </div>
              ) : (
                filteredParts.map((p) => {
                  const isSelected = selectedPartCode === p.itemCode;
                  const isColorMatch = device?.color && p.color && 
                    p.color.toLowerCase().trim() === device.color.toLowerCase().trim();

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPartCode(p.itemCode)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-500/10 shadow-sm ring-1 ring-blue-500/30'
                          : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-[#181a24]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate" title={p.partName}>
                            {p.partName}
                          </span>
                          {isColorMatch && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                              Renge Uygun
                            </span>
                          )}
                        </div>

                        <div className="font-mono text-[11px] text-blue-600 dark:text-[#00b2ff] font-semibold mt-0.5 truncate">
                          {p.itemCode}
                        </div>

                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                          <span>{p.itemCategory || 'Genel'}</span>
                          {p.color && <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300">{p.color}</span>}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          p.isAvailable
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          {p.isAvailable ? `Good Stock: ${p.goodStockQty}` : 'Stokta Yok'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{p.model}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-400">
              <span>Listelenen Parça:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredParts.length} adet</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
