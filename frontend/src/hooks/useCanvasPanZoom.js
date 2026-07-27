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
    // Note: React passive event warning is expected for wheel, we can ignore it or just remove preventDefault
    // e.preventDefault(); // Removed to prevent "Unable to preventDefault" console spam
    
    if (!e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * factor, minScale), maxScale);
      // Zoom toward cursor position
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
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
    // Any click (left, middle, right) that reaches the canvas will start panning
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      // Always prevent default to stop native drag/selection which can break mousemove
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };

      const handleGlobalMouseMove = (ev) => {
        if (!isPanning.current) return;
        const dx = typeof ev.clientX === 'number' && typeof lastPos.current.x === 'number' ? ev.clientX - lastPos.current.x : 0;
        const dy = typeof ev.clientY === 'number' && typeof lastPos.current.y === 'number' ? ev.clientY - lastPos.current.y : 0;
        lastPos.current = { x: ev.clientX, y: ev.clientY };
        setTransform(prev => {
          const newX = prev.x + dx;
          const newY = prev.y + dy;
          return { 
            ...prev, 
            x: isNaN(newX) ? prev.x : newX, 
            y: isNaN(newY) ? prev.y : newY 
          };
        });
      };

      const handleGlobalMouseUp = () => {
        isPanning.current = false;
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
  }, []);

  // ── Pan Move (For backward compatibility, though now handled globally) ──
  const onPanMove = useCallback((e) => {
    // intentionally left empty since global listener handles it now
  }, []);

  // ── Pan End (For backward compatibility) ────────────────────────────────
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

    setTransform({ 
      x: isNaN(x) || !isFinite(x) ? 0 : x, 
      y: isNaN(y) || !isFinite(y) ? 0 : y, 
      scale: isNaN(newScale) || newScale <= 0 ? 1 : newScale 
    });
  }, [maxScale]);

  const safeX = isNaN(transform.x) || !isFinite(transform.x) ? 0 : transform.x;
  const safeY = isNaN(transform.y) || !isFinite(transform.y) ? 0 : transform.y;
  const safeScale = isNaN(transform.scale) || transform.scale <= 0 || !isFinite(transform.scale) ? 1 : transform.scale;

  const cssTransform = `translate(${safeX}px, ${safeY}px) scale(${safeScale})`;
  const safeTransform = { x: safeX, y: safeY, scale: safeScale };

  return {
    transform: safeTransform, // Replace transform with safeTransform
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
