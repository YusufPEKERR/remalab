import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck, Table2, AlertTriangle, Activity, TrendingUp,
  Wrench, Cpu, CircleSlash2, Filter, Database, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { QC_FAILS, QC_PROD } from '../constants/qcDemoData';

// demo üretim pass/fail özetini hesapla (canlı DB gelmezse fallback)
function demoProdSummary() {
  const pass = QC_PROD.filter((r) => r.repair_is_success === true || r.test_result_type_name === 'Pass1').length;
  return { pass, fail: QC_PROD.length - pass };
}

/**
 * QC (Quality Control) Modülü
 *
 * Kontrol Paneli altında kalite kontrol paneli. Şu an demo veriden
 * (constants/qcDemoData.js — table_preview.xlsx'ten 100 Fail1 kaydı)
 * beslenir. Gerçek entegrasyonda bu veri backend @Slot ile (ETL/analytics
 * DB) değiştirilecek — aşağıdaki useMemo'lar ve grafikler aynı kalır.
 *
 * Kaynak tablolar: repair_test_fail_records (Fail1) + production_repair_records
 */

// ── veri-viz renkleri (hem açık hem koyu kart zemininde okunur) ──
const C_BAR = '#3b82f6';      // magnitude (mavi)
const C_S1  = '#3b82f6';      // Ara Test
const C_S2  = '#f59e0b';      // Çıkış Testi
const C_CUM = '#f59e0b';      // pareto kümülatif
const C_GOOD = '#16a34a';
const C_FAIL = '#dc2626';
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// ── yardımcılar ──
function countBy(arr, key) {
  const m = new Map();
  arr.forEach((r) => { const k = r[key] || '—'; m.set(k, (m.get(k) || 0) + 1); });
  return m;
}
const sortedEntries = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
function parseDT(s) { if (!s) return null; const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d; }

// ── küçük grafik bileşenleri ──
function BarChart({ data, color = C_BAR }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  const total = data.reduce((s, d) => s + d[1], 0) || 1;
  if (!data.length) return <Empty />;
  return (
    <div className="flex flex-col gap-2">
      {data.map(([label, val]) => (
        <div key={label} className="grid grid-cols-[8.5rem_1fr_2.5rem] gap-3 items-center group"
             title={`${label} · ${val} fail · %${(val / total * 100).toFixed(1)}`}>
          <div className="text-xs text-gray-500 dark:text-gray-400 text-right truncate">{label}</div>
          <div className="h-5 rounded-md bg-gray-100 dark:bg-gray-700/50 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded-r-md transition-[width] duration-700 ease-out group-hover:brightness-110"
                 style={{ width: `${(val / max) * 100}%`, backgroundColor: color, minWidth: 3 }} />
          </div>
          <div className="text-sm font-bold text-gray-800 dark:text-gray-100 text-right tabular-nums">{val}</div>
        </div>
      ))}
    </div>
  );
}

function Pareto({ data }) {
  if (!data.length) return <Empty />;
  const total = data.reduce((s, d) => s + d[1], 0) || 1;
  const W = 820, H = 300, mL = 42, mR = 16, mT = 14, mB = 52;
  const iw = W - mL - mR, ih = H - mT - mB, gap = iw / data.length, bw = gap * 0.55;
  const y = (v) => mT + ih - (v / 100) * ih;
  let cum = 0;
  const bars = [], pts = [], labels = [];
  data.forEach(([label, val], i) => {
    const share = (val / total) * 100; cum += share;
    const cx = mL + gap * i + gap / 2;
    const bh = (share / 100) * ih, by = mT + ih - bh;
    bars.push(
      <rect key={label} x={cx - bw / 2} y={by} width={bw} height={bh} rx="4" fill={C_BAR}>
        <title>{`${label} · ${val} fail · pay %${share.toFixed(1)} · kümülatif %${cum.toFixed(1)}`}</title>
      </rect>
    );
    pts.push([cx, y(cum)]);
    labels.push(<text key={label + 'l'} x={cx} y={H - mB + 18} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 11 }}>{label.replace('FT_', '')}</text>);
  });
  const gridY = [0, 20, 40, 60, 80, 100];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Semptom pareto">
      {gridY.map((g) => (
        <g key={g}>
          <line x1={mL} y1={y(g)} x2={W - mR} y2={y(g)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
          <text x={mL - 8} y={y(g) + 3} textAnchor="end" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 10.5 }}>{g}%</text>
        </g>
      ))}
      {bars}
      <polyline fill="none" stroke={C_CUM} strokeWidth="2" points={pts.map((p) => p.join(',')).join(' ')} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={C_CUM} className="stroke-white dark:stroke-gray-800" strokeWidth="2" />)}
      {labels}
    </svg>
  );
}

