/**
 * useMainDragPan — Main Chart wrapper의 Drag Pan 배선 (hook 내부용).
 *
 * 지도처럼 콘텐츠가 손가락을 따라온다 — 오른쪽으로 끌면 이전(왼쪽) 데이터가 드러나도록 range는 포인터 반대 방향으로 이동한다.
 * 이동량은 "시작 시점 Window 폭" 비율로 환산한다 (Preview는 전체 폭 비율 — 다름).
 * plot 폭은 wrapper 폭 − inset 근사 (완전 정밀화는 v1.x Bridge).
 */
import { useMemo, useRef } from "react";
import type { DOMAttributes } from "react";
import type { Range } from "../core";

interface DragSession {
  /** 이 드래그를 시작한 포인터 — 다른 손가락·마우스의 move를 무시하기 위해 기억 */
  pointerId: number;
  startClientX: number;
  /** pointerdown 시점 1회 측정 — move마다 재측정하면 매번 강제 layout이 일어난다 */
  plotWidth: number;
  /** 시작 Range — 매 move를 "시작 + 총 이동량"으로 계산해 소수 오차 누적을 막는다 */
  startRange: Range;
}

interface UseMainDragPanOptions {
  /** 시작 Range + 총 이동량으로 환산한 목표 start — pointermove마다 호출 */
  onPanTo: (nextStart: number) => void;
  onDragStart: () => void;
  /** up/cancel 어느 경로로 끝나든 정확히 1회 */
  onDragEnd: () => void;
  /** 드래그 시작 시점의 range 스냅샷용 */
  readRange: () => Range;
  /** wrapper 안 plot 영역 근사용 좌우 여백(px) */
  inset: { left: number; right: number };
}

export function useMainDragPan({
  onPanTo,
  onDragStart,
  onDragEnd,
  readRange,
  inset,
}: UseMainDragPanOptions): DOMAttributes<HTMLDivElement> {
  const sessionRef = useRef<DragSession | null>(null);

  return useMemo<DOMAttributes<HTMLDivElement>>(
    () => ({
      onPointerDown: (event) => {
        // 주 포인터의 주 버튼만 드래그로 취급 (우클릭, 멀티터치 두 번째 손가락 제외)
        if (!event.isPrimary || event.button !== 0) return;

        // pointerdown을 취소하면 mousedown의 기본 동작(텍스트 선택 시작)이 눌린다
        // — 사용자 차트에 userSelect 스타일을 강제하지 않고 드래그 중 선택을 막는 방법
        event.preventDefault();
        // 캡처: 포인터가 차트 밖으로 나가도 move/up이 계속 이 요소로 온다
        event.currentTarget.setPointerCapture(event.pointerId);

        const rect = event.currentTarget.getBoundingClientRect();
        sessionRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          plotWidth: rect.width - inset.left - inset.right,
          startRange: readRange(),
        };
        onDragStart();
      },

      onPointerMove: (event) => {
        const session = sessionRef.current;
        if (!session || event.pointerId !== session.pointerId) return;
        if (session.plotWidth <= 0) return;

        const { startRange, startClientX, plotWidth } = session;
        const span = startRange.end - startRange.start;
        const deltaPositions =
          ((event.clientX - startClientX) / plotWidth) * span;

        // 콘텐츠가 손가락을 따라오도록 range는 반대 방향으로 이동한다
        onPanTo(startRange.start - deltaPositions);
      },

      // 드래그 종료를 한 곳으로 수렴: 캡처된 포인터는 up/cancel 시 자동으로
      // 캡처가 풀리며 이 이벤트가 항상 발생한다. 세션이 있을 때만 종료 처리하므로
      // pointerup과 겹쳐 들어와도 onDragEnd는 드래그당 1회만 나간다.
      onLostPointerCapture: () => {
        if (sessionRef.current === null) return;
        sessionRef.current = null;
        onDragEnd();
      },
    }),
    [onPanTo, onDragStart, onDragEnd, readRange, inset],
  );
}
