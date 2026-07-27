import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Link2, Save, Search, X, Maximize2, ZoomIn, ZoomOut,
  Database, Code, ArrowRight, Trash2, Info, CheckCircle, Table2
} from 'lucide-react';
import useCanvasPanZoom from '../hooks/useCanvasPanZoom';
import TableNode, { getPortPosition } from '../components/schema/TableNode';
import BezierEdge from '../components/schema/BezierEdge';

// ═══════════════════════════════════════════════════════════════════
// SEED DATA — Remalab V5 Default Tables
// ═══════════════════════════════════════════════════════════════════
const SEED_TABLES = [
  {
    id: 'tbl_service_statu',
    dbName: 'ServiceStatu',
    feName: 'ServiceStatus',
    x: 80,
    y: 60,
    fields: [
      { id: 'ss_id', dbName: 'id', feName: 'id', type: 'int', isPK: true, isFK: false, fkRef: null },
      { id: 'ss_code', dbName: 'code', feName: 'code', type: 'int', isPK: false, isFK: false, fkRef: null },
      { id: 'ss_name', dbName: 'name', feName: 'name', type: 'string', isPK: false, isFK: false, fkRef: null },
      { id: 'ss_desc', dbName: 'description', feName: 'description', type: 'string', isPK: false, isFK: false, fkRef: null },
      { id: 'ss_active', dbName: 'isActive', feName: 'isActive', type: 'boolean', isPK: false, isFK: false, fkRef: null },
    ],
  },
  {
    id: 'tbl_service_statu_map',
    dbName: 'ServiceStatuMap',
    feName: 'StatusTransitions',
    x: 480,
    y: 40,
    fields: [
      { id: 'ssm_id', dbName: 'id', feName: 'id', type: 'int', isPK: true, isFK: false, fkRef: null },
      { id: 'ssm_parent', dbName: 'parentStatu', feName: 'fromStatus', type: 'relation', isPK: false, isFK: true, fkRef: { tableId: 'tbl_service_statu', fieldId: 'ss_code' } },
      { id: 'ssm_child', dbName: 'childStatu', feName: 'toStatus', type: 'int', isPK: false, isFK: false, fkRef: null },
      { id: 'ssm_req', dbName: 'requestType', feName: 'requestType', type: 'string', isPK: false, isFK: false, fkRef: null },
      { id: 'ssm_test', dbName: 'testResult', feName: 'testResult', type: 'string', isPK: false, isFK: false, fkRef: null },
    ],
  },
  {
    id: 'tbl_item_category',
    dbName: 'ItemCategory',
    feName: 'PartCategories',
    x: 80,
    y: 320,
    fields: [
      { id: 'ic_id', dbName: 'id', feName: 'id', type: 'int', isPK: true, isFK: false, fkRef: null },
      { id: 'ic_code', dbName: 'code', feName: 'code', type: 'string', isPK: false, isFK: false, fkRef: null },
      { id: 'ic_name', dbName: 'shortName', feName: 'label', type: 'string', isPK: false, isFK: false, fkRef: null },
      { id: 'ic_mission', dbName: 'mission', feName: 'missionCode', type: 'relation', isPK: false, isFK: true, fkRef: { tableId: 'tbl_mission_workgroup', fieldId: 'mw_code' } },
      { id: 'ic_type', dbName: 'itemType', feName: 'itemType', type: 'string', isPK: false, isFK: false, fkRef: null },
    ],
  },
  {
    id: 'tbl_mission_workgroup',
    dbName: 'MissionWorkgroup',
    feName: 'Workgroups',
    x: 480,
    y: 340,
    fields: [
      { id: 'mw_id', dbName: 'id', feName: 'id', type: 'int', isPK: true, isFK: false, fkRef: null },
      { id: 'mw_code', dbName: 'code', feName: 'code', type: 'string', isPK: false, isFK: false, fkRef: null },
      { id: 'mw_name', dbName: 'name', feName: 'name', type: 'string', isPK: false, isFK: false, fkRef: null },
      { id: 'mw_desc', dbName: 'description', feName: 'description', type: 'string', isPK: false, isFK: false, fkRef: null },
    ],
  },
];

