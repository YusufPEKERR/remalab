import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook: Kanvas pan (sürükleme) ve zoom (yakınlaştırma) matematiğini yönetir.
 * CSS transform: translate + scale kullanır, DOM re-render minimize edilir.
 *
 * Kullanım:
 *   Alt tuşu + sol tık VEYA orta tık (wheel click) ile pan
 *   Mouse wheel ile zoom in/out
 */
export default function useCanvasPanZoom({ minScale = 0.15, maxScale = 3 } = {}) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // ── Wheel Zoom ────────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * factor, minScale), maxScale);
      // Zoom toward cursor position
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const ratio = newScale / prev.scale;
      return {
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
        scale: newScale,
      };
    });
  }, [minScale, maxScale]);

  // ── Pan Start ─────────────────────────────────────────────
  const onPanStart = useCallback((e) => {
    // Middle mouse button OR Alt + left click
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  // ── Pan Move ──────────────────────────────────────────────
  const onPanMove = useCallback((e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  // ── Pan End ───────────────────────────────────────────────
  const onPanEnd = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Global mouseup to ensure pan stops even outside canvas
  useEffect(() => {
    window.addEventListener('mouseup', onPanEnd);
    return () => window.removeEventListener('mouseup', onPanEnd);
  }, [onPanEnd]);

  // ── Screen → Canvas coordinate conversion ────────────────
  const screenToCanvas = useCallback((screenX, screenY, containerRect) => {
    return {
      x: (screenX - containerRect.left - transform.x) / transform.scale,
      y: (screenY - containerRect.top - transform.y) / transform.scale,
    };
  }, [transform]);

  // ── Reset ─────────────────────────────────────────────────
  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const cssTransform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;

  return {
    transform,
    setTransform,
    cssTransform,
    onWheel,
    onPanStart,
    onPanMove,
    onPanEnd,
    screenToCanvas,
    resetView,
    isPanning,
  };
}
