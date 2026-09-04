/**
 * useMainDragPan — Main Chart wrapper의 Drag Pan 배선 (hook 내부용).
 *
 * 지도처럼 콘텐츠가 손가락을 따라온다 — 오른쪽으로 끌면 이전(왼쪽) 데이터가 드러나도록 range는 포인터 반대 방향으로 이동한다.
 * 이동량은 "시작 시점 Window 폭" 비율로 환산한다 (Preview는 전체 폭 비율 — 다름).
 * plot 폭은 wrapper 폭 − inset 근사 (완전 정밀화는 v1.x Bridge).
 * 포인터 생명주기(캡처·1회 종료)는 usePointerDragSession이 담당.
 */
import { useCallback } from "react";
import type { DOMAttributes, PointerEvent as ReactPointerEvent } from "react";
import type { Range } from "../../../entities/range";
import { usePointerDragSession } from "../../../shared/hooks";

interface MainDragSession {
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
}: UseMainDragPanOptions): DOMAttributes<HTMLElement> {
  const onStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>): MainDragSession => {
      // pointerdown을 취소하면 mousedown의 기본 동작(텍스트 선택 시작)이 눌린다 — 사용자 차트에 userSelect 스타일을 강제하지 않고 드래그 중 선택을 막는 방법
      event.preventDefault();

      const rect = event.currentTarget.getBoundingClientRect();
      // 시작 콜백(세션 begin) 먼저 — 그 안의 commit이 range를 바꿔도 스냅샷에 반영되도록
      onDragStart();
      return {
        startClientX: event.clientX,
        plotWidth: rect.width - inset.left - inset.right,
        startRange: readRange(),
      };
    },
    [onDragStart, readRange, inset],
  );

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>, session: MainDragSession) => {
      const { startRange, startClientX, plotWidth } = session;
      if (plotWidth <= 0) return;

      const span = startRange.end - startRange.start;
      const deltaPositions =
        ((event.clientX - startClientX) / plotWidth) * span;

      // 콘텐츠가 손가락을 따라오도록 range는 반대 방향으로 이동한다
      onPanTo(startRange.start - deltaPositions);
    },
    [onPanTo],
  );

  return usePointerDragSession({ onStart, onMove, onEnd: onDragEnd });
}
