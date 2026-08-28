import { useRef, type PointerEvent } from 'react';

const MIN_SWIPE_DISTANCE = 72;

type SwipePoint = { x: number; y: number };

export function useSwipeNavigation(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const start = useRef<SwipePoint | null>(null);

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') return;
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const origin = start.current;
      start.current = null;
      if (!origin || event.pointerType === 'mouse') return;
      const deltaX = event.clientX - origin.x;
      const deltaY = event.clientY - origin.y;
      if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
      if (deltaX < 0) onSwipeLeft();
      else onSwipeRight();
    },
    onPointerCancel: () => { start.current = null; },
  };
}
