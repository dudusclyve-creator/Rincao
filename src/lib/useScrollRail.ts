'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Trilho horizontal (categorias do PDV, categorias do modal de mesa...).
// Antes só dava pra arrastar a barrinha fininha embaixo, o que é péssimo com
// mouse. Aqui o trilho rola com a roda do mouse, arrastando com o mouse e
// pelas setas, e avisa quando ainda tem conteúdo pra cada lado.
export function useScrollRail<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      const max = el.scrollWidth - el.clientWidth;
      // se o trilho já chegou no fim naquele sentido, deixa a página rolar
      const canScroll = delta > 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 1;
      if (!canScroll) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [update]);

  const onPointerDown = (e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    drag.current = { x: e.clientX, start: el.scrollLeft, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<T>) => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true;
      try { el.setPointerCapture(e.pointerId); } catch {}
    }
    if (!d.moved) return;
    el.scrollLeft = d.start - dx;
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      // arrastar não pode selecionar a categoria que estava embaixo do mouse
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 350);
    }
  };

  const onClickCapture = (e: React.MouseEvent<T>) => {
    if (justDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const scrollPage = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const railHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave: onPointerUp, onClickCapture };

  return { ref, edges, railHandlers, scrollPage, update };
}
