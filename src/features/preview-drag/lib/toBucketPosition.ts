import type { Range } from "../../../entities/range";

/**
 * 컨테이너 rect 기준 clientX → Bucket Position.
 * 좌표계 계약(plot 영역 = 컨테이너) 덕분에 선형 변환만으로 충분하다.
 * 컨테이너 밖 위치도 자르지 않는다 — 경계 보정은 core의 몫.
 */
export function toBucketPosition(
  rect: DOMRect,
  clientX: number,
  fullRange: Range,
): number {
  const ratio = (clientX - rect.left) / rect.width;
  return fullRange.start + ratio * (fullRange.end - fullRange.start);
}
