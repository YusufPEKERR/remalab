import { useState } from 'react';
import { Search, ClipboardCheck, Wrench, FlaskConical, Download, AlertTriangle, RefreshCw, Cpu } from 'lucide-react';
import { api } from '../services/api';

const TABS = [
  { key: 'durum', label: 'Durum', icon: ClipboardCheck },
  { key: 'test', label: 'Test', icon: FlaskConical },
  { key: 'onarim', label: 'Onarım', icon: Wrench },
];

const INFO_FIELDS = [
  { key: 'serviceNumber', label: 'Service Number' },
  { key: 'productBrand', label: 'Product Brand' },
  { key: 'productFamily', label: 'Product Family' },
  { key: 'productCategory', label: 'Product Category' },
  { key: 'productModel', label: 'Product Model' },
  { key: 'product', label: 'Product' },
  { key: 'itemColor', label: 'Item Color', gapAfter: true },
  { key: 'itemInternalId', label: 'Item Internal Id' },
  { key: 'itemSerialNo', label: 'Item Serial No' },
  { key: 'itemImei', label: 'Item Imei' },
  { key: 'itemImei2', label: 'Item Imei2', gapAfter: true },
  { key: 'customer', label: 'Customer' },
  { key: 'requestType', label: 'Request Type' },
  { key: 'rmaReason', label: 'RMA Reason' },
  { key: 'receiveGrade', label: 'Receive Grade', gapAfter: true },
  { key: 'createDate', label: 'Create Date' },
  { key: 'statuUpdateDate', label: 'Statu Update Date' },
  { key: 'updateDate', label: 'Update Date' },
];

const HISTORY_COLUMNS = ['Date', 'StaffName', 'Type', 'Text'];
const HISTORY_ROW_KEYS = ['date', 'staffName', 'type', 'text'];
const PHONECHECK_COLUMNS = ['DeviceUpdatedD', 'Grade', 'PartInfoRemark', 'Parts', 'StationID', 'Version', 'BatteryCycle'];
const PHONECHECK_ROW_KEYS = ['deviceUpdatedD', 'grade', 'partInfoRemark', 'parts', 'stationID', 'version', 'batteryCycle'];
const DETECTED_PART_COLUMNS = ['Id', 'name', 'Status', 'FactorySerial', 'notice', 'CurrentSerial', 'Test'];
const DETECTED_PART_ROW_KEYS = ['id', 'name', 'status', 'factorySerial', 'notice', 'currentSerial', 'test'];
const SUB_REPAIR_COLUMNS = ['MissionGroup', 'RepairStatu', 'TEC', 'RepairStartTime', 'RepairFinishTime', 'QAC', 'TestResult'];
const SUB_REPAIR_ROW_KEYS = ['missionGroup', 'repairStatu', 'tec', 'repairStartTime', 'repairFinishTime', 'qac', 'testResult'];
const REPAIR_PARTS_COLUMNS = ['MissionGroup', 'TEC', 'Item', 'Type', 'SupplyStatu', 'Labour', 'Fault'];
const REPAIR_PARTS_ROW_KEYS = ['missionGroup', 'tec', 'item', 'type', 'supplyStatu', 'labour', 'fault'];

