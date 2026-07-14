import { useState, useEffect, useCallback } from 'react';
import { Download, Upload, Plus, RefreshCw, ArrowRightLeft, FileSpreadsheet, Search } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';
import StockTransferModal from '../components/StockTransferModal';

export default function Irsaliye() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);

  // Modals
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showOutboundModal, setShowOutboundModal] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  
  // Data for forms
  const [parts, setParts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);
  const [users, setUsers] = useState([]);
  const [systemLocations, setSystemLocations] = useState([]);
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
  const [excelDirection, setExcelDirection] = useState('inbound');

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState({
    "Parça Adı": true,
    "Yön": true,
    "Miktar": true,
    "Birim Fiyat": true,
    "Kaynak Depo": true,
    "Hedef Depo": true,
    "Tarih": true,
    "İşlemi Yapan": true,
    "Tür": true,
    "Açıklama": true
  });

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

        if (excelDirection === 'inbound') {
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

    if (action === 'template') {
        const templateData = [{
          "Parça ID": "1",
          "Lokasyon ID": "1",
          "Miktar": 10,
          "Birim Fiyat": 150.00,
          "İşlem Türü": "Yeni Alım VEYA Çıkış"
        }];
        await api.exportTableToExcel(templateData, "irsaliye_sablon.xlsx");
    } else if (action === 'export') {
        setIsExportModalOpen(true);
    } else if (action === 'import_in' || action === 'import_out') {
        setExcelDirection(action === 'import_in' ? 'inbound' : 'outbound');
        setIsExcelModalOpen(true);
    }
  };

  const executeExport = async () => {
    const dataToExport = selectedRows.length > 0 
      ? movements.filter(mov => selectedRows.includes(mov.id))
      : movements;

    if (dataToExport.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      setIsExportModalOpen(false);
      return;
    }

    const exportReadyData = dataToExport.map(mov => {
      const dir = getDirection(mov);
      const row = {};
      if (selectedExportColumns["Parça Adı"]) row["Parça Adı"] = mov.part_name;
      if (selectedExportColumns["Yön"]) row["Yön"] = dir === 'in' ? 'Giriş' : (dir === 'out' ? 'Çıkış' : 'Transfer');
      if (selectedExportColumns["Miktar"]) row["Miktar"] = mov.quantity;
      if (selectedExportColumns["Birim Fiyat"]) row["Birim Fiyat"] = mov.unit_price;
      if (selectedExportColumns["Kaynak Depo"]) row["Kaynak Depo"] = dir === 'in' ? 'Dışarı (Tedarikçi)' : mov.source_location;
      if (selectedExportColumns["Hedef Depo"]) row["Hedef Depo"] = dir === 'out' ? 'Dışarı' : mov.target_location;
      if (selectedExportColumns["Tarih"]) row["Tarih"] = mov.created_at;
      if (selectedExportColumns["İşlemi Yapan"]) row["İşlemi Yapan"] = mov.created_by;
      if (selectedExportColumns["Tür"]) row["Tür"] = mov.type;
      if (selectedExportColumns["Açıklama"]) row["Açıklama"] = mov.description || '-';
      return row;
    });

    await api.exportTableToExcel(exportReadyData, 'irsaliye_hareketleri.xlsx');
    setIsExportModalOpen(false);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getStockMovements('all');
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
  }, []);

  const getDirection = (mov) => {
    const hasSource = mov.source_location && mov.source_location !== '-';
    const hasTarget = mov.target_location && mov.target_location !== '-';
    if (hasSource && hasTarget) return 'transfer';
    if (hasSource) return 'out';
    return 'in';
  };

  const directionBadge = (dir) => {
    if (dir === 'in') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Giriş</span>;
    if (dir === 'out') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">Çıkış</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">Transfer</span>;
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === movements.length && movements.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(movements.map(mov => mov.id));
    }
  };

  const toggleRowSelect = (id, e) => {
    e.stopPropagation();
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const fetchDependencies = async () => {
    const resP = await api.getParts();
    if (resP && resP.success) setParts(resP.parts);
    const resL = await api.getLocations();
    if (resL && resL.success) setLocations(resL.locations);
    const resS = await api.getStockStatus();
    if (resS && resS.success) setStockStatus(resS.stock);
    const resU = await api.getUsers();
    if (resU && resU.success) setUsers(resU.users);
    const resSys = await api.getSystemLocations();
    if (resSys && resSys.success) setSystemLocations(resSys.locations || []);
  };

  const getSystemLocationId = (kind) => {
    const loc = systemLocations.find(l => l.kind === kind);
    return loc ? String(loc.id) : '';
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
    setFormData({ part_id: '', loc_id: getSystemLocationId('good_stock'), source_loc_id: '', qty: 1, price: 0, type: 'Yeni Alım (Tedarikçiden)', technician: '', description: '' });
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
    if (!window.confirm("Bu stok çıkışını yapmak istediğinize emin misiniz?")) {
      return;
    }
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
          <p className="text-slate-500 mt-1">Stok giriş ve çıkış hareketlerini tek ekrandan yönetin</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {/* Actions */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
        <div className="text-slate-700 dark:text-slate-300 text-sm">
          Stok Giriş / Çıkış Modülü
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
              <option value="template">Şablon İndir</option>
              <option value="export">{selectedRows.length > 0 ? `${selectedRows.length} Seçiliyi Dışa Aktar` : 'Tümünü Dışa Aktar'}</option>
              <option value="import_in">Giriş İçe Aktar</option>
              <option value="import_out">Çıkış İçe Aktar</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
              <FileSpreadsheet size={16} />
            </div>
          </div>
          <button
            onClick={resetInboundForm}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Giriş Yap
          </button>
          <button
            onClick={async () => {
              await fetchDependencies();
              
              if (selectedRows.length === 1) {
                const mov = movements.find(m => String(m.id) === String(selectedRows[0]));
                console.log("Selected Movement:", mov);
                if (mov) {
                  const p = parts.find(x => String(x.id) === String(mov.part_id)) || { item_code: '', brand: '', model: '' };
                  console.log("Found Part:", p);
                  setOutboundBarcode(String(p.item_code || ''));
                  setOutboundBrand(p.brand || '');
                  setOutboundModel(p.model || '');
                  
                  const dir = getDirection(mov);
                  let locId = '';
                  if (dir === 'in' || dir === 'transfer') {
                    locId = mov.target_location_id || '';
                  } else if (dir === 'out') {
                    locId = mov.source_location_id || '';
                  }

                  setFormData({ part_id: String(mov.part_id || ''), loc_id: String(locId), qty: mov.quantity || 1, price: 0, type: 'Teknik Servis', technician: '', description: '' });
                  setShowOutboundModal(true);
                  return;
                }
              }
              
              setOutboundBarcode(''); setOutboundBrand(''); setOutboundModel(''); setFormData({ part_id: '', loc_id: '', qty: 1, price: 0, type: 'Teknik Servis', technician: '', description: '' }); setShowOutboundModal(true); 
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Stok Çıkışı Yap
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/50 sticky top-0 uppercase tracking-wider text-xs z-10">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                    checked={selectedRows.length === movements.length && movements.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">PARÇA ADI</th>
                <th className="px-6 py-4">YÖN</th>
                <th className="px-6 py-4">MİKTAR</th>
                <th className="px-6 py-4">BİRİM FİYAT</th>
                <th className="px-6 py-4">KAYNAK DEPO</th>
                <th className="px-6 py-4">HEDEF DEPO</th>
                <th className="px-6 py-4">TARİH</th>
                <th className="px-6 py-4">İŞLEMİ YAPAN</th>
                <th className="px-6 py-4">TÜR</th>
                <th className="px-6 py-4">AÇIKLAMA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Yükleniyor...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-400">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                movements.map((mov, index) => {
                  const dir = getDirection(mov);
                  const isChecked = selectedRows.includes(mov.id);
                  return (
                    <tr key={`${mov.id}-${index}`} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors group text-slate-800 dark:text-slate-200 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-800"
                          checked={isChecked}
                          onChange={(e) => toggleRowSelect(mov.id, e)}
                        />
                      </td>
                      <td className="px-6 py-3">{mov.part_name}</td>
                      <td className="px-6 py-3">{directionBadge(dir)}</td>
                      <td className={`px-6 py-3 font-mono font-semibold ${dir === 'out' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {dir === 'out' ? '-' : '+'}{mov.quantity}
                      </td>
                      <td className="px-6 py-3 font-mono">{mov.unit_price ? `${mov.unit_price.toFixed(2)} TL` : '-'}</td>
                      <td className="px-6 py-3">{dir === 'in' ? 'Dışarı (Tedarikçi)' : mov.source_location}</td>
                      <td className="px-6 py-3">{dir === 'out' ? 'Dışarı' : mov.target_location}</td>
                      <td className="px-6 py-3 text-slate-400">{mov.created_at}</td>
                      <td className="px-6 py-3">{mov.created_by}</td>
                      <td className="px-6 py-3">{mov.type}</td>
                      <td className="px-6 py-3 text-slate-400">{mov.description || '-'}</td>
                    </tr>
                  );
                })
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Plus size={18}/> Stok Girişi Yap</h2>
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

              {(getSystemLocationId('good_stock') || getSystemLocationId('doa_stock')) && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Durum (hızlı seçim)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, loc_id: getSystemLocationId('good_stock') }))}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${formData.loc_id && formData.loc_id === getSystemLocationId('good_stock') ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 dark:bg-[#0f1219] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500'}`}
                    >
                      ✅ Sağlam (Good Stock)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, loc_id: getSystemLocationId('doa_stock') }))}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${formData.loc_id && formData.loc_id === getSystemLocationId('doa_stock') ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 dark:bg-[#0f1219] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500'}`}
                    >
                      ⚠️ Arızalı (DOA Stock)
                    </button>
                  </div>
                </div>
              )}

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

      {/* Dışa Aktar Sütun Seçimi Modalı */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Sütun Seçimi</h2>
            <p className="text-sm text-slate-500 mb-4">Dışa aktarılacak Excel dosyasında hangi sütunların bulunmasını istediğinizi seçin.</p>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
              {Object.keys(selectedExportColumns).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedExportColumns[col]}
                    onChange={(e) => setSelectedExportColumns(prev => ({...prev, [col]: e.target.checked}))}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{col}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium"
              >
                İptal
              </button>
              <button 
                onClick={executeExport}
                disabled={!Object.values(selectedExportColumns).some(Boolean)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                Dışa Aktar
              </button>
            </div>
          </div>
        </div>
      )}

      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransfer={handleTransferSubmit}
        locations={locations}
        systemLocationIds={systemLocations.map(l => l.id)}
      />
    </div>
  );
}
