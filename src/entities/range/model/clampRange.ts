/**
 * clampRange — 모든 Range 변경 경로가 통과하는 단일 관문.
 *
 * Wheel/Pan/Resize/Dim Click/외부 변경 어디서 온 Range든 이 함수를 거치면 항상 유효한 Range가 된다:
 * - `start <= end`
 * - `end - start >= minRange` (전체 폭 한도 내에서)
 * - fullRange 안에 위치
 */
import { DEFAULT_MIN_RANGE, type Range, type RangeConstraints } from "./types";

/**
 * Range를 제약 안의 유효한 Range로 보정한다.
 *
 * 보정 규칙 (적용 순서):
 * 1. NaN/Infinity가 섞인 range는 fullRange로 안전 복귀
 * 2. `start > end`로 뒤집힌 range는 순서를 바로잡음
 * 3. 폭이 minRange보다 좁으면 start를 고정하고 end를 늘려 확보
 * 4. 폭이 전체 폭 이상이면 fullRange
 * 5. 경계를 벗어나면 **폭을 유지한 채** 안쪽으로 평행이동 (Pan/Zoom의 "경계에 닿으면 반대쪽만 이동"이 이 규칙에서 나온다)
 */
export function clampRange(range: Range, constraints: RangeConstraints): Range {
  const { fullRange } = constraints;
  const fullSpan = fullRange.end - fullRange.start;

  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return { start: fullRange.start, end: fullRange.end };
  }

  const start = Math.min(range.start, range.end);
  let end = Math.max(range.start, range.end);

  // 최소 폭 보장 — 단, 전체 폭보다 넓게 요구할 수는 없다
  const minSpan = Math.min(sanitizeMinRange(constraints.minRange), fullSpan);
  if (end - start < minSpan) {
    end = start + minSpan;
  }

  if (end - start >= fullSpan) {
    return { start: fullRange.start, end: fullRange.end };
  }

  // 폭이 전체보다 좁으므로 초과는 한쪽에서만 일어난다
  const span = end - start;
  if (start < fullRange.start) {
    return { start: fullRange.start, end: fullRange.start + span };
  }
  if (end > fullRange.end) {
    return { start: fullRange.end - span, end: fullRange.end };
  }

  return { start, end };
}

/**
 * 음수·NaN 등 의미 없는 minRange는 기본값으로 대체. 명시적 0은 허용.
 * clampRange와 zoomRange가 공유한다 (core 내부용 — 패키지 공개 API 아님).
 */
export function sanitizeMinRange(minRange: number | undefined): number {
  if (minRange === undefined || !Number.isFinite(minRange) || minRange < 0) {
    return DEFAULT_MIN_RANGE;
  }
  return minRange;
}

/**
 * 스칼라 값을 [min, max] 구간으로 자른다.
 * zoomRange(pivot)·resizeRange(Handle 목표)가 공유한다 (core 내부용 — 패키지 공개 API 아님).
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
