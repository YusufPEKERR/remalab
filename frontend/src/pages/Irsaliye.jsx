import { useState, useEffect, useCallback } from 'react';
import { Download, Upload, Plus, RefreshCw, ArrowRightLeft, FileSpreadsheet, Search } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';
import StockTransferModal from '../components/StockTransferModal';

export default function Irsaliye() {
  const [activeTab, setActiveTab] = useState('inbound'); // 'inbound' or 'outbound'
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showOutboundModal, setShowOutboundModal] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  
  // Data for forms
  const [parts, setParts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ part_id: '', loc_id: '', source_loc_id: '', qty: 1, price: 0, type: '', technician: '', description: '' });

  // Inbound Form States
  const [inboundBarcode, setInboundBarcode] = useState('');
  const [inboundBrand, setInboundBrand] = useState('');
  const [inboundModel, setInboundModel] = useState('');

  // Outbound Form States
  const [outboundBarcode, setOutboundBarcode] = useState('');
  const [outboundBrand, setOutboundBrand] = useState('');
  const [outboundModel, setOutboundModel] = useState('');

  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const dbColumns = ["part_id", "loc_id", "qty", "price", "type"];
  const friendlyNames = {
    part_id: "Parça ID (Zorunlu)",
    loc_id: "Lokasyon ID (Zorunlu)",
    qty: "Miktar (Zorunlu)",
    price: "Birim Fiyat",
    type: "İşlem Türü"
  };

  const handleExcelImport = async (data) => {
    setIsExcelModalOpen(false);
    let successCount = 0;
    
    for (const row of data) {
        if (!row.part_id || !row.loc_id || !row.qty) continue;
        
        if (activeTab === 'inbound') {
            await api.addInboundEntry(
                row.part_id, 
                row.loc_id, 
                row.qty, 
                row.price || 0, 
                row.type || 'Yeni Alım', 
                'admin'
            );
        } else {
            await api.addOutboundEntry(
                row.part_id, 
                row.loc_id, 
                row.qty, 
                row.type || 'Çıkış', 
                'admin'
            );
        }
        successCount++;
    }
    
    alert(`${successCount} kayıt başarıyla içe aktarıldı.`);
    fetchData();
  };

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';
    
    if (action === 'download_template') {
        const templateData = [{
          "Parça ID": "1",
          "Lokasyon ID": "1",
          "Miktar": 10,
          "Birim Fiyat": 150.00,
          "İşlem Türü": activeTab === 'inbound' ? "Yeni Alım" : "Çıkış"
        }];
        await api.exportTableToExcel(templateData, "irsaliye_sablon.xlsx");
    } else if (action === 'export') {
        const filename = activeTab === 'inbound' ? 'giris_irsaliyeleri.xlsx' : 'cikis_irsaliyeleri.xlsx';
        await api.exportTableToExcel(movements, filename);
    } else if (action === 'import') {
        setIsExcelModalOpen(true);
    }
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const typeStr = activeTab === 'inbound' ? 'in' : 'out';
      const res = await api.getStockMovements(typeStr);
      if (res && res.success) {
        setMovements(res.movements || []);
      } else {
        setError(res ? res.message : 'Hata');
      }
    } catch (_err) {
      setError('Bağlantı hatası.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeTab]);

  const fetchDependencies = async () => {
    const resP = await api.getParts();
    if (resP && resP.success) setParts(resP.parts);
    const resL = await api.getLocations();
    if (resL && resL.success) setLocations(resL.locations);
    const resS = await api.getStockStatus();
    if (resS && resS.success) setStockStatus(resS.stock);
    const resU = await api.getUsers();
    if (resU && resU.success) setUsers(resU.users);
  };

  const getStockQty = (partId, locId) => {
    if (!partId || !locId) return 0;
    const entry = stockStatus.find(s => String(s.part_id) === String(partId) && String(s.location_id) === String(locId));
    return entry ? entry.quantity : 0;
  };

  const findBestSourceLocation = (partId) => {
    const entries = stockStatus.filter(s => String(s.part_id) === String(partId) && s.quantity > 0);
    if (entries.length === 0) return '';
    const best = entries.reduce((a, b) => (b.quantity > a.quantity ? b : a));
    return String(best.location_id);
  };

  const handleTransferSubmit = async (transferData) => {
    const res = await api.transferStock(
      transferData.sourceStockId,
      transferData.sourceLocId,
      transferData.targetLocationId,
      transferData.quantity,
      'admin'
    );
    if (res && res.success) {
      setIsTransferModalOpen(false);
      fetchData();
    } else {
      alert('Hata: ' + (res ? res.message : ''));
    }
  };

  const handleBarcodeSearch = () => {
    const p = parts.find(x => x.item_code === inboundBarcode || String(x.item_code) === inboundBarcode);
    if (p) {
      setInboundBrand(p.brand || '');
      setInboundModel(p.model || '');
      setFormData(prev => ({...prev, part_id: p.id}));
    } else {
      alert('Barkod bulunamadı!');
    }
  };

  const handleOutboundBarcodeSearch = () => {
    const p = parts.find(x => x.item_code === outboundBarcode || String(x.item_code) === outboundBarcode);
    if (p) {
      setOutboundBrand(p.brand || '');
      setOutboundModel(p.model || '');
      setFormData(prev => ({...prev, part_id: p.id}));
    } else {
      alert('Barkod bulunamadı!');
    }
  };

  const uniqueBrands = Array.from(new Set(parts.map(p => p.brand).filter(Boolean)));
  const uniqueModels = Array.from(new Set(parts.filter(p => p.brand === inboundBrand).map(p => p.model).filter(Boolean)));
  const filteredParts = parts.filter(p => 
    (!inboundBrand || p.brand === inboundBrand) && 
    (!inboundModel || p.model === inboundModel)
  );

  const outboundUniqueModels = Array.from(new Set(parts.filter(p => p.brand === outboundBrand).map(p => p.model).filter(Boolean)));
  const outboundFilteredParts = parts.filter(p => 
    (!outboundBrand || p.brand === outboundBrand) && 
    (!outboundModel || p.model === outboundModel)
  );

  const resetInboundForm = () => {
    setInboundBarcode('');
    setInboundBrand('');
    setInboundModel('');
    setFormData({ part_id: '', loc_id: '', source_loc_id: '', qty: 1, price: 0, type: 'Yeni Alım (Tedarikçiden)', technician: '', description: '' });
    setShowInboundModal(true);
    fetchDependencies();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const handleInbound = async (e) => {
    e.preventDefault();
    const user = "admin";
    const isTransfer = formData.type === 'Depodan Depoya';

    if (isTransfer && Number(formData.qty) > getStockQty(formData.part_id, formData.source_loc_id)) {
      alert("Kaynak lokasyonda yeterli stok yok.");
      return;
    }

    const res = isTransfer
      ? await api.transferStock(formData.part_id, formData.source_loc_id, formData.loc_id, formData.qty, user)
      : await api.addInboundEntry(formData.part_id, formData.loc_id, formData.qty, formData.price, formData.type || 'Yeni Alım', user);

    if (res && res.success) {
      setShowInboundModal(false);
      fetchData();
    } else alert("Hata: " + (res ? res.message : ""));
  };

  const handleOutbound = async (e) => {
    e.preventDefault();
    const user = "admin";
    const res = await api.addOutboundEntry(formData.part_id, formData.loc_id, formData.qty, formData.type || 'Teknik Servis', user, formData.technician, formData.description);
    if (res && res.success) {
      setShowOutboundModal(false);
      fetchData();
    } else alert("Hata: " + (res ? res.message : ""));
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">İrsaliye</h1>
          <p className="text-slate-500 mt-1">
            {activeTab === 'inbound' 
              ? 'Yeni stok girişlerini (Giriş İrsaliyesi) kaydedin' 
              : 'Depodan çıkış işlemlerini (Çıkış İrsaliyesi) kaydedin'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 mt-2">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('inbound')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'inbound' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
            `}
          >
            Giriş
          </button>
          <button
            onClick={() => setActiveTab('outbound')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'outbound' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
            `}
          >
            Çıkış
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {/* Actions */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
        <div className="text-slate-700 dark:text-slate-300 text-sm">
          {activeTab === 'inbound' ? 'Yeni Stok Girişi' : 'Depo Çıkış Modülü'}
        </div>
        <div className="flex gap-3 items-center">
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 rounded-lg transition-colors font-bold flex items-center gap-2 shadow-sm"
          >
            <ArrowRightLeft size={16} /> Stok Transferi
          </button>
          <div className="relative">
            <select 
              onChange={handleExcelAction}
              className="appearance-none bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="">Excel İşlemi Seç...</option>
              <option value="download_template">Boş Şablon İndir</option>
              <option value="export">Excel'e Dışa Aktar</option>
              <option value="import">Excel'den İçe Aktar</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
              <FileSpreadsheet size={16} />
            </div>
          </div>
          {activeTab === 'inbound' ? (
            <button 
              onClick={resetInboundForm}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Yeni Stok Ekle
            </button>
          ) : (
            <button 
              onClick={() => { setOutboundBarcode(''); setOutboundBrand(''); setOutboundModel(''); setFormData({ part_id: '', loc_id: '', qty: 1, price: 0, type: 'Teknik Servis', technician: '', description: '' }); setShowOutboundModal(true); fetchDependencies(); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Stok Çıkışı Yap
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/50 sticky top-0 uppercase tracking-wider text-xs z-10">
              {activeTab === 'inbound' ? (
                <tr>
                  <th className="px-6 py-4">PARÇA ADI</th>
                  <th className="px-6 py-4">MİKTAR</th>
                  <th className="px-6 py-4">BİRİM FİYAT</th>
                  <th className="px-6 py-4">GİRİŞ TARİHİ</th>
                  <th className="px-6 py-4">İŞLEMİ YAPAN</th>
                  <th className="px-6 py-4">TÜR / DETAY</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4">PARÇA ADI</th>
                  <th className="px-6 py-4">MİKTAR</th>
                  <th className="px-6 py-4">KAYNAK -&gt; HEDEF</th>
                  <th className="px-6 py-4">ÇIKIŞ TARİHİ</th>
                  <th className="px-6 py-4">İŞLEMİ YAPAN</th>
                  <th className="px-6 py-4">TÜR</th>
                  <th className="px-6 py-4">AÇIKLAMA</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'inbound' ? 6 : 7} className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'inbound' ? 6 : 7} className="px-6 py-8 text-center text-slate-400">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                movements.map((mov, index) => (
                  <tr key={`${mov.id}-${index}`} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-800 dark:text-slate-200">
                    {activeTab === 'inbound' ? (
                      <>
                        <td className="px-6 py-3">{mov.part_name}</td>
                        <td className="px-6 py-3 font-mono">{mov.quantity}</td>
                        <td className="px-6 py-3 font-mono">{mov.unit_price ? `${mov.unit_price.toFixed(2)} TL` : '-'}</td>
                        <td className="px-6 py-3 text-slate-400">{mov.created_at}</td>
                        <td className="px-6 py-3">{mov.created_by}</td>
                        <td className="px-6 py-3">
                          {mov.type === 'İç Transfer' ? `İç Transfer: ${mov.source_location} -> ${mov.target_location}` : mov.type}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3">{mov.part_name}</td>
                        <td className="px-6 py-3 font-mono">{mov.quantity}</td>
                        <td className="px-6 py-3">
                          {mov.source_location} &rarr; {mov.type === 'İç Transfer' ? mov.target_location : 'Dışarı'}
                        </td>
                        <td className="px-6 py-3 text-slate-400">{mov.created_at}</td>
                        <td className="px-6 py-3">{mov.created_by}</td>
                        <td className="px-6 py-3">{mov.type}</td>
                        <td className="px-6 py-3 text-slate-400">{mov.description || '-'}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INBOUND MODAL */}
      {showInboundModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#242a38] shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Plus size={18}/> Yeni Stok Ekle</h2>
              <button onClick={() => setShowInboundModal(false)} className="text-slate-400 hover:text-slate-900 dark:text-white">&times;</button>
            </div>
            <form onSubmit={handleInbound} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-2">
                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">📄</span> Barkod (okutun ve Enter'a basın)
                </label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Barkodu okutun veya manuel girin..." className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={inboundBarcode} onChange={(e) => setInboundBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBarcodeSearch())} />
                  <button type="button" onClick={handleBarcodeSearch} className="px-4 bg-slate-100 dark:bg-[#2a3142] hover:bg-blue-600 border border-slate-300 dark:border-slate-600 rounded-lg text-white transition-colors"><Search size={18} /></button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4"></div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marka</label>
                <select className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={inboundBrand} onChange={(e) => { setInboundBrand(e.target.value); setInboundModel(''); setFormData({...formData, part_id: ''}); }}>
                  <option value="">Marka seçiniz...</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefon Modeli</label>
                <select className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={inboundModel} onChange={(e) => { setInboundModel(e.target.value); setFormData({...formData, part_id: ''}); }}>
                  <option value="">Model seçiniz...</option>
                  {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parça Adı / Parça</label>
                <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.part_id} onChange={(e) => {
                  const partId = e.target.value;
                  const bestLoc = findBestSourceLocation(partId);
                  setFormData(prev => ({
                    ...prev,
                    part_id: partId,
                    source_loc_id: prev.type === 'Depodan Depoya' ? bestLoc : prev.source_loc_id,
                    loc_id: prev.type === 'Depodan Depoya' ? prev.loc_id : bestLoc
                  }));
                }}>
                  <option value="">Parça seçiniz...</option>
                  {filteredParts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} {p.name ? `- ${p.name}` : ''}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Giriş Tipi</label>
                <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.type} onChange={(e) => {
                  const type = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    type,
                    source_loc_id: type === 'Depodan Depoya' ? findBestSourceLocation(prev.part_id) : prev.source_loc_id,
                    loc_id: type === 'Depodan Depoya' ? prev.loc_id : findBestSourceLocation(prev.part_id)
                  }));
                }}>
                  <option value="Yeni Alım (Tedarikçiden)">Yeni Alım (Tedarikçiden)</option>
                  <option value="İade Girişi">İade Girişi</option>
                  <option value="Depodan Depoya">Depodan Depoya</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Miktar</label>
                  <input type="number" required min="1" className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.qty} onChange={(e) => setFormData({...formData, qty: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Birim Fiyat</label>
                  <div className="relative">
                    <input type="number" step="0.01" className="w-full px-3 py-2 pr-8 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">TL</span>
                  </div>
                </div>
              </div>

              {formData.type === 'Depodan Depoya' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kaynak Lokasyon</label>
                    <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.source_loc_id} onChange={(e) => setFormData({...formData, source_loc_id: e.target.value})}>
                      <option value="">Kaynak lokasyon seçiniz...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    {formData.part_id && formData.source_loc_id && (
                      <p className={`mt-1.5 text-xs font-medium ${getStockQty(formData.part_id, formData.source_loc_id) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        Mevcut Stok: {getStockQty(formData.part_id, formData.source_loc_id)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hedef Lokasyon</label>
                    <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.loc_id} onChange={(e) => setFormData({...formData, loc_id: e.target.value})}>
                      <option value="">Hedef lokasyon seçiniz...</option>
                      {locations.filter(l => String(l.id) !== String(formData.source_loc_id)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lokasyon</label>
                  <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.loc_id} onChange={(e) => setFormData({...formData, loc_id: e.target.value})}>
                    <option value="">Lokasyon seçiniz...</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  {formData.part_id && formData.loc_id && (
                    <p className={`mt-1.5 text-xs font-medium ${getStockQty(formData.part_id, formData.loc_id) > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                      Mevcut Stok: {getStockQty(formData.part_id, formData.loc_id)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-700/50 pt-4">
                <button type="button" onClick={() => setShowInboundModal(false)} className="px-5 py-2.5 bg-[#323a4d] hover:bg-[#3f485e] text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-[#42526e] hover:bg-[#506385] text-white rounded-lg text-sm font-medium transition-colors shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OUTBOUND MODAL */}
      {showOutboundModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#242a38] shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">Stok Çıkışı Yap</h2>
              <button onClick={() => setShowOutboundModal(false)} className="text-slate-400 hover:text-slate-900 dark:text-white">&times;</button>
            </div>
            <form onSubmit={handleOutbound} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-2">
                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">📄</span> Barkod (okutun ve Enter'a basın)
                </label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Barkodu okutun veya manuel girin..." className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={outboundBarcode} onChange={(e) => setOutboundBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleOutboundBarcodeSearch())} />
                  <button type="button" onClick={handleOutboundBarcodeSearch} className="px-4 bg-slate-100 dark:bg-[#2a3142] hover:bg-blue-600 border border-slate-600 rounded-lg text-white transition-colors"><Search size={18} /></button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4"></div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marka</label>
                <select className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={outboundBrand} onChange={(e) => { setOutboundBrand(e.target.value); setOutboundModel(''); setFormData({...formData, part_id: ''}); }}>
                  <option value="">Marka seçiniz...</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefon Modeli</label>
                <select className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={outboundModel} onChange={(e) => { setOutboundModel(e.target.value); setFormData({...formData, part_id: ''}); }}>
                  <option value="">Model seçiniz...</option>
                  {outboundUniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Parça Adı / Parça</label>
                <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.part_id} onChange={(e) => {
                  const partId = e.target.value;
                  setFormData(prev => ({ ...prev, part_id: partId, loc_id: findBestSourceLocation(partId) }));
                }}>
                  <option value="">Parça seçiniz...</option>
                  {outboundFilteredParts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} {p.name ? `- ${p.name}` : ''}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kaynak Lokasyon</label>
                <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.loc_id} onChange={(e) => setFormData({...formData, loc_id: e.target.value})}>
                  <option value="">Lokasyon seçiniz...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {formData.part_id && formData.loc_id && (
                  <p className={`mt-1.5 text-xs font-medium ${getStockQty(formData.part_id, formData.loc_id) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    Mevcut Stok: {getStockQty(formData.part_id, formData.loc_id)}
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Miktar</label>
                  <input type="number" required min="1" className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.qty} onChange={(e) => setFormData({...formData, qty: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Çıkış Tipi</label>
                  <select required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                    <option value="Teknik Servis">Teknik Servis</option>
                    <option value="Müşteri Satışı">Müşteri Satışı</option>
                    <option value="Tedarikçiye İade">Tedarikçiye İade</option>
                    <option value="Fire">Fire / Bozuk</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teknisyen</label>
                  <select className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.technician} onChange={(e) => setFormData({...formData, technician: e.target.value})}>
                    <option value="">Seçiniz...</option>
                    {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Açıklama</label>
                  <input type="text" placeholder="İsteğe bağlı açıklama..." className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-slate-200 dark:border-slate-700/50 pt-4">
                <button type="button" onClick={() => setShowOutboundModal(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors">İptal</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors shadow-lg shadow-red-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ExcelMappingModal 
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        dbColumns={dbColumns}
        friendlyNames={friendlyNames}
      />
      <StockTransferModal 
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransfer={handleTransferSubmit}
        locations={locations}
      />
    </div>
  );
}
