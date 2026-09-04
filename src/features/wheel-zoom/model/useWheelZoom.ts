/**
 * useWheelZoom — Main Chart wrapper의 Wheel 입력 배선 (라이브러리 내부용).
 *
 * React의 onWheel은 root에 passive로 등록되어 preventDefault가 무시된다.
 * 그래서 ref로 요소를 받아 네이티브 non-passive 리스너를 직접 단다 — 차트 위에서 휠은 항상 Zoom이고 페이지 스크롤은 차단해야 하기 때문.
 *
 * 포인터 중심 Zoom의 anchor 측정도 여기서 한다 — plot 영역 안 포인터 위치 비율(anchorRatio, lib/toAnchorRatio)을 onZoom에 넘긴다.
 * 비율 → Range Position 번역은 controller의 몫.
 *
 * 매 틱 후 같은 좌표의 mousemove를 재전송한다(rAF) — mousemove 없이 데이터가 바뀌면
 * 차트의 hover 상태(Tooltip 선택)가 이전 배열 기준으로 남기 때문. 아래 scheduleHoverRefresh 참고.
 *
 * Wheel에는 pointerup 같은 "조작 끝" 신호가 없다.
 * 마지막 휠 후 WHEEL_COMMIT_DELAY_MS 동안 추가 입력이 없으면 조작이 끝난 것으로 보고 세션을 닫는다(debounce) — commit 판정은 세션(useRangeCallbacks)의 몫.
 */
import { useCallback, useEffect, useRef } from "react";
import type { ZoomDirection } from "../../../entities/range";
import { useLatestRef } from "../../../shared/hooks";
import { WHEEL_COMMIT_DELAY_MS } from "../constants";
import { toAnchorRatio, toClientX } from "../lib/toAnchorRatio";

interface UseWheelZoomOptions {
  /**
   * 휠 1회 회전을 Zoom으로 적용 — deltaY 부호가 방향으로 번역되어 온다.
   * anchorRatio는 plot 영역 안 포인터 위치 비율(0 = 왼쪽 끝, 1 = 오른쪽 끝).
   * plot 폭을 잴 수 없으면 undefined — 수신 측은 중앙 기준으로 폴백한다.
   *
   * 반환값: anchor로 고정된 데이터 포인트가 새 창에서 렌더되는 plot 비율.
   * 있으면 hover 재전송을 이 위치로 보내 Tooltip 선택을 anchor 데이터에 고정한다. 없으면 포인터 원좌표로 재전송.
   */
  onZoom: (
    direction: ZoomDirection,
    anchorRatio: number | undefined,
  ) => number | undefined;
  /** wheel 조작 세션 시작 (연속 휠의 첫 회전에서 1회) */
  onSessionStart: () => void;
  /** wheel 조작 세션 종료 — 마지막 회전 후 WHEEL_COMMIT_DELAY_MS 뒤 1회 */
  onSessionEnd: () => void;
  /** wrapper 안 plot 영역 근사용 좌우 여백(px) */
  inset: { left: number; right: number };
}