function TrendChart({ fails }) {
  const arr = useMemo(() => {
    const b = new Map();
    fails.forEach((r) => {
      const d = parseDT(r.create_time); if (!d) return;
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!b.has(k)) b.set(k, { date: new Date(d.getFullYear(), d.getMonth(), 1), ara: 0, cikis: 0 });
      const o = b.get(k); if (r.test_type_name === 'Ara Test') o.ara++; else o.cikis++;
    });
    return [...b.values()].sort((a, z) => a.date - z.date);
  }, [fails]);
  if (!arr.length) return <Empty />;
  const W = 820, H = 260, mL = 34, mR = 16, mT = 12, mB = 34;
  const iw = W - mL - mR, ih = H - mT - mB;
  const maxY = Math.max(3, ...arr.map((b) => Math.max(b.ara, b.cikis)));
  const x = (i) => mL + (arr.length === 1 ? iw / 2 : (iw * i) / (arr.length - 1));
  const y = (v) => mT + ih - (v / maxY) * ih;
  const step = Math.ceil(maxY / 4);
  const grid = [];
  for (let g = 0; g <= maxY; g += step) grid.push(g);
  const line = (key, color) => {
    const pts = arr.map((b, i) => [x(i), y(b[key])]);
    return (
      <g key={key}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={pts.map((p) => p.join(',')).join(' ')} />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill={color} className="stroke-white dark:stroke-gray-800" strokeWidth="2">
            <title>{`${arr[i].date.getFullYear()} ${TR_MONTHS[arr[i].date.getMonth()]} · ${key === 'ara' ? 'Ara Test' : 'Çıkış Testi'}: ${arr[i][key]}`}</title>
          </circle>
        ))}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Aylık fail trendi">
      {grid.map((g) => (
        <g key={g}>
          <line x1={mL} y1={y(g)} x2={W - mR} y2={y(g)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1" />
          <text x={mL - 8} y={y(g) + 3} textAnchor="end" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 10.5 }}>{g}</text>
        </g>
      ))}
      {line('ara', C_S1)}
      {line('cikis', C_S2)}
      {arr.map((b, i) => <text key={i} x={x(i)} y={H - mB + 18} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 10.5 }}>{TR_MONTHS[b.date.getMonth()]}</text>)}
    </svg>
  );
}

function Donut({ pass, fail }) {
  const total = pass + fail || 1;
  const failRate = (fail / total) * 100;
  const cx = 95, cy = 95, rad = 63, sw = 26, circ = 2 * Math.PI * rad;
  const passFrac = pass / total, failFrac = fail / total;
  const seg = (frac, offset, color, label, val) => (
    <circle cx={cx} cy={cy} r={rad} fill="none" stroke={color} strokeWidth={sw}
      strokeDasharray={`${frac * circ} ${circ}`} strokeDashoffset={-offset * circ}
      transform={`rotate(-90 ${cx} ${cy})`}>
      <title>{`${label}: ${val} · %${(frac * 100).toFixed(1)}`}</title>
    </circle>
  );
  return (
    <div className="flex items-center gap-6 flex-wrap justify-center">
      <svg viewBox="0 0 190 190" width="170" height="170" role="img" aria-label="Pass fail">
        {seg(passFrac, 0, C_GOOD, 'Başarılı (Pass1)', pass)}
        {seg(failFrac, passFrac, C_FAIL, 'Fail1', fail)}
        <text x={cx} y={cy - 3} textAnchor="middle" className="fill-gray-800 dark:fill-gray-100" style={{ fontSize: 30, fontWeight: 800 }}>%{failRate.toFixed(0)}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 10, letterSpacing: 1 }}>FAIL ORANI</text>
      </svg>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: C_GOOD }} /><b className="text-gray-800 dark:text-gray-100">{pass}</b><span className="text-gray-500 dark:text-gray-400">Başarılı · Pass1</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: C_FAIL }} /><b className="text-gray-800 dark:text-gray-100">{fail}</b><span className="text-gray-500 dark:text-gray-400">Fail1 · yeniden işlem</span></div>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">toplam {total} onarım</div>
      </div>
    </div>
  );
}

const Empty = () => <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-10">Bu filtrede kayıt yok</div>;

