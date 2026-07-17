import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Scale, Check } from 'lucide-react';
import { api } from '../services/api';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

const PAGE_SIZE = 50;

export default function StokEsitleme() {
  const currentUser = getCurrentUser();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    const res = await api.getGoodStockOverview();
    if (res.success) setParts(res.parts || []);
    setLoading(false);
  };

  useEffect(() => { fetchOverview(); }, []);
  useEffect(() => { setPage(1); }, [searchTerm]);

  const filteredParts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return parts.filter(p =>
      (p.item_code && p.item_code.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q)) ||
      String(p.id).includes(q)
    );
  }, [parts, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / PAGE_SIZE));
  const pageItems = filteredParts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleApply = async (part) => {
    const raw = edits[part.id];
    if (raw === undefined || raw === '') return;
    const newQty = Number(raw);
    if (!Number.isInteger(newQty) || newQty < 0) {
      alert('Geçerli, negatif olmayan bir tam sayı giriniz.');
      return;
    }
    if (newQty === part.quantity) return;
    if (!window.confirm(`${part.item_code || part.name}: Good Stock miktarı ${part.quantity} → ${newQty} olarak güncellenecek. Onaylıyor musunuz?`)) return;

    setSavingId(part.id);
    const res = await api.equalizeGoodStock(part.id, newQty, currentUser?.username);
    setSavingId(null);
    if (res.success) {
      setParts(prev => prev.map(p => p.id === part.id ? { ...p, quantity: newQty } : p));
      setEdits(prev => { const next = { ...prev }; delete next[part.id]; return next; });
    } else {
      alert(res.message || 'Güncelleme başarısız oldu.');
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Scale className="text-blue-400" size={24} /> Stok Eşitleme
        </h1>
        <p className="text-slate-400 mt-1">Good Stock'taki bir parçanın stoğunu fiziksel sayım sonucuna göre doğrudan düzeltin. Fark otomatik olarak "Stok Eşitleme" hareketi olarak kaydedilir.</p>
      </div>

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Parça kodu, adı, marka veya model ile arayın..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-800 dark:text-slate-200 transition-all text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">PARÇA</th>
                <th className="px-6 py-4">PARÇA KODU</th>
                <th className="px-6 py-4">GOOD STOCK (MEVCUT)</th>
                <th className="px-6 py-4">YENİ MİKTAR</th>
                <th className="px-6 py-4 text-center">İŞLEM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : !searchTerm.trim() ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">Bir parça aramak için yukarıdaki kutuyu kullanın.</td>
                </tr>
              ) : filteredParts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">Kayıt bulunamadı.</td>
                </tr>
              ) : (
                pageItems.map(part => {
                  const editVal = edits[part.id] ?? '';
                  const hasChange = editVal !== '' && Number(editVal) !== part.quantity;
                  return (
                    <tr key={part.id} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200">
                        {[part.brand, part.model, part.color, part.part_category].filter(Boolean).join(' ') || part.name || '-'}
                      </td>
                      <td className="px-6 py-3 font-mono text-slate-400">{part.item_code || '-'}</td>
                      <td className="px-6 py-3 font-mono font-semibold">{part.quantity}</td>
                      <td className="px-6 py-3">
                        <input
                          type="number" min="0"
                          placeholder={String(part.quantity)}
                          value={editVal}
                          onChange={e => setEdits(prev => ({ ...prev, [part.id]: e.target.value }))}
                          className="w-28 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleApply(part)}
                          disabled={!hasChange || savingId === part.id}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                        >
                          <Check size={14} /> {savingId === part.id ? 'Kaydediliyor...' : 'Uygula'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredParts.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-700/50 shrink-0">
            <span className="text-xs text-slate-400">
              {filteredParts.length} sonuçtan {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredParts.length)} arası gösteriliyor
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-[#242a38] rounded-lg disabled:opacity-40 text-slate-700 dark:text-slate-300">Önceki</button>
              <span className="text-xs text-slate-400">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-[#242a38] rounded-lg disabled:opacity-40 text-slate-700 dark:text-slate-300">Sonraki</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
