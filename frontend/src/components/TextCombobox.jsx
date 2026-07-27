import { useState, useRef, useEffect, useMemo } from 'react';

export default function TextCombobox({ options = [], value, onChange, placeholder = '', required = false, maxResults = 60 }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    const term = (value || '').toLowerCase().trim();
    if (!term) return options.slice(0, maxResults);
    return options.filter(o => o.toLowerCase().includes(term)).slice(0, maxResults);
  }, [options, value, maxResults]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        required={required}
        className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
        value={value}
        onChange={e => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[150] max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setIsOpen(false); }}
              className="w-full text-left px-3.5 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2a3142] transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
