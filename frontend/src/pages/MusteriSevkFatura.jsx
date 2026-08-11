import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt, RefreshCw, Download, FileText, ChevronDown, ChevronRight,
  AlertTriangle, Loader2, Package,
} from 'lucide-react';
import { api } from '../services/api';

// Müşteriye Sevk / Faturalandırma.
//
// Fatura MÜŞTERİ BAZINDA kesilir çünkü her müşterinin cari hesabı ayrıdır: sevke okutulmuş
// (statü 127) cihazlar müşteriye göre gruplanır, "Faturalandır" o müşterinin TAMAMINI tek
// faturada kapatır ve cihazları 128'e (çıkış yapıldı) alır.
//
// Sayfa iki bölümlü ve sıra sabittir: faturalandırılabilecekler HER ZAMAN üstte, kesilmiş
// faturalar altta (en güncel en üstte). Fatura kesilir kesilmez dosya kaydettirilip açılır;
// geçmiş faturaların dosyası saklandığı için "Dosya İndir" hep aynı belgeyi verir,
// yeniden hesaplamaz.

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

const para = (v, birim) => `${Number(v || 0).toLocaleString('tr-TR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}${birim ? ' ' + birim : ''}`;

const tarih = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// Faturalandırılabilir bir müşteri grubu. Açılınca cihaz listesi görünür.
function MusteriGrubu({ grup, onFaturalandir, calisan }) {
  const [acik, setAcik] = useState(false);
  const eksik = grup.missing_price_count > 0;

  return (
    <div className="rounded-xl border border-[#DCE1F1] dark:border-[#1e222d] overflow-hidden bg-white dark:bg-[#12141c]">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setAcik(a => !a)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
        >
          {acik ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
            {grup.customer_name}
          </span>
          <span className="text-[11px] font-mono text-slate-400 shrink-0">{grup.customer_code}</span>
          <span className="text-xs text-slate-500 shrink-0">
            {grup.device_count} cihaz
          </span>
          {eksik && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle size={12} /> {grup.missing_price_count} eksik fiyat
            </span>
          )}
        </button>

        <div className="hidden md:flex items-center gap-5 text-xs text-slate-500 shrink-0">
          <span>parça <b className="text-slate-700 dark:text-slate-200">{para(grup.parts_total)}</b></span>
          <span>işçilik <b className="text-slate-700 dark:text-slate-200">{para(grup.labour_total)}</b></span>
          <span>DGD <b className="text-slate-700 dark:text-slate-200">{para(grup.dgd_total)}</b></span>
        </div>

        <div className="text-right shrink-0 min-w-[110px]">
          <div className="text-base font-bold text-slate-800 dark:text-slate-100">
            {para(grup.grand_total, grup.currency)}
          </div>
        </div>

        <button
          onClick={() => onFaturalandir(grup)}
          disabled={calisan}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
        >
          {calisan ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
          Faturalandır
        </button>
      </div>

      {acik && (
        <div className="border-t border-[#DCE1F1] dark:border-[#1e222d] overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#181a24] text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left px-4 py-2">IMEI</th>
                <th className="text-left px-3 py-2">Model</th>
                <th className="text-left px-3 py-2">Akış</th>
                <th className="text-left px-3 py-2">Seviye</th>
                <th className="text-right px-3 py-2">Parça</th>
                <th className="text-right px-3 py-2">İşçilik</th>
                <th className="text-right px-3 py-2">DGD</th>
                <th className="text-right px-4 py-2">Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
              {grup.devices.map(d => (
                <tr key={d.imei || d.service_id} className="hover:bg-slate-50 dark:hover:bg-[#181a24]">
                  <td className="px-4 py-1.5 font-mono text-slate-700 dark:text-slate-300">{d.imei || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{d.model || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500">{d.flow || '—'}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
                      {d.seviye}
                    </span>
                    {d.eksik_fiyat > 0 && (
                      <AlertTriangle size={12} className="inline ml-1.5 text-amber-500" />
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{para(d.parca_toplam)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{para(d.iscilik_toplam)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{para(d.dgd_ucret)}</td>
                  <td className="px-4 py-1.5 text-right font-semibold text-slate-800 dark:text-slate-200">{para(d.genel_toplam)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MusteriSevkFatura() {
  const [gruplar, setGruplar] = useState([]);
  const [faturalar, setFaturalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [calisan, setCalisan] = useState(null);   // faturalandırılan müşteri kodu
  const [indirilen, setIndirilen] = useState(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [bekleyen, gecmis] = await Promise.all([
        api.getInvoiceableDevices(),
        api.getInvoices(200),
      ]);
      if (bekleyen.success) setGruplar(bekleyen.groups || []);
      if (gecmis.success) setFaturalar(gecmis.invoices || []);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const toplamBekleyen = useMemo(
    () => gruplar.reduce((s, g) => s + g.device_count, 0),
    [gruplar]
  );

  const faturalandir = async (grup) => {
    // Eksik fiyat varsa kullanıcı ONAYLAMADAN fatura kesilmez; sayı ve sonucu açıkça söylenir.
    if (grup.missing_price_count > 0) {
      const devam = window.confirm(
        `${grup.customer_name} için ${grup.device_count} cihaz faturalandırılacak.\n\n` +
        `⚠ ${grup.missing_price_count} kalemde fiyat bulunamadı; bunlar 0,00 olarak faturalanacak.\n\n` +
        `Yine de devam edilsin mi?`
      );
      if (!devam) return;
    } else {
      const devam = window.confirm(
        `${grup.customer_name} için ${grup.device_count} cihaz, toplam ${para(grup.grand_total, grup.currency)} ` +
        `faturalandırılacak.\n\nCihazlar "çıkış yapıldı" statüsüne alınacak. Onaylıyor musunuz?`
      );
      if (!devam) return;
    }

    setCalisan(grup.customer_code);
    const res = await api.createInvoice(grup.customer_code, getCurrentUser()?.username);
    setCalisan(null);

    if (!res.success) {
      alert(res.message || 'Fatura oluşturulamadı.');
      return;
    }
    await yukle();
    // Fatura kesilir kesilmez dosya kaydettirilip açılır (kullanıcı yeri seçer).
    const dosya = await api.saveInvoiceFile(res.invoice_id);
    if (!dosya.success && !dosya.cancelled) {
      alert(`Fatura ${res.invoice_no} oluşturuldu ancak dosya kaydedilemedi: ${dosya.message || ''}`);
    }
  };

  const indir = async (fatura) => {
    setIndirilen(fatura.id);
    const res = await api.saveInvoiceFile(fatura.id);
    setIndirilen(null);
    if (!res.success && !res.cancelled) alert(res.message || 'Dosya kaydedilemedi.');
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1500px] mx-auto animate-in fade-in duration-300">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <Receipt size={13} /> MÜŞTERİYE SEVK
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Sevk ve Faturalandırma
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Sevke okutulmuş cihazlar müşteri bazında gruplanır — her müşterinin cari hesabı
              ayrı olduğu için fatura da müşteri başına kesilir. Faturalandırılan cihazlar
              çıkış yapıldı statüsüne geçer ve fatura dosyası oluşur.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#181a24] dark:text-white">{toplamBekleyen}</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">sevk bekleyen</div>
            </div>
            <button
              onClick={yukle}
              className="flex items-center gap-2 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              <RefreshCw size={15} className={yukleniyor ? 'animate-spin' : ''} /> Yenile
            </button>
          </div>
        </div>
      </div>

      {/* ÜST BÖLÜM — faturalandırılabilecekler, her zaman en üstte */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Package size={16} className="text-emerald-500" />
          Faturalandırılabilecek Cihazlar
          <span className="font-normal text-xs text-slate-400">
            {gruplar.length} müşteri · {toplamBekleyen} cihaz
          </span>
        </div>
        {gruplar.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#DCE1F1] dark:border-[#1e222d] px-6 py-10 text-center text-sm text-slate-500">
            Sevk bekleyen cihaz yok. Cihazlar <b>Müşteri için sevket (126&gt;127)</b> ekranından
            okutulduğunda burada listelenir.
          </div>
        ) : (
          gruplar.map(g => (
            <MusteriGrubu
              key={g.customer_code}
              grup={g}
              onFaturalandir={faturalandir}
              calisan={calisan === g.customer_code}
            />
          ))
        )}
      </div>

      {/* ALT BÖLÜM — kesilmiş faturalar, en güncel üstte */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <FileText size={16} className="text-slate-400" />
          Geçmiş Faturalar
          <span className="font-normal text-xs text-slate-400">{faturalar.length} fatura</span>
        </div>
        <div className="rounded-xl border border-[#DCE1F1] dark:border-[#1e222d] overflow-hidden bg-white dark:bg-[#12141c]">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-[#181a24] text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left px-4 py-2.5">Tarih</th>
                  <th className="text-left px-3 py-2.5">Fatura No</th>
                  <th className="text-left px-3 py-2.5">Müşteri</th>
                  <th className="text-right px-3 py-2.5">Cihaz</th>
                  <th className="text-right px-3 py-2.5">Parça</th>
                  <th className="text-right px-3 py-2.5">İşçilik</th>
                  <th className="text-right px-3 py-2.5">DGD</th>
                  <th className="text-right px-3 py-2.5">Toplam</th>
                  <th className="text-left px-3 py-2.5">Kesen</th>
                  <th className="text-center px-4 py-2.5">Dosya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d]">
                {faturalar.length === 0 ? (
                  <tr><td colSpan={10} className="px-6 py-8 text-center text-slate-500">Henüz fatura kesilmedi.</td></tr>
                ) : faturalar.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-[#181a24]">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{tarih(f.created_at)}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">{f.invoice_no}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {f.customer_name}
                      {f.missing_price_count > 0 && (
                        <span title={`${f.missing_price_count} kalemde fiyat bulunamamıştı`}>
                          <AlertTriangle size={12} className="inline ml-1.5 text-amber-500" />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{f.device_count}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{para(f.parts_total)}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{para(f.labour_total)}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{para(f.dgd_total)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">{para(f.grand_total, f.currency)}</td>
                    <td className="px-3 py-2 text-slate-500">{f.created_by || '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => indir(f)}
                        disabled={indirilen === f.id}
                        className="inline-flex items-center gap-1.5 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40"
                      >
                        {indirilen === f.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Download size={13} />}
                        Dosya İndir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
