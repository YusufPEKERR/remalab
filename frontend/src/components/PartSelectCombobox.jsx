import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export default function PartSelectCombobox({ parts = [], value, onChange, placeholder = "Parça seçiniz veya arayın..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Selected part object
  const selectedPart = useMemo(() => {
    if (!value) return null;
    return parts.find(p => String(p.id) === String(value)) || null;
  }, [parts, value]);

  // Fast Memoized Filtered List (max 60 results for instant rendering)
  const filteredParts = useMemo(() => {
    if (!searchTerm.trim()) return parts.slice(0, 60);
    const term = searchTerm.toLowerCase();
    const matches = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const str = `${p.item_code || ''} ${p.brand || ''} ${p.model || ''} ${p.color || ''} ${p.part_category || ''} ${p.name || ''}`.toLowerCase();
      if (str.includes(term)) {
        matches.push(p);
        if (matches.length >= 60) break;
      }
    }
    return matches;
  }, [parts, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (partId) => {
    onChange(partId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const formatPartLabel = (p) => {
    const code = p.item_code ? `[${p.item_code}] ` : '';
    const details = [p.brand, p.model, p.color, p.part_category].filter(Boolean).join(' ');
    const name = p.name ? `- ${p.name}` : '';
    return `${code}${details} ${name}`.trim();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected Box / Combobox Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors shadow-sm select-none"
      >
        <span className="truncate font-medium">
          {selectedPart ? formatPartLabel(selectedPart) : <span className="text-slate-400">{placeholder}</span>}
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
                placeholder="Parça kodu, marka, model ara..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredParts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Eşleşen parça bulunamadı.
              </div>
            ) : (
              filteredParts.map((p) => {
                const isSelected = String(p.id) === String(value);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(String(p.id))}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors fast-transition ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2a3142]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium truncate">{formatPartLabel(p)}</div>
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
