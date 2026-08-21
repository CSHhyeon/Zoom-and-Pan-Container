/**
 * panRange — Window 폭을 유지한 채 위치만 이동.
 *
 * delta는 위치 단위(Bucket Position)이며 양수 = 오른쪽(큰 index).
 * 픽셀 → delta 변환과 부호(Main Drag는 손가락 반대 방향,
 * Preview Window Drag는 같은 방향)는 recharts 계층의 몫.
 */
import { clampRange } from "./clampRange";
import type { Range, RangeConstraints } from "./types";

/**
 * range를 delta만큼 평행이동한다.
 *
 * 경계를 넘는 이동은 clampRange가 폭을 유지한 채 벽에 붙여 멈춘다.
 * NaN/Infinity delta는 이동하지 않는다 (관문만 통과).
 */
export function panRange(
  range: Range,
  delta: number,
  constraints: RangeConstraints,
): Range {
  const safeDelta = Number.isFinite(delta) ? delta : 0;

  return clampRange(
    { start: range.start + safeDelta, end: range.end + safeDelta },
    constraints,
  );
}
