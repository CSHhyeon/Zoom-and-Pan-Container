/**
 * usePreviewDrag — Preview 위 드래그를 "픽셀 → Bucket Position 번역"까지만 담당하는 내부 hook.
 * 반환한 이벤트 props를 드래그 대상(Handle button·Window div)에 스프레드한다.
 * 포인터 생명주기(캡처·1회 종료)는 usePointerDragSession이, 픽셀 → Position 계산은 lib/toBucketPosition이 담당.
 *
 * 컨테이너 밖 위치([0,1] 밖 비율)도 자르지 않고 그대로 onDragTo로 넘긴다 — 경계 보정 규칙을 UI에 중복 구현하지 않기 위해서다.
 * snap·최소 폭·경계 보정은 controller → core의 몫.
 */
import { useCallback } from "react";
import type {
  DOMAttributes,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import type { Range } from "../../../entities/range";
import { usePointerDragSession } from "../../../shared/hooks";
import { toBucketPosition } from "../lib/toBucketPosition";

/** Preview 드래그의 수신자 — 번역된 위치와 드래그 생명주기를 받는다 */
export interface PreviewDragCallbacks {
  /** 번역된 Bucket Position — pointermove마다 호출 */
  onDragTo: (position: number) => void;
  /** 드래그 시작 (pointerdown, 캡처 직후). 잡은 지점의 Position을 함께 준다 */
  onDragStart?: (startPosition: number) => void;
  /** 드래그 종료 — up/cancel 어느 경로로 끝나든 정확히 1회 */
  onDragEnd?: () => void;
}

interface PreviewDragSession {
  /**
   * pointerdown 시점에 1회 측정한 컨테이너 rect.
   * move마다 재측정하면 매번 강제 layout이 일어난다.
   * (드래그 중 컨테이너 크기 불변 전제 — Chart Resize 대응은 범위 제외)
   */
  rect: DOMRect;
}

export function usePreviewDrag(
  containerRef: RefObject<HTMLDivElement | null>,
  fullRange: Range,
  { onDragTo, onDragStart, onDragEnd }: PreviewDragCallbacks,
): DOMAttributes<HTMLElement> {
  const onStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>): PreviewDragSession | null => {
      const container = containerRef.current;
      if (!container) return null;

      // 이벤트 우선순위 Handle > Window > Dim — 아래 레이어로 전파 차단
      event.stopPropagation();
      const rect = container.getBoundingClientRect();
      onDragStart?.(toBucketPosition(rect, event.clientX, fullRange));
      return { rect };
    },
    [containerRef, fullRange, onDragStart],
  );

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>, { rect }: PreviewDragSession) =>
      onDragTo(toBucketPosition(rect, event.clientX, fullRange)),
    [onDragTo, fullRange],
  );

  const onEnd = useCallback(() => onDragEnd?.(), [onDragEnd]);

  return usePointerDragSession({ onStart, onMove, onEnd });
}
