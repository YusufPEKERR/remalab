import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Wrench, Save, RefreshCw, Layers, Hash, ClipboardCheck, FileSpreadsheet } from 'lucide-react';
import { api } from '../services/api';

// pricing.xlsx'teki 3 fiyat tablosu. Her tablo KÜÇÜK (müşteri × birkaç sabit sütun) olduğundan
// parça matrisindeki (CustomerPriceMatrix) sanallaştırma/marka filtresi/Excel akışına gerek yok:
// tek sayfada alt alta 3 basit grid, her biri kendi Kaydet'iyle. Ortak SimpleLabourGrid bileşeni
// dirty-hücre takibi + kaydet mantığını üçünde de paylaşır.

// Sütun anahtarları backend key kolonlarıyla (level_key / order_key / dgd_key) BİREBİR eşleşmeli.
const LEVEL_COLUMNS = [
  { key: 'Level 0', label: 'Level 0' },
  { key: 'Level 1', label: 'Level 1' },
  { key: 'Level 2', label: 'Level 2' },
  { key: 'Level 3', label: 'Level 3' },
  { key: 'Bat.Replacement1', label: 'Bat.Repl. 1' },
  { key: 'Bat.Replacement2', label: 'Bat.Repl. 2' },
];
const PARTORDER_COLUMNS = [
  { key: '1-5', label: '1-5. Parça' },
  { key: '6+', label: '6. ve Sonrası' },
];
const DGD_COLUMNS = [
  { key: 'full_functional', label: 'Full Functional' },
  { key: 'not_full_functional', label: 'Full Functional Değil' },
  { key: 'ch_bat_replacement', label: 'CH Bat.Replacement' },
];

// Üstteki sekme çubuğu. id -> aktif sekme state'i; her sekme kendi grid'ini gösterir.
const TABS = [
  { id: 'level', label: 'Seviye', icon: Layers },
  { id: 'partorder', label: 'Parça Sırası', icon: Hash },
  { id: 'dgd', label: 'DGD', icon: ClipboardCheck },
];

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

