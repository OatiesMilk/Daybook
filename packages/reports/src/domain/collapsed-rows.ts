/**
 * Collapsed activities are remembered per report date as row positions only (no row
 * content), because in-memory row IDs are regenerated whenever the editor remounts.
 */
export const collapsedRowsKey = (date: string) => `daybook.collapsed-activities.${date}`;

/** Maps stored positions onto the current row IDs, ignoring anything malformed or out of range. */
export function collapsedFromPositions(stored: unknown, ids: readonly string[]): Set<string> {
  if (!Array.isArray(stored)) return new Set();
  return new Set(stored.filter((index): index is number => Number.isInteger(index) && index >= 0 && index < ids.length).map(index => ids[index]));
}

/** Positions of collapsed rows in their current order, ready to store. */
export function positionsFromCollapsed(ids: readonly string[], collapsed: ReadonlySet<string>): number[] {
  return ids.flatMap((id, index) => collapsed.has(id) ? [index] : []);
}
