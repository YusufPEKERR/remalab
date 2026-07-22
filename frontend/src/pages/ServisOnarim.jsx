import { useState, useEffect } from 'react';
import { Wrench, Trash2, X, Save, Layers, Package, RotateCcw } from 'lucide-react';
import { api } from '../services/api';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

const PRIORITY_STYLES = {
  'Düşük': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Orta': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Yüksek': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Acil': 'bg-red-500/10 text-red-500 border-red-500/20',
};

const STATUS_STYLES = {
  'Beklemede': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Devam Ediyor': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Tamamlandı': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'İptal Edildi': 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function ServisOnarim() {
  const currentUser = getCurrentUser();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Order / Technician Screen States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [repairData, setRepairData] = useState(null);
  const [repairParts, setRepairParts] = useState([]);
  const [diagSaving, setDiagSaving] = useState(false);

  useEffect(() => {
    fetchServiceWorkOrders();
  }, []);

  const fetchServiceWorkOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await api.getWorkOrders();
      if (res) {
        // Filter: only SERVICE work orders
        const serviceOrders = res.filter(o => o.service_record_id);
        setOrders(serviceOrders);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOpenRepairScreen = async (order) => {
    setSelectedOrder(order);
    setRepairData(null);
    setRepairParts([]);
    
    try {
      const res = await api.getServiceRepairDetails(order.id);
      const data = JSON.parse(res);
      if (data.success) {
        if (!data.diagnostics.parts_extra) {
          data.diagnostics.parts_extra = {};
        }
        setRepairData(data);
      } else {
        alert(data.message || 'Onarım detayları yüklenemedi.');
        setSelectedOrder(null);
        return;
      }
      
      const partsRes = await api.getWorkOrderParts(order.id);
      if (partsRes) {
        setRepairParts(partsRes);
      }
    } catch (err) {
      alert('Hata: ' + err.message);
      setSelectedOrder(null);
    }
  };

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
    setRepairData(prev => ({
      ...prev,
      stages: [
        ...prev.stages,
        { group_name: 'Yeni Aşama', staff_name: currentUser?.username || '', count: 1, status: 'Beklemede', start_time: '', finish_time: '' }
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
    if (!repairData || !repairParts.length) return '0.00';
    let total = 0;
    repairParts.forEach(wop => {
      const extra = repairData.diagnostics.parts_extra?.[wop.id] || {};
      const price = parseFloat(extra.price) || 0;
      total += price;
    });
    return total.toFixed(2);
  };

  const handleSaveRepairDetails = async () => {
    if (!selectedOrder || !repairData) return;
    setDiagSaving(true);
    try {
      const payload = {
        diagnostics: repairData.diagnostics,
        stages: repairData.stages,
        price: calculateTotalPrice()
      };
      const res = await api.saveServiceRepairDetails(selectedOrder.id, JSON.stringify(payload));
      const data = JSON.parse(res);
      if (data.success) {
        alert('Onarım bilgileri başarıyla kaydedildi!');
        setSelectedOrder(null);
        fetchServiceWorkOrders();
      } else {
        alert(data.message || 'Onarım bilgileri kaydedilemedi.');
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    } finally {
      setDiagSaving(false);
    }
  };

  // Filter list by searchQuery
  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    return (
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.brand || '').toLowerCase().includes(q) ||
      (o.model || '').toLowerCase().includes(q) ||
      (o.imei_number || '').toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Servis Onarımları</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Cihaz arıza tespit, tanı ve aşama yönetim modülü (Teknisyen Workshop)</p>
        </div>
      </div>

      {/* Standalone List View */}
      {!selectedOrder && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Search bar */}
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex gap-4 items-center">
            <input
              type="text"
              placeholder="IMEI, Müşteri Adı veya Marka/Model ile ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">İş Emri</th>
                  <th className="px-6 py-4">Müşteri / Cihaz Bilgisi</th>
                  <th className="px-6 py-4">Sorumlu Teknisyen</th>
                  <th className="px-6 py-4">Öncelik</th>
                  <th className="px-6 py-4">Tarih Aralığı</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
                {ordersLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Servis iş emri kaydı bulunamadı.</td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-4 font-mono font-bold text-xs">
                        {'1' + String(order.id).padStart(14, '0')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-850 dark:text-slate-200">{order.customer_name || '-'}</div>
                        <div className="text-xs text-slate-400">{order.brand} {order.model}{order.fault_category ? ` · ${order.fault_category}` : ''}</div>
                      </td>
                      <td className="px-6 py-4">{order.assigned_technician || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${PRIORITY_STYLES[order.priority] || PRIORITY_STYLES['Orta']}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {order.start_date || '?'} &rarr; {order.end_date || '?'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[order.status] || STATUS_STYLES['Beklemede']}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleOpenRepairScreen(order)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-900/10 flex items-center gap-1.5 mx-auto transition-colors"
                        >
                          <Wrench size={14} /> Atölye Ekranı
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Inline Technician Workshop View */}
      {selectedOrder && repairData && (
        <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 shadow-2xl rounded-2xl w-full p-6 flex flex-col space-y-6 animate-in fade-in duration-250">
          
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700/50">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Wrench className="text-blue-500 animate-pulse" size={20} /> Servis Onarımları / Teknisyen Ekranı
            </h3>
            <button
              onClick={() => setSelectedOrder(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#242a38] dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1"
            >
              &larr; Geri Dön
            </button>
          </div>

          {/* Body */}
          <div className="space-y-6 text-slate-700 dark:text-slate-200">
            
            {/* 1. Device Summary Fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-[#161a23] p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Imei / Internal Id / Seri No</label>
                <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">{repairData.imei_number || '-'}</div>
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
              
              {/* Left Column: Complaint Details / Notes */}
              <div className="lg:col-span-2 space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Müşteri Notları / Şikayet Detayı</label>
                <div className="w-full bg-slate-50 dark:bg-[#161a23] border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-700 dark:text-slate-300 min-h-[110px] leading-relaxed uppercase">
                  {((repairData.customer_complaint || '') + ' ' + (repairData.preliminary_diagnosis || '')).toUpperCase() || '-'}
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

            {/* 2. Onarım Detay Tablosu */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} /> Onarım Detay / Aşamalar
                </h4>
                <button
                  type="button"
                  onClick={handleAddRepairStage}
                  className="px-3 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} /> Aşama Ekle
                </button>
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
                      <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={stage.group_name || ''}
                            onChange={e => handleUpdateStage(idx, 'group_name', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 w-full"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={stage.staff_name || ''}
                            onChange={e => handleUpdateStage(idx, 'staff_name', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 w-full"
                            placeholder="Teknisyen"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            value={stage.count || 1}
                            onChange={e => handleUpdateStage(idx, 'count', parseInt(e.target.value, 10) || 1)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 w-12 text-center"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={stage.status || 'Beklemede'}
                            onChange={e => handleUpdateStage(idx, 'status', e.target.value)}
                            className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-850 rounded px-2 py-1 focus:outline-none focus:border-blue-500 text-xs"
                          >
                            <option value="Beklemede">Beklemede</option>
                            <option value="Teknisyene Alındı">Teknisyene Alındı</option>
                            <option value="Onarıma Başlandı">Onarıma Başlandı</option>
                            <option value="Onarım Tamamlandı">Onarım Tamamlandı</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={stage.start_time || ''}
                              onChange={e => handleUpdateStage(idx, 'start_time', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 text-[11px] w-28"
                              placeholder="dd.mm.yyyy hh:mm"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateStage(idx, 'start_time', new Date().toLocaleString('tr-TR'))}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-[10px] text-blue-500"
                              title="Şu Anki Saati Ayarla"
                            >
                              <RotateCcw size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={stage.finish_time || ''}
                              onChange={e => handleUpdateStage(idx, 'finish_time', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none py-1 text-[11px] w-28"
                              placeholder="dd.mm.yyyy hh:mm"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateStage(idx, 'finish_time', new Date().toLocaleString('tr-TR'))}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-[10px] text-blue-500"
                              title="Şu Anki Saati Ayarla"
                            >
                              <RotateCcw size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
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
                    {repairParts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-6 text-center text-slate-400">Bu iş emrine ait parça talebi bulunamadı.</td>
                      </tr>
                    ) : (
                      repairParts.map((wop) => {
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
                                className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 focus:outline-none"
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
                                className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 focus:outline-none"
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
                onClick={() => setSelectedOrder(null)} 
                className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Vazgeç
              </button>
              <button 
                type="button"
                disabled={diagSaving}
                onClick={handleSaveRepairDetails}
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-1.5"
              >
                <Save size={16} /> {diagSaving ? 'Kaydediliyor...' : 'KAYDET'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
