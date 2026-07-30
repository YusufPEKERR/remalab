import { useState, useMemo, useRef } from 'react';
import { CheckCircle, AlertTriangle, X, ClipboardCheck, Undo2 } from 'lucide-react';
import { api } from '../services/api';
import { FAULT_CATALOG } from '../constants/faultCatalog';

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
  logExitTest = false
}) {
  const [successImei, setSuccessImei] = useState('');
  const [failImei, setFailImei] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFaultIds, setSelectedFaultIds] = useState([]);
  const [successLoading, setSuccessLoading] = useState(false);
  const [failLoading, setFailLoading] = useState(false);
  const [notification, setNotification] = useState(null);
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
    try {
      const scanData = await resolveEntry(successImei);
      const res = await api.submitTestResult(
        scanData.entry_id, sourceStatuCode, successStatuCode, failStatuCode, 'success', '', [], logExitTest
      );
      if (res.success) {
        showNotification('success', res.message);
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
        scanData.entry_id, sourceStatuCode, successStatuCode, failStatuCode, 'fail', description.trim(), selectedFaultLabels
      );
      if (res.success) {
        showNotification('success', res.message);
        setFailImei('');
        setDescription('');
        setSelectedFaultIds([]);
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
    <div className="flex flex-col space-y-6 pb-12 text-[#16204A] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300 relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#101935] via-[#DDE2F2] dark:via-[#16204A] to-[#FFFFFF] dark:to-[#24326A] p-6 sm:p-8 text-[#1B2755] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#24326A]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(91, 110, 196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(91, 110, 196,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 dark:border-blue-400/30 text-[#2E3F78] dark:text-blue-300 text-xs font-semibold tracking-wide">
              <ClipboardCheck size={13} className="text-blue-400" /> KALİTE KONTROL VE TEST DEPARTMANI
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2755] dark:text-white">
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
        <div className="lg:col-span-1 bg-[#F5F7FC] dark:bg-[#16204A] border border-emerald-500/40 rounded-2xl overflow-hidden flex flex-col shadow-md">
          <div className="bg-emerald-600/90 px-5 py-3.5 flex items-center gap-2 border-b border-emerald-500/40">
            <CheckCircle size={18} className="text-[#1B2755] dark:text-white" />
            <h3 className="text-xs font-semibold text-[#1B2755] dark:text-white uppercase tracking-wider">Test Başarılı (Onay)</h3>
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
                className="w-full bg-[#FFFFFF] dark:bg-[#24326A] border border-[#DCE1F1] dark:border-[#3B4A85] text-[#16204A] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-emerald-500 transition-all"
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
        </div>

        {/* Test Başarısız */}
        <div className="lg:col-span-2 bg-[#F5F7FC] dark:bg-[#16204A] border border-rose-500/40 rounded-2xl overflow-hidden flex flex-col shadow-md">
          <div className="bg-rose-600/90 px-5 py-3.5 flex items-center gap-2.5 border-b border-rose-500/40">
            <div className="p-1 bg-white/10 rounded-lg">
              <Undo2 size={16} className="text-[#1B2755] dark:text-white" />
            </div>
            <h3 className="text-xs font-semibold text-[#1B2755] dark:text-white uppercase tracking-wider">Test Başarısız (Geri Çevrim)</h3>
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
                className="w-full bg-[#FFFFFF] dark:bg-[#24326A] border border-[#DCE1F1] dark:border-[#3B4A85] text-[#16204A] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:border-rose-500 transition-all"
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
              <div className="w-full bg-[#F5F7FC] dark:bg-[#1B2755] border border-[#DCE1F1] dark:border-[#24326A] rounded-xl p-4 max-h-72 overflow-y-auto space-y-4">
                {FAULT_CATALOG.map(({ category, items }) => (
                  <div key={category}>
                    <h4 className="text-xs font-bold text-rose-400 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      {category}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                      {items.map((text) => {
                        const id = `${category}::${text}`;
                        return (
                          <label key={id} className="flex items-center gap-2 text-xs text-[#16204A] dark:text-[#F6F8FF] hover:text-white cursor-pointer py-1 select-none">
                            <input
                              type="checkbox"
                              checked={selectedFaultIds.includes(id)}
                              onChange={() => toggleFault(id)}
                              className="w-4 h-4 rounded border-[#DCE1F1] dark:border-[#3B4A85] accent-rose-600 focus:ring-rose-500 bg-[#FFFFFF] dark:bg-[#24326A]"
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

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">
                Arıza Açıklaması <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows="3"
                placeholder="Arıza açıklamasını detaylı şekilde yazınız..."
                className="w-full bg-[#FFFFFF] dark:bg-[#24326A] border border-[#DCE1F1] dark:border-[#3B4A85] text-[#16204A] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:border-rose-500 transition-all resize-none"
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
