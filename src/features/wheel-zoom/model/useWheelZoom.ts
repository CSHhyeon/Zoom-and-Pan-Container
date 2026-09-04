/**
 * useWheelZoom — Main Chart wrapper의 Wheel 입력 배선 (라이브러리 내부용).
 *
 * React의 onWheel은 root에 passive로 등록되어 preventDefault가 무시된다.
 * 그래서 ref로 요소를 받아 네이티브 non-passive 리스너를 직접 단다 — 차트 위에서 휠은 항상 Zoom이고 페이지 스크롤은 차단해야 하기 때문.
 *
 * 포인터 중심 Zoom의 anchor 측정도 여기서 한다 — plot 영역 안 포인터 위치 비율(anchorRatio, lib/toAnchorRatio)을 onZoom에 넘긴다.
 * 비율 → Range Position 번역은 controller의 몫.
 *
 * Wheel에는 pointerup 같은 "조작 끝" 신호가 없다.
 * 마지막 휠 후 WHEEL_COMMIT_DELAY_MS 동안 추가 입력이 없으면 조작이 끝난 것으로 보고 세션을 닫는다(debounce) — commit 판정은 세션(useRangeCallbacks)의 몫.
 */
import { useCallback, useEffect, useRef } from "react";
import type { ZoomDirection } from "../../../entities/range";
import { useLatestRef } from "../../../shared/hooks";
import { WHEEL_COMMIT_DELAY_MS } from "../constants";
import { toAnchorRatio } from "../lib/toAnchorRatio";

interface UseWheelZoomOptions {
  /**
   * 휠 1회 회전을 Zoom으로 적용 — deltaY 부호가 방향으로 번역되어 온다.
   * anchorRatio는 plot 영역 안 포인터 위치 비율(0 = 왼쪽 끝, 1 = 오른쪽 끝).
   * plot 폭을 잴 수 없으면 undefined — 수신 측은 중앙 기준으로 폴백한다.
   */
  onZoom: (direction: ZoomDirection, anchorRatio: number | undefined) => void;
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

  const handleWheel = useCallback(
    (event: WheelEvent, element: HTMLElement) => {
      // 차트 위에서 휠은 항상 Zoom — 페이지 스크롤 차단 (Ctrl+휠 옵션은 향후)
      event.preventDefault();
      // 방향은 deltaY의 부호만 사용한다 — deltaMode(픽셀/줄/페이지 단위) 무관
      if (event.deltaY === 0) return;

      // 타이머가 살아 있다 = wheel 조작 진행 중. 없으면 새 조작의 첫 회전이다
      if (timerRef.current === null) optionsRef.current.onSessionStart();
      else window.clearTimeout(timerRef.current);

      optionsRef.current.onZoom(
        event.deltaY < 0 ? "in" : "out",
        toAnchorRatio(element, event.clientX, optionsRef.current.inset),
      );

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        optionsRef.current.onSessionEnd();
      }, WHEEL_COMMIT_DELAY_MS);
    },
    [optionsRef],
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

  // 언마운트: 리스너는 ref(null)가 정리하지만, 대기 중인 타이머는 여기서 끊는다 (사라진 컴포넌트의 세션 종료 콜백 호출 방지)
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { mainRef, settle };
}
