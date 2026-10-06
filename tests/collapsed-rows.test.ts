import { test } from "node:test";
import assert from "node:assert/strict";
import { collapsedFromPositions, collapsedRowsKey, positionsFromCollapsed } from "../packages/reports/src/domain/collapsed-rows.ts";

test("collapsed activities are remembered per report date as positions only", () => {
  assert.equal(collapsedRowsKey("2026-10-06"), "daybook.collapsed-activities.2026-10-06");
  const ids = ["a", "b", "c", "d", "e"];
  // Activities 1-4 collapsed, 5 open: stored as positions, restored onto fresh IDs after a remount.
  const positions = positionsFromCollapsed(ids, new Set(["a", "b", "c", "d"]));
  assert.deepEqual(positions, [0, 1, 2, 3]);
  assert.deepEqual([...collapsedFromPositions(positions, ["r0", "r1", "r2", "r3", "r4"])], ["r0", "r1", "r2", "r3"]);
  // Removing activity 2 shifts later rows up; positions are recomputed from the remaining IDs.
  assert.deepEqual(positionsFromCollapsed(["a", "c", "d", "e"], new Set(["a", "c", "d"])), [0, 1, 2]);
  // Malformed or out-of-range storage is ignored rather than collapsing the wrong rows.
  assert.deepEqual([...collapsedFromPositions({ 0: true }, ids)], []);
  assert.deepEqual([...collapsedFromPositions([0, -1, 1.5, "2", 9], ids)], ["a"]);
  assert.deepEqual(positionsFromCollapsed(ids, new Set()), []);
});
