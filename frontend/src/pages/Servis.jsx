import { useState } from 'react';
import { Search, ClipboardCheck, Wrench, FlaskConical, Download, AlertTriangle } from 'lucide-react';
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
    <div className="w-72 shrink-0 border-r border-slate-200 dark:border-slate-700/50 overflow-y-auto p-4 space-y-3">
      {INFO_FIELDS.map(({ key, label, gapAfter }) => (
        <div key={key} className={gapAfter ? 'pb-3 mb-1 border-b border-slate-100 dark:border-slate-800' : ''}>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{label}</label>
          <div className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 min-h-[30px]">
            {fields[key] || ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows = [], rowKeys, emptyLabel = 'Kayıt yok' }) {
  const keys = rowKeys || columns;
  return (
    <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-[#242a38]">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                {keys.map((k) => (
                  <td key={k} className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {row[k] ?? ''}
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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!imei.trim()) return;
    setLoading(true);
    setSearchError('');
    setFields(null);
    setPhonecheckRows([]);
    setDetectedParts([]);
    setRepairRecords([]);
    const res = await api.getServiceInfoByImei(imei.trim());
    if (res.success) {
      setSearchedImei(imei.trim());
      setFields(res.fields);
      setStatuName(res.statu_name || '');
      const [pcRes, partsRes, repairRes] = await Promise.all([
        api.getPhonecheckHistoryByImei(imei.trim()),
        api.getDetectedPartsByImei(imei.trim()),
        api.getRepairRecordsByImei(imei.trim()),
      ]);
      if (pcRes.success) setPhonecheckRows(pcRes.items || []);
      if (partsRes.success) setDetectedParts(partsRes.items || []);
      if (repairRes.success) setRepairRecords(repairRes.items || []);
    } else {
      setSearchedImei('');
      setSearchError(res.message || 'Cihaz bulunamadı.');
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Servis</h1>
        <p className="text-slate-400 mt-1">IMEI numarasına göre cihazın durum ve onarım bilgilerini görüntüleyin.</p>

        <form onSubmit={handleSearch} className="mt-4 flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="IMEI numarasını girin..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
              value={imei}
              onChange={(e) => setImei(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!imei.trim() || loading}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? 'Aranıyor...' : 'Ara'}
          </button>
        </form>

        {searchError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle size={15} /> {searchError}
          </div>
        )}
        {statuName && searchedImei && (
          <div className="mt-3 inline-flex px-3 py-1.5 rounded-full text-xs font-bold border bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
            Statü: {statuName}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-200 dark:border-slate-700/50 shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {!searchedImei ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Sonuçları görmek için bir IMEI numarası aratın.
            </div>
          ) : activeTab === 'durum' ? (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />

              {/* Sağ: Durum Geçmişi Tablosu */}
              <div className="flex-1 overflow-auto p-4">
                <DataTable columns={HISTORY_COLUMNS} />
              </div>
            </div>
          ) : activeTab === 'test' ? (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />

              {/* Sağ: Phonecheck Cihaz Verisi + Tespit Parça */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <Download size={15} /> Download Phone Check Device Data
                  </div>
                  <DataTable columns={PHONECHECK_COLUMNS} rowKeys={PHONECHECK_ROW_KEYS} rows={phonecheckRows} />
                  <p className="text-xs text-slate-400 mt-1.5">Toplam : {phonecheckRows.length} Kayıt Listelendi</p>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Tespit Parça</div>
                  <DataTable columns={DETECTED_PART_COLUMNS} rowKeys={DETECTED_PART_ROW_KEYS} rows={detectedParts} />
                  <p className="text-xs text-slate-400 mt-1.5">Toplam : {detectedParts.length} Kayıt Listelendi</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />

              {/* Sağ: Alt Onarımlar + Onarım Parça ve İşçilikleri */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Alt Onarımlar</div>
                  <DataTable columns={SUB_REPAIR_COLUMNS} rowKeys={SUB_REPAIR_ROW_KEYS} rows={repairRecords} />
                  <p className="text-xs text-slate-400 mt-1.5">Toplam : {repairRecords.length} Kayıt Listelendi</p>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Onarım Parça ve İşçilikleri</div>
                  <DataTable columns={REPAIR_PARTS_COLUMNS} rowKeys={REPAIR_PARTS_ROW_KEYS} rows={repairRecords} />
                  <p className="text-xs text-slate-400 mt-1.5">Toplam : {repairRecords.length} Kayıt Listelendi</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
