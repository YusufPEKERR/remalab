import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, X, Check, Upload, AlertCircle } from 'lucide-react';

export default function ExcelMappingModal({ 
  isOpen, 
  onClose, 
  onImport, 
  dbColumns, 
  friendlyNames 
}) {
  const [fileData, setFileData] = useState(null);
  const [excelColumns, setExcelColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [error, setError] = useState('');

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setFileData(null);
      setExcelColumns([]);
      setPreviewRows([]);
      setMappings({});
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON (array of arrays for header extraction)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setError('Seçilen Excel dosyasında hiç veri bulunamadı!');
          return;
        }

        const headers = jsonData[0] || [];
        const rows = XLSX.utils.sheet_to_json(worksheet); // Array of objects

        setExcelColumns(headers);
        setFileData(rows);
        setPreviewRows(rows.slice(0, 5)); // Take first 5 for preview
        
        // Auto-map logic
        const initialMapping = {};
        dbColumns.forEach(dbCol => {
          const friendlyName = (friendlyNames?.[dbCol] || dbCol).split('(')[0].trim().toLowerCase();
          
          let aliases = [dbCol.toLowerCase(), friendlyName];
          if (dbCol === 'item_code') aliases.push('shortname', 'code');
          if (dbCol === 'name') aliases.push('itemcategory');
          if (dbCol === 'part_type') aliases.push('itemtype', 'parça tipi');
          if (dbCol === 'item_category') aliases.push('kalite');

          const match = headers.find(h => {
            const hLower = String(h).toLowerCase();
            return aliases.some(alias => hLower === alias || hLower.includes(alias));
          });
          
          if (match) {
            initialMapping[dbCol] = match;
          } else {
            initialMapping[dbCol] = '';
          }
        });
        setMappings(initialMapping);
        setError('');
      } catch (err) {
        setError('Excel dosyası okunamadı. Geçerli bir .xlsx dosyası seçtiğinizden emin olun.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (dbCol, excelCol) => {
    setMappings(prev => ({
      ...prev,
      [dbCol]: excelCol
    }));
  };

  const handleSave = () => {
    // Check if any mapping is selected
    const activeMappings = Object.entries(mappings).filter(([k, v]) => v !== '');
    if (activeMappings.length === 0) {
      setError('Hiçbir sütun eşleştirilmedi!');
      return;
    }

    // Create the mapped dataset
    const mappedData = fileData.map(row => {
      const newRow = {};
      activeMappings.forEach(([dbCol, excelCol]) => {
        newRow[dbCol] = row[excelCol];
      });
      return newRow;
    }).filter(row => {
      // Check if row has at least one non-empty value
      return Object.values(row).some(val => val !== undefined && val !== null && String(val).trim() !== '');
    });

    onImport(mappedData);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-[#1e2330] border border-slate-700 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#242a38]">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-green-500" />
            Excel İçe Aktarma ve Eşleştirme
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 bg-red-500/10 text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-500/20">
              <AlertCircle size={20} />
              <p className="font-medium text-sm">{error}</p>
            </div>
          )}

          {!fileData ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-slate-700 rounded-xl bg-slate-50 dark:bg-[#242a38]/50">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Upload size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">Excel Dosyası Yükle</h3>
              <p className="text-slate-500 text-sm mb-6 text-center max-w-sm">
                Sisteme aktarmak istediğiniz kayıtları içeren .xlsx veya .xls uzantılı dosyanızı seçin.
              </p>
              <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                Dosya Seç
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Mapping Section */}
              <section>
                <h3 className="text-slate-800 dark:text-slate-200 font-medium mb-3 flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  Sütun Başlıklarını Eşleştirin
                </h3>
                <div className="bg-slate-50 dark:bg-[#242a38] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-200 dark:border-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Veritabanı Alanı</th>
                        <th className="px-4 py-3 font-medium">Excel'deki Karşılığı</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {dbColumns.map(dbCol => (
                        <tr key={dbCol} className="hover:bg-slate-800/20">
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                            {friendlyNames?.[dbCol] || dbCol}
                          </td>
                          <td className="px-4 py-3">
                            <select 
                              className="w-full bg-white dark:bg-[#1e2330] border border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                              value={mappings[dbCol] || ''}
                              onChange={(e) => handleMappingChange(dbCol, e.target.value)}
                            >
                              <option value="">[Eşleştirilmedi]</option>
                              {excelColumns.map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Preview Section */}
              <section>
                <h3 className="text-slate-800 dark:text-slate-200 font-medium mb-3 flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  Örnek Veri Önizlemesi (İlk 5 Satır)
                </h3>
                <div className="bg-slate-50 dark:bg-[#242a38] rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-200 dark:border-slate-700/50">
                      <tr>
                        {excelColumns.map(col => (
                          <th key={col} className="px-4 py-3 font-medium">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-800/20 text-slate-700 dark:text-slate-300">
                          {excelColumns.map(col => (
                            <td key={col} className="px-4 py-3 truncate max-w-[200px]">
                              {row[col] !== undefined ? String(row[col]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          )}
        </div>

        {/* Footer */}
        {fileData && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-3 bg-slate-50 dark:bg-[#242a38]">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1e2330] hover:bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              İptal
            </button>
            <button 
              onClick={handleSave}
              className="px-5 py-2.5 text-white bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <Check size={18} />
              İçe Aktar
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
