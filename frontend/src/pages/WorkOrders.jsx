import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Edit, X, Save, Factory, Package, TrendingUp, Repeat, AlertTriangle, Layers } from 'lucide-react';
import { api } from '../services/api';
import PartSupplyMenu from '../components/PartSupplyMenu';
import DeliverPartPopover from '../components/DeliverPartPopover';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
  } catch (_e) {
    return null;
  }
}

const PRIORITY_OPTIONS = ['Düşük', 'Orta', 'Yüksek', 'Acil'];
const PRIORITY_STYLES = {
  'Düşük': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Orta': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Yüksek': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Acil': 'bg-red-500/10 text-red-400 border-red-500/20'
};

const STATUS_OPTIONS = ['Beklemede', 'Devam Ediyor', 'Tamamlandı', 'Başarısız', 'İptal'];
const STATUS_STYLES = {
  'Beklemede': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Devam Ediyor': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Tamamlandı': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Başarısız': 'bg-red-500/10 text-red-400 border-red-500/20',
  'İptal': 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};
// Bu duruma geçişte iş emrindeki parçalar otomatik olarak taşınır (bkz. update_work_order).
const TERMINAL_STATUSES = ['Tamamlandı', 'Başarısız', 'İptal'];

const EMPTY_FORM = {
  service_record_id: '', description: '', assigned_technician: '', priority: 'Orta',
  start_date: '', end_date: '', status: 'Beklemede', source_location_id: ''
};

const EMPTY_PRODUCTION_FORM = {
  target_part_id: '', target_part_code: '', quantity_produced: 1, source_location_id: '', target_location_id: '', produced_by: '', notes: ''
};

// Production Work Order: Service Record'a bağlı değildir, work_orders tablosunu
// work_order_type='PRODUCTION' ile paylaşır (bkz. create_production_work_order).
const EMPTY_PRODUCTION_WO_FORM = {
  target_part_id: '', description: '', priority: 'Orta', planned_quantity: 1, assigned_technician: ''
};

const EMPTY_COMPLETE_FORM = { produced_quantity: '', scrap_quantity: '', production_notes: '' };

// Production Work Order durum akışı: BEKLIYOR -> URETIMDE -> TAMAMLANDI (bkz.
// start_production_work_order/complete_production_work_order). Service Work Order'ın
// kendi durum sözlüğünden (STATUS_STYLES/STATUS_OPTIONS) tamamen bağımsızdır.
const PRODUCTION_WO_STATUS_STYLES = {
  'BEKLIYOR': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'URETIMDE': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'TAMAMLANDI': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};
const PRODUCTION_WO_STATUS_LABELS = {
  'BEKLIYOR': 'Bekliyor',
  'URETIMDE': 'Üretimde',
  'TAMAMLANDI': 'Tamamlandı'
};

const SUPPLY_STATUS_STYLES = {
  'Stokta Var': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Teslim Edildi': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Tedarik Bekleniyor': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'İptal Edildi': 'bg-red-500/10 text-red-400 border-red-500/20'
};

// Malzeme talebi durum akışı: WAITING -> PARTIAL -> ISSUED (bkz. issue_material_request).
// Backend bu kodları İngilizce döner; ekranda gösterilen etiketler Türkçedir (bkz. MATERIAL_REQUEST_STATUS_LABELS).
const MATERIAL_REQUEST_STATUS_STYLES = {
  'WAITING': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'PARTIAL': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'ISSUED': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};
const MATERIAL_REQUEST_STATUS_LABELS = {
  'WAITING': 'Bekliyor',
  'PARTIAL': 'Kısmi Teslim',
  'ISSUED': 'Teslim Edildi'
};

