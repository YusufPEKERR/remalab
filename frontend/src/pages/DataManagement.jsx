import { useState, useEffect } from 'react';
import { Database, Download, Upload, FileSpreadsheet, AlertTriangle, Eye, RefreshCw, Save, XCircle } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

const KNOWN_TABLE_NAMES = {
  products: "Ürünler (products)",
  parts: "Parçalar (parts)",
  suppliers: "Tedarikçiler (suppliers)",
  locations: "Depo / Lokasyonlar (locations)",
  users: "Kullanıcılar (users)",
  stock: "Stok Durumu (stock)",
  dispatch_notes: "İrsaliyeler (dispatch_notes)",
  dispatch_items: "İrsaliye Kalemleri (dispatch_items)",
  production_runs: "İş Emirleri / Üretim (production_runs)",
  departments: "Departmanlar (departments)",
  service_records: "Servis Kayıtları (service_records)",
  service_parts: "Servis Parçaları (service_parts)"
};

const KNOWN_FRIENDLY_NAMES = {
  id: "ID (id)",
  item_code: "Ürün Kodu (item_code)",
  brand: "Marka (brand)",
  model: "Model (model)",
  color: "Renk (color)",
  part_category: "Parça Tipi (part_category)",
  item_category: "Parça Kategorisi (item_category)",
  memory: "Hafıza (memory)",
  name: "Adı (name)",
  supplier: "Tedarikçi Adı (supplier)",
  contact_info: "İletişim (contact_info)",
  address: "Adres (address)",
  barcode: "Barkod (barcode)",
  username: "Kullanıcı Adı (username)",
  email: "E-Posta (email)",
  password_hash: "Şifre Hash (password_hash)",
  role: "Rol (role)",
  quantity: "Miktar (quantity)",
  target_part_id: "Üretilen Parça ID (target_part_id)",
  quantity_produced: "Üretilen Miktar (quantity_produced)",
  source_location_id: "Kaynak Lokasyon ID (source_location_id)",
  target_location_id: "Hedef Lokasyon ID (target_location_id)",
  location_id: "Lokasyon ID (location_id)",
  part_id: "Parça ID (part_id)",
  product_id: "Ürün ID (product_id)",
  notes: "Notlar (notes)",
  created_at: "Oluşturulma Tarihi (created_at)",
  updated_at: "Güncellenme Tarihi (updated_at)"
};

