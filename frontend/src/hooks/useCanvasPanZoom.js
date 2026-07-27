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

  // ── Auto-Fit / Center Viewport ────────────────────────────
  const centerView = useCallback((nodes, containerRect) => {
    if (!nodes || nodes.length === 0 || !containerRect) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
    });

    // Add assumed table width/height if not provided in nodes
    maxX += 280; // TABLE_WIDTH
    maxY += 200; // estimated max height

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Padding
    const padding = 100;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    let newScale = Math.min(scaleX, scaleY, maxScale); // Max zoom level to fit
    
    // Don't zoom in too much if content is small, cap at 1.0
    if (newScale > 1) newScale = 1;

    // Calculate center
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    const x = (containerRect.width / 2) - (contentCenterX * newScale);
    const y = (containerRect.height / 2) - (contentCenterY * newScale);

    setTransform({ x, y, scale: newScale });
  }, [maxScale]);

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
    centerView,
    isPanning,
  };
}
