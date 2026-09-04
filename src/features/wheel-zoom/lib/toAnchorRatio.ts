/**
 * wrapper 기준 clientX → plot 영역 안 포인터 위치 비율.
 *
 * wrapper 폭에서 inset(YAxis·margin 몫)을 빼 plot 영역을 근사한다.
 * 잔여 오차는 카테고리 축의 자체 padding 수준 (완전 정밀화는 v1.x Bridge의 몫).
 * 유효 폭이 없으면 undefined — 수신 측은 중앙 기준으로 폴백한다.
 */
export function toAnchorRatio(
  element: HTMLElement,
  clientX: number,
  inset: { left: number; right: number },
): number | undefined {
  const rect = element.getBoundingClientRect();
  const plotWidth = rect.width - inset.left - inset.right;
  if (plotWidth <= 0) return undefined;

  return (clientX - rect.left - inset.left) / plotWidth;
}
