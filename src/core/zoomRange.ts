/**
 * zoomRange — 현재 Window 중심 기준 확대·축소.
 *
 * 중심을 유지한 채 폭만 바꾼 뒤 clampRange 관문을 통과시킨다.
 * 경계·최소 폭 보정(예: 한쪽 경계에 닿으면 반대쪽만 이동)은 여기서 재구현하지 않고 전부 clampRange가 책임진다.
 */
import { clampRange, sanitizeMinRange } from "./clampRange";
import type { Range, RangeConstraints } from "./types";

/** Zoom 방향. Wheel deltaY → 방향 매핑(deltaY < 0 = "in")은 recharts 계층의 몫 */
export type ZoomDirection = "in" | "out";

/** Zoom 1회당 각 Handle이 이동하는 기본 칸 수 */
export const DEFAULT_ZOOM_STEP = 1;

/**
 * anchor 지점을 고정한 채 폭을 step * 2만큼 줄이거나(in) 늘린다(out).
 *
 * - anchor: 고정할 Position(포인터 중심 Zoom). 생략·NaN이면 Window 중앙 고정,
 *   창 밖 값은 가장자리로 clamp — "anchor의 창 내 비율"이 줌 전후에 유지된다
 * - 폭 하한: minRange(확대는 여기서 멈춤) / 폭 상한: 전체 폭(축소는 fullRange까지)
 * - 축소 중 한쪽이 전체 경계에 닿으면 반대쪽만 이동한다 (clampRange의 폭 유지 평행이동)
 * - 소수 결과의 snap은 core가 아니라 hook의 몫
 */
export function zoomRange(
  range: Range,
  direction: ZoomDirection,
  constraints: RangeConstraints,
  step: number = DEFAULT_ZOOM_STEP,
  anchor?: number,
): Range {
  const fullSpan = constraints.fullRange.end - constraints.fullRange.start;
  const minSpan = Math.min(sanitizeMinRange(constraints.minRange), fullSpan);
  const safeStep =
    Number.isFinite(step) && step >= 0 ? step : DEFAULT_ZOOM_STEP;

  // 양쪽 Handle이 step씩 움직이므로 폭은 step * 2씩 변한다
  const span = Math.abs(range.end - range.start);
  const requestedSpan =
    direction === "in" ? span - safeStep * 2 : span + safeStep * 2;

  // 폭을 [minSpan, fullSpan]으로 먼저 자르지 않으면 음수 폭이 clampRange에서 뒤집혀 "확대가 축소로 반전"되는 버그가 생긴다
  const nextSpan = Math.min(Math.max(requestedSpan, minSpan), fullSpan);

  // 고정점(pivot): anchor를 창 안으로 clamp. 없으면 중앙 = 비율 0.5의 특수 케이스
  const lo = Math.min(range.start, range.end);
  const hi = Math.max(range.start, range.end);
  const pivot = Number.isFinite(anchor as number)
    ? Math.min(Math.max(anchor as number, lo), hi)
    : (lo + hi) / 2;
  const ratio = span === 0 ? 0.5 : (pivot - lo) / span;

  // pivot이 새 폭에서도 같은 비율 지점에 오도록 배치한다
  const nextStart = pivot - ratio * nextSpan;
  return clampRange(
    { start: nextStart, end: nextStart + nextSpan },
    constraints,
  );
}
