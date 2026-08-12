import { useState } from 'react';
import { Download, RefreshCw, Calendar, FolderDown } from 'lucide-react';
import { api } from '../services/api';

// Sistem raporları — dikey liste. Her rapor bir "Rapor Oluştur" aksiyonu ile
// Excel üretir ve İndirilenler klasörüne kaydeder. Sayfada veri önizlemesi YOK.
const REPORT_TABS = [
  { key: 'stok', title: 'Stok Raporu', accent: '#00B2FF',
    desc: 'Tüm parçaların depo bazında güncel stok miktarları ve kritik durumu.' },
  { key: 'critical', title: 'Kritik Stok Raporu', accent: '#DC2626',
    desc: 'Kritik limitin altına düşen, acil tedarik gereken parçalar.' },
  { key: 'transfers', title: 'Transfer Hareketleri', accent: '#D97706', dateRange: true,
    desc: 'Seçili tarih aralığındaki giriş / çıkış / transfer stok hareketleri.' },
  { key: 'uretim', title: 'Üretim Onarım', accent: '#059669', dateRange: true,
    desc: 'Üretim aşamasındaki cihazların tamamlanan/iptal onarımları ve değişen parçaları.' },
  { key: 'uretim_durum', title: 'Üretim Durumu', accent: '#7C3AED',
    desc: 'Üretimdeki cihazların güncel durumu: mission group statüsü ve değişen parçalar (fiyat + işçilik).' },
];

