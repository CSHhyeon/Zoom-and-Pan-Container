/**
 * centerRangeAt — 폭을 유지한 채 Window 중앙이 center에 오도록 이동.
 *
 * 중앙 배치보다 전체 경계 준수가 우선이다 — 원하는 배치가 경계를 넘으면
 * clampRange의 폭 유지 평행이동이 벽에 붙여 멈춘다.
 * NaN/Infinity center는 이동하지 않는다 (관문만 통과).
 */
import { clampRange } from "./clampRange";
import type { Range, RangeConstraints } from "./types";

export function centerRangeAt(
  range: Range,
  center: number,
  constraints: RangeConstraints,
): Range {
  if (!Number.isFinite(center)) return clampRange(range, constraints);

  const span = Math.abs(range.end - range.start);

  return clampRange(
    { start: center - span / 2, end: center + span / 2 },
    constraints,
  );
}
