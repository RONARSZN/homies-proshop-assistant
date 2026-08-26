import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { monthKeyOf } from './domain';
import type { Period } from './types';

/*
 * The reporting period is shared rather than local to the overview, because
 * the export lives in the More drawer and must produce the period the user is
 * actually looking at. Two copies of this state would silently disagree.
 */
type PeriodContextValue = { period: Period; setPeriod: (next: Period) => void };
const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>({ type: 'month', key: monthKeyOf(new Date()) });
  const value = useMemo(() => ({ period, setPeriod }), [period]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod() {
  const value = useContext(PeriodContext);
  if (!value) throw new Error('usePeriod must be used inside PeriodProvider');
  return value;
}
