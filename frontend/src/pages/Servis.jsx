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

const HISTORY_COLUMNS = ['Date', 'StaffName', 'Statü', 'Text'];
const HISTORY_ROW_KEYS = ['date', 'staffName', 'statu', 'text'];
const PHONECHECK_COLUMNS = ['DeviceUpdatedD', 'Grade', 'Kritik Parçalar', 'Parts', 'Failed', 'PartInfoRemark', 'StationID', 'Version', 'BatteryCycle'];
const PHONECHECK_ROW_KEYS = ['deviceUpdatedD', 'grade', 'criticalParts', 'parts', 'failed', 'partInfoRemark', 'stationID', 'version', 'batteryCycle'];

// ─── KRİTİK PARÇA ORİJİNALLİK ROZETLERİ ──────────────────────────────
// Kaynak: Phonecheck "Parts" alanı (bkz. phonecheck_service.parse_critical_parts).
// Takip edilen 3 parça: Ana Kamera, Batarya / Pil, Eski Pil.
//   yeşil = Orijinal (Genuine)   kırmızı = Orijinal Değil (Not Genuine)
//   gri   = Belirtilmemiş / Veri Yok
// Gri, "orijinal değil" ile aynı şey DEĞİLDİR: Phonecheck bazı parçaları hiç
// değerlendirmeden boş bırakıyor, eski kayıtlarda ise Parts verisi hiç yok.
const CRITICAL_PART_TONES = {
  genuine: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40',
  not_genuine: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/40',
  unknown: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600',
};

