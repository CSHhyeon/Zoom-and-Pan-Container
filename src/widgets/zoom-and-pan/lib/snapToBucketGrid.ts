import {
  clampRange,
  type Range,
  type RangeConstraints,
} from "../../../entities/range";

/**
 * 소수 Position 결과(anchor zoom·중앙 배치)를 정수 Bucket 격자로 snap.
 *
 * 폭을 먼저 반올림해 부동소수점 찌꺼기(예: 3.0000000000000018)를 제거하고, 시작점을 반올림한 뒤(이동 최대 0.5칸) 관문으로 마무리한다.
 * 결과를 콜백(snapshot)이 그대로 받으므로 반드시 유효한 Range여야 한다.
 * (snap은 core가 아니라 hook 계층의 몫 — CLAUDE.md 확정 결정)
 */
export function snapToBucketGrid(
  range: Range,
  constraints: RangeConstraints,
): Range {
  const span = Math.round(range.end - range.start);
  const start = Math.round(range.start);
  return clampRange({ start, end: start + span }, constraints);
}