const bugun = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const gunEkle = (isoTarih, gun) => {
  const d = new Date(isoTarih + 'T00:00:00');
  d.setDate(d.getDate() + gun);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// "dd.mm.yyyy HH:MM" -> Date | null  (Üretim Onarım tarih filtresi için)
const parseTrDate = (s) => {
  if (!s || s === '-') return null;
  const parts = String(s).trim().split(' ');
  const [dd, mm, yyyy] = (parts[0] || '').split('.');
  if (!yyyy) return null;
  const [hh = '0', mi = '0'] = (parts[1] || '').split(':');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
  return isNaN(d.getTime()) ? null : d;
};

export default function Raporlar() {
  const [generating, setGenerating] = useState(null);   // üretilmekte olan rapor anahtarı
  const [openKey, setOpenKey] = useState(null);         // hangi raporun tarih paneli açık
  const [ranges, setRanges] = useState({
    transfers: { start: gunEkle(bugun(), -30), end: bugun() },
    uretim: { start: gunEkle(bugun(), -30), end: bugun() },
  });
  const setRange = (key, field, val) => setRanges((r) => ({ ...r, [key]: { ...r[key], [field]: val } }));
  const [preview, setPreview] = useState(null);       // önizleme modalı: { key, title, filename, rows }
  const [downloading, setDownloading] = useState(false);

  // Rapor verisini seçilen türe göre Excel satırlarına dönüştürür
  const buildRows = (key, data) => {
    if (key === 'uretim_durum') {
      return data.map((r) => {
        const row = {
          'IMEI': r.imei || '',
          'Internal ID': r.internalId || '',
          'Seri No': r.serialNumber || '',
          'Model': r.model || '',
          'Batch': r.batch || '',
          'Müşteri Adı': r.customerName || '',
          'Mission Group': r.missionGroup || '',
          'Mission Group Statü': r.missionGroupStatus || '',
        };
        for (let i = 0; i < 10; i++) {
          const p = (r.parts && r.parts[i]) || {};
          row[`Parça ${i + 1}`] = p.name || '';
          row[`Parça ${i + 1} Fiyat`] = (p.price !== null && p.price !== undefined) ? p.price : '';
          row[`Parça ${i + 1} İşçilik`] = (p.labour !== null && p.labour !== undefined) ? p.labour : '';
        }
        return row;
      });
    }
    if (key === 'stok') {
      return data.map((r) => ({
        'Son Hareket Tarihi': r.updated_at || r.date || '-',
        'İtem Kodu': r.item_code,
        'Parça Adı': r.part_name,
        'Lokasyon': r.location_name,
        'Stok Miktarı': r.quantity,
        'Kritik Durumu': (r.location_kind === 'good_stock' && r.quantity <= r.critical_limit) ? 'Kritik' : 'Normal',
      }));
    }
    if (key === 'critical') {
      return data.map((r) => ({
        'İtem Kodu': r.item_code,
        'Parça Adı': r.part_name,
        'Lokasyon': r.location_name,
        'Mevcut Stok': r.quantity,
        'Kritik Limit': r.critical_limit,
      }));
    }
    if (key === 'transfers') {
      return data.map((r) => {
        const t = r.type || '';
        const isOut = ['Çıkış', 'Satış', 'Servis Kullanımı', 'Outbound', 'Fire', 'Teknik Servis'].some((x) => t.includes(x));
        const isIn = ['Giriş', 'Yeni Alım', 'İade', 'Return', 'İptal', 'Inbound'].some((x) => t.includes(x));
        return {
          'Tarih': r.date,
          'İtem Kodu': r.item_code,
          'Parça Adı': r.part_name,
          'Miktar': (isOut ? '-' : (isIn ? '+' : '')) + r.quantity,
          'Kaynakta Kalan': (r.source_balance_after !== null && r.source_balance_after !== undefined) ? r.source_balance_after : '',
          'Kaynak Depo': r.source_location,
          'Hedef Depo': r.target_location,
          'İşlemi Yapan': r.user,
          'Açıklama': r.type,
        };
      });
    }
    // uretim
    return data.map((r) => {
      const row = {
        'IMEI': r.imei || '',
        'Internal ID': r.internalId || '',
        'Seri No': r.serialNumber || '',
        'Model': r.model || '',
        'Departman': r.departman || '',
        'Durum': r.durum || '',
        'Teknisyen': r.teknisyen || '',
        'Tarih': r.tarih || '',
      };
      for (let i = 0; i < 10; i++) row[`Parça ${i + 1}`] = (r.parts && r.parts[i]) || '';
      return row;
    });
  };

  // Raporu oluştur → Excel → İndirilenler klasörüne kaydet
  const raporOlustur = async (key) => {
    setGenerating(key);
    try {
      let data = [];
      let filename = '';
      if (key === 'stok') {
        const res = await api.getStockStatus();
        data = res.success ? (res.stock || []) : [];
        filename = 'stok_raporu.xlsx';
      } else if (key === 'critical') {
        const res = await api.getCriticalStock();
        data = res.success ? (res.critical_stock || []) : [];
        filename = 'kritik_stok_raporu.xlsx';
      } else if (key === 'uretim') {
        const res = await api.getProductionRepairReport();
        let items = res.success ? (res.items || []) : [];
        // Üretim Onarım'ın kendi onarım tarihine (tarih alanı) göre filtre
        const { start, end } = ranges.uretim;
        const s = start ? new Date(`${start}T00:00:00`) : null;
        const e = end ? new Date(`${end}T23:59:59`) : null;
        if (s || e) {
          items = items.filter((it) => {
            const dt = parseTrDate(it.tarih);
            if (!dt) return false;
            if (s && dt < s) return false;
            if (e && dt > e) return false;
            return true;
          });
        }
        data = items;
        filename = `uretim_onarim_raporu_${ranges.uretim.start}_${ranges.uretim.end}.xlsx`;
      } else if (key === 'uretim_durum') {
        const res = await api.getProductionStatusReport();
        data = res.success ? (res.items || []) : [];
        filename = 'uretim_durumu_raporu.xlsx';
      } else if (key === 'transfers') {
        const { start, end } = ranges.transfers;
        const res = await api.getReports(`${start}T00:00`, `${end}T23:59`);
        data = res.success ? (res.reports || []) : [];
        filename = `transfer_hareketleri_${start}_${end}.xlsx`;
      }

      if (!data || data.length === 0) {
        alert('Bu rapor için veri bulunamadı.');
        return;
      }
      const rows = buildRows(key, data);
      const title = (REPORT_TABS.find((t) => t.key === key) || {}).title || 'Rapor';
      setPreview({ key, title, filename, rows });      // indirmeden önce önizleme aç
      setOpenKey(null);                                // tarih paneli açıksa kapat
    } catch (e) {
      alert('Rapor oluşturulamadı: ' + (e?.message || e));
    } finally {
      setGenerating(null);
    }
  };

  // Önizlemedeki raporu Excel olarak İndirilenler'e kaydet
  const previewIndir = async () => {
    if (!preview) return;
    setDownloading(true);
    try {
      await api.exportTableToExcel(preview.rows, preview.filename);
      setPreview(null);
    } catch (e) {
      alert('İndirilemedi: ' + (e?.message || e));
    } finally {
      setDownloading(false);
    }
  };

  const setQuickRange = (key, type) => {
    const today = bugun();
    let start = today; let end = today;
    if (type === 'yesterday') { start = gunEkle(today, -1); end = start; }
    else if (type === 'week') { start = gunEkle(today, -7); }
    else if (type === 'month') { start = gunEkle(today, -30); }
    else if (type === '6month') { start = gunEkle(today, -182); }
    else if (type === 'year') { start = gunEkle(today, -365); }
    setRanges((r) => ({ ...r, [key]: { start, end } }));
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1100px] mx-auto animate-in fade-in duration-300">

      {/* ════════════════ HERO ════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-400/30 text-pink-300 text-xs font-semibold tracking-wide">
            <Download size={13} className="text-pink-400" /> RAPORLAMA VE ANALİZ MODÜLÜ
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">Sistem Raporları</h1>
          <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
            İstediğiniz raporu seçip <strong>Rapor Oluştur</strong>'a basın. Rapor Excel (.xlsx) olarak
            oluşturulur ve bilgisayarınızın <strong>İndirilenler</strong> klasörüne kaydedilir.
          </p>
          <div className="inline-flex items-center gap-2 text-xs text-[#5A6685] dark:text-[#8892B5] pt-1">
            <FolderDown size={14} /> Kayıt konumu: İndirilenler (Downloads)
          </div>
        </div>
      </div>

      {/* ════════════════ DİKEY RAPOR LİSTESİ ════════════════ */}
      <div className="flex flex-col gap-3">
        {/* Başlık satırı */}
        <div className="hidden sm:flex items-center gap-4 px-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#5A6685] dark:text-[#8892B5]">
          <div className="w-52 shrink-0">Rapor Adı</div>
          <div className="flex-1 min-w-0">Rapor Açıklaması</div>
          <div className="w-44 shrink-0 text-right">Aksiyon</div>
        </div>

        {REPORT_TABS.map((t) => {
          const busy = generating === t.key;
          const hasDate = !!t.dateRange;
          const isOpen = openKey === t.key;
          const rng = ranges[t.key] || {};
          const toggle = () => setOpenKey((k) => (k === t.key ? null : t.key));
          return (
            <div key={t.key} className="glass-card rounded-2xl shadow-md border border-[#DCE1F1] dark:border-[#1e222d] overflow-hidden">
              <div
                className={`flex items-center gap-4 p-5 flex-wrap ${hasDate ? 'cursor-pointer hover:bg-[#FFFFFF]/40 dark:hover:bg-[#1e222d]/40 transition-colors' : ''}`}
                style={{ borderLeft: `4px solid ${t.accent}` }}
                onClick={hasDate ? toggle : undefined}
              >
                {/* Rapor Adı */}
                <div className="w-52 shrink-0 flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.accent }} />
                  <h3 className="font-bold text-sm text-[#12141c] dark:text-[#F6F8FF]">{t.title}</h3>
                </div>

                {/* Rapor Açıklaması */}
                <p className="flex-1 min-w-[200px] text-xs text-[#5A6685] dark:text-[#8892B5] leading-relaxed">{t.desc}</p>

                {/* Aksiyon */}
                <div className="w-44 shrink-0 flex sm:justify-end">
                  <button
                    onClick={(e) => { if (hasDate) { e.stopPropagation(); toggle(); } else { raporOlustur(t.key); } }}
                    disabled={busy}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-60"
                    style={{ background: t.accent }}
                  >
                    {busy
                      ? <><RefreshCw size={15} className="animate-spin" /> Oluşturuluyor...</>
                      : hasDate
                        ? <><Calendar size={15} /> {isOpen ? 'Kapat' : 'Rapor Oluştur'}</>
                        : <><Download size={15} /> Rapor Oluştur</>}
                  </button>
                </div>
              </div>

              {/* Tarih aralığı seçimi (transfer + üretim onarım) */}
              {hasDate && isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-[#DCE1F1] dark:border-[#1e222d] bg-[#F5F7FC] dark:bg-[#181a24]">
                  <p className="text-xs font-bold text-[#5A6685] dark:text-[#8892B5] mt-3 mb-2">
                    {t.key === 'uretim' ? 'Onarım Tarihi Aralığı Seçin' : 'Hareket Tarihi Aralığı Seçin'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {[['today', 'Bugün'], ['yesterday', 'Dün'], ['week', 'Son 1 Hafta'], ['month', 'Son 1 Ay'], ['6month', 'Son 6 Ay'], ['year', 'Son 1 Yıl']].map(([q, label]) => (
                      <button key={q} onClick={() => setQuickRange(t.key, q)}
                        className="text-xs px-3 py-1.5 bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] rounded-lg border border-[#DCE1F1] dark:border-[#2e3545] font-semibold cursor-pointer">{label}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">Başlangıç:</span>
                      <input type="date" style={{ colorScheme: 'dark' }} value={rng.start || ''} onChange={(e) => setRange(t.key, 'start', e.target.value)}
                        className="bg-[#FFFFFF] dark:bg-[#1e222d] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00B2FF]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#5A6685] dark:text-[#8892B5]">Bitiş:</span>
                      <input type="date" style={{ colorScheme: 'dark' }} value={rng.end || ''} onChange={(e) => setRange(t.key, 'end', e.target.value)}
                        className="bg-[#FFFFFF] dark:bg-[#1e222d] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#00B2FF]" />
                    </div>
                    <button
                      onClick={() => raporOlustur(t.key)}
                      disabled={busy || !rng.start || !rng.end}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-60"
                      style={{ background: t.accent }}
                    >
                      {busy ? <><RefreshCw size={15} className="animate-spin" /> Oluşturuluyor...</> : <><Download size={15} /> Oluştur ve İndir</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ════════════════ ÖNİZLEME MODALI ════════════════ */}
      {preview && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-modal shadow-2xl rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col text-[#12141c] dark:text-[#F6F8FF]">
            <div className="flex items-center justify-between p-5 border-b border-[#DCE1F1] dark:border-[#1e222d]">
              <div>
                <h2 className="text-base font-bold">{preview.title} — Önizleme</h2>
                <p className="text-xs text-[#5A6685] dark:text-[#8892B5] mt-0.5">
                  Toplam {preview.rows.length} satır{preview.rows.length > 15 ? ' · ilk 15 gösteriliyor' : ''} · İndirince İndirilenler klasörüne kaydedilir
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="text-[#5A6685] hover:text-[#12141c] dark:hover:text-white cursor-pointer text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <table className="w-full text-[11px] border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] sticky top-0">
                    {Object.keys(preview.rows[0]).map((c) => (
                      <th key={c} className="border border-[#DCE1F1] dark:border-[#2e3545] px-2 py-1.5 text-left font-semibold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 15).map((r, i) => (
                    <tr key={i} className={i % 2 ? 'bg-[#F5F7FC]/40 dark:bg-[#171a26]' : ''}>
                      {Object.keys(preview.rows[0]).map((c, j) => (
                        <td key={j} className="border border-[#DCE1F1] dark:border-[#2e3545] px-2 py-1">
                          {(r[c] === null || r[c] === undefined) ? '' : String(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-[#DCE1F1] dark:border-[#1e222d]">
              <button onClick={() => setPreview(null)} disabled={downloading}
                className="px-4 py-2 bg-[#FFFFFF] dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                İptal
              </button>
              <button onClick={previewIndir} disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-60">
                {downloading ? <><RefreshCw size={15} className="animate-spin" /> İndiriliyor...</> : <><Download size={15} /> İndir</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
