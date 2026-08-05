import { useState, useEffect, useRef } from 'react';
import { Scan, Info, Layers, Package, Search, RefreshCw, CheckCircle, AlertCircle, RotateCcw, X } from 'lucide-react';
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

  // Cihazın parçaları (hem teslim edilecek hem teslim edilmiş parçalar)
  const [deliverableParts, setDeliverableParts] = useState([]);
  const [selectedPartCode, setSelectedPartCode] = useState(null);
  const [serviceStatuList, setServiceStatuList] = useState([]);

  // Parça Geri Alma (İade) Modalı state'leri
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedReturnPart, setSelectedReturnPart] = useState(null);
  const [targetStock, setTargetStock] = useState('GOOD'); // 'GOOD' veya 'DOA'
  const [returning, setReturning] = useState(false);

  // Filtreleme & Arama State'leri
  const [searchFilter, setSearchFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('Hepsi');

  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const issuingRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    api.getServiceStatuList().then(res => {
      if (res && res.success) setServiceStatuList(res.service_statu || []);
    });
  }, []);

  const statuName = (code) => {
    const s = serviceStatuList.find(x => x.code === code);
    return s ? s.short_name : (code != null ? String(code) : "-");
  };

  // Cihaza Eklenmiş Tüm Parçaları Getir
  const fetchDeliverableParts = async (brand, model, color, imeiOrSerial) => {
    try {
      const res = await api.getDeliverablePartsForDevice(brand, model, color, imeiOrSerial);
      if (res && res.success) {
        const partsList = res.parts || [];
        setDeliverableParts(partsList);
      } else {
        setError(res?.message || 'Parçalar alınamadı.');
      }
    } catch (err) {
      console.error('Parçaları alma hatası:', err);
      setError('Cihaz parçaları alınırken hata oluştu.');
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

      const imeiOrSerial = devData.imei_number || devData.serial_number || query;

      // 2) Cihaza eklenmiş parçaları getir
      await fetchDeliverableParts(devData.brand, devData.model, devData.color, imeiOrSerial);

    } catch (err) {
      console.error('Arama hatası:', err);
      setError('Barkod / IMEI arama işlemi sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Parça Çıkışı / Teslim Et İşlemi
  const handleDeliverPart = async (targetPart) => {
    if (issuingRef.current) return;
    if (!targetPart) {
      setError('Lütfen teslim edilecek bir parça seçin.');
      return;
    }
    if (targetPart.goodStockQty < 1 && !targetPart.isStoksuz) {
      setError(`'${targetPart.partName}' Good Stock depoda tükenmiştir.`);
      return;
    }

    issuingRef.current = true;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const username = getCurrentUser()?.username;
      const imeiOrSerial = device?.imei_number || device?.serial_number || imeiInput;

      const res = await api.deliverPartToDevice(imeiOrSerial, targetPart.itemCode, username);
      if (!res || !res.success) {
        setError(res?.message || 'Parça teslimatı başarısız oldu.');
        return;
      }

      setSuccessMsg(res.message || `'${targetPart.partName}' (${targetPart.itemCode}) teslim edildi.`);

      // Listeleri yenile
      await fetchDeliverableParts(device.brand, device.model, device.color, imeiOrSerial);
    } catch (err) {
      setError('Parça teslimatı sırasında beklenmeyen hata: ' + err.message);
    } finally {
      issuingRef.current = false;
      setSubmitting(false);
    }
  };

  // Parçayı Geri Alma Modalını Aç
  const handleOpenReturnModal = (part) => {
    setSelectedReturnPart(part);
    setTargetStock('GOOD');
    setReturnModalOpen(true);
  };

  // Parçayı Geri Alma Onayı (Good veya DOA Stock'a Aktarma)
  const handleConfirmReturn = async () => {
    if (!selectedReturnPart) return;
    setReturning(true);
    setError('');
    setSuccessMsg('');

    try {
      const username = getCurrentUser()?.username;
      const imeiOrSerial = device?.imei_number || device?.serial_number || imeiInput;

      const res = await api.returnDeliveredPart(
        selectedReturnPart.repairRecordId,
        imeiOrSerial,
        targetStock,
        username
      );

      if (!res || !res.success) {
        setError(res?.message || 'Parça geri alma işlemi başarısız oldu.');
        setReturnModalOpen(false);
        return;
      }

      setSuccessMsg(res.message || `'${selectedReturnPart.partName}' parçası teslimden geri alındı.`);
      setReturnModalOpen(false);
      setSelectedReturnPart(null);

      // Listeleri yenile
      await fetchDeliverableParts(device.brand, device.model, device.color, imeiOrSerial);
    } catch (err) {
      setError('Parça iadesi sırasında hata: ' + err.message);
      setReturnModalOpen(false);
    } finally {
      setReturning(false);
    }
  };

  const phoneInfo = device ? [device.model, device.gb, device.color].filter(Boolean).join(' ') || '-' : '-';

  const teams = ['Hepsi', ...new Set(deliverableParts.map(p => p.repairTeamName).filter(Boolean))].sort(
    (a, b) => a === 'Hepsi' ? -1 : b === 'Hepsi' ? 1 : a.localeCompare(b, 'tr')
  );

  const filteredParts = deliverableParts.filter(p => {
    const matchesTeam = teamFilter === 'Hepsi' || p.repairTeamName === teamFilter;
    const matchesSearch = !searchFilter.trim() ||
      (p.partName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.itemCode || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.repairTeamName || '').toLowerCase().includes(searchFilter.toLowerCase());
    return matchesTeam && matchesSearch;
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">IMEI / Seri No ile Parça Teslimi & Geri Alma</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Cihaza eklenmiş parçaları listelemek, teslimat ve geri alma yapmak için IMEI veya Seri No okutunuz.
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

      {/* ── BİRLEŞTİRİLMİŞ KONTROL PANELİ ── */}
      {device && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* KART 1: Cihaz Bilgileri */}
            <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12141c] shadow-lg flex flex-col justify-between space-y-4 lg:col-span-1">
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
                  <span className="text-slate-500 dark:text-slate-400">Telefon Bilgisi:</span>
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

            {/* BİRLEŞTİRİLMİŞ KART: Depo İşlemleri & Cihaz Parçaları */}
            <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12141c] shadow-lg flex flex-col justify-between space-y-4 lg:col-span-2">
              
              {/* Üst Başlık & Depo Bilgisi */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-3">
                <div className="flex items-center gap-2 text-purple-500 dark:text-purple-400">
                  <Layers size={20} />
                  <h2 className="font-bold text-slate-800 dark:text-slate-100">Depo & Parça Teslimat Yönetimi</h2>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-medium">
                    Good Stock <span className="text-slate-400">➔</span> Repair Stock
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                    {filteredParts.length} Parça
                  </span>
                </div>
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
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#090a0f] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {teams.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                    {teams.map(team => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => setTeamFilter(team)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          teamFilter === team
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {team}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Birleşik Parça Listesi (Her Satır Kendi Aksiyonuna Sahip) */}
              <div className="space-y-2.5 overflow-y-auto max-h-96 pr-1 flex-1">
                {filteredParts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-1">
                    <Package size={32} className="mx-auto text-amber-400 dark:text-amber-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Bu cihaza eklenmiş parça bulunmamaktadır.</p>
                  </div>
                ) : (
                  filteredParts.map((p) => {
                    const isColorMatch = device?.color && p.color &&
                      p.color.toLowerCase().trim() === device.color.toLowerCase().trim();

                    return (
                      <div
                        key={p.repairRecordId || p.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                          p.isDelivered
                            ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20'
                            : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#181a24]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate" title={p.partName}>
                              {p.partName}
                            </span>
                            {isColorMatch && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                Renge Uygun
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="font-mono font-bold text-blue-600 dark:text-[#00b2ff]">{p.itemCode}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 dark:text-slate-400">{p.repairTeamName || 'Genel'}</span>
                            {p.color && (
                              <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300 text-[10px]">{p.color}</span>
                            )}
                          </div>
                        </div>

                        {/* DİLİM / BADGE KISMI & AKSİYON BUTONLARI */}
                        <div className="flex items-center gap-3 shrink-0">
                          {p.isDelivered ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                                <CheckCircle size={14} />
                                Teslim Edildi
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenReturnModal(p)}
                                className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-lg border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Parçayı Teslimden Geri Al (Good Stock / DOA Stock)"
                              >
                                <RotateCcw size={14} />
                                Parçayı Geri Al
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                                p.goodStockQty > 0
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                Good Stock: {p.goodStockQty}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleDeliverPart(p)}
                                disabled={submitting || !p.isAvailable}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-blue-600/20"
                              >
                                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Package size={14} />}
                                Teslim Et
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-400">
                <span>Toplam Ekli Parça:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {filteredParts.length} adet ({filteredParts.filter(p => p.isDelivered).length} Teslim Edilmiş, {filteredParts.filter(p => !p.isDelivered).length} Bekliyor)
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── PARÇA GERİ ALMA (İADE) MODALI ── */}
      {returnModalOpen && selectedReturnPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Parçayı Teslimden Geri Al</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Teslim edilen parçanın stoğa iade yönlendirmesi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected Part Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Geri Alınacak Parça:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={selectedReturnPart.partName}>{selectedReturnPart.partName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Parça Kodu:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-[#00b2ff]">{selectedReturnPart.itemCode}</span>
              </div>
              {selectedReturnPart.deliveredBy && (
                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                  <span>Teslim Eden: {selectedReturnPart.deliveredBy}</span>
                  <span>{selectedReturnPart.deliveredAt}</span>
                </div>
              )}
            </div>

            {/* Stock Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Hangi stoğa aktarılsın? (Hedef Depo Seçimi)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* GOOD STOCK OPTION */}
                <div
                  onClick={() => setTargetStock('GOOD')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    targetStock === 'GOOD'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <CheckCircle size={16} />
                      <span>Good Stock</span>
                    </div>
                    <input
                      type="radio"
                      name="targetStock"
                      checked={targetStock === 'GOOD'}
                      onChange={() => setTargetStock('GOOD')}
                      className="accent-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Parça sağlam ve kullanılabilir. <strong>Good Stock (Ana Depo)</strong> alanına iade edilir.
                  </p>
                </div>

                {/* DOA STOCK OPTION */}
                <div
                  onClick={() => setTargetStock('DOA')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    targetStock === 'DOA'
                      ? 'border-rose-500 bg-rose-500/10 shadow-md ring-1 ring-rose-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                      <AlertCircle size={16} />
                      <span>DOA Stock</span>
                    </div>
                    <input
                      type="radio"
                      name="targetStock"
                      checked={targetStock === 'DOA'}
                      onChange={() => setTargetStock('DOA')}
                      className="accent-rose-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Parça kusurlu veya arızalı. <strong>DOA Stock (Hasarlı)</strong> alanına aktarılır.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                disabled={returning}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={returning}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {returning ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                Geri Almayı Onayla ({targetStock === 'GOOD' ? 'Good Stock' : 'DOA Stock'})
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
