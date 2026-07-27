import React, { memo, useCallback } from 'react';

/**
 * SVG Bezier bağlantı çizgisi bileşeni.
 * Kaynak ve hedef port koordinatlarından yatay bezier eğrisi çizer.
 * Okbaşı (arrowhead) ile yön gösterir.
 *
 * Props:
 *   sourceX, sourceY  — Kaynak port (px, kanvas koordinatı)
 *   targetX, targetY  — Hedef port (px, kanvas koordinatı)
 *   edgeId            — Benzersiz edge kimliği
 *   isSelected        — Seçili mi
 *   label             — İlişki etiketi (opsiyonel)
 *   onSelect          — Tıklanınca çağrılır
 */
const BezierEdge = memo(function BezierEdge({
  sourceX, sourceY, targetX, targetY,
  edgeId, isSelected = false, label = '', onSelect,
}) {
  // Bezier kontrol noktaları — yatay uzaklığa göre akıcı eğri
  const dx = Math.abs(targetX - sourceX);
  const cpOffset = Math.max(60, dx * 0.45);
  const cp1x = sourceX + cpOffset;
  const cp1y = sourceY;
  const cp2x = targetX - cpOffset;
  const cp2y = targetY;

  const path = `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`;

  // Midpoint for label
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const markerId = `arrowhead-${edgeId}`;

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onSelect?.(edgeId);
  }, [edgeId, onSelect]);

  return (
    <g className="cursor-pointer" onClick={handleClick}>
      {/* Arrowhead marker definition */}
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            className={isSelected ? 'fill-blue-500' : 'fill-slate-400 dark:fill-slate-500'}
          />
        </marker>
      </defs>

      {/* Invisible thick path for easier click target */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
      />

      {/* Visible path */}
      <path
        d={path}
        fill="none"
        className={`${
          isSelected
            ? 'stroke-blue-500 dark:stroke-blue-400'
            : 'stroke-slate-300 dark:stroke-slate-600 hover:stroke-blue-400 dark:hover:stroke-blue-500'
        }`}
        strokeWidth={isSelected ? 2.5 : 1.5}
        strokeDasharray={isSelected ? 'none' : 'none'}
        markerEnd={`url(#${markerId})`}
      />

      {/* Label */}
      {label && (
        <g>
          <rect
            x={midX - 24}
            y={midY - 10}
            width={48}
            height={20}
            rx={6}
            className="fill-white dark:fill-[#1e2330] stroke-slate-200 dark:stroke-slate-700"
            strokeWidth={1}
          />
          <text
            x={midX}
            y={midY + 4}
            textAnchor="middle"
            className="text-[9px] font-bold fill-slate-500 dark:fill-slate-400 select-none"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
});

export default BezierEdge;
