import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Link2, Save, Search, X, Maximize2, ZoomIn, ZoomOut, AlertTriangle, ArrowUpDown, Filter,
  Database, Code, ArrowRight, Trash2, Info, CheckCircle, Table2, Map, List, ChevronRight, FileText
} from 'lucide-react';
import useCanvasPanZoom from '../hooks/useCanvasPanZoom';
import { api } from '../services/api';
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
  if (!feName) return index;
  switch (type) {
    case 'int': return index;
    case 'boolean': return true;
    case 'timestamp': return '2025-07-27T09:00:00Z';
    case 'relation': return index;
    default: return typeof feName === 'string' ? feName.charAt(0).toUpperCase() + feName.slice(1) + ' Örneği' : 'Örnek';
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
      <div className="bg-white dark:bg-[#1E2B5C] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full mx-4 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between bg-slate-50 dark:bg-[#232F63]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Plus size={20} className="text-blue-500" /></div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Yeni Tablo Ekle</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">DB Tablo Adı *</label>
            <input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="Örn: ProductModel" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A2450] text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">FE Alias (Opsiyonel)</label>
            <input value={feName} onChange={e => setFeName(e.target.value)} placeholder="Otomatik: DB adı kullanılır" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A2450] text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
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
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'list'
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
  const [listSortOrder, setListSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [listModuleFilter, setListModuleFilter] = useState('Tümü');

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
        if (api.getSchemaIntrospection) {
          const res = await api.getSchemaIntrospection();
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

  // Center view on initial load
  const hasCentered = useRef(false);
  useEffect(() => {
    if (!isLoading && canvasRef.current && tables.length > 0 && !hasCentered.current) {
      hasCentered.current = true;
      // PRO-TIP ZAMANLAMA KORUMASI: DOM mount ve render için bekle
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            centerView(tables, rect);
          }
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isLoading, tables.length, centerView]); 

  // ── Table Drag ────────────────────────────────────────────
  const handleDragStart = useCallback((tableId, e) => {
    const t = tables.find(t => t.id === tableId);
    if (!t) return;
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      isDragging: true,
      tableId,
      startX: clientX,
      startY: clientY,
      origX: Number(t.x),
      origY: Number(t.y),
    };
  }, [tables]);

  const handleCanvasMouseMove = useCallback((e) => {
    onPanMove(e);
    if (!dragRef.current.isDragging) return;
    const { tableId, startX, startY, origX, origY } = dragRef.current;
    const scale = transform.scale;
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    const dx = typeof clientX === 'number' ? (clientX - startX) / scale : 0;
    const dy = typeof clientY === 'number' ? (clientY - startY) / scale : 0;
    
    setTables(prev => {
      if (!Array.isArray(prev)) return prev;
      const newX = Number(origX) + dx;
      const newY = Number(origY) + dy;
      return prev.map(t => t.id === tableId ? { 
        ...t, 
        x: isNaN(newX) ? Number(origX) : newX, 
        y: isNaN(newY) ? Number(origY) : newY 
      } : t);
    });
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
    // Ekrana/tuvale tıklandığında seçimi temizlemeyi (paneli kapatmayı) devre dışı bıraktık.
    // Kullanıcı hem ekranı kaydırıp hem de özellikleri okumaya devam edebilsin.
    if (connectMode && connectSource) {
      setConnectSource(null); // Cancel partial connection
    }
  }, [connectMode, connectSource]);

  // ── FE Name Changes ───────────────────────────────────────
  const handleTableFeNameChange = useCallback((tableId, newName) => {
    setTables(prev => {
      if (!Array.isArray(prev)) return prev;
      return prev.map(t => t.id === tableId ? { ...t, feName: newName } : t);
    });
  }, []);

  const handleFieldFeNameChange = useCallback((tableId, fieldId, newName) => {
    setTables(prev => {
      if (!Array.isArray(prev)) return prev;
      return prev.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            fields: Array.isArray(t.fields) ? t.fields.map(f => f.id === fieldId ? { ...f, feName: newName } : f) : t.fields
          };
        }
        return t;
      });
    });
  }, []);

  const handleDbNameChange = useCallback((tableId, fieldId, newDbName) => {
    setTables(prev => {
      if (!Array.isArray(prev)) return prev;
      return prev.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            fields: Array.isArray(t.fields) ? t.fields.map(f => f.id === fieldId ? { ...f, dbName: newDbName } : f) : t.fields
          };
        }
        return t;
      });
    });
  }, []);

  const handleDbTableChange = useCallback((tableId, fieldId, newDbTable) => {
    setTables(prev => {
      if (!Array.isArray(prev)) return prev;
      return prev.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            fields: Array.isArray(t.fields) ? t.fields.map(f => f.id === fieldId ? { ...f, dbTable: newDbTable, dbName: "" } : f) : t.fields
          };
        }
        return t;
      });
    });
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
      setEdges(prev => Array.isArray(prev) ? [...prev, newEdge] : [newEdge]);
      // Mark source field as FK
      setTables(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(t => t.id === connectSource.tableId ? {
          ...t, fields: Array.isArray(t.fields) ? t.fields.map(f => f.id === connectSource.fieldId ? {
            ...f, isFK: true, type: 'relation', fkRef: { tableId, fieldId }
          } : f) : t.fields
        } : t);
      });
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
      setTables(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(t => t.id === edge.sourceTableId ? {
          ...t, fields: Array.isArray(t.fields) ? t.fields.map(f => f.id === edge.sourceFieldId ? { ...f, isFK: false, type: 'int', fkRef: null } : f) : t.fields
        } : t);
      });
    }
    setEdges(prev => Array.isArray(prev) ? prev.filter(e => e.id !== edgeId) : []);
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
        fields: t.fields.map(f => {
          const isCrossTable = f.dbTable && f.dbTable !== t.dbName;
          let relationPath = undefined;
          
          if (isCrossTable) {
            const otherTable = tables.find(tbl => tbl.dbName === f.dbTable);
            if (otherTable) {
              const edge = edges.find(e => 
                (e.sourceTableId === t.id && e.targetTableId === otherTable.id) ||
                (e.targetTableId === t.id && e.sourceTableId === otherTable.id)
              );
              if (edge) {
                // If there is an edge, find the foreign key column name
                const isSource = edge.sourceTableId === t.id;
                const fkFieldId = isSource ? edge.sourceFieldId : edge.targetFieldId;
                const fkTable = isSource ? t : otherTable;
                const fkField = fkTable.fields.find(fld => fld.id === fkFieldId);
                if (fkField) {
                  relationPath = fkField.dbName;
                }
              }
            }
          }
          
          return {
            dbName: f.dbName,
            feName: f.feName,
            type: f.type,
            isPK: f.isPK,
            isFK: f.isFK,
            fkRef: f.fkRef,
            ...(isCrossTable && { dbTable: f.dbTable, isReadOnly: true }),
            ...(relationPath && { relationPath })
          };
        }),
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

  // ── Proje Rehberi (PDF) ────────────────────────────────────
  const handleOpenProjectGuide = useCallback(async () => {
    try {
      const res = await api.openProjectGuide();
      if (!res.success) {
        showNotif(res.message || 'Proje rehberi açılamadı.', 'warning');
      }
    } catch (e) {
      showNotif('Proje rehberi açılırken hata oluştu.', 'warning');
    }
  }, [showNotif]);

  // ── Search / Filter ───────────────────────────────────────
  const handleSearchFocus = useCallback((tableId) => {
    const t = tables.find(t => t.id === tableId);
    if (!t || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = 1.5; // Tablonun ekrana tam oturması için büyüteç oranı
    
    // Tablonun merkez noktasını hesapla (yaklaşık genişlik 280px)
    const tableCenterX = Number(t.x) + 140; 
    // Yüksekliği alan sayısına göre tahmini hesapla
    const tableCenterY = Number(t.y) + 100 + (t.fields ? t.fields.length * 16 : 0);

    setTransform({
      x: rect.width / 2 - tableCenterX * scale,
      y: rect.height / 2 - tableCenterY * scale,
      scale: scale,
    });
    setSelectedTableId(tableId);
    setInspectorOpen(true);
    setSearchTerm('');
  }, [tables, setTransform]);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchTerm(val);
    const query = val.trim().toLowerCase();
    const isShowAllCommand = ["tüm tablolar", "tümü", "hepsi", "all", "*", "listele"].includes(query);

    if (isShowAllCommand || query === "") {
      setSelectedTableId(null);
      if (isShowAllCommand) {
        requestAnimationFrame(() => {
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            centerView(tables, rect);
          }
          setSearchTerm('');
          showNotif('Tüm tablolar görünür hale getirildi ve hizalandı.', 'success');
        });
      }
    }
  }, [tables, centerView, showNotif]);

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
    <div className="flex flex-col h-[calc(100vh-112px)]">
      <Toast notif={notif} onClose={() => setNotif(null)} />
      {showAddModal && <AddTableModal onClose={() => setShowAddModal(false)} onAdd={handleAddTable} />}

      {/* ════════════════ TOOLBAR ════════════════ */}
      <div className="bg-[#F5F7FC] dark:bg-[#16204A] border-b border-[#DCE1F1] dark:border-[#24326A] px-5 py-3 flex items-center justify-between gap-3 flex-wrap shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mr-3 font-mono">
            <Database size={17} className="text-blue-400" />
            SCHEMA MAPPER
          </h2>

          <button onClick={() => setShowAddModal(true)} className="px-3.5 py-2 rounded-xl bg-[#4457A5] hover:bg-[#2E3F78] text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all">
            <Plus size={14} /> Yeni Tablo
          </button>
          <button onClick={() => { setConnectMode(!connectMode); setConnectSource(null); }} className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer border ${connectMode ? 'bg-rose-500 text-white border-rose-500' : 'bg-[#FFFFFF] dark:bg-[#24326A] text-[#16204A] dark:text-[#F6F8FF] border-[#DCE1F1] dark:border-[#3B4A85] hover:border-rose-400'}`}>
            <Link2 size={14} /> {connectMode ? 'Bağlama: AÇIK' : 'İlişki Bağla'}
          </button>
          <button onClick={handleSaveMapping} className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-all">
            <Save size={14} /> Kaydet
          </button>
          <button onClick={handleOpenProjectGuide} title="Proje rehberini PDF olarak aç" className="px-3.5 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#24326A] text-[#16204A] dark:text-[#F6F8FF] border border-[#DCE1F1] dark:border-[#3B4A85] text-xs font-semibold flex items-center gap-1.5 shadow-md hover:border-blue-400 transition-all cursor-pointer">
            <FileText size={14} /> Proje Rehberi
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* TAB BUTTONS */}
          <div className="flex items-center bg-slate-100 dark:bg-[#131B3A] p-1 rounded-xl mr-2">
            <button 
              onClick={() => setActiveTab('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'visual' ? 'bg-white dark:bg-[#1E2B5C] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Map size={14} /> Görsel Şema
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'list' ? 'bg-white dark:bg-[#1E2B5C] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <List size={14} /> Liste Görünümü
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              value={searchTerm} 
              onChange={handleSearchChange} 
              placeholder="Tablo ara veya 'tümü' yaz..." 
              className="pl-8 pr-3 py-1.5 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3A] text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
            />
            {filteredSearch.length > 0 && !["tüm tablolar", "tümü", "hepsi", "all", "*", "listele"].includes(searchTerm.trim().toLowerCase()) && (
              <div className="absolute top-full left-0 mt-1 w-60 bg-white dark:bg-[#1E2B5C] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
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
           MAIN AREA: Canvas + Inspector OR List View
         ═══════════════════════════════════════════════════════ */}
      {activeTab === 'visual' ? (
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-[#131B3A]/50 backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* No Schema State */}
          {!isLoading && tables.length === 0 && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <div className="bg-white dark:bg-[#1E2B5C] p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md text-center pointer-events-auto">
                <Database size={48} className="text-slate-700 dark:text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Veritabanı Şeması Bulunamadı</h3>
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
            className={`flex-1 relative overflow-hidden select-none min-w-0 ${connectMode ? 'cursor-crosshair' : 'cursor-default'}`}
            style={{ backgroundColor: 'transparent', touchAction: 'none' }}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => { onPanStart(e); handleCanvasClick(); }}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={(e) => { onPanStart(e); handleCanvasClick(); }}
            onTouchMove={handleCanvasMouseMove}
            onTouchEnd={handleCanvasMouseUp}
            onTouchCancel={handleCanvasMouseUp}
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
              className="absolute top-0 left-0 origin-top-left z-10"
              style={{ transform: cssTransform }}
            >
              {/* SVG Layer for Edges */}
              <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '100vw', height: '100vh', overflow: 'visible' }}>
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
                  onFeNameChange={handleTableFeNameChange}
                  onFieldFeNameChange={handleFieldFeNameChange}
                  onFieldClick={handleFieldClick}
                />
              ))}
            </div>
          </div>

          {/* ── INSPECTOR PANEL ─────────────────────────────── */}
          {inspectorOpen && (selectedTable || selectedEdge) && (
            <div className="w-80 shrink-0 bg-white dark:bg-[#1A2450] border-l border-slate-200 dark:border-[#3A4A8C] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-[#3A4A8C] bg-slate-50/50 dark:bg-[#131B3A]/50">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Özellikler</h3>
                <button onClick={() => setInspectorOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* ── Table Inspector ──────────────── */}
                {selectedTable && (
                  <div className="p-4 space-y-6">
                    {/* Header Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Table2 size={16} className="text-blue-500" />
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedTable.feName}</h2>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 opacity-80 pl-6">db: {selectedTable.dbName}</p>
                    </div>

                    {/* Field List */}
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Alanlar ({selectedTable.fields.length})</h4>
                      <div className="space-y-1">
                        {selectedTable.fields.map(f => (
                          <div key={f.id} className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#131B3A]">
                            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">{f.dbName}</span>
                            <div className="flex items-center gap-1.5">
                              <ArrowRight size={10} className="text-slate-700 dark:text-slate-300" />
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
                      <div className="bg-[#F5F7FC] dark:bg-[#121A38] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-3 py-1.5 bg-[#EFF1FA] dark:bg-[#1A2450] border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
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
      ) : (
        <div className="flex flex-1 min-h-0 bg-slate-50 dark:bg-[#131B3A] p-4 sm:p-6 gap-6 overflow-hidden">
            {/* List View Left Sidebar (Tables) */}
            <div className="w-72 flex flex-col bg-white dark:bg-[#1A2450] border border-slate-200 dark:border-[#3A4A8C] rounded-2xl overflow-hidden shadow-sm shrink-0">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-[#3A4A8C] bg-slate-50/50 dark:bg-[#131B3A]/50 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Database size={14} className="text-blue-500" /> Tablolar
                  </h3>
                  <button 
                    onClick={() => setListSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-1 rounded bg-slate-200 dark:bg-[#3A4A8C] text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-[#4A5A9E] transition-colors"
                    title={listSortOrder === 'asc' ? 'A-Z Sıralı' : 'Z-A Sıralı'}
                  >
                    <ArrowUpDown size={12} />
                  </button>
                </div>
                <div className="relative">
                  <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={listModuleFilter}
                    onChange={(e) => setListModuleFilter(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-[#1A2450] border border-slate-200 dark:border-[#3A4A8C] text-[11px] font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 dark:text-slate-300 appearance-none cursor-pointer"
                  >
                    {['Tümü', 'DEPO', 'ENVANTER', 'KULLANICI & AYARLAR', 'SİSTEM'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {tables.map(t => {
                  let displayName = t.feName;
                  const dbNameLower = t.dbName ? t.dbName.toLowerCase() : '';
                  if (dbNameLower === 'items' || t.id === 'tbl_items') displayName = 'Stok Kartları (Parçalar)';
                  if (dbNameLower === 'batch' || t.id === 'tbl_batch') displayName = 'Batch Girişi Yönetimi';
                  if (dbNameLower === 'itemcategory' || dbNameLower === 'item_category' || t.id === 'tbl_item_category') displayName = 'Parça Kategorileri';
                  
                  let moduleName = "SİSTEM";
                  
                  if (dbNameLower.includes('user') || dbNameLower.includes('auth') || dbNameLower.includes('role') || dbNameLower.includes('batch') || dbNameLower.includes('category') || dbNameLower.includes('bom') || dbNameLower.includes('department') || dbNameLower.includes('setting') || dbNameLower.includes('data') || dbNameLower.includes('schema')) {
                    moduleName = "KULLANICI & AYARLAR";
                  }
                  else if (dbNameLower.includes('item') || dbNameLower.includes('part') || dbNameLower.includes('brand') || dbNameLower.includes('model') || dbNameLower.includes('product') || dbNameLower.includes('supplier') || dbNameLower.includes('location') || dbNameLower.includes('customer')) {
                    moduleName = "ENVANTER";
                  }
                  else if (dbNameLower.includes('service') || dbNameLower.includes('work_order') || dbNameLower.includes('mission') || dbNameLower.includes('workgroup') || dbNameLower.includes('irsaliye') || dbNameLower.includes('depo')) {
                    moduleName = "DEPO";
                  }

                  return { ...t, displayName, moduleName };
                })
                .filter(t => listModuleFilter === 'Tümü' || t.moduleName === listModuleFilter)
                .sort((a, b) => {
                  const cmp = a.displayName.localeCompare(b.displayName);
                  return listSortOrder === 'asc' ? cmp : -cmp;
                })
                .map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTableId(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex flex-col ${
                        selectedTableId === t.id 
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <span className="font-bold">{t.displayName}</span>
                      <div className="flex items-center justify-between mt-1 w-full gap-2">
                        <span className="text-[10px] font-mono opacity-70 flex items-center gap-1 truncate">
                          <Database size={10} className="shrink-0" /> <span className="truncate">{t.dbName}</span>
                        </span>
                        <span className="text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-sm shrink-0">
                          {t.moduleName}
                        </span>
                      </div>
                    </button>
                  ))
                }
              </div>
            </div>

          {/* List View Right Content (Fields) */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#1A2450] border border-slate-200 dark:border-[#3A4A8C] rounded-2xl overflow-hidden shadow-sm">
            {selectedTable ? (
              <>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-[#3A4A8C] bg-slate-50/50 dark:bg-[#131B3A]/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{selectedTable.feName}</h2>
                    <p className="text-xs text-slate-500 font-mono mt-1">Veritabanı Tablosu: {selectedTable.dbName}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold">
                    {selectedTable.fields.length} Alan
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="rounded-xl border border-slate-200 dark:border-[#3A4A8C] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-[#131B3A] border-b border-slate-200 dark:border-[#3A4A8C]">
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Uygulama Alanı (FE Name)</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest w-24">Veri Tipi</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest w-48">Veritabanı Tablosu</th>
                          <th className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest w-48">Veritabanı Sütunu (DB Name)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#3A4A8C]">
                        {selectedTable.fields.map(f => {
                          const currentDbTable = f.dbTable || selectedTable.dbName;
                          const targetTable = tables.find(t => t.dbName === currentDbTable) || selectedTable;
                          const isCrossTable = currentDbTable !== selectedTable.dbName;
                          
                          let hasEdge = false;
                          if (isCrossTable) {
                             hasEdge = edges.some(e => 
                               (e.sourceTableId === selectedTable.id && e.targetTableId === targetTable.id) ||
                               (e.targetTableId === selectedTable.id && e.sourceTableId === targetTable.id)
                             );
                          }

                          return (
                          <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-[#131B3A]/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{f.feName}</span>
                                {f.isPK && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 uppercase">PK</span>}
                                {f.isFK && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 uppercase">FK</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-mono px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {f.type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative flex items-center">
                                <Table2 size={14} className="absolute left-3 text-slate-400" />
                                <select
                                  value={currentDbTable}
                                  onChange={(e) => handleDbTableChange(selectedTable.id, f.id, e.target.value)}
                                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 dark:border-[#3A4A8C] bg-white dark:bg-[#1A2450] text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer transition-colors"
                                >
                                  {tables.map(t => (
                                    <option key={t.id} value={t.dbName}>{t.feName || t.dbName} ({t.dbName})</option>
                                  ))}
                                </select>
                                <ChevronRight size={14} className="absolute right-3 text-slate-400 pointer-events-none rotate-90" />
                              </div>
                              {isCrossTable && !hasEdge && (
                                <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-500 font-bold px-1">
                                  <AlertTriangle size={10} /> FK Yok
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative flex items-center">
                                <Database size={14} className="absolute left-3 text-slate-400" />
                                <select
                                  value={f.dbName || ''}
                                  onChange={(e) => handleDbNameChange(selectedTable.id, f.id, e.target.value)}
                                  className={`w-full pl-9 pr-8 py-2 rounded-lg border bg-white dark:bg-[#1A2450] text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer transition-colors ${
                                    isCrossTable && !hasEdge ? 'border-amber-200 dark:border-amber-500/30' : 'border-slate-200 dark:border-[#3A4A8C]'
                                  }`}
                                >
                                  <option value="" disabled>Seçiniz</option>
                                  {Array.from(new Set(targetTable.fields.map(field => field.dbName))).map(dbCol => (
                                    <option key={dbCol} value={dbCol}>{dbCol}</option>
                                  ))}
                                  {!targetTable.fields.some(field => field.dbName === f.dbName) && f.dbName && (
                                    <option value={f.dbName}>{f.dbName}</option>
                                  )}
                                </select>
                                <ChevronRight size={14} className="absolute right-3 text-slate-400 pointer-events-none rotate-90" />
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                <Database size={48} className="mb-4 opacity-20" />
                <p>Eşleştirme yapmak için sol taraftan bir tablo seçin</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
