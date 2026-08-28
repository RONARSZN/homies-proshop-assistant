import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetPinsForTest, usePins } from './usePins';

beforeEach(() => {
  window.localStorage.clear();
  __resetPinsForTest();
});

describe('usePins', () => {
  it('starts with nothing pinned', () => {
    const { result } = renderHook(() => usePins());
    expect(result.current.isPinned('p1')).toBe(false);
  });

  it('pins and unpins the same id', () => {
    const { result } = renderHook(() => usePins());
    act(() => result.current.toggle('p1'));
    expect(result.current.isPinned('p1')).toBe(true);
    act(() => result.current.toggle('p1'));
    expect(result.current.isPinned('p1')).toBe(false);
  });

  it('persists a pin across a remount', () => {
    const first = renderHook(() => usePins());
    act(() => first.result.current.toggle('p1'));
    first.unmount();
    // Force the module back through read() so this actually proves the pin
    // reached localStorage, not just that in-memory state survived unmount.
    __resetPinsForTest();
    const second = renderHook(() => usePins());
    expect(second.result.current.isPinned('p1')).toBe(true);
  });

  it('keeps two mounted hooks in step', () => {
    const a = renderHook(() => usePins());
    const b = renderHook(() => usePins());
    act(() => a.result.current.toggle('p1'));
    expect(b.result.current.isPinned('p1')).toBe(true);
  });

  it('survives corrupt stored data', () => {
    window.localStorage.setItem('homies.pins', '{ nope');
    // Force the module to re-read storage now, so this render goes through
    // read()'s catch on the corrupt string instead of an already-empty snapshot.
    __resetPinsForTest();
    const { result } = renderHook(() => usePins());
    expect(result.current.pinned.size).toBe(0);
  });
});
