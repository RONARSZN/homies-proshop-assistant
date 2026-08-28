import { describe, expect, it } from 'vitest';
import { formatPeso } from './domain';

describe('test harness', () => {
  it('runs against the app source', () => {
    expect(formatPeso(1000)).toBe('₱1,000');
  });
});
