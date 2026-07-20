import { useEffect, useRef } from 'react';
import { Truck, Hourglass, Undo2, Trash2, RotateCcw, PlusCircle } from 'lucide-react';

export default function PartSupplyMenu({ position, currentStatus, onDeliver, onMarkWaiting, onRevert, onReturnToDoa, onExtraPart, onRemove, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!position) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [position, onClose]);

  if (!position) return null;

  const canDeliver = currentStatus !== 'Teslim Edildi';
  const canMarkWaiting = currentStatus === 'Stokta Var';
  const canRevert = currentStatus !== 'Stokta Var';
  const canReturnToDoa = currentStatus === 'Teslim Edildi';

  const items = [
    canDeliver && { key: 'deliver', label: 'Depodan Teslim Al', icon: Truck, onClick: onDeliver, className: 'text-blue-500 dark:text-blue-400' },
    canMarkWaiting && { key: 'waiting', label: 'Yedek Parça Bekleniyor İşaretle', icon: Hourglass, onClick: onMarkWaiting, className: 'text-amber-500 dark:text-amber-400' },
    canReturnToDoa && onReturnToDoa && { key: 'return_doa', label: 'Doğa Stoğa Geri Al', icon: RotateCcw, onClick: onReturnToDoa, className: 'text-orange-500 dark:text-orange-400' },
    onExtraPart && { key: 'extra_part', label: 'Ekstra Parça Çıkışı Yap', icon: PlusCircle, onClick: onExtraPart, className: 'text-indigo-500 dark:text-indigo-400' },
    canRevert && { key: 'revert', label: 'İşlemi Geri Al', icon: Undo2, onClick: onRevert, className: 'text-slate-500 dark:text-slate-400' },
    { key: 'remove', label: 'Satırı Sil', icon: Trash2, onClick: onRemove, className: 'text-red-500 dark:text-red-400' }
  ].filter(Boolean);

  const left = Math.min(position.x, window.innerWidth - 272);
  const top = Math.min(position.y, window.innerHeight - items.length * 42 - 16);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: Math.max(top, 8), left: Math.max(left, 8) }}
      className="z-[100] w-64 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl overflow-hidden py-1.5 animate-in fade-in zoom-in-95"
    >
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-[#2a3142] flex items-center gap-2.5 transition-colors ${item.className}`}
        >
          <item.icon size={16} /> {item.label}
        </button>
      ))}
    </div>
  );
}