// "Parts" sütunu: Phonecheck'in bildirdiği TÜM parçaların özeti. Eskiden bu sütun
// yanlışlıkla başarısız testleri (Failed) gösteriyordu; Failed artık kendi sütununda.
// Rozette genel Remarks + parça sayısı var, tam liste tooltip'te.
function PartsSummary({ remark, all }) {
  const list = all || [];
  if (list.length === 0) {
    return <span className="text-[#5A6685] dark:text-[#8892B5]">{remark || '-'}</span>;
  }
  const notGenuine = list.filter((p) => p.status === 'not_genuine');
  // Renk parça listesinden türetilir, Remarks metnine güvenilmez: aralarında
  // tutarsızlık olursa gerçek parça durumu belirleyicidir.
  const tone = notGenuine.length > 0
    ? CRITICAL_PART_TONES.not_genuine
    : list.some((p) => p.status === 'genuine')
      ? CRITICAL_PART_TONES.genuine
      : CRITICAL_PART_TONES.unknown;
  const baslik = list.map((p) => `${p.name}: ${p.statusLabel}`).join('\n');
  const ozet = notGenuine.length > 0
    ? `${notGenuine.length} parça orijinal değil`
    : (remark || 'Orijinal');
  return (
    <span
      title={baslik}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${tone}`}
    >
      {ozet} · {list.length} parça
    </span>
  );
}

function CriticalPartsChips({ items }) {
  if (!items || items.length === 0) return <span className="text-[#5A6685] dark:text-[#8892B5]">-</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((p) => (
        <span
          key={p.key}
          title={`${p.label}: ${p.statusLabel}`
            + (p.sourceName ? ` (Phonecheck: ${p.sourceName})` : ' (Phonecheck çıktısında bu parça yok)')
            + (p.reason ? ` — ${p.reason}` : '')}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${CRITICAL_PART_TONES[p.status] || CRITICAL_PART_TONES.unknown}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {p.label}
        </span>
      ))}
    </div>
  );
}
const DETECTED_PART_COLUMNS = ['Id', 'name', 'Status', 'FactorySerial', 'notice', 'CurrentSerial', 'Test'];
const DETECTED_PART_ROW_KEYS = ['id', 'name', 'status', 'factorySerial', 'notice', 'currentSerial', 'test'];
const SUB_REPAIR_COLUMNS = ['MissionGroup', 'RepairStatu', 'TEC', 'RepairStartTime', 'RepairFinishTime', 'QAC', 'TestResult'];
const SUB_REPAIR_ROW_KEYS = ['missionGroup', 'repairStatu', 'tec', 'repairStartTime', 'repairFinishTime', 'qac', 'testResult'];
const REPAIR_PARTS_COLUMNS = ['MissionGroup', 'TEC', 'Item', 'Type', 'SupplyStatu', 'Labour', 'Fault'];
const REPAIR_PARTS_ROW_KEYS = ['missionGroup', 'tec', 'item', 'type', 'supplyStatu', 'labour', 'fault'];

function InfoPanel({ fields = {} }) {
  return (
    <div className="w-72 shrink-0 border-r border-[#DCE1F1] dark:border-[#1e222d] overflow-y-auto p-4 space-y-3 bg-[#F5F7FC] dark:bg-[#12141c]">
      {INFO_FIELDS.map(({ key, label, gapAfter }) => (
        <div key={key} className={gapAfter ? 'pb-3 mb-1 border-b border-[#DCE1F1] dark:border-[#1e222d]' : ''}>
          <label className="block text-[11px] font-semibold text-[#5A6685] dark:text-[#8892B5] mb-1 uppercase tracking-wider">{label}</label>
          <div className="w-full px-3 py-2 bg-[#F5F7FC] dark:bg-[#181a24] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl text-xs font-mono font-medium text-[#12141c] dark:text-[#F6F8FF] min-h-[34px] flex items-center">
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
    <div className="overflow-hidden border border-[#DCE1F1] dark:border-[#1e222d] rounded-xl bg-[#F5F7FC] dark:bg-[#12141c]">
      <table className="w-full text-xs text-left whitespace-nowrap">
        <thead className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#1e222d]">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 border-b border-[#DCE1F1] dark:border-[#1e222d]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#1e222d]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[#5A6685] dark:text-[#8892B5]">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-[#FFFFFF]/60 dark:hover:bg-[#1e222d]/60 text-[#12141c] dark:text-[#F6F8FF] transition-colors">
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
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO BANNER ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        {/* Ambient Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(194, 68, 95,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(194, 68, 95,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-400/30 text-rose-700 dark:text-rose-300 text-xs font-semibold tracking-wide">
              <Cpu size={13} className="text-rose-400" /> SERVİS VE CİHAZ YÖNETİMİ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Servis Cihaz Sorgulama
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              IMEI numarasına göre cihazın statü geçmişini, PhoneCheck verilerini ve teknik servis onarım detaylarını sorgulayın.
            </p>
          </div>
        </div>

        {/* Search Bar inside Hero Header */}
        <div className="relative z-10 mt-6 pt-6 border-t border-[#DCE1F1]/80 dark:border-[#1e222d]/80 max-w-2xl">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6685] dark:text-[#8892B5]" size={18} />
              <input
                type="text"
                placeholder="IMEI veya Seri Numarası girin..."
                className="glass-card w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] focus:outline-none focus:border-[#00B2FF] shadow-xs"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={!imei.trim() || loading}
              className="px-6 py-3 bg-[#00B2FF] hover:bg-[#1e222d] disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Aranıyor...' : 'Cihazı Sorgula'}
            </button>
          </form>

          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 px-3 py-2 rounded-xl">
              <AlertTriangle size={15} /> {searchError}
            </div>
          )}

          {statuName && searchedImei && (
            <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Aktif Cihaz Statüsü: {statuName}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ MAIN CONTENT CONTAINER ════════════════ */}
      <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col min-h-[600px]">
        {/* TAB HEADER */}
        <div className="flex border-b border-[#DCE1F1] dark:border-[#1e222d] bg-[#F5F7FC] dark:bg-[#181a24] shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2.5 px-6 py-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === key
                  ? 'border-[#00B2FF] text-[#8894D8] bg-[#F5F7FC] dark:bg-[#12141c]'
                  : 'border-transparent text-[#5A6685] dark:text-[#8892B5] hover:text-[#12141c] dark:hover:text-[#F6F8FF] hover:bg-[#FFFFFF]/40 dark:hover:bg-[#1e222d]/40'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* TAB BODY */}
        <div className="flex-1 overflow-hidden">
          {!searchedImei ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-[#5A6685] dark:text-[#8892B5] space-y-3 p-8">
              <div className="w-12 h-12 rounded-2xl bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] flex items-center justify-center text-[#8894D8]">
                <Search size={24} />
              </div>
              <p className="text-sm font-medium">Cihaz detaylarını ve onarım kayıtlarını görmek için bir IMEI numarası aratın.</p>
            </div>
          ) : activeTab === 'durum' ? (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />
              <div className="flex-1 overflow-auto p-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#12141c] dark:text-[#F6F8FF] flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-[#8894D8]" /> Statü Geçmişi Kayıtları
                </h3>
                <DataTable columns={HISTORY_COLUMNS} rowKeys={HISTORY_ROW_KEYS} rows={statusHistory} />
              </div>
            </div>
          ) : activeTab === 'test' ? (
            <div className="h-full flex overflow-hidden">
              <InfoPanel fields={fields} />
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#12141c] dark:text-[#F6F8FF] flex items-center gap-2">
                      <Download size={16} className="text-[#8894D8]" /> PhoneCheck Cihaz Test Verisi
                    </h3>
                    <span className="text-xs font-semibold text-[#5A6685] dark:text-[#8892B5]">Toplam: {phonecheckRows.length} Kayıt</span>
                  </div>
                  {/* criticalParts backend'den dizi gelir; DataTable hücreyi olduğu gibi
                      bastığı için rozetlere burada, render sırasında çevriliyor
                      (state'te JSX tutulmuyor). */}
                  <DataTable
                    columns={PHONECHECK_COLUMNS}
                    rowKeys={PHONECHECK_ROW_KEYS}
                    rows={phonecheckRows.map((r, i) => ({
                      ...r,
                      criticalParts: <CriticalPartsChips key={`c${i}`} items={r.criticalParts} />,
                      parts: <PartsSummary key={`p${i}`} remark={r.partsRemark} all={r.parts} />,
                    }))}
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#12141c] dark:text-[#F6F8FF]">Tespit Edilen Parçalar</h3>
                    <span className="text-xs font-semibold text-[#5A6685] dark:text-[#8892B5]">Toplam: {detectedParts.length} Kayıt</span>
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
                  <div className="flex flex-wrap items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#12141c] dark:text-[#F6F8FF]">Alt Onarımlar</h3>
                    <span className="text-xs font-semibold text-[#5A6685] dark:text-[#8892B5]">Toplam: {repairRecords.length} Kayıt</span>
                  </div>
                  <DataTable columns={SUB_REPAIR_COLUMNS} rowKeys={SUB_REPAIR_ROW_KEYS} rows={repairRecords} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#12141c] dark:text-[#F6F8FF]">Onarım Parça ve İşçilikleri</h3>
                    <span className="text-xs font-semibold text-[#5A6685] dark:text-[#8892B5]">Toplam: {repairRecords.length} Kayıt</span>
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
