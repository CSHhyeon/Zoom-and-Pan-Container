/**
 * resizeRange — Handle 드래그로 Window의 한쪽 경계만 이동.
 *
 * Left Handle은 start만, Right Handle은 end만 바꾼다 (반대쪽 고정).
 * Handle 교차 방지는 별도 기능이 아니라 이동 가능 구간에 내장된다:
 * - resizeLeft의 상한 = `end - minRange`
 * - resizeRight의 하한 = `start + minRange`
 *
 * 목표 위치(next*)는 Bucket Position 단위. 픽셀 → 위치 변환과
 * round snap은 recharts 계층(Preview Handle)의 몫.
 */
import { clampRange, sanitizeMinRange } from "./clampRange";
import type { Range, RangeConstraints } from "./types";

/**
 * Left Handle: end를 고정하고 start를 nextStart로 옮긴다.
 *
 * start의 이동 가능 구간 = [fullRange.start, end - minRange].
 * NaN/Infinity 목표는 이동하지 않는다 (관문만 통과).
 */
export function resizeLeftRange(
  range: Range,
  nextStart: number,
  constraints: RangeConstraints,
): Range {
  const safeNext = Number.isFinite(nextStart) ? nextStart : range.start;
  const maxStart = range.end - resolveMinSpan(constraints);
  const start = clampValue(safeNext, constraints.fullRange.start, maxStart);

  return clampRange({ start, end: range.end }, constraints);
}

/**
 * Right Handle: start를 고정하고 end를 nextEnd로 옮긴다.
 *
 * end의 이동 가능 구간 = [start + minRange, fullRange.end].
 * NaN/Infinity 목표는 이동하지 않는다 (관문만 통과).
 */
export function resizeRightRange(
  range: Range,
  nextEnd: number,
  constraints: RangeConstraints,
): Range {
  const safeNext = Number.isFinite(nextEnd) ? nextEnd : range.end;
  const minEnd = range.start + resolveMinSpan(constraints);
  const end = clampValue(safeNext, minEnd, constraints.fullRange.end);

  return clampRange({ start: range.start, end }, constraints);
}

/** 실효 최소 폭 = min(minRange, 전체 폭) — zoomRange와 같은 규칙 */
function resolveMinSpan(constraints: RangeConstraints): number {
  const fullSpan = constraints.fullRange.end - constraints.fullRange.start;
  return Math.min(sanitizeMinRange(constraints.minRange), fullSpan);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