export default function WorkOrders() {
  const [activeTab, setActiveTab] = useState('production');

  // --- İş Emirleri (work orders) state ---
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [partsUsed, setPartsUsed] = useState([]);

  const [serviceRecords, setServiceRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [parts, setParts] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);
  const [systemLocations, setSystemLocations] = useState([]);
  const currentUser = getCurrentUser();

  // --- Parça Tedarik Durumu (live, kayıtlı iş emri için) state ---
  const [workOrderParts, setWorkOrderParts] = useState([]);
  const [liveNewPart, setLiveNewPart] = useState({ part_id: '', quantity: 1 });
  const [contextMenu, setContextMenu] = useState(null); // {wopId, status, x, y} | null
  const [deliverPopover, setDeliverPopover] = useState(null); // {wopId, partId, partName, quantity, x, y} | null

  // --- Üretim (production) state ---
  const [productionRuns, setProductionRuns] = useState([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionForm, setProductionForm] = useState(EMPTY_PRODUCTION_FORM);
  const [productionMaterials, setProductionMaterials] = useState([]);
  const [recentProductions, setRecentProductions] = useState([]);
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [itemBoms, setItemBoms] = useState([]);
  const [bomsLoading, setBomsLoading] = useState(false);
  const [bomSearchQuery, setBomSearchQuery] = useState('');

  // --- Production Work Order state (work_orders, work_order_type = 'PRODUCTION') ---
  const [showProductionWOForm, setShowProductionWOForm] = useState(false);
  const [productionWOForm, setProductionWOForm] = useState(EMPTY_PRODUCTION_WO_FORM);
  const [productionWOSaving, setProductionWOSaving] = useState(false);
  // Sadece id tutulur; gösterilecek veri her render'da guncel `orders` listesinden
  // turetilir (bkz. selectedProductionOrder), boylece durum degisince (Baslat/Tamamla)
  // ayrica senkronize etmeye gerek kalmaz.
  const [selectedProductionOrderId, setSelectedProductionOrderId] = useState(null);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [materialRequestsLoading, setMaterialRequestsLoading] = useState(false);
  const [issueDialog, setIssueDialog] = useState(null); // {mrId, partName, itemCode, required, issued, remaining} | null
  const [issueQuantity, setIssueQuantity] = useState(1);
  const [issueSaving, setIssueSaving] = useState(false);
  const [completeDialog, setCompleteDialog] = useState(null); // order | null
  const [completeForm, setCompleteForm] = useState(EMPTY_COMPLETE_FORM);
  const [completeSaving, setCompleteSaving] = useState(false);
  const [startSaving, setStartSaving] = useState(false);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    const res = await api.getWorkOrders();
    if (res.success) setOrders(res.work_orders || []);
    setOrdersLoading(false);
  };

  const fetchProductionRuns = async () => {
    setProductionLoading(true);
    const res = await api.getProductionRuns();
    if (res.success) setProductionRuns(res.production_runs || []);
    setProductionLoading(false);
  };

  const fetchItemBoms = async () => {
    setBomsLoading(true);
    const res = await api.getItemBOMs();
    if (res.success) setItemBoms(res.item_boms || []);
    setBomsLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    fetchProductionRuns();
    fetchItemBoms();
    api.getServiceRecords().then(res => { if (res.success) setServiceRecords(res.records || []); });
    api.getUsers().then(res => { if (res.success) setUsers(res.users || []); });
    api.getParts().then(res => { if (res.success) setParts(res.parts || []); });
    api.getStockStatus().then(res => { if (res.success) setStockStatus(res.stock || []); });
    api.getSystemLocations().then(res => { if (res.success) setSystemLocations(res.locations || []); });
  }, []);

  const getSystemLocationId = (kind) => {
    const loc = systemLocations.find(l => l.kind === kind);
    return loc ? String(loc.id) : '';
  };

  const getStockQty = (partId, locId) => {
    if (!partId || !locId) return 0;
    return stockStatus
      .filter(s => String(s.part_id) === String(partId) && String(s.location_id) === String(locId))
      .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  };

  // Yarı mamul üretiminde hammadde hangi lokasyonda olursa olsun toplam stok esas alınır.
  const getTotalStockQty = (partId) => {
    if (!partId) return 0;
    return stockStatus
      .filter(s => String(s.part_id) === String(partId))
      .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
  };

  const fetchWorkOrderParts = async (workOrderId) => {
    const res = await api.getWorkOrderParts(workOrderId);
    if (res.success) setWorkOrderParts(res.parts || []);
  };

  const refreshStockStatus = () => {
    api.getStockStatus().then(r => { if (r.success) setStockStatus(r.stock || []); });
  };

  useEffect(() => {
    if (editingOrder?.id) {
      fetchWorkOrderParts(editingOrder.id);
    } else {
      setWorkOrderParts([]);
    }
    setLiveNewPart({ part_id: '', quantity: 1 });
  }, [editingOrder?.id]);

  // ===================== Parça Tedarik Durumu handlers =====================

  const handleAddLivePart = async () => {
    if (!editingOrder?.id || !liveNewPart.part_id) return;
    const res = await api.addWorkOrderPart(editingOrder.id, liveNewPart.part_id, liveNewPart.quantity || 1, currentUser?.username);
    if (res.success && res.part) {
      setWorkOrderParts(prev => [...prev, res.part]);
      setLiveNewPart({ part_id: '', quantity: 1 });
    } else {
      alert(res.message || 'Parça eklenemedi.');
    }
  };

  const handleOpenContextMenu = (row, e) => {
    e.preventDefault();
    setContextMenu({ wopId: row.id, status: row.status, x: e.clientX, y: e.clientY });
  };

  const handleOpenDeliverPopover = (row) => {
    const pos = contextMenu || { x: 200, y: 200 };
    setDeliverPopover({ wopId: row.id, partId: row.part_id, partName: row.part_name, quantity: row.quantity, x: pos.x, y: pos.y });
  };

  const handleConfirmDeliver = async (locationId) => {
    if (!deliverPopover) return;
    const res = await api.deliverWorkOrderPart(deliverPopover.wopId, locationId, currentUser?.username);
    if (res.success) {
      setDeliverPopover(null);
      fetchWorkOrderParts(editingOrder.id);
      refreshStockStatus();
    } else {
      alert(res.message || 'Teslim işlemi başarısız oldu.');
    }
  };

  const handleMarkWaiting = async (row) => {
    const notes = window.prompt('Tedarik bekleme notu (opsiyonel):', '') || '';
    const res = await api.markWorkOrderPartWaiting(row.id, notes, currentUser?.username);
    if (res.success) {
      fetchWorkOrderParts(editingOrder.id);
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleRevertPart = async (row) => {
    if (!window.confirm('Bu durumu geri almak istediğinize emin misiniz?')) return;
    const res = await api.revertWorkOrderPartStatus(row.id, currentUser?.username);
    if (res.success) {
      fetchWorkOrderParts(editingOrder.id);
      refreshStockStatus();
    } else {
      alert(res.message || 'Geri alma işlemi başarısız oldu.');
    }
  };

  const handleRemoveLivePart = async (row) => {
    if (!window.confirm('Bu parça satırını silmek istediğinize emin misiniz?')) return;
    const res = await api.removeWorkOrderPart(row.id);
    if (res.success) {
      setWorkOrderParts(prev => prev.filter(p => p.id !== row.id));
    } else {
      alert(res.message || 'Silme işlemi başarısız oldu.');
    }
  };

  // İş emri parçaları sadece Good/DOA Stock'tan (Repair Stock'a) beslenebilir.
  const workOrderSourceLocations = systemLocations.filter(l => l.kind === 'good_stock' || l.kind === 'doa_stock');

  // Yarı mamul üretiminde hammadde düşümü ve üretilen parça girişi her zaman Good Stock'ta yapılır.
  const goodStockLocationId = systemLocations.find(l => l.kind === 'good_stock')?.id || '';

  // ===================== İş Emri handlers =====================

  const handleOpenForm = (order = null) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        service_record_id: order.service_record_id || '',
        description: order.description || '',
        assigned_technician: order.assigned_technician || '',
        priority: order.priority || 'Orta',
        start_date: order.start_date || '',
        end_date: order.end_date || '',
        status: order.status || 'Beklemede',
        source_location_id: order.source_location_id || ''
      });
      try {
        setPartsUsed(JSON.parse(order.parts_used || '[]'));
      } catch (_e) {
        setPartsUsed([]);
      }
    } else {
      setEditingOrder(null);
      setFormData({ ...EMPTY_FORM, source_location_id: getSystemLocationId('good_stock') });
      setPartsUsed([]);
    }
    setActiveTab('new');
  };

  const handleAddPartRow = () => {
    setPartsUsed(prev => [...prev, { part_id: '', quantity: 1 }]);
  };

  const handlePartRowChange = (index, field, value) => {
    setPartsUsed(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleRemovePartRow = (index) => {
    setPartsUsed(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const usedParts = partsUsed.filter(r => r.part_id && Number(r.quantity) > 0);

    if (!editingOrder && usedParts.length > 0) {
      if (!formData.source_location_id) {
        alert('Parça kullanılan bir iş emri için Kaynak Depo seçmelisiniz.');
        return;
      }
      for (const row of usedParts) {
        const available = getStockQty(row.part_id, formData.source_location_id);
        if (Number(row.quantity) > available) {
          alert('Seçilen kaynak depoda bazı parçalar için yeterli stok yok. Lütfen miktarları kontrol edin.');
          return;
        }
      }
    }

    if (editingOrder && TERMINAL_STATUSES.includes(formData.status) && formData.status !== editingOrder.status && !editingOrder.stock_settled_at) {
      const ok = window.confirm('Bu işlem, iş emrindeki parçaları otomatik olarak ilgili depoya (Good/Scrap Stock veya kaynak depo) taşıyacak. Onaylıyor musunuz?');
      if (!ok) return;
    }

    const payload = { ...formData, parts_used: JSON.stringify(usedParts) };
    const res = editingOrder
      ? await api.updateWorkOrder(editingOrder.id, payload)
      : await api.createWorkOrder(payload);
    if (res.success) {
      if (!editingOrder && res.id && usedParts.length > 0) {
        await api.addWorkOrderPartsBulk(res.id, usedParts, currentUser?.username);
      }
      setEditingOrder(null);
      setFormData({ ...EMPTY_FORM, source_location_id: getSystemLocationId('good_stock') });
      setPartsUsed([]);
      fetchOrders();
      api.getStockStatus().then(r => { if (r.success) setStockStatus(r.stock || []); });
      setActiveTab('list');
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu iş emrini silmek istediğinize emin misiniz?')) {
      const res = await api.deleteWorkOrder(id);
      if (res.success) {
        fetchOrders();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  const parsePartsUsed = (json) => {
    try {
      return JSON.parse(json || '[]');
    } catch (_e) {
      return [];
    }
  };

  // ===================== Üretim handlers =====================

  const handleAddMaterialRow = () => {
    setProductionMaterials(prev => [...prev, { part_id: '', quantity_consumed: 1 }]);
  };

  const handleMaterialRowChange = (index, field, value) => {
    setProductionMaterials(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleRemoveMaterialRow = (index) => {
    setProductionMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduction = async (e) => {
    e.preventDefault();
    if (!goodStockLocationId) {
      alert('Good Stock lokasyonu bulunamadı. Lütfen sistem lokasyonlarını kontrol edin.');
      return;
    }

    const targetPart = parts.find(p => 
      (p.item_code && p.item_code.toLowerCase() === (productionForm.target_part_code || '').trim().toLowerCase()) || 
      (p.name && p.name.toLowerCase() === (productionForm.target_part_code || '').trim().toLowerCase()) ||
      String(p.id) === String(productionForm.target_part_code).trim()
    );

    if (!targetPart) {
      alert('Girilen parça kodu veya adına ait bir parça sistemde bulunamadı. Lütfen kontrol edip tekrar deneyin.');
      return;
    }
    const finalTargetPartId = targetPart.id;

    const materials = productionMaterials.filter(r => r.part_id && Number(r.quantity_consumed) > 0);

    if (materials.length === 0) {
      alert('Lütfen en az bir tane tüketilen madde (hammadde) giriniz.');
      return;
    }

    for (const m of materials) {
      const available = getTotalStockQty(m.part_id);
      if (Number(m.quantity_consumed) > available) {
        alert('Bazı hammaddeler için yeterli stok yok. Lütfen miktarları kontrol edin.');
        return;
      }
    }

    const res = await api.createProductionRun({
      ...productionForm,
      target_part_id: finalTargetPartId,
      source_location_id: goodStockLocationId,
      target_location_id: goodStockLocationId,
      materials_json: JSON.stringify(materials)
    });
    if (res.success) {
      const recentRun = {
        id: Date.now(),
        target_part_id: finalTargetPartId,
        target_part_name: targetPart.name,
        quantity_produced: productionForm.quantity_produced,
        source_location_id: goodStockLocationId,
        target_location_id: goodStockLocationId,
        materials: materials,
        produced_by: productionForm.produced_by,
        notes: productionForm.notes,
        time: new Date().toLocaleTimeString()
      };
      setRecentProductions(prev => [recentRun, ...prev].slice(0, 5));

      setProductionForm(EMPTY_PRODUCTION_FORM);
      setProductionMaterials([]);
      fetchProductionRuns();
      api.getStockStatus().then(r => { if (r.success) setStockStatus(r.stock || []); });
    } else {
      alert(res.message || 'Üretim kaydı oluşturulamadı.');
    }
  };

  const handleInstantRepeatProduction = async (run) => {
    for (const m of run.materials) {
      const available = getTotalStockQty(m.part_id);
      if (Number(m.quantity_consumed) > available) {
        alert(`Yeterli stok yok. ${parts.find(p => String(p.id) === String(m.part_id))?.name || 'Bazı hammaddeler'} için mevcut stok: ${available}`);
        return;
      }
    }
    
    if (repeatLoading) return;
    setRepeatLoading(true);

    const payload = {
      target_part_id: run.target_part_id,
      quantity_produced: run.quantity_produced,
      source_location_id: run.source_location_id,
      target_location_id: run.target_location_id,
      materials_json: JSON.stringify(run.materials),
      produced_by: run.produced_by || (getCurrentUser()?.username || 'admin'),
      notes: run.notes || ''
    };

    const res = await api.createProductionRun(payload);
    if (res.success) {
      const updatedRun = { ...run, id: Date.now(), time: new Date().toLocaleTimeString() };
      setRecentProductions(prev => {
        const others = prev.filter(p => p.id !== run.id);
        return [updatedRun, ...others].slice(0, 5);
      });
      fetchProductionRuns();
      api.getStockStatus().then(r => { if (r.success) setStockStatus(r.stock || []); });
    } else {
      alert(res.message || 'Yeniden üretim kaydı oluşturulamadı.');
    }
    setRepeatLoading(false);
  };

  const handleDeleteProduction = async (id) => {
    if (window.confirm('Bu üretim işlemini geri almak (iptal etmek) istediğinize emin misiniz? (Üretilen ürün miktarı stoktan düşülecek ve tüketilen malzemeler stoğa geri eklenecektir.)')) {
      const res = await api.deleteProductionRun(id);
      if (res.success) {
        fetchProductionRuns();
        api.getStockStatus().then(r => { if (r.success) setStockStatus(r.stock || []); });
      } else {
        alert(res.message || 'Üretim kaydı silinemedi.');
      }
    }
  };

  const handleRepeatProduction = (run) => {
    const targetPart = parts.find(p => String(p.id) === String(run.target_part_id));
    setProductionForm({
      target_part_id: run.target_part_id,
      target_part_code: targetPart ? (targetPart.item_code || targetPart.name) : run.target_part_id,
      quantity_produced: run.quantity_produced,
      source_location_id: run.source_location_id,
      target_location_id: run.target_location_id,
      produced_by: getCurrentUser()?.username || 'admin',
      notes: run.notes || ''
    });
    // Duplicate the materials list so it's a new reference, mapping it correctly
    setProductionMaterials((run.materials || []).map(m => ({
      part_id: m.part_id,
      quantity_consumed: m.quantity_consumed
    })));
    setActiveTab('production');
  };

  const handleProduceFromBOM = async (bom) => {
    const qtyStr = window.prompt(`"${bom.parent_name || bom.parent_item_id}" üretilecek. Miktar girin:`, "1");
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      alert("Geçersiz miktar.");
      return;
    }

    if (!goodStockLocationId) {
      alert("Good Stock lokasyonu bulunamadı.");
      return;
    }

    if (!bom.parent_part_id) {
      alert("Hata: Üretilecek parçanın veritabanı ID'si bulunamadı.");
      return;
    }

    const materials = bom.materials.map(m => ({
      part_id: m.child_part_id,
      quantity_consumed: m.quantity * qty
    }));

    for (const m of materials) {
      if (!m.part_id) {
        alert("Hata: Hammaddelerden bazılarının veritabanı ID'si bulunamadı.");
        return;
      }
      const available = getTotalStockQty(m.part_id);
      if (m.quantity_consumed > available) {
        alert(`Yetersiz stok! Gerekli: ${m.quantity_consumed}, Mevcut: ${available}`);
        return;
      }
    }

    if (repeatLoading) return;
    setRepeatLoading(true);

    const res = await api.createProductionRun({
      target_part_id: bom.parent_part_id,
      quantity_produced: qty,
      source_location_id: goodStockLocationId,
      target_location_id: goodStockLocationId,
      materials_json: JSON.stringify(materials),
      produced_by: currentUser?.username || 'admin',
      notes: 'BOM tablosundan hızlı üretim'
    });

    if (res.success) {
      alert("Üretim başarıyla tamamlandı!");
      fetchProductionRuns();
      refreshStockStatus();
    } else {
      alert(res.message || "Üretim başarısız oldu.");
    }
    setRepeatLoading(false);
  };

  const handleFillFormFromBOM = (bom) => {
    if (!bom.parent_part_id) {
      alert("Üretilecek parça veritabanında bulunamadı.");
      return;
    }
    setProductionForm({
      target_part_id: bom.parent_part_id,
      target_part_code: bom.parent_item_id || bom.parent_name,
      quantity_produced: 1,
      source_location_id: goodStockLocationId,
      target_location_id: goodStockLocationId,
      produced_by: currentUser?.username || 'admin',
      notes: 'BOM tablosundan aktarıldı'
    });
    setProductionMaterials(bom.materials.map(m => ({
      part_id: m.child_part_id,
      quantity_consumed: m.quantity
    })));
    setActiveTab('production');
  };

  // ===================== Production Work Order handlers =====================

  const productionWorkOrders = orders.filter(o => o.work_order_type === 'PRODUCTION');
  const selectedProductionOrder = productionWorkOrders.find(o => String(o.id) === String(selectedProductionOrderId)) || null;

  const handleOpenProductionWOForm = () => {
    setProductionWOForm(EMPTY_PRODUCTION_WO_FORM);
    setShowProductionWOForm(true);
  };

  const fetchMaterialRequests = async (workOrderId) => {
    setMaterialRequestsLoading(true);
    const res = await api.getMaterialRequests(workOrderId);
    if (res.success) setMaterialRequests(res.material_requests || []);
    setMaterialRequestsLoading(false);
  };

  const handleSelectProductionOrder = (order) => {
    setSelectedProductionOrderId(order.id);
    fetchMaterialRequests(order.id);
  };

  const handleOpenIssueDialog = (mr) => {
    setIssueDialog(mr);
    setIssueQuantity(mr.remaining_quantity > 0 ? mr.remaining_quantity : 1);
  };

  const handleConfirmIssue = async (e) => {
    e.preventDefault();
    if (!issueDialog) return;
    const qty = Number(issueQuantity);
    if (!qty || qty <= 0) {
      alert('Teslim miktarı 0\'dan büyük olmalıdır.');
      return;
    }
    if (qty > issueDialog.remaining_quantity) {
      alert(`Kalan miktardan (${issueDialog.remaining_quantity}) fazla teslim edilemez.`);
      return;
    }
    setIssueSaving(true);
    const res = await api.issueMaterialRequest(issueDialog.id, qty, currentUser?.username);
    setIssueSaving(false);
    if (res.success) {
      setIssueDialog(null);
      fetchMaterialRequests(selectedProductionOrderId);
    } else {
      alert(res.message || 'Malzeme teslim edilemedi.');
    }
  };

  const handleStartProduction = async (order) => {
    if (!window.confirm('Bu iş emri için üretimi başlatmak istediğinize emin misiniz?')) return;
    setStartSaving(true);
    const res = await api.startProductionWorkOrder(order.id, currentUser?.username);
    setStartSaving(false);
    if (res.success) {
      fetchOrders();
    } else {
      alert(res.message || 'Üretim başlatılamadı.');
    }
  };

  const handleOpenCompleteDialog = (order) => {
    setCompleteDialog(order);
    setCompleteForm({
      produced_quantity: order.planned_quantity !== '' ? order.planned_quantity : '',
      scrap_quantity: 0,
      production_notes: ''
    });
  };

  const handleConfirmComplete = async (e) => {
    e.preventDefault();
    if (!completeDialog) return;
    const produced = Number(completeForm.produced_quantity);
    const scrap = Number(completeForm.scrap_quantity);
    if (completeForm.produced_quantity === '' || completeForm.scrap_quantity === '' || isNaN(produced) || isNaN(scrap) || produced < 0 || scrap < 0) {
      alert('Üretilen Adet ve Fire Adedi geçerli, negatif olmayan sayılar olmalıdır.');
      return;
    }
    setCompleteSaving(true);
    const res = await api.completeProductionWorkOrder(completeDialog.id, produced, scrap, completeForm.production_notes, currentUser?.username);
    setCompleteSaving(false);
    if (res.success) {
      setCompleteDialog(null);
      fetchOrders();
    } else {
      alert(res.message || 'Üretim tamamlanamadı.');
    }
  };

  const handleSaveProductionWorkOrder = async (e) => {
    e.preventDefault();
    if (!productionWOForm.target_part_id) {
      alert('Üretilecek yarı mamulü seçmelisiniz.');
      return;
    }
    setProductionWOSaving(true);
    const res = await api.createProductionWorkOrder(productionWOForm);
    setProductionWOSaving(false);
    if (res.success) {
      setShowProductionWOForm(false);
      setProductionWOForm(EMPTY_PRODUCTION_WO_FORM);
      await fetchOrders();
      // Oluşturulan iş emrinin Material Request listesini hemen görebilmek için
      // detay panelini otomatik aç.
      if (res.id) {
        setSelectedProductionOrderId(res.id);
        fetchMaterialRequests(res.id);
      }
    } else {
      alert(res.message || 'Üretim İş Emri oluşturulamadı.');
    }
  };

  const materialConsumption = () => {
    const map = new Map();
    productionRuns.forEach(run => {
      (run.materials || []).forEach(m => {
        const key = m.part_id;
        const prev = map.get(key) || { part_name: m.part_name, item_code: m.item_code, total: 0, runCount: 0 };
        prev.total += Number(m.quantity_consumed) || 0;
        prev.runCount += 1;
        map.set(key, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  };

  const filteredBoms = itemBoms.filter(bom => {
    const q = bomSearchQuery.toLowerCase();
    const parentMatch = bom.parent_item_id.toLowerCase().includes(q) || bom.parent_name.toLowerCase().includes(q);
    const childMatch = bom.materials.some(m => 
      m.child_item_id.toLowerCase().includes(q) || m.child_name.toLowerCase().includes(q)
    );
    return parentMatch || childMatch;
  });

  const TABS = [
    { key: 'production', label: 'Yarı Mamul Üretimi', icon: Factory },
    { key: 'recent_productions', label: 'Hızlı Tekrar Üretim', icon: Repeat },
    { key: 'consumption', label: 'Malzeme Tüketimi', icon: Package },
    { key: 'history', label: 'Üretim Geçmişi', icon: TrendingUp },
    { key: 'production_work_orders', label: 'Üretim İş Emirleri', icon: Layers }
  ];

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">

      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <ClipboardList className="text-blue-400" size={24} /> İş Emirleri
        </h1>
        <p className="text-slate-400 mt-1">Servis kayıtlarına bağlı teknisyen iş emirlerini ve üretim/malzeme takibini yönetin.</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 shrink-0 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200
              ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-white dark:bg-[#1e2330] text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a3142] border border-slate-200 dark:border-slate-700/50'}
            `}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">

        {/* --- YENİ İŞ EMRİ --- */}
        {activeTab === 'new' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
              {editingOrder ? 'İş Emrini Düzenle' : 'Yeni İş Emri'}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Servis Kaydı <span className="text-red-400">*</span></label>
                <select required className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.service_record_id} onChange={e => setFormData({...formData, service_record_id: e.target.value})}>
                  <option value="">Servis kaydı seçiniz...</option>
                  {serviceRecords.map(rec => (
                    <option key={rec.id} value={rec.id}>
                      {rec.customer_name} — {rec.brand} {rec.model} {rec.fault_category ? `(${rec.fault_category})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Açıklama</label>
                <textarea rows={2} placeholder="Bu iş emrinde yapılacak işin açıklaması..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Atanan Teknisyen</label>
                  <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.assigned_technician} onChange={e => setFormData({...formData, assigned_technician: e.target.value})}>
                    <option value="">Seçiniz...</option>
                    {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Öncelik</label>
                  <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Başlangıç Tarihi</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Bitiş Tarihi</label>
                  <input type="date" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>

              {!editingOrder && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Kaynak Depo (Kullanılan Parçalar İçin)</label>
                  <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.source_location_id} onChange={e => setFormData({...formData, source_location_id: e.target.value})} disabled>
                    {workOrderSourceLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Aşağıda eklenen parçalar, iş emri oluşturulduğunda bu depodan Repair Stock'a otomatik taşınır.</p>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Kullanılan Parçalar</label>
                  {!editingOrder && (
                    <button type="button" onClick={handleAddPartRow} className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                      <Plus size={14} /> Parça Ekle
                    </button>
                  )}
                </div>
                {!editingOrder ? (
                  // Yeni (kaydedilmemiş) iş emri: yerel taslak satırlar, kaynak depoya göre stok kontrolü yapılır.
                  partsUsed.length === 0 ? (
                    <p className="text-xs text-slate-500">Henüz parça eklenmedi.</p>
                  ) : (
                    <div className="space-y-2">
                      {partsUsed.map((row, idx) => {
                        const available = getStockQty(row.part_id, formData.source_location_id);
                        const insufficient = row.part_id && formData.source_location_id && Number(row.quantity) > available;
                        return (
                          <div key={idx}>
                            <div className="flex gap-2 items-center">
                              <select className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.part_id} onChange={e => handlePartRowChange(idx, 'part_id', e.target.value)}>
                                <option value="">Parça seçiniz...</option>
                                {parts.map(p => <option key={p.id} value={p.id}>{p.item_code} - {p.name} - {p.item_category}</option>)}
                              </select>
                              <input type="number" min="1" className="w-20 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.quantity} onChange={e => handlePartRowChange(idx, 'quantity', e.target.value)} />
                              <button type="button" onClick={() => handleRemovePartRow(idx)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>
                            {row.part_id && formData.source_location_id && (
                              <p className={`mt-1 text-xs font-medium ${insufficient ? 'text-red-500' : 'text-emerald-500'}`}>
                                Kaynak depoda mevcut: {available}{insufficient ? ' — Yetersiz!' : ''}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    {partsUsed.length > 0 && (
                      <div className="space-y-1">
                        {partsUsed.map((row, idx) => (
                          <p key={idx} className="text-xs text-slate-400">
                            {parts.find(p => String(p.id) === String(row.part_id))?.name || `Parça #${row.part_id}`} — {row.quantity} adet
                          </p>
                        ))}
                        <p className="text-xs text-slate-500 italic">Parçalar iş emri oluşturulurken rezerve edildi, buradan değiştirilemez.</p>
                      </div>
                    )}

                    {/* Kayıtlı iş emri: canlı, API destekli tedarik durumu satırları — rozet + sağ tık menüsü. */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Parça Tedarik Durumu</p>
                      {workOrderParts.length === 0 && (
                        <p className="text-xs text-slate-500">Henüz parça eklenmedi.</p>
                      )}
                      {workOrderParts.map(row => (
                        <div
                          key={row.id}
                          onContextMenu={(e) => handleOpenContextMenu(row, e)}
                          className="flex gap-2 items-center bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 cursor-context-menu"
                          title="Aksiyonlar için sağ tıklayın"
                        >
                          <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                            {row.part_name} {row.item_code ? <span className="text-slate-400">- {row.item_code}</span> : null}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 w-14 text-center">{row.quantity} ad.</div>
                          <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${SUPPLY_STATUS_STYLES[row.status] || SUPPLY_STATUS_STYLES['Stokta Var']}`}>
                            {row.status}
                          </span>
                        </div>
                      ))}

                      <div className="flex gap-2 items-center pt-1">
                        <select className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={liveNewPart.part_id} onChange={e => setLiveNewPart({ ...liveNewPart, part_id: e.target.value })}>
                          <option value="">Parça seçiniz...</option>
                          {parts.map(p => <option key={p.id} value={p.id}>{p.item_code} - {p.name} - {p.item_category}</option>)}
                        </select>
                        <input type="number" min="1" className="w-20 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={liveNewPart.quantity} onChange={e => setLiveNewPart({ ...liveNewPart, quantity: e.target.value })} />
                        <button type="button" onClick={handleAddLivePart} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Parça Ekle">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Durum</label>
                <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                {editingOrder && (
                  <button type="button" onClick={() => { setEditingOrder(null); setFormData({ ...EMPTY_FORM, source_location_id: getSystemLocationId('good_stock') }); setPartsUsed([]); }} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                )}
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {/* --- İŞ EMRİ LİSTESİ --- */}
        {activeTab === 'list' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Servis Kaydı</th>
                  <th className="px-6 py-4">Teknisyen</th>
                  <th className="px-6 py-4">Öncelik</th>
                  <th className="px-6 py-4">Tarih Aralığı</th>
                  <th className="px-6 py-4">Kullanılan Parça</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {ordersLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                  </tr>
                ) : (
                  orders.map(order => {
                    const usedParts = parsePartsUsed(order.parts_used);
                    return (
                      <tr key={order.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{order.customer_name || '-'}</div>
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
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {usedParts.length > 0 ? `${usedParts.length} kalem` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[order.status] || STATUS_STYLES['Beklemede']}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button onClick={() => handleOpenForm(order)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Düzenle">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(order.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- YARI MAMUL ÜRETİMİ --- */}
        {activeTab === 'production' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
              <Factory size={20} className="text-orange-400" /> Yarı Mamul Üretimi
            </h2>
            <p className="text-slate-400 text-sm mb-6">Hammadde/parça tüketerek yeni bir parça stoku oluşturun. Seçilen lokasyondaki hammaddeler otomatik düşülür, üretilen parçanın stoku artırılır.</p>

            <form onSubmit={handleSaveProduction} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretilen Parça Kodu/Adı <span className="text-red-400">*</span></label>
                  <input type="text" required placeholder="Parça Kodu veya Adı (Örn: P-001)" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={productionForm.target_part_code || ''} onChange={e => setProductionForm({...productionForm, target_part_code: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Miktar <span className="text-red-400">*</span></label>
                  <input type="number" required min="1" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={productionForm.quantity_produced} onChange={e => setProductionForm({...productionForm, quantity_produced: e.target.value})} />
                </div>
              </div>


              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretici / Sorumlu</label>
                  <select className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" value={productionForm.produced_by} onChange={e => setProductionForm({...productionForm, produced_by: e.target.value})}>
                    <option value="">Seçiniz...</option>
                    {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={`block text-sm font-medium ${productionMaterials.filter(r => r.part_id && Number(r.quantity_consumed) > 0).length === 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    Tüketilen Hammaddeler <span className="text-red-400">*</span>
                  </label>
                  <button type="button" onClick={handleAddMaterialRow} className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                    <Plus size={14} /> Hammadde Ekle
                  </button>
                </div>
                {productionMaterials.filter(r => r.part_id && Number(r.quantity_consumed) > 0).length === 0 && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-2">
                    <AlertTriangle size={14} className="text-red-400 shrink-0" />
                    <p className="text-xs text-red-400 font-medium">En az bir hammadde girmeniz zorunludur.</p>
                  </div>
                )}
                {productionMaterials.length === 0 ? (
                  <p className="text-xs text-slate-500">Henüz hammadde eklenmedi.</p>
                ) : (
                  <div className="space-y-2">
                    {productionMaterials.map((row, idx) => {
                      const available = getTotalStockQty(row.part_id);
                      const insufficient = row.part_id && Number(row.quantity_consumed) > available;
                      return (
                        <div key={idx}>
                          <div className="flex gap-2 items-center">
                            <select className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.part_id} onChange={e => handleMaterialRowChange(idx, 'part_id', e.target.value)}>
                              <option value="">Parça seçiniz...</option>
                              {parts.map(p => <option key={p.id} value={p.id}>{p.item_code} - {p.name} - {p.item_category}</option>)}
                            </select>
                            <input type="number" min="1" className="w-20 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-blue-500" value={row.quantity_consumed} onChange={e => handleMaterialRowChange(idx, 'quantity_consumed', e.target.value)} />
                            <button type="button" onClick={() => handleRemoveMaterialRow(idx)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                          {row.part_id && (
                            <p className={`mt-1 text-xs font-medium ${insufficient ? 'text-red-500' : 'text-emerald-500'}`}>
                              Mevcut Stok: {available}{insufficient ? ' — Yetersiz!' : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Notlar</label>
                <textarea rows={2} placeholder="İsteğe bağlı not..." className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" value={productionForm.notes} onChange={e => setProductionForm({...productionForm, notes: e.target.value})} />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                <button
                  type="submit"
                  disabled={productionMaterials.filter(r => r.part_id && Number(r.quantity_consumed) > 0).length === 0}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-900/20 flex items-center gap-2"
                >
                  <Save size={18}/> Üretimi Kaydet
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- HIZLI TEKRAR ÜRETİM --- */}
        {activeTab === 'recent_productions' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full overflow-hidden">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2 shrink-0">
              <Repeat size={20} className="text-blue-400" /> Hızlı Tekrar Üretim (BOM)
            </h3>
            <p className="text-slate-400 text-sm mb-6 shrink-0">
              Sistemdeki ürün reçeteleri (BOM) listelenmektedir. Hızlı üretim yapmak istediğiniz ürünün yanındaki "Hızlı Üret" butonuna basarak tek tıkla üretim gerçekleştirebilir veya "Forma Aktar" seçeneğiyle parametreleri forma doldurabilirsiniz.
            </p>
            
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <input
                type="text"
                placeholder="Üretilecek parça veya hammadde adına/koduna göre ara..."
                className="flex-1 bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                value={bomSearchQuery}
                onChange={e => setBomSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-700/50 rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Üretilecek Parça Kodu</th>
                    <th className="px-6 py-4">Üretilecek Parça Adı</th>
                    <th className="px-6 py-4">Tüketilen Parça 1</th>
                    <th className="px-6 py-4 w-28">Miktar 1</th>
                    <th className="px-6 py-4">Tüketilen Parça 2</th>
                    <th className="px-6 py-4 w-28">Miktar 2</th>
                    <th className="px-6 py-4 text-center w-48">Aksiyonlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {bomsLoading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                    </tr>
                  ) : filteredBoms.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Reçete kaydı bulunamadı.</td>
                    </tr>
                  ) : (
                    filteredBoms.map((bom, index) => {
                      const mat1 = bom.materials[0];
                      const mat2 = bom.materials[1];
                      return (
                        <tr key={index} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                          <td className="px-6 py-4 font-mono font-semibold text-blue-500 dark:text-blue-400">{bom.parent_item_id}</td>
                          <td className="px-6 py-4 text-xs max-w-xs truncate" title={bom.parent_name}>{bom.parent_name}</td>
                          <td className="px-6 py-4">
                            {mat1 ? (
                              <div>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{mat1.child_item_id}</span>
                                <div className="text-[10px] text-slate-400 truncate max-w-xs" title={mat1.child_name}>{mat1.child_name}</div>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 font-mono">{mat1 ? mat1.quantity : '-'}</td>
                          <td className="px-6 py-4">
                            {mat2 ? (
                              <div>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{mat2.child_item_id}</span>
                                <div className="text-[10px] text-slate-400 truncate max-w-xs" title={mat2.child_name}>{mat2.child_name}</div>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 font-mono">{mat2 ? mat2.quantity : '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                type="button"
                                onClick={() => handleFillFormFromBOM(bom)}
                                className="px-2.5 py-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Forma Aktar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleProduceFromBOM(bom)}
                                className="px-2.5 py-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Hızlı Üret
                              </button>
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
        )}

        {/* --- MALZEME TÜKETİMİ --- */}
        {activeTab === 'consumption' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package size={20} className="text-purple-400" /> Malzeme Tüketimi
              </h2>
              <p className="text-slate-400 text-sm mt-1">Üretimde tüketilen malzemelerin toplu raporu (tüm üretim kayıtlarından derlenir).</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Parça</th>
                  <th className="px-6 py-4">Ürün Kodu</th>
                  <th className="px-6 py-4">Toplam Tüketilen Miktar</th>
                  <th className="px-6 py-4">Kaç Üretimde Kullanıldı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {productionLoading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : materialConsumption().length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Henüz malzeme tüketimi yok.</td>
                  </tr>
                ) : (
                  materialConsumption().map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{m.part_name || '-'}</td>
                      <td className="px-6 py-4 font-mono text-slate-400">{m.item_code}</td>
                      <td className="px-6 py-4 font-mono">{m.total}</td>
                      <td className="px-6 py-4 text-slate-400">{m.runCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- ÜRETİM GEÇMİŞİ --- */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="p-6 pb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-400" /> Üretim Geçmişi
              </h2>
              <p className="text-slate-400 text-sm mt-1">Geçmişte yapılan tüm yarı mamul üretim kayıtları.</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Üretilen Parça</th>
                  <th className="px-6 py-4">Miktar</th>
                  <th className="px-6 py-4">Kaynak Lokasyon</th>
                  <th className="px-6 py-4">Hedef Lokasyon</th>
                  <th className="px-6 py-4">Tüketilen Malzemeler</th>
                  <th className="px-6 py-4">Üretici</th>
                  <th className="px-6 py-4">Tarih</th>
                  <th className="px-6 py-4 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {productionLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : productionRuns.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                  </tr>
                ) : (
                  productionRuns.map(run => (
                    <tr key={run.id} className="hover:bg-slate-100 dark:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {run.target_part_name || '-'} {parts.find(p => p.id == run.target_part_id)?.part_category ? `(${parts.find(p => p.id == run.target_part_id).part_category})` : ''}
                        </div>
                        <div className="text-xs text-slate-400">{run.target_item_code}</div>
                      </td>
                      <td className="px-6 py-4 font-mono">{run.quantity_produced}</td>
                      <td className="px-6 py-4">{run.source_location_name || '-'}</td>
                      <td className="px-6 py-4">{run.location_name || '-'}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {(run.materials || []).length > 0
                          ? run.materials.map(m => `${m.part_name} (${m.quantity_consumed})`).join(', ')
                          : '-'}
                      </td>
                      <td className="px-6 py-4">{run.produced_by || '-'}</td>
                      <td className="px-6 py-4 text-slate-400">{run.created_at}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleRepeatProduction(run)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="İşlemi Tekrarla">
                            <Repeat size={16} />
                          </button>
                          <button onClick={() => handleDeleteProduction(run.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- PRODUCTION WORK ORDER --- */}
        {activeTab === 'production_work_orders' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Layers size={20} className="text-teal-400" /> Üretim İş Emirleri
                </h2>
                <p className="text-slate-400 text-sm mt-1">Bir reçeteye bağlı yarı mamul üretim iş emirleri. Servis kaydı gerektirmez.</p>
              </div>
              <button
                onClick={handleOpenProductionWOForm}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-900/20 flex items-center gap-2"
              >
                <Plus size={18} /> Yeni Üretim İş Emri
              </button>
            </div>

            {showProductionWOForm && (
              <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Yeni Üretim İş Emri</h3>
                  <button onClick={() => setShowProductionWOForm(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2a3142] rounded-lg transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSaveProductionWorkOrder} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretilecek Yarı Mamul <span className="text-red-400">*</span></label>
                    <select
                      required
                      className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
                      value={productionWOForm.target_part_id}
                      onChange={e => setProductionWOForm({ ...productionWOForm, target_part_id: e.target.value })}
                    >
                      <option value="">Parça seçiniz...</option>
                      {/* Sadece warehouse.item_bom'da bir Recipe'si (parent_item_id) olan parçalar listelenir;
                          aksi halde backend "Recipe bulunamadı" hatası veriyordu (bkz. create_production_work_order). */}
                      {itemBoms.filter(bom => bom.parent_part_id).map(bom => (
                        <option key={bom.parent_part_id} value={bom.parent_part_id}>{bom.parent_item_id} - {bom.parent_name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Yalnızca tanımlı bir reçetesi olan parçalar listelenir.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Açıklama</label>
                    <textarea
                      rows={2}
                      placeholder="Bu üretim iş emrinin açıklaması..."
                      className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 resize-none"
                      value={productionWOForm.description}
                      onChange={e => setProductionWOForm({ ...productionWOForm, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Öncelik</label>
                      <select
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
                        value={productionWOForm.priority}
                        onChange={e => setProductionWOForm({ ...productionWOForm, priority: e.target.value })}
                      >
                        {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Planlanan Üretim Adedi</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
                        value={productionWOForm.planned_quantity}
                        onChange={e => setProductionWOForm({ ...productionWOForm, planned_quantity: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Atanan Teknisyen</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
                      value={productionWOForm.assigned_technician}
                      onChange={e => setProductionWOForm({ ...productionWOForm, assigned_technician: e.target.value })}
                    >
                      <option value="">Seçiniz...</option>
                      {users.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                    <button type="button" onClick={() => setShowProductionWOForm(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                    <button type="submit" disabled={productionWOSaving} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-900/20 flex items-center gap-2">
                      <Save size={18} /> Kaydet
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">İş Emri No</th>
                    <th className="px-6 py-4">Üretilecek Parça</th>
                    <th className="px-6 py-4">Planlanan Adet</th>
                    <th className="px-6 py-4">Öncelik</th>
                    <th className="px-6 py-4">Durum</th>
                    <th className="px-6 py-4">Oluşturma Tarihi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {ordersLoading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                    </tr>
                  ) : productionWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Henüz Üretim İş Emri oluşturulmadı.</td>
                    </tr>
                  ) : (
                    productionWorkOrders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => handleSelectProductionOrder(order)}
                        className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors text-slate-700 dark:text-slate-300 ${String(selectedProductionOrder?.id) === String(order.id) ? 'bg-slate-100 dark:bg-[#2a3142]' : ''}`}
                        title="Malzeme taleplerini görmek için tıklayın"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-slate-800 dark:text-slate-200">#{order.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{order.target_part_name || '-'}</div>
                          <div className="text-xs text-slate-400">{order.target_part_code}</div>
                        </td>
                        <td className="px-6 py-4 font-mono">{order.planned_quantity !== '' ? order.planned_quantity : '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${PRIORITY_STYLES[order.priority] || PRIORITY_STYLES['Orta']}`}>
                            {order.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${PRODUCTION_WO_STATUS_STYLES[order.status] || PRODUCTION_WO_STATUS_STYLES['BEKLIYOR']}`}>
                            {PRODUCTION_WO_STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">{order.created_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* --- PRODUCTION WORK ORDER DETAY --- */}
            {selectedProductionOrder && (
              <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="flex justify-between items-center p-6 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Layers size={20} className="text-teal-400" /> İş Emri #{selectedProductionOrder.id} — {selectedProductionOrder.target_part_name || '-'}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{selectedProductionOrder.target_part_code}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedProductionOrder.status === 'BEKLIYOR' && (
                      <button
                        onClick={() => handleStartProduction(selectedProductionOrder)}
                        disabled={startSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
                      >
                        Üretimi Başlat
                      </button>
                    )}
                    {selectedProductionOrder.status === 'URETIMDE' && (
                      <button
                        onClick={() => handleOpenCompleteDialog(selectedProductionOrder)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-emerald-900/20"
                      >
                        Tamamla
                      </button>
                    )}
                    <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${PRODUCTION_WO_STATUS_STYLES[selectedProductionOrder.status] || PRODUCTION_WO_STATUS_STYLES['BEKLIYOR']}`}>
                      {PRODUCTION_WO_STATUS_LABELS[selectedProductionOrder.status] || selectedProductionOrder.status}
                    </span>
                    <button onClick={() => setSelectedProductionOrderId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2a3142] rounded-lg transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-6">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Teknisyen</div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedProductionOrder.assigned_technician || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Başlama Zamanı</div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedProductionOrder.started_at || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Bitiş Zamanı</div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedProductionOrder.completed_at || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Planlanan</div>
                    <div className="text-sm font-medium font-mono text-slate-800 dark:text-slate-200">{selectedProductionOrder.planned_quantity !== '' ? selectedProductionOrder.planned_quantity : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Üretilen</div>
                    <div className="text-sm font-medium font-mono text-slate-800 dark:text-slate-200">{selectedProductionOrder.produced_quantity !== '' ? selectedProductionOrder.produced_quantity : '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Fire</div>
                    <div className="text-sm font-medium font-mono text-slate-800 dark:text-slate-200">{selectedProductionOrder.scrap_quantity !== '' ? selectedProductionOrder.scrap_quantity : '-'}</div>
                  </div>
                  <div className="col-span-2 md:col-span-4">
                    <div className="text-xs text-slate-400 mb-1">Üretim Notu</div>
                    <div className="text-sm text-slate-800 dark:text-slate-200">{selectedProductionOrder.production_notes || '-'}</div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-2 px-6 py-4">
                  <Package size={18} className="text-teal-400" />
                  <h4 className="font-bold text-slate-800 dark:text-slate-100">Malzeme Talepleri</h4>
                  <span className="text-xs text-slate-400">(bu iş emrinin reçetesinden otomatik oluşturulan, salt okunur)</span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-6 py-4">Parça</th>
                      <th className="px-6 py-4">Gerekli</th>
                      <th className="px-6 py-4">Verilen</th>
                      <th className="px-6 py-4">Kalan</th>
                      <th className="px-6 py-4">Durum</th>
                      <th className="px-6 py-4 text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {materialRequestsLoading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-slate-400">Yükleniyor...</td>
                      </tr>
                    ) : materialRequests.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Malzeme talebi bulunamadı.</td>
                      </tr>
                    ) : (
                      materialRequests.map(mr => (
                        <tr key={mr.id} className="text-slate-700 dark:text-slate-300">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200">{mr.part_name || '-'}</div>
                            <div className="text-xs text-slate-400">{mr.item_code}</div>
                          </td>
                          <td className="px-6 py-4 font-mono">{mr.required_quantity}</td>
                          <td className="px-6 py-4 font-mono">{mr.issued_quantity}</td>
                          <td className="px-6 py-4 font-mono">{mr.remaining_quantity}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border ${MATERIAL_REQUEST_STATUS_STYLES[mr.status] || MATERIAL_REQUEST_STATUS_STYLES['WAITING']}`}>
                              {MATERIAL_REQUEST_STATUS_LABELS[mr.status] || mr.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {mr.remaining_quantity > 0 ? (
                              <button
                                onClick={() => handleOpenIssueDialog(mr)}
                                className="px-2.5 py-1.5 bg-teal-500/10 text-teal-500 hover:bg-teal-500 hover:text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Teslim Et
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <PartSupplyMenu
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        currentStatus={contextMenu?.status}
        onDeliver={() => {
          const row = workOrderParts.find(p => p.id === contextMenu.wopId);
          if (row) handleOpenDeliverPopover(row);
        }}
        onMarkWaiting={() => {
          const row = workOrderParts.find(p => p.id === contextMenu.wopId);
          if (row) handleMarkWaiting(row);
        }}
        onRevert={() => {
          const row = workOrderParts.find(p => p.id === contextMenu.wopId);
          if (row) handleRevertPart(row);
        }}
        onRemove={() => {
          const row = workOrderParts.find(p => p.id === contextMenu.wopId);
          if (row) handleRemoveLivePart(row);
        }}
        onClose={() => setContextMenu(null)}
      />

      <DeliverPartPopover
        isOpen={!!deliverPopover}
        position={deliverPopover ? { x: deliverPopover.x, y: deliverPopover.y } : null}
        partName={deliverPopover?.partName}
        quantity={deliverPopover?.quantity}
        locations={
          deliverPopover
            ? stockStatus
                .filter(s => String(s.part_id) === String(deliverPopover.partId) && s.quantity > 0)
                .map(s => ({ id: s.location_id, name: s.location_name, quantity: s.quantity }))
            : []
        }
        onConfirm={handleConfirmDeliver}
        onClose={() => setDeliverPopover(null)}
      />

      {/* --- MATERIAL ISSUE DIALOG (Production Work Order Material Request teslimi) --- */}
      {issueDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIssueDialog(null)}>
          <div
            className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Malzeme Teslim Et</h3>
              <button onClick={() => setIssueDialog(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2a3142] rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {issueDialog.part_name} {issueDialog.item_code ? <span className="text-slate-400">({issueDialog.item_code})</span> : null}
            </p>
            <form onSubmit={handleConfirmIssue} className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-[#242a38] rounded-xl py-2.5">
                  <div className="text-xs text-slate-400 mb-1">Gerekli</div>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{issueDialog.required_quantity}</div>
                </div>
                <div className="bg-slate-50 dark:bg-[#242a38] rounded-xl py-2.5">
                  <div className="text-xs text-slate-400 mb-1">Verilen</div>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{issueDialog.issued_quantity}</div>
                </div>
                <div className="bg-slate-50 dark:bg-[#242a38] rounded-xl py-2.5">
                  <div className="text-xs text-slate-400 mb-1">Kalan</div>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{issueDialog.remaining_quantity}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Bu Sefer Verilecek Miktar</label>
                <input
                  type="number"
                  autoFocus
                  min="1"
                  max={issueDialog.remaining_quantity}
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
                  value={issueQuantity}
                  onChange={e => setIssueQuantity(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIssueDialog(null)} className="px-4 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" disabled={issueSaving} className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl font-medium transition-colors shadow-lg shadow-teal-900/20 flex items-center gap-2">
                  <Save size={16} /> Teslim Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ÜRETİMİ TAMAMLA DIALOG (Production Work Order) --- */}
      {completeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCompleteDialog(null)}>
          <div
            className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Üretimi Tamamla</h3>
              <button onClick={() => setCompleteDialog(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2a3142] rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              İş Emri #{completeDialog.id} — {completeDialog.target_part_name}
            </p>
            <form onSubmit={handleConfirmComplete} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Planlanan Üretim</label>
                <input
                  type="number"
                  readOnly
                  disabled
                  className="w-full bg-slate-100 dark:bg-[#2a3142] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  value={completeDialog.planned_quantity !== '' ? completeDialog.planned_quantity : ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretilen Adet</label>
                  <input
                    type="number"
                    autoFocus
                    min="0"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                    value={completeForm.produced_quantity}
                    onChange={e => setCompleteForm({ ...completeForm, produced_quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Fire Adedi</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                    value={completeForm.scrap_quantity}
                    onChange={e => setCompleteForm({ ...completeForm, scrap_quantity: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Üretim Notu</label>
                <textarea
                  rows={2}
                  placeholder="İsteğe bağlı not..."
                  className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
                  value={completeForm.production_notes}
                  onChange={e => setCompleteForm({ ...completeForm, production_notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCompleteDialog(null)} className="px-4 py-2.5 bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" disabled={completeSaving} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-medium transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
                  <Save size={16} /> Tamamla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