function Card({ title, subtitle, icon: Icon, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-cyan-500" />} {title}
        </h3>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── ana sayfa ──
export default function QC() {
  const [testType, setTestType] = useState('all');
  const [dept, setDept] = useState('all');
  const [showTable, setShowTable] = useState(false);

  // veri kaynağı: başta demo, canlı DB gelirse onunla değişir
  const [rawFails, setRawFails] = useState(QC_FAILS);
  const [prodSum, setProdSum] = useState(demoProdSummary);
  const [source, setSource] = useState('demo');   // 'demo' | 'db'
  const [sourceLabel, setSourceLabel] = useState('canlı');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getQcData(8000);
      if (res && res.success && Array.isArray(res.fails)) {
        setRawFails(res.fails);
        if (res.prod_summary) setProdSum(res.prod_summary);
        setSource('db');
        setSourceLabel(res.source || 'canlı');
        setDbError('');
      } else {
        setSource('demo');
        setDbError((res && res.error) || 'bağlantı yok');
      }
    } catch (e) {
      setSource('demo');
      setDbError(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadData(); }, []);

  const deptOptions = useMemo(() => sortedEntries(countBy(rawFails, 'mission_group_name')).map((e) => e[0]), [rawFails]);

  const fails = useMemo(() => rawFails.filter((r) =>
    (testType === 'all' || r.test_type_name === testType) &&
    (dept === 'all' || r.mission_group_name === dept)), [rawFails, testType, dept]);

  const agg = useMemo(() => {
    const byDept = sortedEntries(countBy(fails, 'mission_group_name'));
    const bySym = sortedEntries(countBy(fails, 'symptom_group_name'));
    const pass = prodSum.pass || 0, fail = prodSum.fail || 0, totalProd = pass + fail;
    const failRate = totalProd ? (fail / totalProd) * 100 : 0;
    const ara = fails.filter((r) => r.test_type_name === 'Ara Test').length;
    return {
      byFamily: sortedEntries(countBy(fails, 'product_family_name')).slice(0, 10),
      byDept, bySym,
      byTech: sortedEntries(countBy(fails, 'teststaff_fullname')).slice(0, 8),
      pass, fail, totalProd, failRate,
      ara, cikis: fails.length - ara,
      topDept: byDept[0] || ['—', 0], topSym: bySym[0] || ['—', 0],
    };
  }, [fails, prodSum]);

  const range = useMemo(() => {
    const ds = rawFails.map((r) => parseDT(r.create_time)).filter(Boolean).sort((a, b) => a - b);
    if (!ds.length) return '';
    const a = ds[0], b = ds[ds.length - 1];
    return `${a.getDate()} ${TR_MONTHS[a.getMonth()]} – ${b.getDate()} ${TR_MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }, [rawFails]);

  const kpis = [
    { lab: 'Toplam Fail1', val: fails.length, meta: `${QC_FAILS.length} kayıttan filtreli`, strip: C_FAIL, icon: AlertTriangle },
    { lab: 'En Sorunlu Departman', val: agg.topDept[1], meta: agg.topDept[0], strip: '#f59e0b', icon: Wrench },
    { lab: 'En Sık Semptom', val: agg.topSym[1], meta: String(agg.topSym[0]).replace('FT_', ''), strip: C_S1, icon: Cpu },
    { lab: 'Ara / Çıkış Testi', val: `${agg.ara}/${agg.cikis}`, meta: 'ara / çıkış kırılımı', strip: '#06b6d4', icon: Activity },
    { lab: 'Üretim Fail Oranı', val: `%${agg.failRate.toFixed(0)}`, meta: `${agg.pass}/${agg.totalProd} Pass1`, strip: agg.failRate > 25 ? C_FAIL : C_GOOD, icon: TrendingUp, valColor: agg.failRate > 25 ? 'text-red-500' : 'text-green-600 dark:text-green-500' },
  ];

  const Seg = ({ value, set, options }) => (
    <div className="inline-flex bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      {options.map((o) => (
        <button key={o.v} onClick={() => set(o.v)}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${value === o.v ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100'}`}>
          {o.t}
        </button>
      ))}
    </div>
  );

  const tableRows = useMemo(() => {
    const dims = [
      ['Ürün Ailesi', countBy(fails, 'product_family_name')],
      ['Onarım Departmanı', countBy(fails, 'mission_group_name')],
      ['Semptom Grubu', countBy(fails, 'symptom_group_name')],
      ['Test Tipi', countBy(fails, 'test_type_name')],
      ['Teknisyen', countBy(fails, 'teststaff_fullname')],
    ];
    const total = fails.length || 1;
    const out = [];
    dims.forEach(([dim, m]) => sortedEntries(m).forEach(([k, v]) => out.push({ dim, k, v, p: (v / total * 100).toFixed(1) })));
    return out;
  }, [fails]);

  return (
    <div className="p-6">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">QC — Kalite Kontrol</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fail1 analizi · repair_test_fail_records</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {source === 'db' ? (
            <span className="text-xs font-mono px-3 py-1.5 rounded-lg border border-green-400/40 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center gap-1.5" title="canlı veritabanı">
              <Database className="w-3.5 h-3.5" />CANLI · {sourceLabel} · {rawFails.length} kayıt
            </span>
          ) : (
            <span className="text-xs font-mono px-3 py-1.5 rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1.5"
                  title={dbError ? `DB'ye ulaşılamadı: ${dbError}` : 'demo veri'}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />DEMO VERİ · {rawFails.length} kayıt
            </span>
          )}
          {range && <span className="text-xs font-mono px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">{range}</span>}
          <button onClick={loadData} disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Yenile
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex items-center gap-3 flex-wrap mb-5 p-3 bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl">
        <span className="text-[11px] font-mono uppercase tracking-wide text-gray-400 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" />Test tipi</span>
        <Seg value={testType} set={setTestType} options={[{ v: 'all', t: 'Tümü' }, { v: 'Ara Test', t: 'Ara Test' }, { v: 'Çıkış Testi', t: 'Çıkış Testi' }]} />
        <span className="text-[11px] font-mono uppercase tracking-wide text-gray-400 ml-2">Departman</span>
        <Seg value={dept} set={setDept} options={[{ v: 'all', t: 'Tümü' }, ...deptOptions.map((d) => ({ v: d, t: d.replace(' Onarımı', '') }))]} />
        <div className="flex-1" />
        <button onClick={() => setShowTable((s) => !s)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 flex items-center gap-1.5">
          <Table2 className="w-3.5 h-3.5" />{showTable ? 'Tabloyu gizle' : 'Tablo görünümü'}
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        {kpis.map((k) => (
          <div key={k.lab} className="relative bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: k.strip }} />
            <div className="text-[11px] font-mono uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <k.icon className="w-3.5 h-3.5" />{k.lab}
            </div>
            <div className={`text-3xl font-bold mt-2 leading-none tabular-nums ${k.valColor || 'text-gray-800 dark:text-gray-100'}`}>{k.val}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 truncate" title={k.meta}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Fail — Ürün Ailesine Göre" subtitle="Hangi modelde daha çok arıza?" icon={AlertTriangle}>
          <BarChart data={agg.byFamily} />
        </Card>
        <Card title="Fail — Onarım Departmanına Göre" subtitle="mission_group_name kırılımı" icon={Wrench}>
          <BarChart data={agg.byDept} />
        </Card>

        <Card title="Semptom Grubu — Pareto (80/20)" subtitle="Arızaların çoğu az sayıda gruptan gelir — kümülatif % çizgisi" icon={CircleSlash2} className="lg:col-span-2">
          <Pareto data={agg.bySym} />
        </Card>

        <Card title="Zaman Trendi — Aylık Fail1" subtitle="Ara Test vs Çıkış Testi" icon={TrendingUp} className="lg:col-span-2">
          <div className="flex gap-4 mb-2 text-xs">
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className="w-3 h-3 rounded-sm" style={{ background: C_S1 }} />Ara Test</span>
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><span className="w-3 h-3 rounded-sm" style={{ background: C_S2 }} />Çıkış Testi</span>
          </div>
          <TrendChart fails={fails} />
        </Card>

        <Card title="Teknisyen — Fail Sayısı" subtitle="teststaff_fullname · en çok fail (ilk 8)" icon={Activity}>
          <BarChart data={agg.byTech} />
        </Card>
        <Card title="Üretim Sonucu — Pass / Fail" subtitle="production_repair_records · repair_is_success" icon={ShieldCheck}>
          <Donut pass={agg.pass} fail={agg.fail} />
        </Card>
      </div>

      {/* Tablo görünümü */}
      {showTable && (
        <div className="mt-4 bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2.5 text-left text-[11px] font-mono uppercase tracking-wide">Boyut</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-mono uppercase tracking-wide">Değer</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-mono uppercase tracking-wide">Fail</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-mono uppercase tracking-wide">Pay</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.dim}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{r.k}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-800 dark:text-gray-100">{r.v}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">%{r.p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
