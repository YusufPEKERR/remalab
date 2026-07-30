import { useState, useEffect, useRef } from 'react';
import { Scan, Info, Layers, Package, Search, RefreshCw, CheckCircle, AlertCircle, User, Clock } from 'lucide-react';
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

  // Batch Girişi'nden (warehouse.batch_entries) gelen gerçek cihaz bilgisi.
  const [device, setDevice] = useState(null);
  // Bu cihaz için Servis Onarımları'nda talep edilmiş parçalar (warehouse.repair_records,
  // bkz. get_repair_supply_requests).
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [stockQty, setStockQty] = useState(null);
  const [serviceStatuList, setServiceStatuList] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  // React'in `disabled={submitting}` prop'u ancak bir re-render sonrası DOM'a yansır - hızlı
  // çift tıklama, ilk tık'ın state güncellemesi işlenmeden ikinci tık'ın da handleIssuePart'ı
  // tetiklemesine yol açabiliyordu. Bu ref, senkron olarak (render beklemeden) ikinci çağrıyı engeller.
  const issuingRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    api.getServiceStatuList().then(res => {
      if (res && res.success) setServiceStatuList(res.service_statu || []);
    });
  }, []);

  const selectedRequest = requests.find(r => r.id === selectedId) || null;

  // Seçili parçanın Good Stock'taki güncel miktarı.
  useEffect(() => {
    if (!selectedRequest?.partItemCode) { setStockQty(null); return; }
    api.getStockByItemCode(selectedRequest.partItemCode).then(res => {
      if (res && res.success) setStockQty(res.quantity);
    });
  }, [selectedRequest?.partItemCode]);

  const statuName = (code) => {
    const s = serviceStatuList.find(x => x.code === code);
    return s ? s.short_name : (code != null ? String(code) : "-");
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const query = imeiInput.trim();
    if (!query) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setDevice(null);
    setRequests([]);
    setSelectedId(null);

    try {
      // 1) Cihazı Batch Girişi'nden bul (warehouse.batch_entries - gerçek telefon bilgisi).
      const devRes = await api.lookupBatchEntry(query);
      if (!devRes || !devRes.success || !devRes.found || !devRes.data) {
        setError('Bu IMEI/Seri No için Batch Girişi kaydı bulunamadı.');
        return;
      }
      setDevice(devRes.data);

      // 2) Bu cihaza ait, teknisyenlerin Servis Onarımları'ndan talep ettiği parçaları getir
      // (get_repair_supply_requests global listesi, IMEI'ye göre client-side filtrelenir).
      const reqRes = await api.getRepairSupplyRequests();
      if (reqRes && reqRes.success) {
        const imei = (devRes.data.imei_number || query).trim().toLowerCase();
        const forDevice = (reqRes.requests || []).filter(r => (r.imei || '').trim().toLowerCase() === imei);
        setRequests(forDevice);
        if (forDevice.length > 0) setSelectedId(forDevice[0].id);
      }
    } catch (err) {
      console.error('Arama hatası:', err);
      setError('Barkod / IMEI arama işlemi sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleIssuePart = async () => {
    if (issuingRef.current) return; // çift tıklama koruması (senkron, render beklemez)
    if (!selectedRequest) {
      setError('Lütfen teslim edilecek bir parça seçin.');
      return;
    }
    if (selectedRequest.supplyIsSuccess) {
      setError('Bu parça zaten teslim edildi.');
      return;
    }

    issuingRef.current = true;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const username = getCurrentUser()?.username;

      // update_repair_supply_status, Depo Durum'u "Stoktan Çıktı" yaparken Good Stock ->
      // Repair Stock transferini ve StockMovement kaydını KENDİSİ atomik olarak yapıyor
      // (bkz. backend - önceki durum zaten "Stoktan Çıktı" değilse). Burada AYRICA
      // transfer_stock çağırmak ÇİFT transfere (1 yerine 2 adet düşmesine) sebep oluyordu -
      // o yüzden tek çağrıya indirildi.
      const res = await api.updateRepairSupplyStatus(selectedRequest.id, "Stoktan Çıktı", username);
      if (!res || !res.success) {
        setError(res?.message || 'Parça teslim edilemedi.');
        return;
      }

      setSuccessMsg(`${selectedRequest.partItemCode} Repair Stock'a transfer edildi ve teslim edildi.`);
      setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, supplyStatusCode: "Stoktan Çıktı", supplyStatusName: "Stoktan Çıktı", supplyIsSuccess: true } : r));

      // Good Stock miktarını anında yenile (artık 1 adet azaldı).
      if (selectedRequest.partItemCode) {
        api.getStockByItemCode(selectedRequest.partItemCode).then(stockRes => {
          if (stockRes && stockRes.success) {
            setStockQty(stockRes.quantity);
          }
        });
      }
    } catch (err) {
      setError('Parça teslimatı sırasında beklenmeyen hata: ' + err.message);
    } finally {
      issuingRef.current = false;
      setSubmitting(false);
    }
  };

  const phoneInfo = device ? [device.model, device.gb, device.color].filter(Boolean).join(' ') || '-' : '-';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ── BARKOD SORGULA ÜST KART ── */}
      <div className="app-card rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-[#16204A] transition-colors">
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 mb-1">
            <Scan size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">IMEI / Seri No Sorgula</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Batch Girişi'nde kayıtlı bir IMEI veya Seri No okutarak cihazı ve talep edilen parçaları görüntüleyin.
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
                className="w-full bg-slate-50 dark:bg-[#0E1630] border border-slate-300 dark:border-slate-700/80 rounded-xl px-5 py-3 text-center font-mono text-base font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0 shadow-lg shadow-blue-600/20"
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
          <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#16204A] shadow-lg flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Info size={20} />
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Genel Bilgiler</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">IMEI / Seri No:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{device.imei_number || device.serial_number}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Telefon Bilgileri:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{phoneInfo}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Müşteri:</span>
                <span className="text-slate-700 dark:text-slate-300">{device.customer_name || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Batch No:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{device.batch_no || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1"><User size={12} /> Teknisyen:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">{selectedRequest?.requestedBy || requests[0]?.requestedBy || "Atanmadı"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1"><Clock size={12} /> Talep Tarihi:</span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">{selectedRequest?.requestedAt || requests[0]?.requestedAt || "-"}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500 dark:text-slate-400">Statü:</span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                  {statuName(device.statu_code)}
                </span>
              </div>
            </div>
          </div>

          {/* KART 2: Depo / Teslim */}
          <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#16204A] shadow-lg flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2 text-purple-500 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Layers size={20} />
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Depo / Teslim</h2>
            </div>

            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Kaynak Depo:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Good Stock</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Hedef Depo:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">Repair Stock</span>
              </div>

              {selectedRequest ? (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Seçili Parça Kodu:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedRequest.partItemCode}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Good Stock'ta Mevcut:</span>
                    <span className={`font-semibold ${stockQty > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {stockQty === null ? "…" : stockQty > 0 ? `${stockQty} adet` : "Stokta yok"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 pt-2">Teslim edilecek parçayı sağdaki listeden seçin.</p>
              )}
            </div>

            <button
              onClick={handleIssuePart}
              disabled={submitting || !selectedRequest || selectedRequest?.supplyIsSuccess}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {selectedRequest?.supplyIsSuccess ? "Teslim Edildi" : "Parça Çıkışı Yap / Teslim Et"}
            </button>
          </div>

          {/* KART 3: Talep Edilen Parçalar */}
          <div className="app-card rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#16204A] shadow-lg flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
                <Package size={20} />
                <h2 className="font-bold text-slate-800 dark:text-slate-100">Talep Edilen Parçalar</h2>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                {requests.length} Öğe
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
              {requests.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">Bu cihaz için depo talebi bulunamadı.</p>
              ) : (
                requests.map((r) => {
                  const isSelected = selectedId === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-sm'
                          : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-[#1E2B5C]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {r.partName || r.itemCategory || 'Parça'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {r.partItemCode}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <User size={10} /> {r.requestedBy}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                          r.supplyIsSuccess
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : r.supplyIsCancelled
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                          {r.supplyStatusName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{r.missionGroup}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-400">
              <span>Toplam Talep:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{requests.length} Parça</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