const SEED_EDGES = [
  {
    id: 'edge_ssm_ss',
    sourceTableId: 'tbl_service_statu_map',
    sourceFieldId: 'ssm_parent',
    targetTableId: 'tbl_service_statu',
    targetFieldId: 'ss_code',
    relationType: 'many-to-one',
  },
  {
    id: 'edge_ic_mw',
    sourceTableId: 'tbl_item_category',
    sourceFieldId: 'ic_mission',
    targetTableId: 'tbl_mission_workgroup',
    targetFieldId: 'mw_code',
    relationType: 'many-to-one',
  },
];

// ── Mock value generator for Live DTO Preview ───────────────
function mockValue(type, feName, index = 1) {
  switch (type) {
    case 'int': return index;
    case 'boolean': return true;
    case 'timestamp': return '2025-07-27T09:00:00Z';
    case 'relation': return index;
    default: return feName.charAt(0).toUpperCase() + feName.slice(1) + ' Örneği';
  }
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION TOAST
// ═══════════════════════════════════════════════════════════════════
const Toast = ({ notif, onClose }) => {
  if (!notif) return null;
  const styles = {
    success: 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    info: 'border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300',
    warning: 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300',
  };
  return (
    <div className={`fixed top-5 right-5 z-[110] max-w-sm border rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-3 ${styles[notif.type] || styles.info}`}>
      <CheckCircle size={18} />
      <span className="text-sm font-semibold">{notif.message}</span>
      <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"><X size={14} /></button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ADD TABLE MODAL
// ═══════════════════════════════════════════════════════════════════
const AddTableModal = ({ onClose, onAdd }) => {
  const [dbName, setDbName] = useState('');
  const [feName, setFeName] = useState('');
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full mx-4 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between bg-slate-50 dark:bg-[#242a38]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Plus size={20} className="text-blue-500" /></div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Yeni Tablo Ekle</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">DB Tablo Adı *</label>
            <input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="Örn: ProductModel" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">FE Alias (Opsiyonel)</label>
            <input value={feName} onChange={e => setFeName(e.target.value)} placeholder="Otomatik: DB adı kullanılır" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">İptal</button>
          <button disabled={!dbName.trim()} onClick={() => { onAdd(dbName.trim(), feName.trim() || dbName.trim()); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">Ekle</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function SchemaMapper() {
  // ── Core State ────────────────────────────────────────────
  const [tables, setTables] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState(null); // { tableId, fieldId }
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [notif, setNotif] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const canvasRef = useRef(null);
  const { cssTransform, onWheel, onPanStart, onPanMove, onPanEnd, transform, setTransform, resetView, centerView } = useCanvasPanZoom();

  // ── Drag State ────────────────────────────────────────────
  const dragRef = useRef({ isDragging: false, tableId: null, startX: 0, startY: 0, origX: 0, origY: 0 });

  const showNotif = useCallback((msg, type = 'success') => {
    setNotif({ message: msg, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  // ── Initial Fetch & Auto-Fit ──────────────────────────────
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        setIsLoading(true);
        if (window.webBridge && window.webBridge.get_schema_introspection) {
          const res = await window.webBridge.get_schema_introspection();
          const parsed = JSON.parse(res);
          if (parsed && parsed.tables && parsed.tables.length > 0) {
            setTables(parsed.tables);
            setEdges(parsed.edges || []);
            showNotif('Veritabanı şeması başarıyla yüklendi.');
            return;
          }
        }
        // Throw to trigger catch fallback if no valid data
        throw new Error("Boş veri veya API yok");
      } catch (error) {
        console.error("[SchemaMapper] API Fetch Error:", error);
        // Fallback Seed Data
        setTables(SEED_TABLES);
        setEdges(SEED_EDGES);
        showNotif('Veritabanı şeması okunamadı. Varsayılan Şema (Seed Data) yüklendi.', 'warning');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchema();
  }, [showNotif]);

  // Center view on initial load or table change (when not dragging)
  useEffect(() => {
    if (!isLoading && canvasRef.current && tables.length > 0) {
      // PRO-TIP ZAMANLAMA KORUMASI: DOM mount ve render için bekle
      const timer = setTimeout(() => {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          centerView(tables, rect);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoading, centerView]); // Only run once when loaded

  // ── Table Drag ────────────────────────────────────────────
  const handleDragStart = useCallback((tableId, e) => {
    const t = tables.find(t => t.id === tableId);
    if (!t) return;
    dragRef.current = {
      isDragging: true,
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
    };
  }, [tables]);

  const handleCanvasMouseMove = useCallback((e) => {
    onPanMove(e);
    if (!dragRef.current.isDragging) return;
    const { tableId, startX, startY, origX, origY } = dragRef.current;
    const scale = transform.scale;
    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, x: origX + dx, y: origY + dy } : t));
  }, [onPanMove, transform.scale]);

  const handleCanvasMouseUp = useCallback((e) => {
    onPanEnd(e);
    dragRef.current.isDragging = false;
  }, [onPanEnd]);

  // ── Selection ─────────────────────────────────────────────
  const handleSelectTable = useCallback((id) => {
    setSelectedTableId(id);
    setSelectedEdgeId(null);
    setInspectorOpen(true);
  }, []);

  const handleSelectEdge = useCallback((id) => {
    setSelectedEdgeId(id);
    setSelectedTableId(null);
    setInspectorOpen(true);
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedTableId(null);
    setSelectedEdgeId(null);
    if (connectMode && connectSource) {
      setConnectSource(null); // Cancel partial connection
    }
  }, [connectMode, connectSource]);

  // ── FE Name Changes ───────────────────────────────────────
  const handleTableFeNameChange = useCallback((tableId, newName) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, feName: newName } : t));
  }, []);

  const handleFieldFeNameChange = useCallback((tableId, fieldId, newName) => {
    setTables(prev => prev.map(t => t.id === tableId ? {
      ...t, fields: t.fields.map(f => f.id === fieldId ? { ...f, feName: newName } : f)
    } : t));
  }, []);

  // ── Connect Mode (Click & Connect) ────────────────────────
  const handleFieldClick = useCallback((tableId, fieldId) => {
    if (!connectMode) return;
    if (!connectSource) {
      setConnectSource({ tableId, fieldId });
      showNotif('Kaynak alan seçildi. Şimdi hedef alanı tıklayınız.', 'info');
    } else {
      if (connectSource.tableId === tableId) {
        showNotif('Aynı tablo içinde bağlantı kurulamaz!', 'warning');
        return;
      }
      // Create edge
      const newEdge = {
        id: `edge_${Date.now()}`,
        sourceTableId: connectSource.tableId,
        sourceFieldId: connectSource.fieldId,
        targetTableId: tableId,
        targetFieldId: fieldId,
        relationType: 'many-to-one',
      };
      setEdges(prev => [...prev, newEdge]);
      // Mark source field as FK
      setTables(prev => prev.map(t => t.id === connectSource.tableId ? {
        ...t, fields: t.fields.map(f => f.id === connectSource.fieldId ? {
          ...f, isFK: true, type: 'relation', fkRef: { tableId, fieldId }
        } : f)
      } : t));
      setConnectSource(null);
      setConnectMode(false);
      showNotif('Bağlantı başarıyla oluşturuldu!');
    }
  }, [connectMode, connectSource, showNotif]);

  // ── Add Table ─────────────────────────────────────────────
  const handleAddTable = useCallback((dbName, feName) => {
    const newTable = {
      id: `tbl_${Date.now()}`,
      dbName,
      feName,
      x: 200 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      fields: [
        { id: `f_${Date.now()}_pk`, dbName: 'id', feName: 'id', type: 'int', isPK: true, isFK: false, fkRef: null },
        { id: `f_${Date.now()}_name`, dbName: 'name', feName: 'name', type: 'string', isPK: false, isFK: false, fkRef: null },
        { id: `f_${Date.now()}_created`, dbName: 'createdAt', feName: 'createdAt', type: 'timestamp', isPK: false, isFK: false, fkRef: null },
      ],
    };
    setTables(prev => [...prev, newTable]);
    showNotif(`"${dbName}" tablosu eklendi.`);
  }, [showNotif]);

  // ── Delete Edge ───────────────────────────────────────────
  const handleDeleteEdge = useCallback((edgeId) => {
    const edge = edges.find(e => e.id === edgeId);
    if (edge) {
      // Remove FK flag from source field
      setTables(prev => prev.map(t => t.id === edge.sourceTableId ? {
        ...t, fields: t.fields.map(f => f.id === edge.sourceFieldId ? { ...f, isFK: false, type: 'int', fkRef: null } : f)
      } : t));
    }
    setEdges(prev => prev.filter(e => e.id !== edgeId));
    setSelectedEdgeId(null);
    showNotif('Bağlantı silindi.');
  }, [edges, showNotif]);

  // ── Save Mapping ──────────────────────────────────────────
  const handleSaveMapping = useCallback(() => {
    const mapping = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      tables: tables.map(t => ({
        dbName: t.dbName,
        feName: t.feName,
        fields: t.fields.map(f => ({
          dbName: f.dbName,
          feName: f.feName,
          type: f.type,
          isPK: f.isPK,
          isFK: f.isFK,
          fkRef: f.fkRef,
        })),
      })),
      edges: edges.map(e => ({
        source: `${tables.find(t => t.id === e.sourceTableId)?.dbName}.${tables.find(t => t.id === e.sourceTableId)?.fields.find(f => f.id === e.sourceFieldId)?.dbName}`,
        target: `${tables.find(t => t.id === e.targetTableId)?.dbName}.${tables.find(t => t.id === e.targetTableId)?.fields.find(f => f.id === e.targetFieldId)?.dbName}`,
        relationType: e.relationType,
      })),
    };
    console.log('[SchemaMapper] schema_map.json:', JSON.stringify(mapping, null, 2));
    showNotif('Eşleşme kaydedildi! (Konsola basıldı)');
  }, [tables, edges, showNotif]);

  // ── Search / Filter ───────────────────────────────────────
  const handleSearchFocus = useCallback((tableId) => {
    const t = tables.find(t => t.id === tableId);
    if (!t || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setTransform({
      x: rect.width / 2 - t.x * 1.2,
      y: rect.height / 2 - t.y * 1.2,
      scale: 1.2,
    });
    setSelectedTableId(tableId);
    setInspectorOpen(true);
    setSearchTerm('');
  }, [tables, setTransform]);

  const filteredSearch = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return tables.filter(t => t.dbName.toLowerCase().includes(term) || t.feName.toLowerCase().includes(term));
  }, [tables, searchTerm]);

  // ── Zoom Helpers ──────────────────────────────────────────
  const zoomIn = useCallback(() => setTransform(p => ({ ...p, scale: Math.min(p.scale * 1.2, 3) })), [setTransform]);
  const zoomOut = useCallback(() => setTransform(p => ({ ...p, scale: Math.max(p.scale * 0.8, 0.15) })), [setTransform]);

  // ── Computed: Edge positions ──────────────────────────────
  const edgePositions = useMemo(() => {
    return edges.map(edge => {
      const sourceTable = tables.find(t => t.id === edge.sourceTableId);
      const targetTable = tables.find(t => t.id === edge.targetTableId);
      if (!sourceTable || !targetTable) return null;

      const sp = getPortPosition(sourceTable, edge.sourceFieldId, 'right');
      const tp = getPortPosition(targetTable, edge.targetFieldId, 'left');
      return { ...edge, sourceX: sp.x, sourceY: sp.y, targetX: tp.x, targetY: tp.y };
    }).filter(Boolean);
  }, [edges, tables]);

  // ── Selected Table for Inspector ──────────────────────────
  const selectedTable = useMemo(() => tables.find(t => t.id === selectedTableId), [tables, selectedTableId]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId), [edges, selectedEdgeId]);

  // ── Live DTO Preview JSON ─────────────────────────────────
  const dtoPreview = useMemo(() => {
    if (!selectedTable) return null;
    const obj = {};
    selectedTable.fields.forEach((f, i) => {
      obj[f.feName] = mockValue(f.type, f.feName, i + 1);
    });
    return JSON.stringify(obj, null, 2);
  }, [selectedTable]);

  return (
    <div className="flex flex-col h-full">
      <Toast notif={notif} onClose={() => setNotif(null)} />
      {showAddModal && <AddTableModal onClose={() => setShowAddModal(false)} onAdd={handleAddTable} />}

      {/* ═══════════════════════════════════════════════════════
           TOOLBAR
         ═══════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#161B22] border-b border-slate-200 dark:border-[#30363D] px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap shrink-0 z-20">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mr-2">
            <Database size={16} className="text-blue-500" />
            Schema Mapper
          </h2>

          <button onClick={() => setShowAddModal(true)} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors">
            <Plus size={14} /> Yeni Tablo
          </button>
          <button onClick={() => { setConnectMode(!connectMode); setConnectSource(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border ${connectMode ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-[#1e2330] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-300'}`}>
            <Link2 size={14} /> {connectMode ? 'Bağlama: AÇIK' : 'İlişki Bağla'}
          </button>
          <button onClick={handleSaveMapping} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors">
            <Save size={14} /> Kaydet
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tablo ara..." className="pl-8 pr-3 py-1.5 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f1219] text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            {filteredSearch.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-60 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
                {filteredSearch.map(t => (
                  <button key={t.id} onClick={() => handleSearchFocus(t.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left">
                    <Table2 size={13} className="text-slate-400 shrink-0" />
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{t.dbName}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-blue-500 font-semibold">{t.feName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button onClick={zoomOut} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><ZoomOut size={14} /></button>
            <span className="text-[10px] font-bold text-slate-500 w-10 text-center">{Math.round(transform.scale * 100)}%</span>
            <button onClick={zoomIn} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><ZoomIn size={14} /></button>
            <button onClick={resetView} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors border-l border-slate-200 dark:border-slate-700"><Maximize2 size={14} /></button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
           MAIN AREA: Canvas + Inspector
         ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-slate-100/50 dark:bg-[#0f1219]/50 backdrop-blur-sm flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}

        {!isLoading && tables.length === 0 && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="bg-white dark:bg-[#1e2330] p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md text-center pointer-events-auto">
              <Database size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Veritabanı Şeması Bulunamadı</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Herhangi bir tablo veya ilişki verisi okunamadı. Yeni bir tablo ekleyerek başlayabilirsiniz.</p>
              <button onClick={() => setShowAddModal(true)} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20">
                <Plus size={16} className="inline mr-2" /> Yeni Tablo Ekle
              </button>
            </div>
          </div>
        )}

        {/* ── CANVAS ──────────────────────────────────────── */}
        <div
          ref={canvasRef}
          className={`flex-1 relative overflow-hidden ${connectMode ? 'cursor-crosshair' : 'cursor-default'}`}
          style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          onWheel={onWheel}
          onMouseDown={(e) => { onPanStart(e); handleCanvasClick(); }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          {/* Connect Mode Indicator */}
          {connectMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-rose-500/90 text-white text-xs font-bold shadow-lg flex items-center gap-2 backdrop-blur">
              <Link2 size={14} />
              {connectSource ? 'Hedef alanı tıklayınız...' : 'Kaynak alanı tıklayınız...'}
              <button onClick={() => { setConnectMode(false); setConnectSource(null); }} className="ml-2 p-0.5 rounded hover:bg-white/20"><X size={12} /></button>
            </div>
          )}

          {/* Transformable Layer */}
          <div
            className="absolute top-0 left-0 origin-top-left will-change-transform"
            style={{ transform: cssTransform }}
          >
            {/* SVG Layer for Edges */}
            <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: 4000, height: 4000, overflow: 'visible' }}>
              <g className="pointer-events-auto">
                {edgePositions.map(ep => (
                  <BezierEdge
                    key={ep.id}
                    edgeId={ep.id}
                    sourceX={ep.sourceX}
                    sourceY={ep.sourceY}
                    targetX={ep.targetX}
                    targetY={ep.targetY}
                    isSelected={ep.id === selectedEdgeId}
                    label={ep.relationType === 'many-to-one' ? 'N:1' : '1:N'}
                    onSelect={handleSelectEdge}
                  />
                ))}
              </g>
            </svg>

            {/* Table Nodes */}
            {tables.map(table => (
              <TableNode
                key={table.id}
                table={table}
                isSelected={table.id === selectedTableId}
                connectMode={connectMode}
                onSelect={handleSelectTable}
                onDragStart={handleDragStart}
                onFieldClick={handleFieldClick}
                onFeNameChange={handleTableFeNameChange}
                onFieldFeNameChange={handleFieldFeNameChange}
              />
            ))}
          </div>
        </div>

        {/* ── INSPECTOR PANEL ─────────────────────────────── */}
        {inspectorOpen && (selectedTable || selectedEdge) && (
          <div className="w-80 shrink-0 bg-white dark:bg-[#161B22] border-l border-slate-200 dark:border-[#30363D] flex flex-col overflow-hidden">
            {/* Inspector Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#30363D] flex items-center justify-between bg-slate-50 dark:bg-[#1e2330] shrink-0">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Info size={14} className="text-blue-500" />
                {selectedTable ? 'Tablo Detayı' : 'İlişki Detayı'}
              </h3>
              <button onClick={() => setInspectorOpen(false)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><X size={14} className="text-slate-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ── Table Inspector ─────────────── */}
              {selectedTable && (
                <div className="p-4 space-y-4">
                  {/* Table Identity */}
                  <div className="p-3 bg-slate-50 dark:bg-[#0f1219] rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DB</span>
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{selectedTable.dbName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">FE</span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedTable.feName}</span>
                    </div>
                  </div>

                  {/* Relationships */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">İlişkiler</h4>
                    {edges.filter(e => e.sourceTableId === selectedTable.id || e.targetTableId === selectedTable.id).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Bağlantı yok</p>
                    ) : (
                      <div className="space-y-1.5">
                        {edges.filter(e => e.sourceTableId === selectedTable.id || e.targetTableId === selectedTable.id).map(e => {
                          const otherTable = tables.find(t => t.id === (e.sourceTableId === selectedTable.id ? e.targetTableId : e.sourceTableId));
                          return (
                            <div key={e.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-500/5 rounded-lg border border-rose-100 dark:border-rose-500/20">
                              <Link2 size={12} className="text-rose-400 shrink-0" />
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                                {e.relationType} → <strong className="text-slate-800 dark:text-slate-200">{otherTable?.dbName}</strong>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Field List */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Alanlar ({selectedTable.fields.length})</h4>
                    <div className="space-y-1">
                      {selectedTable.fields.map(f => (
                        <div key={f.id} className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#0f1219]">
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">{f.dbName}</span>
                          <div className="flex items-center gap-1.5">
                            <ArrowRight size={10} className="text-slate-300" />
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">{f.feName}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── LIVE DTO PREVIEW ──────────── */}
                  <div>
                    <h4 className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Code size={12} />
                      Canlı DTO Önizleme (JSON)
                    </h4>
                    <div className="bg-[#0d1117] rounded-xl border border-slate-700 overflow-hidden">
                      <div className="px-3 py-1.5 bg-[#161B22] border-b border-slate-700 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[9px] text-slate-500 ml-2 font-mono">{selectedTable.feName}.json</span>
                      </div>
                      <pre className="px-3 py-3 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                        {dtoPreview}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Edge Inspector ──────────────── */}
              {selectedEdge && (
                <div className="p-4 space-y-4">
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/5 rounded-xl border border-rose-100 dark:border-rose-500/20">
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">İlişki Tipi</p>
                    <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{selectedEdge.relationType}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Kaynak</p>
                    <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {tables.find(t => t.id === selectedEdge.sourceTableId)?.dbName}.{tables.find(t => t.id === selectedEdge.sourceTableId)?.fields.find(f => f.id === selectedEdge.sourceFieldId)?.dbName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Hedef</p>
                    <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {tables.find(t => t.id === selectedEdge.targetTableId)?.dbName}.{tables.find(t => t.id === selectedEdge.targetTableId)?.fields.find(f => f.id === selectedEdge.targetFieldId)?.dbName}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteEdge(selectedEdge.id)} className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2 border border-red-200 dark:border-red-500/30 transition-colors">
                    <Trash2 size={14} /> Bağlantıyı Sil
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
