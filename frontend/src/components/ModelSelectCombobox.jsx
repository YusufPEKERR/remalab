import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export default function ModelSelectCombobox({ 
  models = [], 
  value, 
  onChange, 
  placeholder = "Cihaz ara veya seç...",
  searchPlaceholder = "Parça kodu, marka, model ara..." 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Selected model string
  const selectedModel = useMemo(() => {
    if (!value) return null;
    return models.find(m => m.name === value) || { name: value };
  }, [models, value]);

  // Fast Memoized Filtered List
  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) return models.slice(0, 60);
    const term = searchTerm.toLowerCase();
    const matches = [];
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      if (m.name.toLowerCase().includes(term)) {
        matches.push(m);
        if (matches.length >= 60) break;
      }
    }
    return matches;
  }, [models, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modelName) => {
    onChange(modelName);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Combobox Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors shadow-sm select-none"
      >
        <span className="truncate font-medium">
          {selectedModel ? selectedModel.name : <span className="text-slate-400">{placeholder}</span>}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[150] overflow-hidden animate-menu-in">
          {/* Search Box inside dropdown */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-[#242a38]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Eşleşen model bulunamadı.
              </div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.name === value;
                return (
                  <button
                    key={m.id || m.name}
                    type="button"
                    onClick={() => handleSelect(m.name)}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors fast-transition ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2a3142]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium truncate">{m.name}</div>
                    </div>
                    {isSelected && <Check size={14} className="text-blue-500 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
