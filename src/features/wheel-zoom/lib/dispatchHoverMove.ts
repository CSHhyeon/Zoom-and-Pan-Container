/**
 * dispatchHoverMove — 포인터 좌표로 mousemove를 재전송한다.
 *
 * Zoom은 mousemove 없이 차트 데이터를 바꾸므로, 차트 라이브러리의 hover 상태
 * (Recharts Tooltip의 activeIndex 등)는 마지막 mousemove 기준으로 남아 엉뚱한 포인트를 가리키게 된다.
 * 새 렌더 위에서 같은 좌표의 mousemove를 다시 흘려보내 hover를 재계산시키는 신호다.
 *
 * wrapper에 직접 쏘면 버블링이 위로만 가서 차트 내부 리스너에 닿지 않는다 —
 * 포인터 바로 아래 요소(elementFromPoint)에서 쏘되, wrapper 밖 요소면 무시한다.
 */
export function dispatchHoverMove(
  element: HTMLElement,
  x: number,
  y: number,
): void {
  const target = element.ownerDocument.elementFromPoint(x, y);
  if (target === null || !element.contains(target)) return;

  target.dispatchEvent(
    new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }),
  );
}
