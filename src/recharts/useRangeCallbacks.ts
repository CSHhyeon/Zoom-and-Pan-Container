/**
 * useRangeCallbacks — onRangeChange · onRangeCommit 배선 (hook 내부용).
 *
 * - notifyChange: rAF throttle. 한 프레임에 여러 번 불려도 onRangeChange는
 *   프레임 끝에 최신 값으로 1회만 호출된다.
 * - begin/endInteraction: "한 번의 조작" 세션. end 시점에 시작 대비 Range가
 *   실제로 바뀐 경우에만 onRangeCommit을 1회 호출한다.
 * - end는 멱등 — pointerup과 lostpointercapture가 겹쳐 들어와도 두 번째는 무시된다.
 * - 사용자 콜백은 latest ref로 읽는다 — 인라인 함수를 넘겨도 배선이 다시
 *   만들어지지 않고, rAF가 실행되는 시점의 최신 콜백이 호출된다.
 */
import { useCallback, useEffect, useRef } from "react";
import { isSameRange, type Range } from "../core";

/** Range 변경을 일으킨 조작의 출처. 조작 기능이 추가될 때마다 늘어난다 */
export type RangeChangeSource = "resize-left" | "resize-right" | "window-pan";

/** 콜백이 받는 페이로드 — 현재 Range */
export interface RangeSnapshot {
  range: Range;
}

/** 콜백이 받는 부가 정보 — 어떤 조작이 만든 변경인지 */
export interface RangeChangeMeta {
  source: RangeChangeSource;
}

export interface UseRangeCallbacksOptions {
  onRangeChange?: (snapshot: RangeSnapshot, meta: RangeChangeMeta) => void;
  onRangeCommit?: (snapshot: RangeSnapshot, meta: RangeChangeMeta) => void;
}

/** rAF가 모아 보내는 "아직 알리지 않은 마지막 변경" */
interface PendingChange {
  range: Range;
  source: RangeChangeSource;
}

/** begin ~ end 사이의 조작 세션. startRange가 commit의 비교 기준이 된다 */
interface InteractionSession {
  source: RangeChangeSource;
  startRange: Range;
}

export function useRangeCallbacks(options: UseRangeCallbacksOptions): {
  /** 조작이 range를 실제로 바꿨을 때 호출 — onRangeChange를 프레임당 1회로 묶는다 */
  notifyChange: (range: Range, source: RangeChangeSource) => void;
  /** 조작 세션 시작. 이미 진행 중이면 무시(먼저 시작한 조작 유지) */
  beginInteraction: (source: RangeChangeSource, currentRange: Range) => void;
  /** 조작 세션 종료. 마지막 change를 flush한 뒤, 시작 대비 변경 시에만 commit 1회 */
  endInteraction: (currentRange: Range) => void;
} {
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });

  const pendingRef = useRef<PendingChange | null>(null);
  const rafRef = useRef<number | null>(null);
  const sessionRef = useRef<InteractionSession | null>(null);

  /** 예약을 취소하고, 모아둔 change가 있으면 지금 즉시 내보낸다 */
  const flushChange = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending === null) return;
    pendingRef.current = null;
    callbacksRef.current.onRangeChange?.(
      { range: pending.range },
      { source: pending.source },
    );
  }, []);

  const notifyChange = useCallback(
    (range: Range, source: RangeChangeSource) => {
      pendingRef.current = { range, source };
      if (rafRef.current !== null) return; // 이번 프레임 예약 완료 — 값만 덮어쓴다
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        flushChange();
      });
    },
    [flushChange],
  );

  const beginInteraction = useCallback(
    (source: RangeChangeSource, currentRange: Range) => {
      if (sessionRef.current !== null) return;
      sessionRef.current = { source, startRange: currentRange };
    },
    [],
  );

  const endInteraction = useCallback(
    (currentRange: Range) => {
      const session = sessionRef.current;
      if (session === null) return; // 중복 end(pointerup + lostpointercapture) 무시
      sessionRef.current = null;

      // 마지막 change가 commit보다 늦게 도착하는 역전을 막는다
      flushChange();

      if (isSameRange(currentRange, session.startRange)) return; // 실제 변경 없음
      callbacksRef.current.onRangeCommit?.(
        { range: currentRange },
        { source: session.source },
      );
    },
    [flushChange],
  );

  // 언마운트 시 예약된 rAF 정리 (사라진 컴포넌트의 콜백 호출 방지)
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { notifyChange, beginInteraction, endInteraction };
}
