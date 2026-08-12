import { useState, useEffect, useCallback, useMemo } from 'react';
import { Gauge, RefreshCw, Loader2, AlertTriangle, Clock, Search, Download, X } from 'lucide-react';
import { api } from '../services/api';

// Operasyon Paneli — "RemalabPanel" referansının bize uyarlanmış hali.
// Sekme 1 (Aktif Servisler) canlı; Sekme 2 (Günlük Performans) ve 3 (Üretim Takibi)
// kademeli plan gereği sonraki adımda eklenecek.

const intf = (v) => Number(v || 0).toLocaleString('tr-TR');
const euro = (v) => `€ ${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// "91,89" ya da "91.89" -> 91.89
const parseNum = (s) => {
  if (s === '' || s === null || s === undefined) return 0;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : parseFloat(String(s).replace(',', '.')) || 0;
};

export default function OperasyonPaneli() {
  const [tab, setTab] = useState('aktif');
  const [data, setData] = useState(null);
  const [config, setConfig] = useState({ targets: {}, prices: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  // Sekme 2 (Günlük Performans)
  const bugun = new Date().toISOString().slice(0, 10);
  const [pStart, setPStart] = useState(bugun);
  const [pEnd, setPEnd] = useState(bugun);
  const [pCustomer, setPCustomer] = useState('');
  const [pDept, setPDept] = useState('');
  const [perf, setPerf] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfErr, setPerfErr] = useState('');

  const loadPerformance = useCallback(async () => {
    setPerfLoading(true); setPerfErr('');
    try {
      const r = await api.getOperationsPanelPerformance(pStart, pEnd, pCustomer, pDept);
      if (!r || !r.success) throw new Error(r?.message || 'Performans verisi alınamadı');
      setPerf(r);
    } catch (e) { setPerfErr(String(e.message || e)); }
    finally { setPerfLoading(false); }
  }, [pStart, pEnd, pCustomer, pDept]);

  useEffect(() => {
    if (tab === 'performans' && perf === null) loadPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Sekme 3 (Üretim Takibi)
  const [uCustomer, setUCustomer] = useState('');
  const [uBatch, setUBatch] = useState('');
  const [prod, setProd] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodErr, setProdErr] = useState('');

  const loadProduction = useCallback(async (cust, bat) => {
    setProdLoading(true); setProdErr('');
    try {
      const r = await api.getOperationsPanelProduction(cust ?? uCustomer, bat ?? uBatch);
      if (!r || !r.success) throw new Error(r?.message || 'Üretim takibi verisi alınamadı');
      setProd(r);
    } catch (e) { setProdErr(String(e.message || e)); }
    finally { setProdLoading(false); }
  }, [uCustomer, uBatch]);

  useEffect(() => {
    if (tab === 'uretim' && prod === null) loadProduction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Sekme 1 drill-down modal (hücreye tıkla -> cihaz listesi)
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const openDevices = useCallback(async (groupKey, custKey) => {
    setModal({ groupKey, custKey }); setModalData(null); setModalLoading(true);
    try {
      const r = await api.getOperationsPanelDevices(groupKey, custKey);
      setModalData(r && r.success ? r : { devices: [], count: 0, error: r?.message || 'Liste alınamadı' });
    } catch (e) {
      setModalData({ devices: [], count: 0, error: String(e.message || e) });
    } finally { setModalLoading(false); }
  }, []);

  const exportModal = async () => {
    if (!modalData?.devices?.length) return;
    const fn = `${modalData.group_label || 'liste'}_${modalData.customer_name || ''}`
      .replace(/[^a-zA-Z0-9_-]/g, '_') + '.xlsx';
    try { await api.exportTableToExcel(modalData.devices, fn); } catch (_e) { /* sessiz */ }
  };

  // tıklanabilir sayı hücresi (link stili) — 0 ise düz tire
  const cellLink = (v, groupKey, custKey, tone = 'blue', bold = false) => {
    if (!v) return <span className="text-slate-300 dark:text-slate-600">–</span>;
    const color = tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400';
    return (
      <button onClick={() => openDevices(groupKey, custKey)}
        className={`${color} ${bold ? 'font-extrabold' : 'font-semibold'} underline decoration-dotted underline-offset-2 hover:decoration-solid cursor-pointer`}>
        {intf(v)}
      </button>
    );
  };

  // Sekme 3 drill-down (durum × onarım-tipi hücresi -> cihaz/onarım listesi, mevcut filtrelerle)
  const openProdDevices = useCallback(async (stateKey, catKey) => {
    setModal({ stateKey, catKey }); setModalData(null); setModalLoading(true);
    try {
      const r = await api.getOperationsPanelProductionDevices(stateKey, catKey, uCustomer, uBatch);
      setModalData(r && r.success ? r : { devices: [], count: 0, error: r?.message || 'Liste alınamadı' });
    } catch (e) {
      setModalData({ devices: [], count: 0, error: String(e.message || e) });
    } finally { setModalLoading(false); }
  }, [uCustomer, uBatch]);

  const prodCell = (v, stateKey, catKey, bold = false) => {
    if (!v) return <span className="text-slate-300 dark:text-slate-600">–</span>;
    return (
      <button onClick={() => openProdDevices(stateKey, catKey)}
        className={`text-blue-600 dark:text-blue-400 ${bold ? 'font-extrabold' : 'font-semibold'} underline decoration-dotted underline-offset-2 hover:decoration-solid cursor-pointer`}>
        {intf(v)}
      </button>
    );
  };

  const loadConfig = useCallback(async () => {
    try {
      const c = await api.getOperationsPanelConfig();
      if (c && c.success) setConfig({ targets: c.config?.targets || {}, prices: c.config?.prices || {} });
    } catch (_e) { /* config yoksa boş kalır */ }
  }, []);

  const loadActive = useCallback(async () => {
    setErr('');
    const d = await api.getOperationsPanelActive();
    if (!d || !d.success) throw new Error(d?.message || 'Aktif servis verisi alınamadı');
    setData(d);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([loadActive(), loadConfig()]); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setLoading(false); }
  }, [loadActive, loadConfig]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const yenile = async () => {
    setRefreshing(true);
    try { await loadActive(); } catch (e) { setErr(String(e.message || e)); }
    finally { setRefreshing(false); }
  };

  // Config düzenleme: yazarken local state, blur'da kalıcı yaz.
  const onEdit = (kind, key, val) => {
    setConfig((prev) => ({ ...prev, [kind]: { ...prev[kind], [key]: val } }));
  };
  const persist = async (nextConfig) => {
    const payload = {
      targets: Object.fromEntries(Object.entries(nextConfig.targets || {}).map(([k, v]) => [k, parseNum(v)])),
      prices: Object.fromEntries(Object.entries(nextConfig.prices || {}).map(([k, v]) => [k, parseNum(v)])),
    };
    try {
      const r = await api.saveOperationsPanelConfig(payload);
      if (r && r.success) setConfig({ targets: r.config.targets || {}, prices: r.config.prices || {} });
    } catch (_e) { /* sessiz geç, tekrar denenebilir */ }
  };

  const customers = data?.customers || [];
  const groups = data?.groups || [];
  const counts = data?.counts || {};
  const valueGroups = data?.value_groups || [];

  // sütun/satır toplamları
  const colTotal = useCallback((gkey) => customers.reduce((s, c) => s + (counts[c.key]?.[gkey] || 0), 0), [customers, counts]);
  const grandCount = useMemo(() => customers.reduce((s, c) => s + (counts[c.key]?._total || 0), 0), [customers, counts]);
  const sevkColTotal = useMemo(() => customers.reduce((s, c) => s + (counts[c.key]?.sevk_kalan || 0), 0), [customers, counts]);

  // Toplam Değer: adet(grup) × birim fiyat(müşteri)
  const priceOf = (key) => parseNum(config.prices?.[key]);
  const valueCell = (gkey, ckey) => (counts[ckey]?.[gkey] || 0) * priceOf(ckey);
  const valueColTotal = (gkey) => customers.reduce((s, c) => s + valueCell(gkey, c.key), 0);
  const valueCustTotal = (ckey) => valueGroups.reduce((s, g) => s + valueCell(g, ckey), 0);
  const valueGrand = useMemo(() => customers.reduce((s, c) => s + valueCustTotal(c.key), 0), [customers, valueGroups, counts, config]);

  const groupLabel = (gkey) => groups.find((g) => g.key === gkey)?.label || gkey;

  // ── stil kısayolları ──
  const card = 'rounded-2xl border border-[#DCE1F1] dark:border-[#1e222d] bg-white dark:bg-[#12141c] shadow-sm';
  const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-4 py-2.5 text-sm text-center tabular-nums whitespace-nowrap';
  const rowName = 'px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap sticky left-0 bg-white dark:bg-[#12141c] z-10';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-blue-500" size={28} />
        <span className="ml-3 text-slate-500">Operasyon paneli yükleniyor…</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Başlık */}
      <div className={`${card} overflow-hidden`}>
        <div className="p-5 md:p-6 bg-gradient-to-br from-blue-50/60 to-transparent dark:from-blue-500/5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-500/10 rounded-full px-2.5 py-1">
              <Gauge size={13} /> Genel Bakış
            </span>
            <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Operasyon Paneli</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Müşteri bazında aktif servis dağılımı, hedefler ve sevke yakın envanterin parasal değeri — canlı.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.updated_at && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                <Clock size={13} /> Son güncelleme: {data.updated_at}
              </span>
            )}
            <button
              onClick={yenile}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Yenile
            </button>
          </div>
        </div>
        {/* Sekmeler */}
        <div className="flex items-center gap-1 px-3 border-t border-[#DCE1F1] dark:border-[#1e222d]">
          {[
            { key: 'aktif', label: 'Aktif Servisler', enabled: true },
            { key: 'performans', label: 'Günlük Performans', enabled: true },
            { key: 'uretim', label: 'Üretim Takibi', enabled: true },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => t.enabled && setTab(t.key)}
              disabled={!t.enabled}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'text-blue-600 dark:text-blue-400'
                  : t.enabled
                    ? 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              {t.label}
              {!t.enabled && <span className="ml-1.5 text-[10px] font-semibold uppercase text-amber-500">yakında</span>}
              {tab === t.key && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-blue-500 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {tab === 'aktif' && customers.length === 0 && !err && (
        <div className={`${card} p-10 text-center text-slate-500`}>
          Şu an izlenen statülerde (İlk Test → Müşteriye Gönderilecek) cihaz bulunmuyor.
        </div>
      )}

      {tab === 'aktif' && customers.length > 0 && (
        <>
          {/* 1) Aktif Servis Sayıları */}
          <section className={card}>
            <div className="px-5 pt-4 pb-2 text-sm font-bold text-blue-600 dark:text-blue-400">Aktif Servis Sayıları</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#DCE1F1] dark:border-[#1e222d]">
                    <th className={`${th} text-left sticky left-0 bg-white dark:bg-[#12141c] z-10`}>Statü</th>
                    {customers.map((c) => <th key={c.key} className={`${th} text-center`}>{c.name}</th>)}
                    <th className={`${th} text-center bg-slate-50 dark:bg-white/5`}>TOPLAM</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key} className="border-b border-[#eef1f8] dark:border-[#171a22] hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                      <td className={rowName}>{g.label}</td>
                      {customers.map((c) => {
                        const v = counts[c.key]?.[g.key] || 0;
                        return <td key={c.key} className={td}>{cellLink(v, g.key, c.key)}</td>;
                      })}
                      <td className={`${td} bg-slate-50 dark:bg-white/5`}>{cellLink(colTotal(g.key), g.key, '__all__', 'blue', true)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#DCE1F1] dark:border-[#272b39] bg-slate-50/70 dark:bg-white/[0.03]">
                    <td className={`${rowName} font-bold !bg-transparent`}>TOPLAM</td>
                    {customers.map((c) => <td key={c.key} className={td}>{cellLink(counts[c.key]?._total || 0, '__all__', c.key, 'blue', true)}</td>)}
                    <td className={td}>{cellLink(grandCount, '__all__', '__all__', 'blue', true)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 2) Hedef Adet */}
          <section className={card}>
            <div className="px-5 pt-4 pb-3 text-sm font-bold text-blue-600 dark:text-blue-400">Hedef Adet</div>
            <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {customers.map((c) => (
                <label key={c.key} className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 truncate" title={c.name}>{c.name}</span>
                  <input
                    type="text" inputMode="numeric"
                    value={config.targets?.[c.key] ?? ''}
                    onChange={(e) => onEdit('targets', c.key, e.target.value)}
                    onBlur={() => persist(config)}
                    placeholder="0"
                    className="w-full rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] px-3 py-2 text-sm tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* 3) Sevk için Kalan Adet */}
          <section className={card}>
            <div className="px-5 pt-4 pb-2 text-sm font-bold text-amber-600 dark:text-amber-400">Sevk için Kalan Adet</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#DCE1F1] dark:border-[#1e222d]">
                    <th className={`${th} text-left sticky left-0 bg-white dark:bg-[#12141c] z-10`}></th>
                    {customers.map((c) => <th key={c.key} className={`${th} text-center`}>{c.name}</th>)}
                    <th className={`${th} text-center bg-slate-50 dark:bg-white/5`}>TOPLAM</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={rowName}>Sevk için Kalan</td>
                    {customers.map((c) => {
                      const v = counts[c.key]?.sevk_kalan || 0;
                      return <td key={c.key} className={td}>{cellLink(v, 'sevk_kalan', c.key, 'amber')}</td>;
                    })}
                    <td className={`${td} bg-slate-50 dark:bg-white/5`}>{cellLink(sevkColTotal, 'sevk_kalan', '__all__', 'amber', true)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4) Birim Fiyat */}
          <section className={card}>
            <div className="px-5 pt-4 pb-3 text-sm font-bold text-blue-600 dark:text-blue-400">Birim Fiyat (€ / adet)</div>
            <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {customers.map((c) => (
                <label key={c.key} className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400 truncate" title={c.name}>{c.name}</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                    <input
                      type="text" inputMode="decimal"
                      value={config.prices?.[c.key] ?? ''}
                      onChange={(e) => onEdit('prices', c.key, e.target.value)}
                      onBlur={() => persist(config)}
                      placeholder="0,00"
                      className="w-full rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] pl-7 pr-3 py-2 text-sm tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* 5) Toplam Değer */}
          <section className={card}>
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Toplam Değer</span>
              <span className="text-[11px] text-slate-400">Ara Test + Son Test + Müşteriye Gönderilecek adetleri × birim fiyat</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#DCE1F1] dark:border-[#1e222d]">
                    <th className={`${th} text-left sticky left-0 bg-white dark:bg-[#12141c] z-10`}>Statü</th>
                    {customers.map((c) => <th key={c.key} className={`${th} text-center`}>{c.name}</th>)}
                    <th className={`${th} text-center bg-slate-50 dark:bg-white/5`}>TOPLAM</th>
                  </tr>
                </thead>
                <tbody>
                  {valueGroups.map((gkey) => (
                    <tr key={gkey} className="border-b border-[#eef1f8] dark:border-[#171a22]">
                      <td className={rowName}>{groupLabel(gkey)}</td>
                      {customers.map((c) => {
                        const v = valueCell(gkey, c.key);
                        return <td key={c.key} className={`${td} ${v ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>{v ? euro(v) : '–'}</td>;
                      })}
                      <td className={`${td} font-semibold text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-white/5`}>{euro(valueColTotal(gkey))}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#DCE1F1] dark:border-[#272b39] bg-slate-50/70 dark:bg-white/[0.03]">
                    <td className={`${rowName} font-bold !bg-transparent`}>TOPLAM</td>
                    {customers.map((c) => <td key={c.key} className={`${td} font-bold text-slate-700 dark:text-slate-200`}>{euro(valueCustTotal(c.key))}</td>)}
                    <td className={`${td} font-extrabold text-emerald-600 dark:text-emerald-400`}>{euro(valueGrand)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'performans' && (
        <>
          {/* Filtreler */}
          <section className={card}>
            <div className="p-4 md:p-5 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Başlangıç</span>
                <input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)}
                  className="rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Bitiş</span>
                <input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)}
                  className="rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </label>
              <label className="flex flex-col gap-1 min-w-[190px]">
                <span className="text-[11px] text-slate-400">Müşteri</span>
                <select value={pCustomer} onChange={(e) => setPCustomer(e.target.value)}
                  className="rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  <option value="">Tümü</option>
                  {(perf?.customers || []).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 min-w-[160px]">
                <span className="text-[11px] text-slate-400">Departman</span>
                <select value={pDept} onChange={(e) => setPDept(e.target.value)}
                  className="rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  <option value="">Tümü</option>
                  {(perf?.departments || []).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <button onClick={loadPerformance} disabled={perfLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 transition-colors">
                {perfLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Getir
              </button>
            </div>
          </section>

          {perfErr && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 px-4 py-3 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {perfErr}
            </div>
          )}

          <section className={card}>
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Teknisyen Bazlı Tamamlanan Onarımlar</span>
              {perf?.range && <span className="text-[11px] text-slate-400 font-mono">{perf.range.start} → {perf.range.end}</span>}
            </div>
            {perfLoading ? (
              <div className="p-10 text-center"><Loader2 className="animate-spin inline text-blue-500" size={24} /></div>
            ) : !perf || perf.technicians.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Seçilen aralıkta tamamlanan onarım bulunmuyor.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCE1F1] dark:border-[#1e222d]">
                      <th className={`${th} text-left sticky left-0 bg-white dark:bg-[#12141c] z-10`}>Teknisyen</th>
                      <th className={`${th} text-center bg-slate-50 dark:bg-white/5`}>TOPLAM</th>
                      {perf.columns.map((c) => <th key={c.key} className={`${th} text-center`}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {perf.technicians.map((t) => (
                      <tr key={t.name} className="border-b border-[#eef1f8] dark:border-[#171a22] hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                        <td className={rowName}>{t.name}</td>
                        <td className={`${td} font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-white/5`}>{intf(t.counts._total)}</td>
                        {perf.columns.map((c) => {
                          const v = t.counts[c.key] || 0;
                          return <td key={c.key} className={`${td} ${v ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-300 dark:text-slate-600'}`}>{v ? intf(v) : '–'}</td>;
                        })}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#DCE1F1] dark:border-[#272b39] bg-slate-50/70 dark:bg-white/[0.03]">
                      <td className={`${rowName} font-bold !bg-transparent`}>TOPLAM</td>
                      <td className={`${td} font-extrabold text-blue-600 dark:text-blue-400`}>{intf(perf.technicians.reduce((s, t) => s + t.counts._total, 0))}</td>
                      {perf.columns.map((c) => (
                        <td key={c.key} className={`${td} font-bold text-slate-700 dark:text-slate-200`}>
                          {intf(perf.technicians.reduce((s, t) => s + (t.counts[c.key] || 0), 0))}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'uretim' && (
        <>
          {/* Filtreler */}
          <section className={card}>
            <div className="p-4 md:p-5 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 min-w-[190px]">
                <span className="text-[11px] text-slate-400">Müşteri</span>
                <select value={uCustomer} onChange={(e) => { setUCustomer(e.target.value); loadProduction(e.target.value, uBatch); }}
                  className="rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  <option value="">Tümü</option>
                  {(prod?.customers || []).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 min-w-[190px]">
                <span className="text-[11px] text-slate-400">Batch / Waybill</span>
                <select value={uBatch} onChange={(e) => { setUBatch(e.target.value); loadProduction(uCustomer, e.target.value); }}
                  className="rounded-lg border border-[#DCE1F1] dark:border-[#272b39] bg-white dark:bg-[#0f1117] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  <option value="">Tümü</option>
                  {(prod?.batches || []).map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              {prodLoading && <span className="inline-flex items-center gap-2 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> yükleniyor…</span>}
            </div>
          </section>

          {prodErr && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 px-4 py-3 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {prodErr}
            </div>
          )}

          <section className={card}>
            <div className="px-5 pt-4 pb-2 text-sm font-bold text-blue-600 dark:text-blue-400">
              Üretim Takibi <span className="text-[11px] font-normal text-slate-400">(Statü 109 — Aktif)</span>
            </div>
            {prodLoading && !prod ? (
              <div className="p-10 text-center"><Loader2 className="animate-spin inline text-blue-500" size={24} /></div>
            ) : !prod ? (
              <div className="p-10 text-center text-slate-500">Veri yükleniyor…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCE1F1] dark:border-[#1e222d]">
                      <th className={`${th} text-left sticky left-0 bg-white dark:bg-[#12141c] z-10`}>Durum</th>
                      <th className={`${th} text-center bg-slate-50 dark:bg-white/5`}>TOPLAM</th>
                      {prod.columns.map((c) => <th key={c.key} className={`${th} text-center`}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {prod.rows.map((rw) => {
                      const cnt = prod.counts[rw.key] || {};
                      return (
                        <tr key={rw.key} className="border-b border-[#eef1f8] dark:border-[#171a22] hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                          <td className={rowName}>{rw.label}</td>
                          <td className={`${td} bg-slate-50 dark:bg-white/5`}>{prodCell(cnt._total || 0, rw.key, '__all__', true)}</td>
                          {prod.columns.map((c) => (
                            <td key={c.key} className={td}>{prodCell(cnt[c.key] || 0, rw.key, c.key)}</td>
                          ))}
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-[#DCE1F1] dark:border-[#272b39] bg-slate-50/70 dark:bg-white/[0.03]">
                      <td className={`${rowName} font-bold !bg-transparent`}>TOPLAM</td>
                      <td className={td}>{prodCell(prod.rows.reduce((s, rw) => s + (prod.counts[rw.key]?._total || 0), 0), '__all__', '__all__', true)}</td>
                      {prod.columns.map((c) => (
                        <td key={c.key} className={td}>
                          {prodCell(prod.rows.reduce((s, rw) => s + (prod.counts[rw.key]?.[c.key] || 0), 0), '__all__', c.key, true)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Drill-down modal: hücredeki cihaz listesi */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 bg-black/40 backdrop-blur-sm"
          onClick={() => setModal(null)}>
          <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-[#DCE1F1] dark:border-[#1e222d] bg-white dark:bg-[#12141c] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#DCE1F1] dark:border-[#1e222d]">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                  {modalData && !modalData.error
                    ? `${modalData.group_label} — ${modalData.customer_name}`
                    : 'Cihaz Listesi'}
                </div>
                {modalData && !modalData.error && (
                  <div className="text-xs text-slate-400 font-mono">{modalData.count} kayıt</div>
                )}
              </div>
              <button onClick={exportModal} disabled={!modalData?.devices?.length}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2">
                <Download size={15} /> Excel
              </button>
              <button onClick={() => setModal(null)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-3 py-2">
                <X size={15} /> Kapat
              </button>
            </div>
            <div className="overflow-auto">
              {modalLoading ? (
                <div className="p-12 text-center"><Loader2 className="animate-spin inline text-blue-500" size={26} /></div>
              ) : !modalData || modalData.error || modalData.devices.length === 0 ? (
                <div className="p-12 text-center text-slate-500">{modalData?.error || 'Bu kombinasyonda cihaz bulunamadı.'}</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-[#171a22]">
                    <tr className="border-b border-[#DCE1F1] dark:border-[#1e222d]">
                      {(modalData.columns || []).map((h) => (
                        <th key={h} className={`${th} text-left`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.devices.map((d, i) => (
                      <tr key={i} className="border-b border-[#eef1f8] dark:border-[#171a22] hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                        {(modalData.columns || []).map((h, j) => (
                          <td key={h} className={`px-4 py-2.5 text-sm whitespace-nowrap ${j === 0 ? 'font-mono text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>{d[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
