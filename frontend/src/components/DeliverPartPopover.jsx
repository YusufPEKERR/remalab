import { useState, useEffect, useRef } from 'react';
import { Truck, X } from 'lucide-react';

export default function DeliverPartPopover({ isOpen, position, partName, quantity, locations = [], onConfirm, onClose }) {
  const [locationId, setLocationId] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (isOpen) setLocationId(locations[0] ? String(locations[0].id) : '');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const left = Math.min(position?.x ?? 0, window.innerWidth - 300);
  const top = Math.min(position?.y ?? 0, window.innerHeight - 220);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: Math.max(top, 8), left: Math.max(left, 8) }}
      className="z-[100] w-72 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl p-4 space-y-3 animate-in fade-in zoom-in-95"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Truck size={16} className="text-blue-400" /> Depodan Teslim Al
        </h4>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">{partName} &mdash; {quantity} adet</p>

      {locations.length === 0 ? (
        <p className="text-xs text-red-500 font-medium">Bu parça için hiçbir lokasyonda stok bulunmuyor.</p>
      ) : (
        <select
          className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
        >
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name} (Stok: {l.quantity})</option>
          ))}
        </select>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#242a38] rounded-lg hover:bg-slate-200 dark:hover:bg-[#2a3142] transition-colors">
          İptal
        </button>
        <button
          type="button"
          disabled={!locationId}
          onClick={() => onConfirm(locationId)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Teslim Al
        </button>
      </div>
    </div>
  );
}
