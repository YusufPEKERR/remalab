import { useState, useEffect } from 'react';
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
  const [formData, setFormData] = useState({ part_id: '', loc_id: '', qty: 1, price: 0, type: '' });

  // Inbound Form States
  const [inboundBarcode, setInboundBarcode] = useState('');
  const [inboundBrand, setInboundBrand] = useState('');
  const [inboundModel, setInboundModel] = useState('');

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

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const typeStr = activeTab === 'inbound' ? 'in' : 'out';
      const res = await api.getStockMovements(typeStr);
      if (res && res.success) {
        setMovements(res.movements || []);
      } else {
        setError(res ? res.message : 'Hata');
      }
    } catch (err) {
      setError('Bağlantı hatası.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    const resP = await api.getParts();
    if (resP && resP.success) setParts(resP.parts);
    const resL = await api.getLocations();
    if (resL && resL.success) setLocations(resL.locations);
  };

  const handleTransferSubmit = (transferData) => {
    setIsTransferModalOpen(false);
    fetchData();
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

  const uniqueBrands = Array.from(new Set(parts.map(p => p.brand).filter(Boolean)));
  const uniqueModels = Array.from(new Set(parts.filter(p => p.brand === inboundBrand).map(p => p.model).filter(Boolean)));
  const filteredParts = parts.filter(p => 
    (!inboundBrand || p.brand === inboundBrand) && 
    (!inboundModel || p.model === inboundModel)
  );

  const resetInboundForm = () => {
    setInboundBarcode('');
    setInboundBrand('');
    setInboundModel('');
    setFormData({ part_id: '', loc_id: '', qty: 1, price: 0, type: 'Yeni Alım (Tedarikçiden)' });
    setShowInboundModal(true);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 8000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const handleInbound = async (e) => {
    e.preventDefault();
    const user = "admin";
    const res = await api.addInboundEntry(formData.part_id, formData.loc_id, formData.qty, formData.price, formData.type || 'Yeni Alım', user);
    if (res && res.success) {
      setShowInboundModal(false);
      fetchData();
    } else alert("Hata: " + (res ? res.message : ""));
  };

  const handleOutbound = async (e) => {
    e.preventDefault();
    const user = "admin";
    const res = await api.addOutboundEntry(formData.part_id, formData.loc_id, formData.qty, formData.type || 'Çıkış', user);
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
      <div className="border-b border-slate-700 mt-2">
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

      {/* Actions */}
      <div className="flex justify-between items-center bg-[#1e2330] p-4 rounded-xl border border-slate-700/50 shadow-sm">
        <div className="text-slate-300 text-sm">
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
              className="appearance-none bg-[#242a38] hover:bg-[#2a3142] text-slate-300 border border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500"
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
              onClick={() => { setFormData({ part_id: '', loc_id: '', qty: 1, price: 0, type: 'Müşteri Satışı' }); setShowOutboundModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Stok Çıkışı Yap
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e2330] border border-slate-700/50 rounded-xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#242a38] text-slate-300 font-semibold border-b border-slate-700/50 sticky top-0 uppercase tracking-wider text-xs z-10">
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
                  <tr key={`${mov.id}-${index}`} className="hover:bg-[#2a3142] transition-colors group text-slate-200">
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
                        <td className="px-6 py-3 text-slate-400">-</td>
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2330] rounded-2xl shadow-2xl border border-slate-700/50 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-[#242a38]">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2"><Plus size={18}/> Yeni Stok Ekle</h2>
              <button onClick={() => setShowInboundModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleInbound} className="p-6 space-y-4">
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-2">
                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">📄</span> Barkod (okutun ve Enter'a basın)
                </label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Barkodu okutun veya manuel girin..." className="flex-1 px-4 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={inboundBarcode} onChange={(e) => setInboundBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBarcodeSearch())} />
                  <button type="button" onClick={handleBarcodeSearch} className="px-4 bg-[#2a3142] hover:bg-blue-600 border border-slate-600 rounded-lg text-white transition-colors"><Search size={18} /></button>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-4"></div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Marka</label>
                <select className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={inboundBrand} onChange={(e) => { setInboundBrand(e.target.value); setInboundModel(''); setFormData({...formData, part_id: ''}); }}>
                  <option value="">Marka seçiniz...</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Telefon Modeli</label>
                <select className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={inboundModel} onChange={(e) => { setInboundModel(e.target.value); setFormData({...formData, part_id: ''}); }}>
                  <option value="">Model seçiniz...</option>
                  {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Parça Adı / Parça</label>
                <select required className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.part_id} onChange={(e) => setFormData({...formData, part_id: e.target.value})}>
                  <option value="">Parça seçiniz...</option>
                  {filteredParts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} {p.name ? `- ${p.name}` : ''}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Giriş Tipi</label>
                <select required className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option value="Yeni Alım (Tedarikçiden)">Yeni Alım (Tedarikçiden)</option>
                  <option value="İade Girişi">İade Girişi</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Miktar</label>
                  <input type="number" required min="1" className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.qty} onChange={(e) => setFormData({...formData, qty: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Birim Fiyat</label>
                  <div className="relative">
                    <input type="number" step="0.01" className="w-full px-3 py-2 pr-8 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">TL</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Lokasyon</label>
                <select required className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.loc_id} onChange={(e) => setFormData({...formData, loc_id: e.target.value})}>
                  <option value="">Lokasyon seçiniz...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-slate-700/50 pt-4">
                <button type="button" onClick={() => setShowInboundModal(false)} className="px-5 py-2.5 bg-[#323a4d] hover:bg-[#3f485e] text-slate-200 rounded-lg text-sm font-medium transition-colors">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-[#42526e] hover:bg-[#506385] text-white rounded-lg text-sm font-medium transition-colors shadow-lg">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OUTBOUND MODAL */}
      {showOutboundModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2330] rounded-2xl shadow-2xl border border-slate-700/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-[#242a38]">
              <h2 className="text-lg font-bold text-slate-100">Stok Çıkışı Yap</h2>
            </div>
            <form onSubmit={handleOutbound} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tür</label>
                <select required className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option value="Müşteri Satışı">Müşteri Satışı</option>
                  <option value="Tedarikçiye İade">Tedarikçiye İade</option>
                  <option value="Fire">Fire / Bozuk</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Parça</label>
                <select required className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.part_id} onChange={(e) => setFormData({...formData, part_id: e.target.value})}>
                  <option value="">Seçiniz...</option>
                  {parts.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Kaynak Lokasyon</label>
                <select required className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.loc_id} onChange={(e) => setFormData({...formData, loc_id: e.target.value})}>
                  <option value="">Seçiniz...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Miktar</label>
                <input type="number" required min="1" className="w-full px-3 py-2 bg-[#0f1219] border border-slate-700 text-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" value={formData.qty} onChange={(e) => setFormData({...formData, qty: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 mt-6 border-t border-slate-700/50 pt-4">
                <button type="button" onClick={() => setShowOutboundModal(false)} className="px-4 py-2 border border-slate-600 rounded-xl hover:bg-[#2a3142] text-slate-300 text-sm font-medium transition-colors">İptal</button>
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
