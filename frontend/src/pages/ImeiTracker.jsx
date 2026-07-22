import { useState, useRef, useEffect } from 'react';
import { Search, RotateCcw, AlertTriangle, MoreVertical, Plus, Package, X, ChevronDown, FileText, Wrench, Layers, Save } from 'lucide-react';
import { api } from '../services/api';
import PartSelectCombobox from '../components/PartSelectCombobox';

const STATUS_STYLES = {
  'Stokta Var': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Beklemede': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Teslim Edildi': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Stoğa Geri Alındı': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'İade (DOA)': 'bg-red-500/10 text-red-400 border-red-500/20',
  'İptal Edildi': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Kısmi İade Edildi': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Kısmi Teslim': 'bg-amber-500/10 text-amber-500 border-amber-500/20'
};

export default function ImeiTracker() {
  const [imei, setImei] = useState('');
  const [parts, setParts] = useState([]);
  const [recipeMaterials, setRecipeMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openMenuIdx, setOpenMenuIdx] = useState(null);
  const [returnPartDialog, setReturnPartDialog] = useState(null);
  const [cancelPartDialog, setCancelPartDialog] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState('');
  const [batchInfo, setBatchInfo] = useState('');
  
  const [workOrderId, setWorkOrderId] = useState(null);
  const [workOrderType, setWorkOrderType] = useState(null);
  const [allParts, setAllParts] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);
  const [liveNewPart, setLiveNewPart] = useState({ part_id: '', quantity: 1 });
  const [issueData, setIssueData] = useState({ part_id: '', location_id: '', quantity: 1 });
  
  // Teknisyen Servis Onarım Ekranı States
  const [repairData, setRepairData] = useState(null);
  const [selectedStageIdx, setSelectedStageIdx] = useState(0);
  const [diagSaving, setDiagSaving] = useState(false);

  useEffect(() => {
    const fetchInitial = async () => {
        const pRes = await api.getParts();
        if (pRes.success) setAllParts(pRes.parts);
        const sRes = await api.getStockStatus();
        if (sRes.success) setStockStatus(sRes.stock);
    };
    fetchInitial();
  }, []);

  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const handleUpdateDiag = (key, val) => {
    if (!repairData) return;
    setRepairData(prev => ({
      ...prev,
      diagnostics: {
        ...prev.diagnostics,
        [key]: val
      }
    }));
  };

  const handleUpdateStage = (idx, key, val) => {
    if (!repairData) return;
    const updatedStages = [...repairData.stages];
    updatedStages[idx] = {
      ...updatedStages[idx],
      [key]: val
    };
    setRepairData(prev => ({
      ...prev,
      stages: updatedStages
    }));
  };

  const handleAddRepairStage = () => {
    if (!repairData) return;
    const username = localStorage.getItem('username') || 'Unknown';
    setRepairData(prev => ({
      ...prev,
      stages: [
        ...prev.stages,
        { group_name: 'Yeni Aşama', staff_name: username, count: 1, status: 'Beklemede', start_time: '', finish_time: '' }
      ]
    }));
  };

  const handleRemoveRepairStage = (idx) => {
    if (!repairData) return;
    const updatedStages = repairData.stages.filter((_, i) => i !== idx);
    setRepairData(prev => ({
      ...prev,
      stages: updatedStages
    }));
  };

  const handleUpdatePartExtra = (wopId, key, val) => {
    if (!repairData) return;
    const partsExtra = { ...repairData.diagnostics.parts_extra };
    if (!partsExtra[wopId]) {
      partsExtra[wopId] = {
        operation_type: 'Parça Değişim',
        fault: '',
        warranty: 'Ücretli Onarım',
        price: '0.00'
      };
    }
    partsExtra[wopId] = {
      ...partsExtra[wopId],
      [key]: val
    };
    setRepairData(prev => ({
      ...prev,
      diagnostics: {
        ...prev.diagnostics,
        parts_extra: partsExtra
      }
    }));
  };

  const calculateTotalPrice = () => {
    if (!repairData || !parts.length) return '0.00';
    let total = 0;
    parts.forEach(wop => {
      const extra = repairData.diagnostics.parts_extra?.[wop.id] || {};
      const price = parseFloat(extra.price) || 0;
      total += price;
    });
    return total.toFixed(2);
  };

  const handleSaveRepairDetails = async () => {
    if (!workOrderId || !repairData) return;
    setDiagSaving(true);
    try {
      const payload = {
        diagnostics: repairData.diagnostics,
        stages: repairData.stages,
        price: calculateTotalPrice()
      };
      const res = await api.saveServiceRepairDetails(workOrderId, JSON.stringify(payload));
      const data = JSON.parse(res);
      if (data.success) {
        alert('Onarım bilgileri başarıyla kaydedildi!');
        handleSearch();
      } else {
        alert(data.message || 'Onarım bilgileri kaydedilemedi.');
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    } finally {
      setDiagSaving(false);
    }
  };

  const handleStartProductionStage = () => {
    if (!repairData || repairData.stages.length <= selectedStageIdx) return;
    const username = localStorage.getItem('username') || 'Unknown';
    handleUpdateStage(selectedStageIdx, 'status', 'Onarıma Başlandı');
    handleUpdateStage(selectedStageIdx, 'start_time', new Date().toLocaleString('tr-TR'));
    handleUpdateStage(selectedStageIdx, 'staff_name', username);
  };

  const handleFinishProductionStage = () => {
    if (!repairData || repairData.stages.length <= selectedStageIdx) return;
    handleUpdateStage(selectedStageIdx, 'status', 'Onarım Tamamlandı');
    handleUpdateStage(selectedStageIdx, 'finish_time', new Date().toLocaleString('tr-TR'));
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!imei.trim()) return;

    setLoading(true);
    setError('');
    setParts([]);
    
    try {
      const res = await api.getWorkOrderPartsByImei(imei.trim());
      if (res.success) {
        if (res.parts.length === 0) {
          setError('Bu IMEI numarasına ait parça kaydı bulunamadı.');
          setDeviceInfo('');
          setBatchInfo('');
        } else {
          setParts(res.parts);
          setDeviceInfo(res.device_info || '');
          setBatchInfo(res.batch_info || '');
          setWorkOrderId(res.work_order_id || null);
          setWorkOrderType(res.work_order_type || null);
          setRecipeMaterials(res.recipe_materials || []);
          
          if (res.work_order_type === 'SERVICE' && res.work_order_id) {
              const repRes = await api.getServiceRepairDetails(res.work_order_id);
              const repData = JSON.parse(repRes);
              if (repData.success) {
                  if (!repData.diagnostics.parts_extra) {
                      repData.diagnostics.parts_extra = {};
                  }
                  setRepairData(repData);
                  setSelectedStageIdx(0);
              }
          } else {
              setRepairData(null);
          }
        }
      } else {
        setError(res.message || 'Kayıtlar alınırken hata oluştu.');
      }
    } catch (err) {
      setError('Bağlantı hatası.');
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.select();
        inputRef.current.focus();
      }
    }
  };

  const handleAddLivePart = async () => {
    if (!liveNewPart.part_id || liveNewPart.quantity < 1) return;
    if (!workOrderId) return;
    
    const username = localStorage.getItem('username') || 'Unknown';
    let res;
    if (workOrderType === 'PRODUCTION') {
        res = await api.addMaterialRequest(workOrderId, liveNewPart.part_id, liveNewPart.quantity, username);
    } else {
        res = await api.addWorkOrderPart(workOrderId, liveNewPart.part_id, liveNewPart.quantity, username);
    }
    
    if (res.success) {
        setLiveNewPart({ part_id: '', quantity: 1 });
        handleSearch();
    } else {
        alert(res.message || 'Parça eklenemedi.');
    }
  };

  const handleIssuePart = async () => {
    setError(null);
    if (!issueData.part_id) return;
    const selectedPart = parts.find(p => String(p.id) === String(issueData.part_id));
    if (!selectedPart) return;

    const username = localStorage.getItem('username') || 'Unknown';
    let res;

    const totalStock = stockStatus.filter(s => String(s.part_id) === String(selectedPart.part_id)).reduce((acc, s) => acc + parseInt(s.quantity), 0);

    if (workOrderType === 'PRODUCTION') {
        const qty = parseInt(issueData.quantity);
        if (!qty || qty < 1) { setError('Geçerli bir miktar girin.'); return; }
        if (qty > parseInt(selectedPart.quantity)) { setError(`Çıkış yapılacak miktar, talep edilen miktardan (${selectedPart.quantity}) büyük olamaz.`); return; }
        if (qty > totalStock) { setError(`Depoda yeterli stok yok. (Mevcut stok: ${totalStock})`); return; }
        const actualId = String(selectedPart.id).replace('mr_', '');
        res = await api.issueMaterialRequest(actualId, qty, username);
    } else {
        if (!issueData.location_id) { setError('Lütfen kaynak depo seçin.'); return; }
        res = await api.deliverWorkOrderPart(selectedPart.id, issueData.location_id, username);
    }

    if (res.success) {
        setIssueData({ part_id: '', location_id: '', quantity: 1 });
        handleSearch();
    } else {
        setError(res.message || 'Çıkış başarısız.');
    }
  };

  const handleCloseMenu = () => {
    setOpenMenuIdx(null);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        handleCloseMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);


  const handleConfirmReturnPart = async (e) => {
    e.preventDefault();
    if (!returnPartDialog) return;
    
    const formData = new FormData(e.target);
    const qty = formData.get('quantity');
    const target = formData.get('target_warehouse');
    const reason = formData.get('reason');
    
    const username = localStorage.getItem('username') || 'Unknown';
    let res;
    
    const requestReplacement = formData.get('request_replacement') === 'true';

    if (target === 'doa') {
      res = await api.returnPartToDoa(returnPartDialog.id, qty, username);
    } else {
      res = await api.revertWorkOrderPartStatus(returnPartDialog.id, username, qty);
    }
    
    if (res.success) {
      if (requestReplacement) {
        if (workOrderType === 'PRODUCTION') {
          await api.addMaterialRequest(workOrderId, returnPartDialog.part_id, qty, username);
        } else {
          await api.addWorkOrderPart(workOrderId, returnPartDialog.part_id, qty, username);
        }
      }
      setReturnPartDialog(null);
      handleSearch();
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };


  const handleConfirmCancelPart = async (e) => {
    e.preventDefault();
    if (!cancelPartDialog) return;
    
    const formData = new FormData(e.target);
    const reason = formData.get('cancel_reason');
    
    const res = await api.removeWorkOrderPart(cancelPartDialog.id, reason);
    if (res.success) {
      setCancelPartDialog(null);
      handleSearch();
    } else {
      alert(res.message || 'Silme/İptal işlemi başarısız oldu.');
    }
  };

  const handleRemovePart = async (part) => {
    setCancelPartDialog(part);
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden relative">
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Search className="text-blue-400" size={24} /> IMEI ile Parça Takibi
        </h1>
        <p className="text-slate-400 mt-1">Cihazın IMEI numarasını okutarak kullanılan parçaları ve teknisyen durumlarını listeleyin.</p>
      </div>

      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Barkod / IMEI No</label>
              <input
                type="text"
                placeholder="Barkod okutun veya yazın..."
                className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={imei}
                onChange={e => setImei(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Cihaz Bilgisi</label>
              <input
                type="text"
                placeholder="Barkod okutulduğunda dolar..."
                className="w-full bg-slate-100/50 dark:bg-[#242a38]/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none cursor-not-allowed"
                value={deviceInfo}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Batch Girişi</label>
              <input
                type="text"
                placeholder="Barkod okutulduğunda dolar..."
                className="w-full bg-slate-100/50 dark:bg-[#242a38]/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none cursor-not-allowed"
                value={batchInfo}
                readOnly
              />
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-medium whitespace-nowrap flex items-center gap-2"
            >
              <Search size={18} /> {loading ? 'Aranıyor...' : 'Sorgula'}
            </button>
          </div>
        </form>
        {error && <p className="text-red-400 mt-3 text-sm flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>}
      </div>


      {workOrderId && !repairData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
          <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex flex-col gap-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Plus className="text-emerald-500" size={20} /> Parça İhtiyacı Ekle
            </h3>
            <p className="text-sm text-slate-500">Cihaz için gerekli olan yeni bir yedek parça talebi oluşturun.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Yedek Parça</label>
                <PartSelectCombobox
                  parts={workOrderType === 'PRODUCTION' ? recipeMaterials : allParts}
                  value={liveNewPart.part_id}
                  onChange={val => setLiveNewPart({ ...liveNewPart, part_id: val })}
                  placeholder={workOrderType === 'PRODUCTION' ? "Bu reçetedeki hammaddelerden birini seçin..." : "Parça adı veya kodu ile ara..."}
                />
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Miktar</label>
                  <input 
                    type="number" min="1" 
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" 
                    value={liveNewPart.quantity} 
                    onChange={e => setLiveNewPart({ ...liveNewPart, quantity: e.target.value })} 
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleAddLivePart} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap shadow-lg shadow-emerald-900/20"
                >
                  İhtiyaç Ekle
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm flex flex-col gap-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package className="text-blue-500" size={20} /> Depodan Parça Çıkışı Yap
            </h3>
            <p className="text-sm text-slate-500">Talep edilen bir parçayı depodan düşerek cihaza teslim edin.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Talep Edilen Parça</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                  value={issueData.part_id} 
                  onChange={e => setIssueData({ ...issueData, part_id: e.target.value, location_id: '', quantity: 1 })}
                >
                  <option value="">Seçiniz...</option>
                  {parts.filter(p => p.status === 'Beklemede' || p.status === 'Tedarik Bekleniyor' || p.status === 'Talep' || p.status === 'Stokta Var' || p.status === 'Kısmi Teslim').map(p => {
                    const totalStock = stockStatus.filter(s => String(s.part_id) === String(p.part_id)).reduce((acc, s) => acc + s.quantity, 0);
                    return (
                        <option key={p.id} value={p.id}>{p.part_name} (Talep: {p.quantity} | Depo Stok: {totalStock})</option>
                    );
                  })}
                </select>
              </div>
              
              {issueData.part_id && (
                <div className="flex gap-4 items-end">
                  {workOrderType === 'SERVICE' && (
                    <div className="flex-[2]">
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Kaynak Depo</label>
                      <select 
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                        value={issueData.location_id} 
                        onChange={e => setIssueData({ ...issueData, location_id: e.target.value })}
                      >
                        <option value="">Depo Seçin...</option>
                        {(() => {
                          const selectedPart = parts.find(p => String(p.id) === String(issueData.part_id));
                          if (!selectedPart) return null;
                          return stockStatus
                            .filter(s => String(s.part_id) === String(selectedPart.part_id) && s.quantity > 0)
                            .map(s => <option key={s.location_id} value={s.location_id}>{s.location_name} (Stok: {s.quantity})</option>);
                        })()}
                      </select>
                    </div>
                  )}

                  {workOrderType === 'PRODUCTION' && (
                    <div className="flex-[2]">
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Çıkılacak Miktar</label>
                      <input 
                        type="number" min="1" max={parts.find(p => String(p.id) === String(issueData.part_id))?.quantity || ""}
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" 
                        value={issueData.quantity} 
                        onChange={e => setIssueData({ ...issueData, quantity: e.target.value })} 
                      />
                    </div>
                  )}
                  
                  <button 
                    type="button" 
                    onClick={handleIssuePart} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors whitespace-nowrap shadow-lg shadow-blue-900/20"
                  >
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!repairData ? (
      <div className="flex-1 overflow-y-auto pr-2 pb-6">
        <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Parça Kategorisi</th>
                <th className="px-6 py-4">Parça Kodu</th>
                <th className="px-6 py-4">Parça Adı</th>
                <th className="px-6 py-4 text-center">Miktar</th>
                <th className="px-6 py-4">Teknisyen</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-center">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {parts.length === 0 && !loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Search size={32} className="text-slate-600" />
                      <p>Kayıtları görmek için bir IMEI numarası okutun.</p>
                    </div>
                  </td>
                </tr>
              ) : parts.map((part) => (
                <tr 
                  key={part.id} 
                  className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300"
                >
                  <td className="px-6 py-4 font-medium">{part.part_category}</td>
                  <td className="px-6 py-4 text-blue-400">{part.item_code}</td>
                  <td className="px-6 py-4">{part.part_name}</td>
                  <td className="px-6 py-4 text-center">
                    {part.status === 'Kısmi Teslim' ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {part.issued_qty} Teslim / {part.remaining_qty} Kalan
                      </span>
                    ) : (
                      part.quantity
                    )}
                  </td>
                  <td className="px-6 py-4">{part.assigned_technician || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[part.status] || STATUS_STYLES['Beklemede']}`}>
                      {part.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center relative">
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuIdx(openMenuIdx === part.id ? null : part.id); }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openMenuIdx === part.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuIdx(null); }} />
                          <div ref={menuRef} className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 py-1 text-left select-none">

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenMenuIdx(null); setReturnPartDialog(part); }}
                              className="w-full px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#2a3142] flex items-center gap-2.5 font-medium transition-colors"
                            >
                              <RotateCcw size={15} /> İade İşlemi
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenMenuIdx(null); handleRemovePart(part); }}
                              className="w-full px-4 py-2.5 text-xs text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-[#2a3142] flex items-center gap-2.5 font-medium transition-colors"
                            >
                              <X size={15} /> İptal Et / Sil
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        </div>
      ) : (
        <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 shadow-2xl rounded-2xl w-full p-6 flex flex-col space-y-6 animate-in fade-in duration-250">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700/50">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Wrench className="text-blue-500 animate-pulse" size={20} /> Servis Onarımları / Teknisyen Atölye Ekranı
            </h3>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-[#242a38] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              İş Emri ID: {'1' + String(workOrderId).padStart(14, '0')}
            </span>
          </div>

          {/* Body */}
          <div className="space-y-6 text-slate-700 dark:text-slate-200">
            
            {/* 1. Device Summary Fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Imei / Internal Id / Seri No</label>
                <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">{imei || '-'}</div>
              </div>
              <div className="bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Müşteri talebi</label>
                <div className="font-semibold text-sm text-slate-850 dark:text-slate-100">{repairData.customer_complaint || '-'}</div>
              </div>
              <div className="bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Müşteri Arıza Tespiti</label>
                <div className="font-semibold text-sm text-slate-850 dark:text-slate-100">{repairData.preliminary_diagnosis || '-'}</div>
              </div>
              <div className="bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ürün Bilgisi</label>
                <div className="font-bold text-sm text-blue-600 dark:text-blue-400">
                  {repairData.brand} {repairData.model} {repairData.color} {repairData.memory ? `(${repairData.memory})` : ''}
                </div>
              </div>
            </div>

            {/* Notes & Diagnostics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Complaint Details & Live Part Adder */}
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Müşteri Notları / Şikayet Detayı</label>
                  <div className="w-full bg-slate-50 dark:bg-[#161a23] border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-700 dark:text-slate-300 min-h-[90px] leading-relaxed uppercase">
                    {((repairData.customer_complaint || '') + ' ' + (repairData.preliminary_diagnosis || '')).toUpperCase() || '-'}
                  </div>
                </div>

                {/* Integrated Part Adder inside Workshop view */}
                <div className="bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Yedek Parça İhtiyacı Ekle</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-2">
                      <PartSelectCombobox
                        parts={allParts}
                        value={liveNewPart.part_id}
                        onChange={val => setLiveNewPart({ ...liveNewPart, part_id: val })}
                        placeholder="Parça adı veya kodu ile ara..."
                      />
                    </div>
                    <div>
                      <input 
                        type="number" min="1" 
                        placeholder="Miktar"
                        className="w-full bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" 
                        value={liveNewPart.quantity} 
                        onChange={e => setLiveNewPart({ ...liveNewPart, quantity: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="button" 
                      onClick={handleAddLivePart} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-medium transition-colors shadow-lg shadow-emerald-900/10"
                    >
                      + Parça İhtiyacı Ekle
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Status & Battery Diagnostics */}
              <div className="space-y-4 bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-850 pb-2 mb-3">Tanı & Cihaz Sağlık Kartları</h4>
                
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="space-y-1">
                    <span className="block text-[10px] text-slate-400">LCD</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateDiag('lcd', repairData.diagnostics.lcd === 'OK' ? 'NOk' : 'OK')}
                      className={`w-full py-1.5 rounded-lg border transition-colors ${repairData.diagnostics.lcd === 'OK' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}
                    >
                      {repairData.diagnostics.lcd || 'OK'}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[10px] text-slate-400">M.P. Kamera</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateDiag('mp_camera', repairData.diagnostics.mp_camera === 'OK' ? 'NOk' : 'OK')}
                      className={`w-full py-1.5 rounded-lg border transition-colors ${repairData.diagnostics.mp_camera === 'OK' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}
                    >
                      {repairData.diagnostics.mp_camera || 'OK'}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[10px] text-slate-400">B.Kamera</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateDiag('b_camera', repairData.diagnostics.b_camera === 'OK' ? 'NOk' : 'OK')}
                      className={`w-full py-1.5 rounded-lg border transition-colors ${repairData.diagnostics.b_camera === 'OK' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}
                    >
                      {repairData.diagnostics.b_camera || 'OK'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">Battery Cycle</label>
                    <input
                      type="number"
                      value={repairData.diagnostics.battery_cycle || ''}
                      onChange={e => handleUpdateDiag('battery_cycle', e.target.value)}
                      className="w-full bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">Battery Health (%)</label>
                    <input
                      type="number"
                      value={repairData.diagnostics.battery_health || ''}
                      onChange={e => handleUpdateDiag('battery_health', e.target.value)}
                      className="w-full bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>

              </div>

            </div>

            {/* 2. Onarım Detay / Aşamalar Tablosu */}
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={16} className="text-blue-500" /> Onarım Detay / Aşamalar
                  </h4>
                  {repairData.stages.length > 0 && selectedStageIdx !== null && (
                    <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg font-semibold">
                      Seçili Aşama: {repairData.stages[selectedStageIdx]?.group_name}
                    </span>
                  )}
                </div>
                
                {/* FLOW ACTIONS: Üretimi Başlat / Üretimi Bitir */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleStartProductionStage}
                    disabled={selectedStageIdx === null}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-amber-900/10 disabled:opacity-50"
                  >
                    ÜRETİMİ BAŞLAT (Onarıma Başla)
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishProductionStage}
                    disabled={selectedStageIdx === null}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/10 disabled:opacity-50"
                  >
                    ÜRETİMİ BİTİR (Onarımı Bitir)
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRepairStage}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    + Aşama Ekle
                  </button>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-[#161a23] border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#1a202c] text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">MissionGroupName</th>
                      <th className="px-4 py-3">RepairStaffName</th>
                      <th className="px-4 py-3 text-center">ItemCount</th>
                      <th className="px-4 py-3">RepairStatus</th>
                      <th className="px-4 py-3">RepairStartTime</th>
                      <th className="px-4 py-3">RepairFinishTime</th>
                      <th className="px-4 py-3 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    {repairData.stages.map((stage, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedStageIdx(idx)}
                        className={`cursor-pointer transition-colors ${selectedStageIdx === idx ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30'}`}
                      >
                        <td className="px-4 py-2 font-bold">
                          <input
                            type="text"
                            value={stage.group_name || ''}
                            onChange={e => handleUpdateStage(idx, 'group_name', e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 w-full font-bold"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={stage.staff_name || ''}
                            onChange={e => handleUpdateStage(idx, 'staff_name', e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 w-full"
                            placeholder="Teknisyen"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            value={stage.count || 1}
                            onChange={e => handleUpdateStage(idx, 'count', parseInt(e.target.value, 10) || 1)}
                            onClick={e => e.stopPropagation()}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 w-12 text-center"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-[11px] font-bold border ${stage.status === 'Onarım Tamamlandı' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : stage.status === 'Onarıma Başlandı' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                            {stage.status || 'Beklemede'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={stage.start_time || ''}
                              onChange={e => handleUpdateStage(idx, 'start_time', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 text-[11px] w-28"
                              placeholder="dd.mm.yyyy hh:mm"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={stage.finish_time || ''}
                              onChange={e => handleUpdateStage(idx, 'finish_time', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 text-[11px] w-28"
                              placeholder="dd.mm.yyyy hh:mm"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRepairStage(idx)}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Parça ve İşlemleri Tablosu */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Package size={16} /> Parça ve İşlemleri (Gerçek Veriler)
              </h4>
              
              <div className="bg-slate-50 dark:bg-[#161a23] border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-[#1a202c] text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">ItemCategory</th>
                      <th className="px-4 py-3">ItemCode</th>
                      <th className="px-4 py-3">ItemOperationType</th>
                      <th className="px-4 py-3">PartSupplyStatus</th>
                      <th className="px-4 py-3">ItemFault</th>
                      <th className="px-4 py-3">Warranty</th>
                      <th className="px-4 py-3 text-right">ItemPrice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                    {parts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 text-center text-slate-400">Bu iş emrine ait parça talebi bulunamadı.</td>
                      </tr>
                    ) : (
                      parts.map((wop) => {
                        const extra = repairData.diagnostics.parts_extra?.[wop.id] || {
                          operation_type: 'Parça Değişim',
                          fault: '',
                          warranty: 'Ücretli Onarım',
                          price: '0.00'
                        };
                        return (
                          <tr key={wop.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2">{wop.part_category || 'Genel'}</td>
                            <td className="px-4 py-2 font-mono text-[11px]">{wop.item_code || '-'}</td>
                            <td className="px-4 py-2">
                              <select
                                value={extra.operation_type}
                                onChange={e => handleUpdatePartExtra(wop.id, 'operation_type', e.target.value)}
                                className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-850 rounded px-1.5 py-0.5 focus:outline-none"
                              >
                                <option value="Parça Değişim">Parça Değişim</option>
                                <option value="Tamir">Tamir</option>
                                <option value="Kontrol">Kontrol</option>
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${wop.status === 'Teslim Edildi' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                {wop.status === 'Teslim Edildi' ? 'Stoktan Çıktı' : wop.status}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={extra.fault}
                                onChange={e => handleUpdatePartExtra(wop.id, 'fault', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-0.5 w-full"
                                placeholder="Arıza açıklaması..."
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={extra.warranty}
                                onChange={e => handleUpdatePartExtra(wop.id, 'warranty', e.target.value)}
                                className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-850 rounded px-1.5 py-0.5 focus:outline-none"
                              >
                                <option value="Ücretli Onarım">Ücretli Onarım</option>
                                <option value="Garanti Dışı">Garanti Dışı</option>
                                <option value="Garanti İçi">Garanti İçi</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right font-mono">
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="text"
                                  value={extra.price}
                                  onChange={e => handleUpdatePartExtra(wop.id, 'price', e.target.value)}
                                  className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-0.5 w-16 text-right font-mono"
                                />
                                <span>₺</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#242a38] px-6 py-4 rounded-xl mt-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Toplam Fiyat:</span>
              <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-250 dark:bg-[#161a23] px-2.5 py-1 rounded">
                {calculateTotalPrice()} ₺
              </span>
            </div>
            <div className="flex gap-3">
              <button 
                type="button"
                disabled={diagSaving}
                onClick={handleSaveRepairDetails}
                className="px-8 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-lg shadow-emerald-950/20 flex items-center gap-1.5"
              >
                <Save size={16} /> {diagSaving ? 'Kaydediliyor...' : 'KAYDET'}
              </button>
            </div>
          </div>

        </div>
      )}
      {returnPartDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#242a38]">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <RotateCcw className="text-amber-500" size={20} /> İade İşlemi
              </h3>
              <button onClick={() => setReturnPartDialog(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleConfirmReturnPart}>
              <div className="p-6 space-y-5">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{returnPartDialog.part_name}</span> adlı parçayı iade ediyorsunuz.
                </p>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    İade Edilecek Miktar (Maks: {returnPartDialog.quantity})
                  </label>
                  <input 
                    name="quantity"
                    type="number" 
                    min="1" 
                    max={returnPartDialog.quantity} 
                    defaultValue={returnPartDialog.quantity}
                    required
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Gideceği Depo
                  </label>
                  <select 
                    name="target_warehouse" 
                    required
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="good">Sağlam Stoğa (Good Stock)</option>
                    <option value="doa">Arızalı Stoğa (DOA Stock)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-2 select-none">
                  <input 
                    id="request_replacement_checkbox"
                    name="request_replacement" 
                    type="checkbox" 
                    value="true"
                    className="w-4 h-4 text-amber-500 bg-slate-50 border-slate-200 dark:bg-[#242a38] dark:border-slate-700 rounded focus:ring-amber-500"
                  />
                  <label htmlFor="request_replacement_checkbox" className="text-xs font-semibold text-amber-600 dark:text-amber-400 cursor-pointer">
                    Değişim İstiyorum (Yeniden İhtiyaç Ekle)
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    İade Nedeni
                  </label>
                  <textarea 
                    name="reason"
                    rows="2" 
                    required
                    placeholder="Lütfen detaylıca yazın..."
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-amber-500 resize-none"
                  ></textarea>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#242a38]">
                <button 
                  type="button" 
                  onClick={() => setReturnPartDialog(null)} 
                  className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors shadow-lg shadow-amber-900/20"
                >
                  Parçayı İade Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Cancel Part Modal */}
      {cancelPartDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#242a38]">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <X className="text-red-500" size={20} /> İptal Et / Sil
              </h3>
              <button onClick={() => setCancelPartDialog(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleConfirmCancelPart}>
              <div className="p-6 space-y-5">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{cancelPartDialog.part_name}</span> adlı parçayı iptal ediyorsunuz.
                </p>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    İptal Sebebi
                  </label>
                  <textarea 
                    name="cancel_reason"
                    rows="3" 
                    required
                    placeholder="Lütfen iptal sebebini detaylıca yazın..."
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-red-500 resize-none"
                  ></textarea>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#242a38]">
                <button 
                  type="button" 
                  onClick={() => setCancelPartDialog(null)} 
                  className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-lg shadow-red-900/20"
                >
                  İptal Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
