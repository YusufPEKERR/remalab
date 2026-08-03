import { useState, useEffect, useMemo, useCallback } from 'react';
import { DollarSign, Save, Search, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (_e) {
    return null;
  }
}

export default function CustomerPriceMatrix() {
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [prices, setPrices] = useState({}); // { item_code: { customer_code: price } }
  const [dirty, setDirty] = useState({}); // aynı şekil, sadece değiştirilen hücreler
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [custRes, itemRes, priceRes] = await Promise.all([
      api.getPriceMatrixCustomers(),
      api.getPriceMatrixItems(''),
      api.getPriceMatrix(),
    ]);
    if (custRes.success) setCustomers(custRes.customers || []);
    if (itemRes.success) setItems(itemRes.items || []);
    if (priceRes.success) {
      const map = {};
      for (const p of (priceRes.prices || [])) {
        if (!map[p.item_code]) map[p.item_code] = {};
        map[p.item_code][p.customer_code] = p.price;
      }
      setPrices(map);
    }
    setDirty({});
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter(i => i.item_code.toLowerCase().includes(term) || (i.name || '').toLowerCase().includes(term));
  }, [items, searchTerm]);

  const getCellValue = (itemCode, customerCode) => {
    if (dirty[itemCode] && Object.prototype.hasOwnProperty.call(dirty[itemCode], customerCode)) {
      return dirty[itemCode][customerCode];
    }
    return prices[itemCode]?.[customerCode] ?? '';
  };

  const handleCellChange = (itemCode, customerCode, value) => {
    setDirty(prev => ({
      ...prev,
      [itemCode]: { ...(prev[itemCode] || {}), [customerCode]: value },
    }));
  };

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const itemCode of Object.keys(dirty)) n += Object.keys(dirty[itemCode]).length;
    return n;
  }, [dirty]);

  const handleSave = async () => {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    const rows = [];
    for (const itemCode of Object.keys(dirty)) {
      for (const customerCode of Object.keys(dirty[itemCode])) {
        const raw = dirty[itemCode][customerCode];
        const price = raw === '' || raw === null || raw === undefined ? null : Number(raw);
        rows.push({ item_code: itemCode, customer_code: customerCode, price });
      }
    }
    const res = await api.savePriceMatrixBatch(rows, getCurrentUser()?.username);
    setSaving(false);
    if (res.success) {
      await loadAll();
    } else {
      alert(res.message || 'Kaydetme başarısız oldu.');
    }
  };

  const handleExport = async () => {
    const exportData = filteredItems.map(item => {
      const row = { 'Item Kodu': item.item_code, 'Ad': item.name, 'Tip': item.item_type };
      for (const c of customers) {
        row[c.short_name] = getCellValue(item.item_code, c.code);
      }
      return row;
    });
    await api.exportTableToExcel(exportData, 'musteri_fiyat_matrisi.xlsx');
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(47, 168, 110,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(47, 168, 110,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tracking-wide">
              <DollarSign size={13} className="text-emerald-400" /> FİYATLANDIRMA
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Müşteri Fiyat Matrisi
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Her parça/işçilik kodunun müşteriye göre değişen sabit fiyatını yönetin. Boş hücre, genel (item.satis) fiyata geri düşer.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            >
              <FileSpreadsheet size={15} /> Dışa Aktar
            </button>
            <button
              onClick={loadAll}
              className="flex items-center gap-2 bg-white dark:bg-[#1e222d] hover:bg-[#EFF1FA] dark:hover:bg-[#2e3545] text-[#12141c] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#2e3545] px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
              title="Yeniden Yükle"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleSave}
              disabled={dirtyCount === 0 || saving}
              className="flex items-center gap-2 bg-[#00B2FF] hover:bg-[#1e222d] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Save size={16} /> {saving ? 'Kaydediliyor...' : `Kaydet${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl shadow-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#DCE1F1] dark:border-[#1e222d] bg-[#F5F7FC] dark:bg-[#181a24]">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Item kodu veya ad ile ara..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-auto max-h-[65vh]">
          <table className="text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#181a24] text-slate-400 font-semibold uppercase tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 sticky left-0 bg-slate-50 dark:bg-[#181a24] z-30 min-w-[220px]">Item Kodu</th>
                {customers.map(c => (
                  <th key={c.code} className="px-4 py-3 min-w-[120px] text-center">{c.short_name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {loading ? (
                <tr><td colSpan={customers.length + 1} className="px-6 py-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-400" /></td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={customers.length + 1} className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.item_code} className="hover:bg-slate-100 dark:hover:bg-[#1e222d] transition-colors">
                    <td className="px-4 py-2 sticky left-0 bg-white dark:bg-[#12141c] z-10 font-mono text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.item_type === 'İşçilik' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-500/20 text-slate-500'}`}>
                          {item.item_type}
                        </span>
                        <span>{item.item_code}</span>
                      </div>
                    </td>
                    {customers.map(c => (
                      <td key={c.code} className="px-2 py-1.5 text-center">
                        <input
                          type="number" step="0.01"
                          value={getCellValue(item.item_code, c.code)}
                          onChange={e => handleCellChange(item.item_code, c.code, e.target.value)}
                          placeholder="-"
                          className="w-24 text-center px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#181a24] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
