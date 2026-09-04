/**
 * usePointerDragSession — 포인터 드래그의 공통 생명주기 (라이브러리 내부 공용).
 *
 * Preview Handle/Window 드래그(usePreviewDrag)와 Main Drag Pan(useMainDragPan)이 공유하는 골격:
 * - 주 포인터의 주 버튼만 드래그로 취급 (우클릭, 멀티터치 두 번째 손가락 제외)
 * - 포인터 캡처: 포인터가 요소·차트 밖으로 나가도 move/up이 계속 이 요소로 온다
 * - pointerId 매칭: 드래그를 시작한 포인터의 move만 반영한다
 * - 종료를 lostpointercapture 한 곳으로 수렴: 캡처된 포인터는 up/cancel 시 자동으로 캡처가 풀리며 이 이벤트가 항상 발생한다.
 *   세션이 있을 때만 종료 처리하므로 pointerup과 겹쳐 들어와도 onEnd는 드래그당 정확히 1회 나간다.
 *
 * "무엇을 드래그하는가"(rect 측정, 픽셀 → Position 번역)는 onStart/onMove의 몫이다.
 */
import { useMemo, useRef } from "react";
import type { DOMAttributes, PointerEvent as ReactPointerEvent } from "react";

export interface PointerDragSessionOptions<TSession> {
  /**
   * 드래그 시작 (pointerdown, 가드·캡처 직후) — 이 드래그의 세션 데이터를 만든다.
   * 1회성 rect 측정, stopPropagation/preventDefault, 시작 콜백 호출은 여기서.
   * null을 반환하면 드래그를 시작하지 않는다 (캡처도 즉시 해제된다).
   */
  onStart: (event: ReactPointerEvent<HTMLElement>) => TSession | null;
  /** 드래그 이동 — 시작한 포인터의 move마다 세션 데이터와 함께 호출 */
  onMove: (event: ReactPointerEvent<HTMLElement>, session: TSession) => void;
  /** 드래그 종료 — up/cancel 어느 경로로 끝나든 정확히 1회 */
  onEnd: () => void;
}

/** 진행 중인 드래그. 렌더에 쓰이는 값이 아니라 state가 아닌 ref에 담는다 */
interface ActiveDrag<TSession> {
  pointerId: number;
  session: TSession;
}

/**
 * 반환한 이벤트 props를 드래그 대상 요소에 스프레드한다.
 * 드래그 도중 리렌더로 핸들러가 교체되어도 세션(ref)은 유지된다.
 */
export function usePointerDragSession<TSession>({
  onStart,
  onMove,
  onEnd,
}: PointerDragSessionOptions<TSession>): DOMAttributes<HTMLElement> {
  const dragRef = useRef<ActiveDrag<TSession> | null>(null);

  // 핸들러 묶음의 참조를 고정해 대상 요소가 매 렌더 새 props를 받지 않게 한다.
  // (콜백 묶음 객체는 매 렌더 새로 만들어지므로 개별 함수를 deps로 쓴다)
  return useMemo<DOMAttributes<HTMLElement>>(
    () => ({
      onPointerDown: (event) => {
        if (!event.isPrimary || event.button !== 0) return;

        // 캡처를 먼저 건다 — onStart의 콜백 체인이 도는 동안에도 포인터를 붙잡아 둔다
        event.currentTarget.setPointerCapture(event.pointerId);
        const session = onStart(event);
        if (session === null) {
          // 해제가 일으키는 lostpointercapture는 세션이 없어 무시된다
          event.currentTarget.releasePointerCapture(event.pointerId);
          return;
        }
        dragRef.current = { pointerId: event.pointerId, session };
      },

      onPointerMove: (event) => {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        onMove(event, drag.session);
      },

      onLostPointerCapture: () => {
        if (dragRef.current === null) return;
        dragRef.current = null;
        onEnd();
      },
    }),
    [onStart, onMove, onEnd],
  );
}