// Tek bir küçük işçilik fiyat tablosu. columns: [{key,label}]; customers: [{code,short_name}];
// prices: [{customer_code, key, price}]. Dirty hücreler ayrı tutulur; Kaydet yalnızca değişenleri
// {customer_code, key, price} listesi olarak onSave'e verir (boş -> null -> backend'de siler).
function SimpleLabourGrid({ title, icon: Icon, columns, customers, priceList, onSave, saving }) {
  // priceList -> { [customer_code]: { [key]: price } } pivot
  const priceMap = useMemo(() => {
    const m = {};
    for (const p of (priceList || [])) {
      if (!m[p.customer_code]) m[p.customer_code] = {};
      m[p.customer_code][p.key] = p.price;
    }
    return m;
  }, [priceList]);

  const [dirty, setDirty] = useState({}); // { [customer_code]: { [key]: value } }

  // Yeni veri geldiğinde (kaydet/yenile sonrası) kirli durumu sıfırla.
  useEffect(() => { setDirty({}); }, [priceList]);

  const getVal = (cc, key) => {
    if (dirty[cc] && Object.prototype.hasOwnProperty.call(dirty[cc], key)) return dirty[cc][key];
    return priceMap[cc]?.[key] ?? '';
  };

  const handleChange = (cc, key, value) => {
    setDirty(prev => ({ ...prev, [cc]: { ...(prev[cc] || {}), [key]: value } }));
  };

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const cc of Object.keys(dirty)) n += Object.keys(dirty[cc]).length;
    return n;
  }, [dirty]);

  const handleSaveClick = () => {
    const rows = [];
    for (const cc of Object.keys(dirty)) {
      for (const key of Object.keys(dirty[cc])) {
        const raw = dirty[cc][key];
        const price = raw === '' || raw === null || raw === undefined ? null : Number(raw);
        rows.push({ customer_code: cc, key, price });
      }
    }
    if (rows.length > 0) onSave(rows);
  };

  return (
    <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[#DCE1F1] dark:border-[#1e222d] bg-[#F5F7FC] dark:bg-[#181a24] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
          {Icon && <Icon size={16} className="text-emerald-500" />} {title}
        </div>
        <button
          onClick={handleSaveClick}
          disabled={dirtyCount === 0 || saving}
          className="flex items-center gap-2 bg-[#00B2FF] hover:bg-[#1e222d] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          <Save size={15} /> {saving ? 'Kaydediliyor...' : `Kaydet${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </button>
      </div>
      <div className="overflow-auto max-h-[50vh]">
        <table className="text-left text-xs whitespace-nowrap w-full">
          <thead className="bg-slate-50 dark:bg-[#181a24] text-slate-400 font-semibold uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 sticky left-0 bg-slate-50 dark:bg-[#181a24] z-20 min-w-[180px]">Müşteri</th>
              {columns.map(c => (
                <th key={c.key} className="px-4 py-3 min-w-[120px] text-center">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {customers.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-6 py-8 text-center text-slate-500">Müşteri bulunamadı.</td></tr>
            ) : customers.map(cust => (
              <tr key={cust.code} className="hover:bg-slate-100 dark:hover:bg-[#1e222d] transition-colors">
                <td className="px-4 py-2 sticky left-0 bg-white dark:bg-[#12141c] z-10 font-medium text-slate-700 dark:text-slate-300">
                  {cust.short_name}
                  {cust.currency ? <span className="ml-1.5 text-[10px] text-slate-400">{cust.currency}</span> : null}
                </td>
                {columns.map(c => (
                  <td key={c.key} className="px-2 py-1.5 text-center">
                    <input
                      type="number" step="0.01"
                      value={getVal(cust.code, c.key)}
                      onChange={e => handleChange(cust.code, c.key, e.target.value)}
                      placeholder="-"
                      className="w-24 text-center px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#181a24] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LabourPricingMatrices() {
  const [customers, setCustomers] = useState([]);
  const [levelPrices, setLevelPrices] = useState([]);
  const [partorderPrices, setPartorderPrices] = useState([]);
  const [dgdPrices, setDgdPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(null); // 'level' | 'partorder' | 'dgd' | null
  const [activeTab, setActiveTab] = useState('level'); // aktif sekme: 'level' | 'partorder' | 'dgd'

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [lvl, po, dgd] = await Promise.all([
        api.getLevelLabourMatrix(),
        api.getPartorderLabourMatrix(),
        api.getDgdLabourMatrix(),
      ]);
      // Müşteri listesi üç sorguda da aynı; ilk başarılı olandan alınır.
      if (lvl.success) { setCustomers(lvl.customers || []); setLevelPrices(lvl.prices || []); }
      if (po.success) { if (!lvl.success) setCustomers(po.customers || []); setPartorderPrices(po.prices || []); }
      if (dgd.success) { if (!lvl.success && !po.success) setCustomers(dgd.customers || []); setDgdPrices(dgd.prices || []); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const makeSaver = (section, saveFn) => async (rows) => {
    setSavingSection(section);
    const res = await saveFn(rows, getCurrentUser()?.username);
    setSavingSection(null);
    if (res.success) {
      await loadAll();
    } else {
      alert(res.message || 'Kaydetme başarısız oldu.');
    }
  };

  // Aktif sekmenin Excel akışı için tek merkezî config: hangi kolonlar, hangi veri, hangi save,
  // hangi dosya adı. Böylece export/şablon/import tek gövdeyle üç sekmeyi de idare eder.
  const importFileInputRef = useRef(null);
  const TAB_CONFIG = {
    level: { columns: LEVEL_COLUMNS, priceList: levelPrices, saveFn: api.saveLevelLabourMatrixBatch, file: 'iscilik_seviye_fiyati' },
    partorder: { columns: PARTORDER_COLUMNS, priceList: partorderPrices, saveFn: api.savePartorderLabourMatrixBatch, file: 'iscilik_parca_sirasi' },
    dgd: { columns: DGD_COLUMNS, priceList: dgdPrices, saveFn: api.saveDgdLabourMatrixBatch, file: 'iscilik_dgd' },
  };
  const cfg = TAB_CONFIG[activeTab];

  // priceList -> { [customer_code]: { [key]: price } }
  const activePriceMap = useMemo(() => {
    const m = {};
    for (const p of (cfg.priceList || [])) {
      if (!m[p.customer_code]) m[p.customer_code] = {};
      m[p.customer_code][p.key] = p.price;
    }
    return m;
  }, [cfg.priceList]);

  // "Geniş" (wide) Excel: 1. sütun Müşteri (short_name), sonraki sütunlar her key'in label'ı.
  const buildWideRows = (fill) => customers.map(c => {
    const row = { 'Müşteri': c.short_name };
    for (const col of cfg.columns) {
      row[col.label] = fill === 'data' ? (activePriceMap[c.code]?.[col.key] ?? '') : '';
    }
    return row;
  });

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';
    if (action === 'download_template') {
      const rows = buildWideRows('empty');
      if (rows[0] && cfg.columns[0]) rows[0][cfg.columns[0].label] = 0; // örnek değer
      await api.exportTableToExcel(rows, `${cfg.file}_sablonu.xlsx`);
    } else if (action === 'export') {
      await api.exportTableToExcel(buildWideRows('data'), `${cfg.file}.xlsx`);
    } else if (action === 'import') {
      importFileInputRef.current?.click();
    }
  };

  // Geniş formatlı Excel'i okur: her müşteri satırı + her key sütunu -> {customer_code, key, price}
  // düz listeye çevrilip aktif sekmenin save Slot'una verilir. Müşteri adı short_name (veya code)
  // ile eşlenir; label -> key eşlemesi cfg.columns'tan yapılır.
  const handleWideExcelFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(worksheet);
        if (!rawRows || rawRows.length === 0) { alert('Excel dosyasında veri bulunamadı.'); return; }

        // müşteri eşleme: short_name (küçük harf) veya code -> code
        const byName = {}; const byCode = {};
        for (const c of customers) { byName[String(c.short_name || '').trim().toLowerCase()] = c.code; byCode[String(c.code).trim().toLowerCase()] = c.code; }
        const labelToKey = {}; for (const col of cfg.columns) labelToKey[col.label.trim().toLowerCase()] = col.key;

        const headers = Object.keys(rawRows[0]);
        const custHeader = headers.find(h => ['müşteri', 'musteri', 'customer', 'müşteri kodu'].includes(h.trim().toLowerCase()));
        if (!custHeader) { alert('"Müşteri" sütunu bulunamadı. Lütfen "Şablon İndir" formatını kullanın.'); return; }

        const flat = [];
        const unknown = [];
        for (const r of rawRows) {
          const nameRaw = String(r[custHeader] ?? '').trim();
          if (!nameRaw) continue;
          const cc = byName[nameRaw.toLowerCase()] || byCode[nameRaw.toLowerCase()];
          if (!cc) { unknown.push(nameRaw); continue; }
          for (const h of headers) {
            if (h === custHeader) continue;
            const key = labelToKey[h.trim().toLowerCase()];
            if (!key) continue; // bu tabloya ait olmayan sütun -> atla
            const val = r[h];
            if (val === undefined || val === null || String(val).trim() === '') continue;
            const num = Number(String(val).replace(',', '.'));
            if (Number.isNaN(num)) continue;
            flat.push({ customer_code: cc, key, price: num });
          }
        }
        if (flat.length === 0) { alert('İçe aktarılacak geçerli fiyat bulunamadı.' + (unknown.length ? `\nTanınmayan müşteri(ler): ${[...new Set(unknown)].join(', ')}` : '')); return; }

        setSavingSection(activeTab);
        const res = await cfg.saveFn(flat, getCurrentUser()?.username);
        setSavingSection(null);
        if (res.success) {
          await loadAll();
          alert(`${flat.length} fiyat içe aktarıldı.` + (unknown.length ? `\nTanınmayan müşteri(ler) atlandı: ${[...new Set(unknown)].join(', ')}` : ''));
        } else {
          alert(res.message || 'İçe aktarma başarısız oldu.');
        }
      } catch (err) {
        alert('Excel okunurken hata: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1400px] mx-auto animate-in fade-in duration-300">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <Wrench size={13} className="text-emerald-400" /> İŞÇİLİK FİYATLANDIRMA
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              İşçilik Fiyatlandırma (Seviye)
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Müşteri başına işçilik ücretleri: onarım seviyesine göre (ilk parça), sonraki parçaların
              sırasına göre ve DGD durumuna göre. Her tablo ayrı kaydedilir.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Excel İşlemleri AKTİF sekmeye uygulanır: şablon/dışa aktar/içe aktar o tablonun
                kendi sütunlarıyla "geniş" formatta (satır=müşteri, sütun=key). */}
            <div className="relative">
              <select
                onChange={handleExcelAction}
                value=""
                className="appearance-none bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-xl px-4 py-2.5 pr-9 text-xs font-bold transition-all cursor-pointer focus:outline-none"
                title="Aktif sekmedeki tabloya uygulanır"
              >
                <option value="">Excel İşlemleri ({TABS.find(t => t.id === activeTab)?.label})...</option>
                <option value="download_template">Boş Şablon İndir</option>
                <option value="export">Dışa Aktar</option>
                <option value="import">Excel'den İçe Aktar</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2.5 pointer-events-none text-[#5A6685] dark:text-[#8892B5]">
                <FileSpreadsheet size={15} />
              </div>
            </div>
            <button
              onClick={loadAll}
              className="flex items-center gap-2 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
              title="Yeniden Yükle"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Yenile
            </button>
          </div>
        </div>
      </div>

      <input
        type="file"
        ref={importFileInputRef}
        accept=".xlsx,.xls"
        onChange={handleWideExcelFile}
        style={{ display: 'none' }}
      />

      {/* Sekmeler: aynı anda tek tablo görünür. Her sekmenin kendi grid'i + Kaydet'i vardır. */}
      <div className="flex items-center gap-2 border-b border-[#DCE1F1] dark:border-[#1e222d]">
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 -mb-px transition-all ${
                isActive
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#12141c]'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <TabIcon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'level' && (
        <SimpleLabourGrid
          title="Seviye İşçilik Fiyatı (ilk parça)"
          icon={Layers}
          columns={LEVEL_COLUMNS}
          customers={customers}
          priceList={levelPrices}
          onSave={makeSaver('level', api.saveLevelLabourMatrixBatch)}
          saving={savingSection === 'level'}
        />
      )}

      {activeTab === 'partorder' && (
        <SimpleLabourGrid
          title="Parça Sırası İşçilik Ücreti (sonraki parçalar)"
          icon={Hash}
          columns={PARTORDER_COLUMNS}
          customers={customers}
          priceList={partorderPrices}
          onSave={makeSaver('partorder', api.savePartorderLabourMatrixBatch)}
          saving={savingSection === 'partorder'}
        />
      )}

      {activeTab === 'dgd' && (
        <SimpleLabourGrid
          title="DGD İşçilik Fiyatı"
          icon={ClipboardCheck}
          columns={DGD_COLUMNS}
          customers={customers}
          priceList={dgdPrices}
          onSave={makeSaver('dgd', api.saveDgdLabourMatrixBatch)}
          saving={savingSection === 'dgd'}
        />
      )}
    </div>
  );
}
