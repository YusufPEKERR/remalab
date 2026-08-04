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

  // Cihazın Marka, Model ve Rengine göre teslim edilebilecek parçalar
  const [deliverableParts, setDeliverableParts] = useState([]);
  const [selectedPartCode, setSelectedPartCode] = useState(null);
  const [serviceStatuList, setServiceStatuList] = useState([]);

  // Teslim Edilmiş Parçalar (Geri alma işlemleri için)
  const [deliveredParts, setDeliveredParts] = useState([]);
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

  const selectedPart = deliverableParts.find(p => p.itemCode === selectedPartCode) || null;

  const statuName = (code) => {
    const s = serviceStatuList.find(x => x.code === code);
    return s ? s.short_name : (code != null ? String(code) : "-");
  };

  // Cihaza Eklenmiş / Teslim Edilebilir Parçaları Getir
  const fetchDeliverableParts = async (brand, model, color, imeiOrSerial) => {
    try {
      const res = await api.getDeliverablePartsForDevice(brand, model, color, imeiOrSerial);
      if (res && res.success) {
        const partsList = res.parts || [];
        setDeliverableParts(partsList);
        if (partsList.length > 0) {
          const firstInStock = partsList.find(p => p.isAvailable) || partsList[0];
          setSelectedPartCode(firstInStock.itemCode);
        } else {
          setSelectedPartCode(null);
        }
      } else {
        setError(res?.message || 'Teslim edilebilir parçalar alınamadı.');
      }
    } catch (err) {
      console.error('Teslim edilebilir parçaları alma hatası:', err);
      setError('Teslim edilebilir parçalar alınırken hata oluştu.');
    }
  };

  // Cihaza Ait Teslim Edilmiş Parçaları Getir (Geri Alma için)
  const fetchDeliveredParts = async (imeiOrSerial) => {
    try {
      const res = await api.getDeliveredPartsForDevice(imeiOrSerial);
      if (res && res.success) {
        setDeliveredParts(res.parts || []);
      }
    } catch (err) {
      console.error('Teslim edilen parçaları alma hatası:', err);
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
    setDeliveredParts([]);
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

      // 2) Cihaza eklenmiş teslim edilebilir parçaları getir
      await fetchDeliverableParts(devData.brand, devData.model, devData.color, imeiOrSerial);

      // 3) Cihaza teslim edilmiş parçaları getir (Geri Alma)
      await fetchDeliveredParts(imeiOrSerial);

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
    if (selectedPart.goodStockQty < 1 && !selectedPart.isStoksuz) {
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

      // Listeleri yenile
      await fetchDeliverableParts(device.brand, device.model, device.color, imeiOrSerial);
      await fetchDeliveredParts(imeiOrSerial);
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
      await fetchDeliveredParts(imeiOrSerial);
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
              Cihaza uygun teslim edilecek ve teslim edilmiş parçaları listelemek için IMEI veya Seri No okutunuz.
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

      {/* ── DETAY VE KONTROL KARTLARI ── */}
      {device && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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
                      <span>Onarım Takımı / Renk:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{selectedPart.repairTeamName || "-"} {selectedPart.color ? `(${selectedPart.color})` : ''}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <span>Good Stock Miktarı:</span>
                      <span className={`font-bold ${selectedPart.goodStockQty > 0 || selectedPart.isStoksuz ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {selectedPart.isStoksuz ? "Stok Takipsiz (Serbest)" : selectedPart.goodStockQty > 0 ? `${selectedPart.goodStockQty} adet mevcut` : "Tükenmiş"}
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

                {teams.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                    {teams.map(team => (
                      <button
                        key={team}
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

              {/* Parçalar Listesi */}
              <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                {filteredParts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-1">
                    <Package size={32} className="mx-auto text-amber-400 dark:text-amber-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Bu cihaza eklenmiş/talep edilmiş teslim bekleyen parça bulunmamaktadır.</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                      Depodan parça çıkışı yapılabilmesi için teknisyenin önce onarım ekranından cihaza parça eklemiş olması gereklidir.
                    </p>
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
                            <span>{p.repairTeamName || 'Genel'}</span>
                            {p.color && <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300">{p.color}</span>}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            p.isAvailable
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {p.isStoksuz ? 'Stoksuz' : p.isAvailable ? `Good Stock: ${p.goodStockQty}` : 'Stokta Yok'}
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

          {/* ── TESLİM EDİLMİŞ PARÇALAR / GERİ ALMA ALANI ── */}
          <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12141c] shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
                <RotateCcw size={20} />
                <h2 className="font-bold text-slate-800 dark:text-slate-100">Teslim Edilmiş Parçalar (Geri Alma)</h2>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                {deliveredParts.length} Teslim Edilmiş Parça
              </span>
            </div>

            {deliveredParts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Bu cihaza henüz teslim edilmiş bir parça bulunmamaktadır.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deliveredParts.map((dp) => (
                  <div
                    key={dp.repairRecordId}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={dp.partName}>
                          {dp.partName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                          Stoktan Çıktı
                        </span>
                      </div>
                      <div className="font-mono text-xs font-bold text-blue-600 dark:text-[#00b2ff]">{dp.itemCode}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/80">
                        <span>Teslim Eden: {dp.deliveredBy || "Sistem"}</span>
                        <span>{dp.deliveredAt}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenReturnModal(dp)}
                      className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-lg border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RotateCcw size={14} />
                      Parçayı Geri Al
                    </button>
                  </div>
                ))}
              </div>
            )}
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
