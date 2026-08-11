import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ScanLine, RefreshCw, Package, Boxes, Search, CheckCircle, AlertTriangle, X, Info,
  ChevronDown, ChevronRight, Truck,
} from 'lucide-react';
import { api } from '../services/api';

// Müşteri için Sevk + Pack List (Paketleme).
//
// "Müşteri için sevket (126>127)" akışı: okutulan cihaz müşterisine (batch_entries.customer_no)
// göre sıradaki KUTU ve SIRA'ya yerleştirilir ve 126→127'ye alınır. Kutu kapasitesi 50:
// box 1 sıra 1..50 dolunca box 2'ye geçilir. Sıra MÜŞTERİ BAZINDA kalıcıdır; başka müşteri
// araya girse bile her müşteri kendi kaldığı sıradan devam eder (backend pack_device).

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

const Toast = ({ bildirim, onKapat }) => {
  if (!bildirim) return null;
  const renk = {
    success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    error: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300',
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300',
    info: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300',
  }[bildirim.type] || '';
  const Icon = { success: CheckCircle, error: AlertTriangle, warning: AlertTriangle, info: Info }[bildirim.type] || Info;
  return (
    <div className={`fixed top-6 right-6 z-[110] max-w-sm w-full border rounded-xl px-4 py-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-3 fade-in duration-300 ${renk}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="text-sm font-medium flex-1">{bildirim.message}</div>
      <button onClick={onKapat} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

const BOX_KAPASITE = 50;

const tarihStr = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Tek bir kutunun katlanır paneli (başlık + tablo).
function KutuPaneli({ box_no, rows, toplam, dolu, shipped, acik, onToggle, secili, onSelect }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${
      shipped ? 'border-slate-200 dark:border-[#1e222d] opacity-70'
              : secili ? 'border-emerald-400 dark:border-emerald-500/50' : 'border-[#DCE1F1] dark:border-[#1e222d]'}`}>
      <div className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/70 dark:bg-[#181a24]">
        {/* Sevk seçimi (sevk edilmemiş kutular için) */}
        {!shipped ? (
          <input
            type="checkbox"
            checked={secili}
            onChange={onSelect}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
            title="Sevk için seç"
          />
        ) : <span className="w-4 shrink-0" />}
        <button onClick={onToggle} className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer">
          {acik ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
          <Boxes size={15} className={shipped ? 'text-slate-400 shrink-0' : dolu ? 'text-slate-400 shrink-0' : 'text-emerald-500 shrink-0'} />
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Box {box_no}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums ${
            dolu ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                 : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>
            {toplam}/{BOX_KAPASITE}
          </span>
          {shipped
            ? <span className="text-[10px] text-sky-600 dark:text-sky-400 shrink-0 font-semibold inline-flex items-center gap-1"><Truck size={11} /> sevk edildi</span>
            : dolu
              ? <span className="text-[10px] text-slate-400 shrink-0">dolu</span>
              : <span className="text-[10px] text-emerald-500 shrink-0 font-semibold">aktif</span>}
        </button>
      </div>
      {acik && (
        <div className="overflow-x-auto border-t border-[#DCE1F1] dark:border-[#1e222d]">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-white dark:bg-[#12141c] text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-center px-3 py-2 font-semibold w-14">Sıra</th>
                <th className="text-left px-4 py-2 font-semibold">IMEI</th>
                <th className="text-left px-3 py-2 font-semibold">Serial ID</th>
                <th className="text-left px-3 py-2 font-semibold">Internal ID</th>
                <th className="text-left px-3 py-2 font-semibold">Model</th>
                <th className="text-left px-3 py-2 font-semibold">Teknisyen</th>
                <th className="text-left px-3 py-2 font-semibold">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
              {rows.map((r, i) => (
                <tr key={`${r.imei_number}-${i}`} className="hover:bg-slate-50 dark:hover:bg-[#181a24]">
                  <td className="px-3 py-2 text-center text-slate-500 font-semibold tabular-nums">{r.row_no}</td>
                  <td className="px-4 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">{r.imei_number || '—'}</td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{r.serial_number || '—'}</td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{r.internal_id || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.model || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.technician || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{tarihStr(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Bir müşterinin pack list'i: kutulara bölünmüş, katlanır cihaz satırları.
// Dolu kutular kapalı gelir; sadece aktif (dolmakta olan) kutu açıktır. Aramada
// eşleşen satırı olan kutular otomatik açılır ve yalnızca eşleşen satırlar gösterilir.
function MusteriPaketi({ grup, filtre, onSevk, sevkEdiliyor }) {
  // Üç bağımsız filtre (VE mantığı): IMEI (içerir), Box No (eşit), Sıra (eşit).
  const fi = filtre.imei.trim().toLocaleLowerCase('tr');
  const fb = filtre.box.trim();
  const fs = filtre.sira.trim();
  const araniyor = !!(fi || fb || fs);
  const eslesir = (r) =>
    (!fi || (r.imei_number || '').toLocaleLowerCase('tr').includes(fi)) &&
    (!fb || String(r.box_no) === fb) &&
    (!fs || String(r.row_no) === fs);

  // Satırları kutuya göre grupla; kutu sevk edilmiş mi (tüm satırları shipped) hesapla.
  const kutular = useMemo(() => {
    const m = new Map();
    for (const r of grup.rows) {
      if (!m.has(r.box_no)) m.set(r.box_no, []);
      m.get(r.box_no).push(r);
    }
    return [...m.entries()]
      .map(([box_no, rows]) => ({ box_no, rows, shipped: rows.every(r => r.shipped) }))
      .sort((a, b) => a.box_no - b.box_no);
  }, [grup.rows]);

  const aktifBox = kutular.length ? kutular[kutular.length - 1].box_no : 1;
  const [acikSet, setAcikSet] = useState(() => new Set([aktifBox]));
  useEffect(() => { setAcikSet(prev => new Set(prev).add(aktifBox)); }, [aktifBox]);
  const toggle = (b) => setAcikSet(prev => {
    const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n;
  });

  // Sevk için seçilen kutular (yalnızca sevk edilmemiş olanlar seçilebilir).
  const [secili, setSecili] = useState(() => new Set());
  const secim = (b) => setSecili(prev => {
    const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n;
  });
  const seciliListe = [...secili].filter(b => kutular.some(k => k.box_no === b && !k.shipped));

  const sevkEt = () => {
    if (seciliListe.length === 0) return;
    const toplamCihaz = kutular.filter(k => seciliListe.includes(k.box_no))
      .reduce((s, k) => s + k.rows.filter(r => !r.shipped).length, 0);
    if (!window.confirm(
      `${grup.customer_name || grup.customer_no} — ${seciliListe.length} kutu (${toplamCihaz} cihaz) sevk edilecek.\n` +
      `Cihazlar "çıkış yapıldı" statüsüne alınacak. Onaylıyor musunuz?`
    )) return;
    onSevk(grup.customer_no, seciliListe, () => setSecili(new Set()));
  };

  // Aramaya göre görünecek kutular ve satırlar.
  const gorunen = kutular
    .map(k => ({ ...k, filtreli: araniyor ? k.rows.filter(eslesir) : k.rows }))
    .filter(k => !araniyor || k.filtreli.length > 0);

  if (gorunen.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#DCE1F1] dark:border-[#1e222d] overflow-hidden bg-white dark:bg-[#12141c]">
      {/* Müşteri başlığı + Sevket butonu */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
        <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{grup.customer_name || 'Müşteri'}</span>
        <span className="text-[11px] font-mono text-slate-400 shrink-0">{grup.customer_no}</span>
        <span className="text-xs text-slate-500 shrink-0">{grup.box_count} kutu · {grup.device_count} cihaz</span>
        <button
          onClick={sevkEt}
          disabled={seciliListe.length === 0 || sevkEdiliyor}
          className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
        >
          <Truck size={15} /> Sevket{seciliListe.length > 0 ? ` (${seciliListe.length} kutu)` : ''}
        </button>
      </div>

      {/* Kutu panelleri */}
      <div className="px-3 pb-3 space-y-2 border-t border-[#DCE1F1] dark:border-[#1e222d] pt-3">
        {gorunen.map(k => (
          <KutuPaneli
            key={k.box_no}
            box_no={k.box_no}
            rows={k.filtreli}
            toplam={k.rows.length}
            dolu={k.rows.length >= BOX_KAPASITE}
            shipped={k.shipped}
            secili={secili.has(k.box_no)}
            onSelect={() => secim(k.box_no)}
            acik={araniyor ? true : acikSet.has(k.box_no)}
            onToggle={() => toggle(k.box_no)}
          />
        ))}
      </div>
    </div>
  );
}

export default function MusteriSevkPaket() {
  const [gruplar, setGruplar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [term, setTerm] = useState('');
  const [okutuluyor, setOkutuluyor] = useState(false);
  const [fImei, setFImei] = useState('');
  const [fBox, setFBox] = useState('');
  const [fSira, setFSira] = useState('');
  const filtre = useMemo(() => ({ imei: fImei, box: fBox, sira: fSira }), [fImei, fBox, fSira]);
  const [bildirim, setBildirim] = useState(null);
  const [log, setLog] = useState([]);
  const [sevkEdiliyor, setSevkEdiliyor] = useState(false);
  const inputRef = useRef(null);

  const goster = (type, message) => {
    setBildirim({ type, message });
    if (type !== 'error') setTimeout(() => setBildirim(null), 4000);
  };

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const res = await api.getPackList();
      setGruplar(res.success ? (res.groups || []) : []);
    } catch (_e) {
      setGruplar([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const okut = async () => {
    const t = term.trim();
    if (!t || okutuluyor) return;
    setOkutuluyor(true);
    try {
      const res = await api.packDevice(t, getCurrentUser()?.username);
      if (res.success) {
        const yer = `Box ${res.box_no} · Sıra ${res.row_no}`;
        const msg = res.already
          ? `⚠ ${res.imei_number} bu cihaz DAHA ÖNCE OKUTULDU — ${yer} (${res.customer_name || res.customer_no})`
          : `${res.imei_number} → ${res.customer_name || res.customer_no} · ${yer}`;
        goster(res.already ? 'warning' : 'success', msg);
        setLog(prev => [{
          id: Date.now() + Math.random(), type: res.already ? 'warning' : 'success',
          imei: res.imei_number, musteri: res.customer_name || res.customer_no,
          box: res.box_no, sira: res.row_no, saat: new Date().toLocaleTimeString('tr-TR'),
          already: res.already,
        }, ...prev].slice(0, 1));
        await yukle();
      } else {
        goster('error', res.message || 'Cihaz paketlenemedi.');
        setLog(prev => [{
          id: Date.now() + Math.random(), type: 'error', imei: t, hata: res.message || 'Hata',
          saat: new Date().toLocaleTimeString('tr-TR'),
        }, ...prev].slice(0, 1));
      }
    } catch (e) {
      goster('error', e.message || 'Bağlantı hatası.');
    } finally {
      setOkutuluyor(false);
      setTerm('');
      inputRef.current?.focus();
    }
  };

  const sevkEt = async (customerNo, boxNos, temizle) => {
    setSevkEdiliyor(true);
    try {
      const res = await api.shipBoxes(customerNo, boxNos, getCurrentUser()?.username);
      if (res.success) {
        goster('success', `${res.shipped_count} cihaz sevk edildi (Box ${(res.box_nos || []).join(', ')}).`);
        temizle?.();
        await yukle();
      } else {
        goster('error', res.message || 'Sevk edilemedi.');
      }
    } catch (e) {
      goster('error', e.message || 'Bağlantı hatası.');
    } finally {
      setSevkEdiliyor(false);
    }
  };

  const toplamCihaz = useMemo(() => gruplar.reduce((s, g) => s + g.device_count, 0), [gruplar]);
  const toplamKutu = useMemo(() => gruplar.reduce((s, g) => s + g.box_count, 0), [gruplar]);

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1500px] mx-auto animate-in fade-in duration-300">

      {/* Başlık */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <Package size={13} /> MÜŞTERİ İÇİN SEVKET (126&gt;127)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Sevk Paketleme (Pack List)
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Cihaz okutunca müşterisine göre sıradaki <b>kutu ve sıraya</b> yerleştirilir ve
              müşteriye sevkiyata alınır. Her kutu <b>50 cihaz</b> alır; dolunca yeni kutuya geçilir.
              Sıra müşteri bazında kalıcıdır — başka müşteri araya girse bile kaldığı yerden devam eder.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#181a24] dark:text-white tabular-nums">{toplamKutu}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">kutu</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#181a24] dark:text-white tabular-nums">{toplamCihaz}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">paketlenen</div>
            </div>
          </div>
        </div>
      </div>

      {/* Okutma kutusu */}
      <div className="rounded-2xl border border-[#DCE1F1] dark:border-[#1e222d] bg-white dark:bg-[#12141c] p-5 sm:p-6 shadow-sm">
        <label className="block text-xs font-bold text-[#5A6685] dark:text-[#8892B5] uppercase tracking-wider mb-2">
          Barkod / IMEI Okutun
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <ScanLine size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={term}
              onChange={e => setTerm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') okut(); }}
              placeholder="Barkod veya IMEI okutunuz..."
              className="w-full bg-[#FFFFFF] dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl pl-11 pr-4 py-3 text-sm font-mono font-medium focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            onClick={okut}
            disabled={okutuluyor || !term.trim()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20"
          >
            <ScanLine size={16} /> {okutuluyor ? 'Paketleniyor...' : 'Paketle'}
          </button>
        </div>

        {/* Son okutmalar (oturum içi) */}
        {log.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto space-y-1.5">
            {log.map(l => (
              <div key={l.id} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                l.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300'
                  : l.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              }`}>
                <span className="text-slate-400 tabular-nums shrink-0">{l.saat}</span>
                <span className="font-mono font-semibold shrink-0">{l.imei}</span>
                {l.type === 'error'
                  ? <span className="truncate">— {l.hata}</span>
                  : l.type === 'warning'
                    ? <span className="ml-auto shrink-0 font-semibold">daha önce okutuldu · Box {l.box} · Sıra {l.sira}</span>
                    : <span className="ml-auto shrink-0 font-semibold">{l.musteri} · Box {l.box} · Sıra {l.sira}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pack list — arama + müşteri bazlı kutular */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Package size={16} className="text-emerald-500" /> Pack List
            <span className="font-normal text-xs text-slate-400">
              {gruplar.length} müşteri · {toplamKutu} kutu · {toplamCihaz} cihaz
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={fImei}
                onChange={e => setFImei(e.target.value)}
                placeholder="IMEI filtrele..."
                className="w-full bg-white dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={fBox}
              onChange={e => setFBox(e.target.value)}
              placeholder="Box No"
              className="w-24 bg-white dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-3 py-2 text-xs font-medium tabular-nums focus:outline-none focus:border-emerald-500 transition-all"
            />
            <input
              type="text"
              inputMode="numeric"
              value={fSira}
              onChange={e => setFSira(e.target.value)}
              placeholder="Sıra"
              className="w-20 bg-white dark:bg-[#1e222d] border border-[#DCE1F1] dark:border-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] placeholder-[#5A6685] rounded-xl px-3 py-2 text-xs font-medium tabular-nums focus:outline-none focus:border-emerald-500 transition-all"
            />
            {(fImei || fBox || fSira) && (
              <button
                onClick={() => { setFImei(''); setFBox(''); setFSira(''); }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1e222d] transition-colors"
                title="Filtreleri temizle"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={yukle}
            className="flex items-center gap-2 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <RefreshCw size={14} className={yukleniyor ? 'animate-spin' : ''} /> Yenile
          </button>
        </div>

        {gruplar.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#DCE1F1] dark:border-[#1e222d] px-6 py-10 text-center text-sm text-slate-500">
            Henüz paketlenmiş cihaz yok. Yukarıdan barkod/IMEI okutarak başlayın.
          </div>
        ) : (
          gruplar.map(g => (
            <MusteriPaketi key={g.customer_no} grup={g} filtre={filtre} onSevk={sevkEt} sevkEdiliyor={sevkEdiliyor} />
          ))
        )}
      </div>

      <Toast bildirim={bildirim} onKapat={() => setBildirim(null)} />
    </div>
  );
}
