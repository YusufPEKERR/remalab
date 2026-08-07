import { useState, useMemo, useRef } from 'react';
import { CheckCircle, AlertTriangle, X, ClipboardCheck, Undo2, Barcode, Search } from 'lucide-react';
import { api } from '../services/api';
import { FAULT_CATALOG } from '../constants/faultCatalog';
import EtiketYazdirModal from './EtiketYazdirModal';

const NotificationToast = ({ notification, onClose }) => {
  if (!notification) return null;
  const colors = {
    success: 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    error: 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300'
  };
  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <AlertTriangle size={18} className="text-red-500" />
  };
  return (
    <div className={`fixed top-6 right-6 z-[110] max-w-sm w-full border rounded-xl px-4 py-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-3 fade-in duration-300 ${colors[notification.type]}`}>
      <span className="mt-0.5 shrink-0">{icons[notification.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{notification.message}</p>
      </div>
      <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

export default function TestResultScreen({
  title,
  subtitle,
  sourceStatuCode,
  successStatuCode,
  failStatuCode,
  logExitTest = false,
  etiketSor = false      // Son Test: başarılı sonuçta cihaz etiketi sorulur
}) {
  const [successImei, setSuccessImei] = useState('');
  const [failImei, setFailImei] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFaultIds, setSelectedFaultIds] = useState([]);
  const [faultSearch, setFaultSearch] = useState('');
  const [successLoading, setSuccessLoading] = useState(false);
  const [failLoading, setFailLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  // "Test Başarılı" onayından SONRA gösterilen PhoneCheck test bilgisi. { imei, data } | null
  const [successPcInfo, setSuccessPcInfo] = useState(null);
  const [etiketCihazi, setEtiketCihazi] = useState(null);
  // Barkod artık onay sonrası otomatik açılmaz; kullanıcı "Barkod Yazdır" butonuna
  // basınca modal açılır (isteğe bağlı barkod çıkarma).
  const [etiketModalAcik, setEtiketModalAcik] = useState(false);
  const successInputRef = useRef(null);

  const selectedFaultLabels = useMemo(() => {
    const set = new Set(selectedFaultIds);
    const labels = [];
    FAULT_CATALOG.forEach(({ category, items }) => {
      items.forEach((text) => {
        const id = `${category}::${text}`;
        if (set.has(id)) labels.push(`${category}: ${text}`);
      });
    });
    return labels;
  }, [selectedFaultIds]);

  // Seçilen hatalar, çarpı ile silinebilen kutucuklar (çip) olarak gösterilir.
  const selectedFaultChips = useMemo(() => {
    const set = new Set(selectedFaultIds);
    const chips = [];
    FAULT_CATALOG.forEach(({ category, items }) => {
      items.forEach((text) => {
        const id = `${category}::${text}`;
        if (set.has(id)) chips.push({ id, category, text });
      });
    });
    return chips;
  }, [selectedFaultIds]);

  // Arama: kategori veya hata metninde geçen öğeleri filtreler. Boşsa tüm katalog.
  const filteredCatalog = useMemo(() => {
    const q = faultSearch.trim().toLocaleLowerCase('tr');
    if (!q) return FAULT_CATALOG;
    return FAULT_CATALOG
      .map(({ category, items }) => ({
        category,
        items: items.filter(text =>
          `${category} ${text}`.toLocaleLowerCase('tr').includes(q)),
      }))
      .filter(g => g.items.length > 0);
  }, [faultSearch]);

  const removeFault = (id) =>
    setSelectedFaultIds(prev => prev.filter(f => f !== id));

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const toggleFault = (id) => {
    setSelectedFaultIds(prev => {
      if (prev.includes(id)) return prev.filter(f => f !== id);
      if (prev.length >= 10) {
        showNotification('error', 'En fazla 10 hatalı parça / hata kodu seçebilirsiniz.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const resolveEntry = async (imei) => {
    const scanData = await api.scanBatchEntryStatu(imei.trim());
    if (!scanData.success) {
      throw new Error(scanData.message || 'Cihaz bulunamadı.');
    }
    return scanData;
  };

  const handleSuccess = async (e) => {
    e.preventDefault();
    if (!successImei.trim()) return;
    setSuccessLoading(true);
    setSuccessPcInfo(null);
    try {
      const scanData = await resolveEntry(successImei);
      const res = await api.submitTestResult(
        scanData.entry_id, sourceStatuCode, successStatuCode, failStatuCode, 'success', '', [], logExitTest
      );
      if (res.success) {
        showNotification('success', res.message);
        // IMEI onaylandıktan (Test Başarılı) SONRA, cihazın PhoneCheck test verisini göster.
        // Kaynak: kayıtlı phonecheck_test_results, yoksa canlı PhoneCheck fallback.
        try {
          const pc = await api.getPhonecheckStoredByImei(scanData.imei);
          setSuccessPcInfo({
            imei: scanData.imei,
            data: (pc && pc.success && pc.found && pc.data) ? pc.data : null,
          });
        } catch (_e) {
          setSuccessPcInfo({ imei: scanData.imei, data: null });
        }
        // Test başarılıysa cihaz barkodu için buton hazırlanır (yalnızca Son Test
        // ekranında). Otomatik açılmaz; kullanıcı butona basınca yazdırılır.
        if (etiketSor) {
          setEtiketModalAcik(false);
          setEtiketCihazi({
            imei: scanData.imei,
            internalId: scanData.internal_id || '',
            serialNo: scanData.serial_number || '',
            brand: scanData.brand || '',
            model: scanData.model || '',
            gb: scanData.gb || '',
            color: scanData.color || '',
            productCode: scanData.batch_no || '',
          });
        }
      } else {
        showNotification('error', res.message);
      }
    } catch (err) {
      showNotification('error', err.message || 'Bağlantı hatası.');
    } finally {
      setSuccessLoading(false);
      setSuccessImei('');
      successInputRef.current?.focus();
    }
  };

  const handleFail = async (e) => {
    e.preventDefault();
    if (!failImei.trim()) return;
    if (!description.trim()) {
      showNotification('error', 'Açıklama zorunludur.');
      return;
    }
    if (selectedFaultIds.length === 0) {
      showNotification('error', 'En az bir hatalı parça / hata kodu seçmelisiniz.');
      return;
    }

    setFailLoading(true);
    try {
      const scanData = await resolveEntry(failImei);
      const res = await api.submitTestResult(
        scanData.entry_id, sourceStatuCode, successStatuCode, failStatuCode, 'fail', description.trim(), selectedFaultLabels, logExitTest
      );
      if (res.success) {
        showNotification('success', res.message);
        setFailImei('');
        setDescription('');
        setSelectedFaultIds([]);
        setFaultSearch('');
      } else {
        showNotification('error', res.message);
      }
    } catch (err) {
      showNotification('error', err.message || 'Bağlantı hatası.');
    } finally {
      setFailLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <EtiketYazdirModal
        acik={etiketModalAcik}
        cihaz={etiketCihazi}
        tur="cihaz"
        onKapat={() => setEtiketModalAcik(false)}
      />

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(91, 110, 196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(91, 110, 196,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/30 text-[#1e222d] dark:text-blue-300 text-xs font-semibold tracking-wide">
              <ClipboardCheck size={13} className="text-blue-400" /> KALİTE KONTROL VE TEST DEPARTMANI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Başarılı */}
        <div className="lg:col-span-1 bg-[#F5F7FC] dark:bg-[#12141c] border border-emerald-500/40 rounded-2xl overflow-hidden flex flex-col shadow-md">
          <div className="bg-emerald-600/90 px-5 py-3.5 flex items-center gap-2 border-b border-emerald-500/40">
            <CheckCircle size={18} className="text-[#181a24] dark:text-white" />
            <h3 className="text-xs font-semibold text-[#181a24] dark:text-white uppercase tracking-wider">Test Başarılı (Onay)</h3>
          </div>
          <form onSubmit={handleSuccess} className="p-6 space-y-4">
            <p className="text-xs text-[#5A6685] dark:text-[#8892B5] leading-relaxed">
              Test başarılı sonuçlanmış ise, IMEI girip "Test Başarılı" butonu ile bir sonraki aşamaya aktarın.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">IMEI Okutun <span className="text-emerald-400">*</span></label>
              <input
                ref={successInputRef}
                type="text"
                placeholder="IMEI okutun veya yazın..."
                className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-emerald-500 transition-all"
                value={successImei}
                onChange={e => setSuccessImei(e.target.value)}
                disabled={successLoading}
              />
            </div>
            <button
              type="submit"
              disabled={successLoading || !successImei.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-6 py-3 rounded-xl transition-all font-semibold text-xs cursor-pointer flex items-center justify-center gap-2 shadow-md"
            >
              <CheckCircle size={16} /> {successLoading ? 'İşleniyor...' : 'Test Başarılı'}
            </button>
          </form>

          {/* Onay sonrası ISTEĞE BAĞLI barkod: otomatik açılmaz, kullanıcı basınca yazdırılır. */}
          {etiketSor && etiketCihazi && (
            <div className="px-6 pb-5 -mt-2">
              <button
                type="button"
                onClick={() => setEtiketModalAcik(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all font-semibold text-xs cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <Barcode size={16} /> Barkod Yazdır
              </button>
              <p className="mt-2 text-[10px] text-center text-[#5A6685] dark:text-[#8892B5]">
                Son test onaylandı · <span className="font-mono">{etiketCihazi.imei}</span> — barkod isteğe bağlıdır
              </p>
            </div>
          )}

          {/* Onaydan SONRA gösterilen PhoneCheck test bilgisi (Son teste kabulde artık çekilmiyor). */}
          {successPcInfo && (
            <div className="px-6 pb-6">
              <div className="rounded-xl border border-[#DCE1F1] dark:border-[#2e3545] bg-[#FFFFFF] dark:bg-[#181a24] p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#5A6685] dark:text-[#8892B5] uppercase tracking-wider">
                  <ClipboardCheck size={12} /> PhoneCheck Test Bilgisi · <span className="font-mono normal-case">{successPcInfo.imei}</span>
                </div>
                {successPcInfo.data ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-[#12141c] dark:text-[#F6F8FF]">
                    <div><span className="text-[#5A6685] dark:text-[#8892B5]">Grade:</span> {successPcInfo.data.grade || '-'}</div>
                    <div><span className="text-[#5A6685] dark:text-[#8892B5]">Çalışıyor:</span> {successPcInfo.data.working || '-'}</div>
                    <div className="col-span-2"><span className="text-[#5A6685] dark:text-[#8892B5]">Arıza (Failed):</span> {successPcInfo.data.failed || '-'}</div>
                    <div><span className="text-[#5A6685] dark:text-[#8892B5]">Batarya Sağlık:</span> {successPcInfo.data.battery_health_percentage != null ? `%${successPcInfo.data.battery_health_percentage}` : '-'}</div>
                    <div><span className="text-[#5A6685] dark:text-[#8892B5]">Batarya Döngü:</span> {successPcInfo.data.battery_cycle != null ? successPcInfo.data.battery_cycle : '-'}</div>
                    <div className="col-span-2"><span className="text-[#5A6685] dark:text-[#8892B5]">Notes:</span> {successPcInfo.data.notes || '-'}</div>
                  </div>
                ) : (
                  <p className="text-[11px] italic text-[#5A6685] dark:text-[#8892B5]">Bu cihaz için PhoneCheck test kaydı bulunamadı.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Test Başarısız */}
        <div className="lg:col-span-2 bg-[#F5F7FC] dark:bg-[#12141c] border border-rose-500/40 rounded-2xl overflow-hidden flex flex-col shadow-md">
          <div className="bg-rose-600/90 px-5 py-3.5 flex items-center gap-2.5 border-b border-rose-500/40">
            <div className="p-1 bg-white/10 rounded-lg">
              <Undo2 size={16} className="text-[#181a24] dark:text-white" />
            </div>
            <h3 className="text-xs font-semibold text-[#181a24] dark:text-white uppercase tracking-wider">Test Başarısız (Geri Çevrim)</h3>
            <span className="ml-auto text-[10px] font-bold text-rose-200 bg-white/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Tekniğe Geri Gönder</span>
          </div>
          <form onSubmit={handleFail} className="p-6 space-y-4">
            <p className="text-xs text-[#5A6685] dark:text-[#8892B5] border-l-2 border-rose-500/40 pl-3 leading-relaxed">
              Test başarısız ise IMEI girip, en az 1 arızalı parça/hata kodu seçin ve açıklama ekleyerek tekniğe iade edin.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">IMEI Okutun <span className="text-rose-400">*</span></label>
              <input
                type="text"
                placeholder="IMEI okutun veya yazın..."
                className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-rose-500 transition-all"
                value={failImei}
                onChange={e => setFailImei(e.target.value)}
                disabled={failLoading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between">
                <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">
                  Hatalı Parça ve Hata Kodu <span className="text-rose-400">*</span>
                </label>
                {selectedFaultIds.length > 0 && (
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/30">
                    {selectedFaultIds.length} Seçili
                  </span>
                )}
              </div>
              {/* Arama: hata/parça adında ara (ör. "kamera camı çizik"). */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6685] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Hata ara... (ör. kamera camı çizik)"
                  className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-rose-500 transition-all"
                  value={faultSearch}
                  onChange={e => setFaultSearch(e.target.value)}
                  disabled={failLoading}
                />
                {faultSearch && (
                  <button type="button" onClick={() => setFaultSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6685] hover:text-rose-500">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="w-full bg-[#F5F7FC] dark:bg-[#181a24] border border-[#DCE1F1] dark:border-[#1e222d] rounded-xl p-4 max-h-72 overflow-y-auto space-y-4">
                {filteredCatalog.length === 0 ? (
                  <div className="text-[11px] italic text-[#5A6685] dark:text-[#8892B5] py-2 text-center">
                    "{faultSearch}" ile eşleşen hata bulunamadı.
                  </div>
                ) : filteredCatalog.map(({ category, items }) => (
                  <div key={category}>
                    <h4 className="text-xs font-bold text-rose-400 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      {category}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                      {items.map((text) => {
                        const id = `${category}::${text}`;
                        return (
                          <label key={id} className="flex items-center gap-2 text-xs text-[#12141c] dark:text-[#F6F8FF] hover:text-white cursor-pointer py-1 select-none">
                            <input
                              type="checkbox"
                              checked={selectedFaultIds.includes(id)}
                              onChange={() => toggleFault(id)}
                              className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#2e3545] accent-rose-600 focus:ring-rose-500 bg-[#FFFFFF] dark:bg-[#1e222d]"
                            />
                            {text}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seçilen hatalar: çarpı ile silinebilen kutucuklar. */}
            {selectedFaultChips.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">
                  Seçilen Hatalar ({selectedFaultChips.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedFaultChips.map(({ id, category, text }) => (
                    <span key={id}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[11px] font-medium border bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30">
                      <span><span className="font-bold">{category}:</span> {text}</span>
                      <button type="button" onClick={() => removeFault(id)}
                        title="Kaldır"
                        className="shrink-0 rounded-md p-0.5 hover:bg-rose-200 dark:hover:bg-rose-500/30 transition-colors">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">
                Arıza Açıklaması <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows="3"
                placeholder="Arıza açıklamasını detaylı şekilde yazınız..."
                className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-rose-500 transition-all resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={failLoading}
              />
            </div>

            <button
              type="submit"
              disabled={failLoading || !failImei.trim() || !description.trim() || selectedFaultIds.length === 0}
              className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white px-6 py-3 rounded-xl transition-all font-semibold text-xs cursor-pointer flex items-center justify-center gap-2 shadow-md"
            >
              <Undo2 size={16} /> {failLoading ? 'İşleniyor...' : 'Geri Çevir'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