export default function DataManagement() {
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await api.getAllTablesSchema();
      if (res.success && res.tables) {
        const dynamicTables = res.tables.map(t => {
          const friendlyNames = {};
          t.columns.forEach(col => {
            friendlyNames[col] = KNOWN_FRIENDLY_NAMES[col] || col;
          });
          
          return {
            id: t.id,
            name: KNOWN_TABLE_NAMES[t.table_name] || t.name,
            schema: t.schema,
            table_name: t.table_name,
            columns: t.columns,
            friendlyNames: friendlyNames,
            fetch: () => api.getTableData(t.schema, t.table_name),
            create: (data) => api.insertTableData(t.schema, t.table_name, data)
          };
        });
        setTables(dynamicTables);
      }
    } catch (err) {
      console.error("Tablo şemaları alınırken hata oluştu:", err);
    }
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);

  useEffect(() => {
    if (selectedTable) {
      setSelectedColumns(selectedTable.columns);
      loadPreview(selectedTable);
    } else {
      setSelectedColumns([]);
      setPreviewData([]);
    }
  }, [selectedTableId, tables]);

  const loadPreview = async (table) => {
    setPreviewLoading(true);
    try {
      const res = await table.fetch();
      const dataArray = Object.values(res).find(val => Array.isArray(val)) || [];
      setPreviewData(dataArray);
    } catch(err) {
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleColumn = (col) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleDoubleClick = (rowIndex, colName, value) => {
    setEditingCell({ rowIndex, colName });
    setEditingValue(value || "");
  };

  const handleInputSubmit = () => {
    if (editingCell) {
      const { rowIndex, colName } = editingCell;
      const newData = [...previewData];
      newData[rowIndex] = { ...newData[rowIndex], [colName]: editingValue };
      setPreviewData(newData);
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleInputSubmit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const handleGlobalSave = () => {
    alert("Değişiklikler başarıyla kaydedildi!");
  };

  const handleGlobalCancel = () => {
    setSelectedTableId('');
    setPreviewData([]);
    setSelectedColumns([]);
  };

  const handleDownloadTemplate = async () => {
    if (!selectedTable || selectedTableId === '__ALL__') return;
    const templateData = [
      selectedColumns.reduce((acc, col) => { acc[col] = `Örnek ${col}`; return acc; }, {})
    ];
    
    await api.exportTableToExcel(templateData, `${selectedTable.id}_sablonu.xlsx`);
  };

  const handleExportAllTables = async () => {
    setLoading(true);
    try {
      const allSheets = {};
      for (const t of tables) {
        try {
          const res = await t.fetch();
          const dataArray = Object.values(res).find(val => Array.isArray(val)) || [];
          allSheets[t.table_name] = dataArray;
        } catch (e) {
          console.error(`Tablo alınırken hata (${t.table_name}):`, e);
        }
      }
      await api.exportAllTablesToExcel(allSheets, "tum_tablolar.xlsx");
    } catch (err) {
      console.error(err);
      alert("Tüm tablolar dışa aktarılırken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (selectedTableId === '__ALL__') {
      return handleExportAllTables();
    }
    if (!selectedTable) return;
    setLoading(true);
    try {
      const res = await selectedTable.fetch();
      const dataArray = Object.values(res).find(val => Array.isArray(val)) || [];
      
      const exportedData = dataArray.map(item => {
        const obj = {};
        selectedColumns.forEach(c => { obj[c] = item[c]; });
        return obj;
      });

      await api.exportTableToExcel(exportedData, `${selectedTable.id}_listesi.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Dışa aktarım sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (data) => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      for (const item of data) {
        if (selectedTable.create) {
          await selectedTable.create(item);
        }
      }
      alert("İçe aktarma başarıyla tamamlandı!");
    } catch (err) {
      console.error(err);
      alert("İçe aktarım sırasında bir hata oluştu.");
    } finally {
      setIsExcelModalOpen(false);
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <Database size={28} className="text-blue-400" /> Veri Yönetimi
          </h1>
          <p className="text-slate-400 mt-1">Sistemdeki tüm tabloları yönetin, dışa aktarın ve excel'den içeri veri yükleyin.</p>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg overflow-y-auto">
        <div className="max-w-3xl space-y-8">
          
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Dikkat</p>
              <p className="text-sm mt-1">İçe aktarma işlemleri veritabanına doğrudan kayıt ekler. İşlem öncesi tablonun formatına uygun boş bir şablon indirmeniz ve verileri o şablona göre doldurmanız tavsiye edilir.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">1. Tablo Seçimi</h3>
            <select 
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full max-w-md bg-slate-50 dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">İşlem yapılacak tabloyu seçin...</option>
              <option value="__ALL__">Tüm Tablolar</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {selectedTableId === '__ALL__' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 p-6 rounded-xl text-center">
                <Database size={48} className="mx-auto text-indigo-500 mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Tüm Tablolar Dışa Aktarılacak</h3>
                <p className="text-slate-500 dark:text-slate-400">Veritabanındaki toplam {tables.length} tablonun tamamı, tek bir Excel dosyasında ayrı ayrı sayfalar (sheet) halinde bilgisayarınıza indirilecektir.</p>
                <div className="mt-6">
                  <button 
                    onClick={handleExportData}
                    disabled={loading}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium inline-flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  >
                    <Download size={18} /> {loading ? "Dışa Aktarılıyor..." : "Tüm Tabloları Dışa Aktar"}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedTable && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">2. Tablo Sütunları</h3>
                <div className="flex flex-wrap gap-3">
                  {selectedTable.columns.map(col => (
                    <label key={col} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 dark:border-slate-600 bg-[#0f1219] text-blue-500 focus:ring-blue-500/50"
                        checked={selectedColumns.includes(col)}
                        onChange={() => toggleColumn(col)}
                      />
                      <span className="text-slate-700 dark:text-slate-300 font-mono">{col}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview UI */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Eye size={20} className="text-slate-400" /> 3. Veri Önizleme
                  </h3>
                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={handleGlobalSave}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
                      title="Değişiklikleri Kaydet"
                    >
                      <Save size={16} /> Kaydet
                    </button>
                    <button 
                      onClick={handleGlobalCancel}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20 hover:scale-[1.02] active:scale-[0.98]"
                      title="Seçimi İptal Et"
                    >
                      <XCircle size={16} /> İptal Et
                    </button>
                    
                    <div className="w-px h-8 bg-slate-300 dark:bg-slate-700 mx-2"></div>

                    <button 
                      onClick={handleDownloadTemplate}
                      disabled={loading || selectedColumns.length === 0}
                      className="px-4 py-2 bg-white dark:bg-[#242a38] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-[#2a3142] text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      title="Seçili sütun başlıklarını içeren boş şablon indir"
                    >
                      <FileSpreadsheet size={16} className="text-emerald-500" /> Şablon
                    </button>
                    <button 
                      onClick={handleExportData}
                      disabled={loading || selectedColumns.length === 0}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                      title="Seçili sütunlarla mevcut tabloyu yedekle"
                    >
                      <Download size={16} /> Dışa Aktar
                    </button>
                    <button 
                      onClick={() => setIsExcelModalOpen(true)}
                      disabled={loading}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-violet-600/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                      title="Tüm sütunlarla kayıt ekle"
                    >
                      <Upload size={16} /> İçe Aktar
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-white dark:bg-[#1e2330] text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                        <tr>
                          {selectedColumns.map(col => (
                            <th key={col} className="px-4 py-3">{selectedTable.friendlyNames[col] || col}</th>
                          ))}
                          {selectedColumns.length === 0 && <th className="px-4 py-3">Sütun seçiniz</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {previewLoading ? (
                          <tr>
                            <td colSpan={Math.max(selectedColumns.length, 1)} className="px-4 py-6 text-center text-slate-400">
                              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" /> Yükleniyor...
                            </td>
                          </tr>
                        ) : previewData.length === 0 ? (
                          <tr>
                            <td colSpan={Math.max(selectedColumns.length, 1)} className="px-4 py-6 text-center text-slate-500">
                              Bu tabloda kayıt bulunamadı.
                            </td>
                          </tr>
                        ) : selectedColumns.length === 0 ? (
                          <tr>
                            <td colSpan={1} className="px-4 py-6 text-center text-slate-500">
                              Önizleme için en az bir sütun seçmelisiniz.
                            </td>
                          </tr>
                        ) : (
                          previewData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 transition-colors">
                              {selectedColumns.map(col => {
                                const isEditing = editingCell?.rowIndex === idx && editingCell?.colName === col;
                                return (
                                  <td 
                                    key={col} 
                                    className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 cursor-cell"
                                    onDoubleClick={() => handleDoubleClick(idx, col, row[col])}
                                  >
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={handleInputSubmit}
                                        onKeyDown={handleKeyDown}
                                        className="bg-[#0f1219] text-blue-400 border border-blue-500/50 rounded px-2 py-1 w-full focus:outline-none"
                                      />
                                    ) : (
                                      row[col] || '-'
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {selectedTable && (
        <ExcelMappingModal 
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          onImport={handleImportData}
          dbColumns={selectedTable.columns}
          friendlyNames={selectedTable.friendlyNames}
        />
      )}
    </div>
  );
}
