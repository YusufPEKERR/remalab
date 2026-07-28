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
  failStatuCode
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
        scanData.entry_id, sourceStatuCode, successStatuCode, failStatuCode, 'success', '', []
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
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <ClipboardCheck className="text-blue-400" size={24} /> {title}
        </h1>
        <p className="text-slate-400 mt-1">{subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Test Başarılı */}
          <div className="lg:col-span-1 bg-white dark:bg-[#1e2330] border border-emerald-500/30 rounded-2xl overflow-hidden flex flex-col shrink-0 h-fit">
            <div className="bg-emerald-600 px-5 py-3 flex items-center gap-2">
              <CheckCircle size={18} className="text-white" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Test Başarılı</h3>
            </div>
            <form onSubmit={handleSuccess} className="p-5 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Test başarılı sonuçlanmış ise, IMEI girip "Test Başarılı" ile devam ediniz.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI</label>
                <input
                  ref={successInputRef}
                  type="text"
                  placeholder="IMEI okutun veya yazın..."
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                  value={successImei}
                  onChange={e => setSuccessImei(e.target.value)}
                  disabled={successLoading}
                />
              </div>
              <button
                type="submit"
                disabled={successLoading || !successImei.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl transition-all font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> {successLoading ? 'İşleniyor...' : 'Test Başarılı'}
              </button>
            </form>
          </div>

          {/* Test Başarısız */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1e2330] border border-[#7f1d3a]/40 rounded-2xl overflow-hidden flex flex-col shadow-lg shadow-[#7f1d3a]/5">
            <div className="bg-gradient-to-r from-[#5c1329] to-[#7f1d3a] px-5 py-3.5 flex items-center gap-2.5">
              <div className="p-1.5 bg-white/10 rounded-lg">
                <Undo2 size={16} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Test Başarısız</h3>
              <span className="ml-auto text-[10px] font-semibold text-white/70 bg-white/10 px-2 py-1 rounded-full">Geri Çevrim</span>
            </div>
            <form onSubmit={handleFail} className="p-5 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 border-l-2 border-[#7f1d3a]/40 pl-3">
                Test başarısız ve tekniğe geri çevirmek için IMEI girip, hatalı parça(lar)ı ve hata kodunu seçip açıklama giriniz.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI</label>
                <input
                  type="text"
                  placeholder="IMEI okutun veya yazın..."
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-[#7f1d3a] focus:ring-1 focus:ring-[#7f1d3a]"
                  value={failImei}
                  onChange={e => setFailImei(e.target.value)}
                  disabled={failLoading}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">
                    Hatalı Parça ve Hata Kodu <span className="text-[#a3213f]">*</span>
                  </label>
                  {selectedFaultIds.length > 0 && (
                    <span className="text-xs font-semibold text-[#a3213f] bg-[#7f1d3a]/10 px-2 py-0.5 rounded-full">
                      {selectedFaultIds.length} seçili
                    </span>
                  )}
                </div>
                <div className="w-full bg-slate-50 dark:bg-[#161a23] border border-slate-200 dark:border-slate-800 rounded-xl p-4 max-h-72 overflow-y-auto space-y-4">
                  {FAULT_CATALOG.map(({ category, items }) => (
                    <div key={category}>
                      <h4 className="text-sm font-bold text-[#7f1d3a] dark:text-[#e17b96] mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7f1d3a] dark:bg-[#e17b96]"></span>
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                        {items.map((text) => {
                          const id = `${category}::${text}`;
                          return (
                            <label key={id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer py-0.5">
                              <input
                                type="checkbox"
                                checked={selectedFaultIds.includes(id)}
                                onChange={() => toggleFault(id)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 accent-[#7f1d3a] focus:ring-[#7f1d3a]"
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

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Açıklama <span className="text-[#a3213f]">*</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="Arıza açıklamasını yazınız..."
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-[#7f1d3a] focus:ring-1 focus:ring-[#7f1d3a] resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={failLoading}
                />
              </div>

              <button
                type="submit"
                disabled={failLoading || !failImei.trim() || !description.trim() || selectedFaultIds.length === 0}
                className="w-full bg-gradient-to-r from-[#5c1329] to-[#7f1d3a] hover:from-[#4a0f21] hover:to-[#6b1830] disabled:opacity-50 disabled:hover:from-[#5c1329] disabled:hover:to-[#7f1d3a] text-white px-6 py-2.5 rounded-xl transition-all font-medium flex items-center justify-center gap-2 shadow-md shadow-[#7f1d3a]/20"
              >
                <Undo2 size={16} /> {failLoading ? 'İşleniyor...' : 'Geri Çevir'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
