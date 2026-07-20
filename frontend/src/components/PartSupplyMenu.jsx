import { useEffect } from 'react';
import { Truck, Hourglass, Undo2, Trash2, RotateCcw, PlusCircle } from 'lucide-react';

export default function PartSupplyMenu({ position, currentStatus, onDeliver, onMarkWaiting, onRevert, onReturnToDoa, onExtraPart, onRemove, onClose }) {
  useEffect(() => {
    if (!position) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [position, onClose]);

  if (!position) return null;

  const canDeliver = currentStatus !== 'Teslim Edildi';
  const canMarkWaiting = currentStatus === 'Stokta Var';
  const canRevert = currentStatus !== 'Stokta Var';
  const canReturnToDoa = currentStatus === 'Teslim Edildi';

  const items = [
    canDeliver && { key: 'deliver', label: 'Depodan Teslim Al', icon: Truck, onClick: onDeliver, className: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10' },
    canMarkWaiting && { key: 'waiting', label: 'Yedek Parça Bekleniyor İşaretle', icon: Hourglass, onClick: onMarkWaiting, className: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10' },
    canReturnToDoa && onReturnToDoa && { key: 'return_doa', label: 'DOA Stoğa Geri Al', icon: RotateCcw, onClick: onReturnToDoa, className: 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10' },
    onExtraPart && { key: 'extra_part', label: 'Ekstra Parça Çıkışı Yap', icon: PlusCircle, onClick: onExtraPart, className: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10' },
    canRevert && { key: 'revert', label: 'İşlemi Geri Al', icon: Undo2, onClick: onRevert, className: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800' },
    { key: 'remove', label: 'Satırı Sil', icon: Trash2, onClick: onRemove, className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10' }
  ].filter(Boolean);

  const left = Math.min(Math.max(8, position.x), window.innerWidth - 270);
  const top = Math.min(Math.max(8, position.y), window.innerHeight - items.length * 40 - 20);

  return (
    <>
      <div 
        className="fixed inset-0 z-[99] bg-transparent cursor-default" 
        onClick={onClose} 
        onContextMenu={(e) => { e.preventDefault(); onClose(); }} 
      />
      <div
        style={{ position: 'fixed', top, left }}
        className="z-[100] w-64 bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl overflow-hidden py-1.5 animate-menu-in select-none"
      >
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              setTimeout(() => item.onClick(), 0);
            }}
            className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 transition-colors fast-transition ${item.className}`}
          >
            <item.icon size={15} /> {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