function InfoPanel({ fields = {} }) {
  return (
    <div className="w-72 shrink-0 border-r border-[#E2E8F0] dark:border-[#1E293B] overflow-y-auto p-4 space-y-3 bg-[#F8FAFC] dark:bg-[#0F172A]">
      {INFO_FIELDS.map(({ key, label, gapAfter }) => (
        <div key={key} className={gapAfter ? 'pb-3 mb-1 border-b border-[#E2E8F0] dark:border-[#1E293B]' : ''}>
          <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1 uppercase tracking-wider">{label}</label>
          <div className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-[#162032] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs font-mono font-medium text-[#0F172A] dark:text-[#FAFAFA] min-h-[34px] flex items-center">
            {fields[key] || '-'}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows = [], rowKeys, emptyLabel = 'Kayıt bulunamadı' }) {
  const keys = rowKeys || columns;
  return (
    <div className="overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A]">
      <table className="w-full text-xs text-left whitespace-nowrap">
        <thead className="bg-[#F8FAFC] dark:bg-[#162032] text-[#64748B] dark:text-[#94A3B8] font-bold uppercase tracking-wider border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 border-b border-[#E2E8F0] dark:border-[#1E293B]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[#64748B] dark:text-[#94A3B8]">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1E293B]/60 text-[#0F172A] dark:text-[#FAFAFA] transition-colors">
                {keys.map((k) => (
                  <td key={k} className="px-4 py-2.5">
                    {row[k] ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Servis() {
  const [imei, setImei] = useState('');
  const [searchedImei, setSearchedImei] = useState('');
  const [activeTab, setActiveTab] = useState('durum');
  const [fields, setFields] = useState(null);
  const [statuName, setStatuName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [phonecheckRows, setPhonecheckRows] = useState([]);
  const [detectedParts, setDetectedParts] = useState([]);
  const [repairRecords, setRepairRecords] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!imei.trim()) return;
    setLoading(true);
    setSearchError('');
    setFields(null);
    setPhonecheckRows([]);
    setDetectedParts([]);
    setRepairRecords([]);
    setStatusHistory([]);
    const res = await api.getServiceInfoByImei(imei.trim());
    if (res.success) {
      setSearchedImei(imei.trim());
      setFields(res.fields);
      setStatuName(res.statu_name || '');
      const [pcRes, partsRes, repairRes, historyRes] = await Promise.all([
        api.getPhonecheckHistoryByImei(imei.trim()),
        api.getDetectedPartsByImei(imei.trim()),
        api.getRepairRecordsByImei(imei.trim()),
        api.getStatusHistoryByImei(imei.trim()),
      ]);
      if (pcRes.success) setPhonecheckRows(pcRes.items || []);
      if (partsRes.success) setDetectedParts(partsRes.items || []);
      if (repairRes.success) setRepairRecords(repairRes.items || []);
      if (historyRes.success) setStatusHistory(historyRes.items || []);
    } else {
      setSearchedImei('');
      setSearchError(res.message || 'Cihaz bulunamadı.');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#0F172A] dark:text-[#FAFAFA] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F1F5F9] dark:from-[#050A18] via-[#0F172A] to-[#FFFFFF] dark:to-[#1E293B] p-6 sm:p-8 text-white shadow-xl border border-[#E2E8F0] dark:border-[#1E293B]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(244,63,94,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(244,63,94,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-semibold tracking-wide">
              <Cpu size={13} className="text-rose-400" /> SERVİS VE CİHAZ YÖNETİMİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Servis Cihaz Sorgulama
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              IMEI numarasına göre cihazın statü geçmişini, PhoneCheck verilerini ve teknik servis onarım detaylarını sorgulayın.
            </p>
          </div>
        </div>

        {/* Search Bar inside Hero Header */}
        <div className="relative z-10 mt-6 pt-6 border-t border-[#E2E8F0]/80 dark:border-[#1E293B]/80 max-w-2xl">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" size={18} />
              <input
                type="text"
                placeholder="IMEI veya Seri Numarası girin..."
                className="w-full pl-10 pr-4 py-3 bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-sm font-medium text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] shadow-xs"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={!imei.trim() || loading}
              className="px-6 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Aranıyor...' : 'Cihazı Sorgula'}
            </button>
          </form>

          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/20 border border-red-500/30 px-3 py-2 rounded-xl">
              <AlertTriangle size={15} /> {searchError}
            </div>
          )}

          {statuName && searchedImei && (
            <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Aktif Cihaz Statüsü: {statuName}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ MAIN CONTENT CONTAINER ════════════════ */}
      <div className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-md overflow-hidden flex flex-col min-h-[600px]">
        {/* TAB HEADER */}
        <div className="flex border-b border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#162032] shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2.5 px-6 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === key
                  ? 'border-[#2563EB] text-[#60A5FA] bg-[#F8FAFC] dark:bg-[#0F172A]'
                  : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#FFFFFF]/40 dark:hover:bg-[#1E293B]/40'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* TAB BODY */}
        <div className="flex-1 overflow-hidden">
          {!searchedImei ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-[#64748B] dark:text-[#94A3B8] space-y-3 p-8">
              <div className="w-12 h-12 rounded-2xl bg-[#FFFFFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] flex items-center justify-center text-[#60A5FA]">
                <Search size={24} />
              </div>
              <p className="text-sm font-medium">Cihaz detaylarını ve onarım kayıtlarını görmek için bir IMEI numarası aratın.</p>
            </div>
          ) : activeTab === 'durum' ? (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />
              <div className="flex-1 overflow-auto p-6 space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA] flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-[#60A5FA]" /> Statü Geçmişi Kayıtları
                </h3>
                <DataTable columns={HISTORY_COLUMNS} rowKeys={HISTORY_ROW_KEYS} rows={statusHistory} />
              </div>
            </div>
          ) : activeTab === 'test' ? (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA] flex items-center gap-2">
                      <Download size={16} className="text-[#60A5FA]" /> PhoneCheck Cihaz Test Verisi
                    </h3>
                    <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">Toplam: {phonecheckRows.length} Kayıt</span>
                  </div>
                  <DataTable columns={PHONECHECK_COLUMNS} rowKeys={PHONECHECK_ROW_KEYS} rows={phonecheckRows} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA]">Tespit Edilen Parçalar</h3>
                    <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">Toplam: {detectedParts.length} Kayıt</span>
                  </div>
                  <DataTable columns={DETECTED_PART_COLUMNS} rowKeys={DETECTED_PART_ROW_KEYS} rows={detectedParts} />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA]">Alt Onarımlar</h3>
                    <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">Toplam: {repairRecords.length} Kayıt</span>
                  </div>
                  <DataTable columns={SUB_REPAIR_COLUMNS} rowKeys={SUB_REPAIR_ROW_KEYS} rows={repairRecords} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA]">Onarım Parça ve İşçilikleri</h3>
                    <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">Toplam: {repairRecords.length} Kayıt</span>
                  </div>
                  <DataTable columns={REPAIR_PARTS_COLUMNS} rowKeys={REPAIR_PARTS_ROW_KEYS} rows={repairRecords} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