export function useWheelZoom(options: UseWheelZoomOptions): {
  /** mainProps에 담을 ref — 붙는 요소에 non-passive wheel 리스너를 단다 */
  mainRef: (element: HTMLDivElement | null) => void;
  /**
   * 대기 중인 wheel 조작을 지금 즉시 종료한다.
   * 다른 조작(드래그 등)이 시작되기 전에 호출해 세션이 섞이지 않게 한다.
   */
  settle: () => void;
} {
  const optionsRef = useLatestRef(options);

  const timerRef = useRef<number | null>(null);

  const settle = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    optionsRef.current.onSessionEnd();
  }, [optionsRef]);

  /**
   * hover 재계산 신호 — Zoom은 mousemove 없이 차트 데이터를 바꾸므로, 차트 라이브러리의 hover 상태
   * (Recharts Tooltip의 activeIndex 등)는 마지막 mousemove 기준으로 남아 엉뚱한 포인트를 가리키게 된다.
   * 매 휠 틱 후 같은 포인터 좌표의 mousemove를 재전송해 새 렌더 위에서 "포인터와 가장 가까운 x"를 다시 잡게 한다.
   * rAF 사용: React 커밋 뒤(새 데이터가 그려진 뒤)에 실행되고, 프레임 내 연속 틱은 1회로 합쳐진다.
   */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRefreshRafRef = useRef<number | null>(null);

  const scheduleHoverRefresh = useCallback(
    (element: HTMLElement, x: number, y: number) => {
      pointerRef.current = { x, y };
      if (hoverRefreshRafRef.current !== null) return;

      hoverRefreshRafRef.current = window.requestAnimationFrame(() => {
        hoverRefreshRafRef.current = null;
        const pointer = pointerRef.current;
        if (pointer === null) return;
        // wrapper에 직접 쏘면 버블링이 위로만 가서 차트 내부 리스너에 닿지 않는다 — 포인터 바로 아래 요소에서 쏜다
        const target = element.ownerDocument.elementFromPoint(
          pointer.x,
          pointer.y,
        );
        if (target === null || !element.contains(target)) return;
        target.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: pointer.x,
            clientY: pointer.y,
            bubbles: true,
          }),
        );
      });
    },
    [],
  );

  const handleWheel = useCallback(
    (event: WheelEvent, element: HTMLElement) => {
      // 차트 위에서 휠은 항상 Zoom — 페이지 스크롤 차단 (Ctrl+휠 옵션은 향후)
      event.preventDefault();
      // 방향은 deltaY의 부호만 사용한다 — deltaMode(픽셀/줄/페이지 단위) 무관
      if (event.deltaY === 0) return;

      // 타이머가 살아 있다 = wheel 조작 진행 중. 없으면 새 조작의 첫 회전이다
      if (timerRef.current === null) optionsRef.current.onSessionStart();
      else window.clearTimeout(timerRef.current);

      const anchorDisplayRatio = optionsRef.current.onZoom(
        event.deltaY < 0 ? "in" : "out",
        toAnchorRatio(element, event.clientX, optionsRef.current.inset),
      );
      // 재전송 위치: anchor 데이터의 표시 위치가 있으면 거기로 — 포인터 원좌표로 쏘면
      // 두 점 사이에서 최근접 판정이 틱마다 뒤집혀 Tooltip이 이웃 점 사이를 널뛴다
      const refreshX =
        anchorDisplayRatio === undefined
          ? event.clientX
          : (toClientX(element, anchorDisplayRatio, optionsRef.current.inset) ??
            event.clientX);
      scheduleHoverRefresh(element, refreshX, event.clientY);

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        optionsRef.current.onSessionEnd();
      }, WHEEL_COMMIT_DELAY_MS);
    },
    [optionsRef, scheduleHoverRefresh],
  );

  /**
   * ref callback으로 리스너를 관리한다.
   * React 18은 cleanup 반환을 지원하지 않으므로(unmount 시 ref(null) 호출), 이전 정리 함수를 ref에 들고 있다가 교체·해제 시 직접 실행한다.
   */
  const detachRef = useRef<(() => void) | null>(null);

  const mainRef = useCallback(
    (element: HTMLDivElement | null) => {
      detachRef.current?.();
      detachRef.current = null;
      if (element === null) return;

      const listener = (event: WheelEvent) => handleWheel(event, element);
      element.addEventListener("wheel", listener, { passive: false });
      detachRef.current = () => element.removeEventListener("wheel", listener);
    },
    [handleWheel],
  );

  // 언마운트: 리스너는 ref(null)가 정리하지만, 대기 중인 타이머·rAF는 여기서 끊는다 (사라진 컴포넌트의 콜백·재전송 방지)
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (hoverRefreshRafRef.current !== null)
        window.cancelAnimationFrame(hoverRefreshRafRef.current);
    },
    [],
  );

  return { mainRef, settle };
}
