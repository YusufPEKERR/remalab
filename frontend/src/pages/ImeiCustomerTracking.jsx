import { useState } from 'react';
import { Search, Smartphone, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

const TABS = ['Durum', 'Test', 'Onarım', 'Belge', 'Rapor', 'Önceki Servisler', 'Mesaj'];

// NOT: Veritabanında statü geçmişi (status log) tablosu bulunmadığından
// "Durum" sekmesi yalnızca cihazın güncel statüsünü gösterir (tek satır).
// Test/Onarım/Belge/Rapor/Önceki Servisler/Mesaj sekmeleri için henüz karşılık gelen veri yok.

const FIELD_ROWS = [
  ['serviceNumber', 'Service Number'],
  ['productBrand', 'Product Brand'],
  ['productFamily', 'Product Family'],
  ['productCategory', 'Product Category'],
  ['productModel', 'Product Model'],
  ['product', 'Product'],
  ['itemColor', 'Item Color'],
  ['itemInternalId', 'Item Internal Id'],
  ['itemSerialNo', 'Item Serial No'],
  ['itemImei', 'Item Imei'],
  ['itemImei2', 'Item Imei2'],
  ['customer', 'Customer'],
  ['requestType', 'Request Type'],
  ['rmaReason', 'RMA Reason'],
  ['receiveGrade', 'Receive Grade']
];

const DATE_ROWS = [
  ['createDate', 'Create Date'],
  ['statuUpdateDate', 'Statu Update Date'],
  ['updateDate', 'Update Date'],
  ['repairStart', 'Repair Start'],
  ['repairFinish', 'Repair Finish']
];

export default function ImeiCustomerTracking() {
  const [imei, setImei] = useState('');
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Durum');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const query = imei.trim();
    if (!query) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.getImeiCustomerTracking(query);
      if (res.success) {
        setRecord(res.data);
        setActiveTab('Durum');
      } else {
        setRecord(null);
        setError(res.message || 'Bu IMEI numarasına ait müşteri kaydı bulunamadı.');
      }
    } catch (err) {
      setRecord(null);
      setError('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Smartphone className="text-blue-400" size={24} /> IMEI Müşteri Takip
        </h1>
        <p className="text-slate-400 mt-1">Cihazın IMEI numarasını girerek servis geçmişini ve müşteri bilgilerini görüntüleyin.</p>
      </div>

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI / Barkod No</label>
            <input
              type="text"
              placeholder="IMEI numarasını girin veya okutun... (örn: 359214462439518)"
              className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              value={imei}
              onChange={e => setImei(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium whitespace-nowrap flex items-center gap-2 disabled:opacity-60"
          >
            <Search size={18} /> {loading ? 'Aranıyor...' : 'Sorgula'}
          </button>
        </form>
        {error && <p className="text-red-400 mt-3 text-sm flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>}
      </div>

      {record && (
        <div className="flex-1 overflow-y-auto pr-2 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sol: Cihaz / Müşteri Bilgileri */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-[#242a38] px-5 py-3 border-b border-slate-200 dark:border-slate-700/50">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Cihaz / Servis Bilgileri</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {FIELD_ROWS.map(([key, label]) => (
                    <div key={key} className="px-5 py-2.5">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">{record[key] || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-[#242a38] px-5 py-3 border-b border-slate-200 dark:border-slate-700/50">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Tarih Bilgileri</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {DATE_ROWS.map(([key, label]) => (
                    <div key={key} className="px-5 py-2.5">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">{record[key] || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sağ: Sekmeler */}
            <div className="lg:col-span-2 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex border-b border-slate-200 dark:border-slate-700/50 overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-1 flex-1">
                {activeTab === 'Durum' ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">StaffName</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Text</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {record.history.map((h, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#242a38] transition-colors text-slate-700 dark:text-slate-300">
                          <td className="px-5 py-2.5 whitespace-nowrap">{h.date}</td>
                          <td className="px-5 py-2.5 whitespace-nowrap">{h.staffName}</td>
                          <td className="px-5 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              {h.type}
                            </span>
                          </td>
                          <td className="px-5 py-2.5">{h.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-16">
                    <Search size={28} className="text-slate-300 dark:text-slate-600" />
                    <p className="text-sm">Bu sekme için henüz kayıt bulunmuyor.</p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/50 text-xs text-slate-400">
                Toplam : {activeTab === 'Durum' ? record.history.length : 0} Kayıt Listelendi
              </div>
            </div>
          </div>
        </div>
      )}

      {!record && !error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Smartphone size={40} className="text-slate-300 dark:text-slate-600" />
          <p>Kayıtları görmek için bir IMEI numarası girin.</p>
        </div>
      )}
    </div>
  );
}
