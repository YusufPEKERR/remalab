import React, { memo, useCallback, useRef } from 'react';
import { Key, Link2, GripVertical } from 'lucide-react';

/**
 * Tablo düğüm bileşeni — ER Kanvas üzerindeki tek bir tablo kutusunu temsil eder.
 *
 * Props:
 *   table         — Tablo verisi ({ id, dbName, feName, x, y, fields[] })
 *   isSelected    — Bu tablo seçili mi
 *   connectMode   — Bağlantı çekme modu aktif mi
 *   onSelect      — Tabloya tıklandığında
 *   onDragStart   — Sürükleme başlangıcı
 *   onFieldClick  — Bağlantı modunda alan tıklandığında
 *   onFeNameChange      — Tablo FE adı değişikliği
 *   onFieldFeNameChange — Alan FE adı değişikliği
 */

const TABLE_WIDTH = 280;
const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 32;

// ── Type Badge Colors ───────────────────────────────────────
const TYPE_COLORS = {
  int: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  string: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  boolean: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
  timestamp: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  relation: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
};

// ── Field Row ───────────────────────────────────────────────
const FieldRow = memo(function FieldRow({ field, tableId, tableDbName, index, connectMode, onFieldClick, onFieldFeNameChange }) {
  const handleFeChange = useCallback((e) => {
    onFieldFeNameChange?.(tableId, field.id, e.target.value);
  }, [tableId, field.id, onFieldFeNameChange]);

  const handleClick = useCallback((e) => {
    if (connectMode) {
      e.stopPropagation();
      onFieldClick?.(tableId, field.id);
    }
  }, [connectMode, tableId, field.id, onFieldClick]);

  const typeColor = TYPE_COLORS[field.type] || TYPE_COLORS.string;

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-3 h-8 border-t border-slate-100 dark:border-[#2A3872] group/row transition-colors ${
        connectMode ? 'cursor-crosshair hover:bg-blue-50 dark:hover:bg-blue-500/10' : ''
      }`}
    >
      {/* PK/FK Badge */}
      <div className="w-5 shrink-0 flex justify-center">
        {field.isPK && <Key size={12} className="text-amber-500" strokeWidth={2.5} />}
        {field.isFK && !field.isPK && <Link2 size={12} className="text-rose-400" strokeWidth={2.5} />}
      </div>

      {/* DB Column Name / Cross-Table Badge */}
      <div className="flex shrink-0 items-center overflow-hidden" style={{ width: field.dbTable && field.dbTable !== tableDbName ? '100px' : '72px' }}>
        {field.dbTable && field.dbTable !== tableDbName ? (
          <span className="inline-flex items-center gap-1 px-1 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[9px] border border-blue-200 dark:border-blue-500/20 truncate" title="Çapraz Tablo">
            🔗 {field.dbTable}.{field.dbName}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-500 truncate w-full" title={field.dbName}>
            {field.dbName}
          </span>
        )}
      </div>

      {/* Arrow */}
      <span className="text-[9px] text-slate-700 dark:text-slate-300 dark:text-slate-600 shrink-0">→</span>

      {/* FE Alias Input */}
      <input
        type="text"
        value={field.feName}
        onChange={handleFeChange}
        disabled={field.isFK && field.fkRef}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        className="flex-1 min-w-0 text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-transparent border-b border-transparent hover:border-blue-300 dark:hover:border-blue-500/50 focus:border-blue-500 outline-none transition-colors px-0.5 py-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
        title={field.isFK ? `FK → ${field.fkRef?.tableId}.${field.fkRef?.fieldId} (korumalı)` : 'FE alias değiştir'}
      />

      {/* Type Badge */}
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${typeColor}`}>
        {field.type}
      </span>
    </div>
  );
});

// ── Table Node ──────────────────────────────────────────────
const TableNode = memo(function TableNode({
  table, isSelected, connectMode, opacity = 1,
  onSelect, onDragStart, onFieldClick,
  onFeNameChange, onFieldFeNameChange,
}) {
  const headerRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT') return; // Don't drag when clicking inputs
    e.stopPropagation();
    onSelect?.(table.id);
    onDragStart?.(table.id, e);
  }, [table.id, onSelect, onDragStart]);

  const handleFeNameChange = useCallback((e) => {
    onFeNameChange?.(table.id, e.target.value);
  }, [table.id, onFeNameChange]);

  const handleTableClick = useCallback((e) => {
    e.stopPropagation();
    onSelect?.(table.id);
  }, [table.id, onSelect]);

  return (
    <div
      className={`absolute select-none`}
      style={{
        left: table.x,
        top: table.y,
        width: TABLE_WIDTH,
        zIndex: isSelected ? 20 : 10,
        opacity,
      }}
      onClick={handleTableClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      <div className={`rounded-xl overflow-hidden shadow-lg border-2 ${
        isSelected
          ? 'border-blue-500 dark:border-blue-400 shadow-blue-500/20 dark:shadow-blue-500/10 ring-2 ring-blue-500/20'
          : 'border-slate-200 dark:border-[#3A4A8C] shadow-slate-200/50 dark:shadow-black/20 hover:border-slate-300 dark:hover:border-slate-600'
      }`}>
        {/* ── Header ───────────────────────────── */}
        <div
          ref={headerRef}
          onMouseDown={handleMouseDown}
          className={`flex items-stretch cursor-grab active:cursor-grabbing ${
            isSelected
              ? 'bg-blue-600 dark:bg-blue-600'
              : 'bg-slate-700 dark:bg-[#1E2B5C]'
          }`}
          style={{ height: HEADER_HEIGHT }}
        >
          {/* Drag Handle */}
          <div className="flex items-center px-2 opacity-40">
            <GripVertical size={14} className="text-white" />
          </div>

          {/* DB Name (read-only label) */}
          <div className="flex-1 flex flex-col justify-center pr-1 border-r border-white/10">
            <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest leading-none">DB</span>
            <span className="text-[11px] font-bold text-white/90 font-mono truncate leading-tight mt-0.5">{table.dbName}</span>
          </div>

          {/* FE Name (editable) */}
          <div className="flex-1 flex flex-col justify-center px-2">
            <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest leading-none">FE</span>
            <input
              type="text"
              value={table.feName}
              onChange={handleFeNameChange}
              className="text-[11px] font-bold text-white bg-transparent border-b border-transparent hover:border-white/30 focus:border-white/60 outline-none leading-tight mt-0.5 w-full"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>

        {/* ── Field Rows ───────────────────────── */}
        <div className="bg-white dark:bg-[#1A2450]">
          {table.fields.map((field, i) => (
            <FieldRow
              key={field.id}
              field={field}
              tableId={table.id}
              tableDbName={table.dbName}
              index={i}
              connectMode={connectMode}
              onFieldClick={onFieldClick}
              onFieldFeNameChange={onFieldFeNameChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ── Port Position Calculator ────────────────────────────────
// Verilen tablonun belirli bir alanının sağ veya sol port konumunu hesaplar
export function getPortPosition(table, fieldId, side = 'right') {
  const fieldIndex = table.fields.findIndex(f => f.id === fieldId);
  if (fieldIndex === -1) return { x: table.x, y: table.y };

  const x = side === 'right' ? table.x + TABLE_WIDTH : table.x;
  const y = table.y + HEADER_HEIGHT + fieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
  return { x, y };
}

export { TABLE_WIDTH, HEADER_HEIGHT, ROW_HEIGHT };
export default TableNode;
