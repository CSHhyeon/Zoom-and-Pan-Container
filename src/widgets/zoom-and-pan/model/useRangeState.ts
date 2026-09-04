/**
 * useRangeState — Uncontrolled Range 상태의 소유자 (controller 내부용).
 *
 * "저장은 보정 없이 raw로, 읽기는 항상 관문(core clampRange)을 통과"라는 상태 규칙을 이 파일 하나로 격리한다.
 * raw 값이 어디서 왔든 읽기에서 한 번만 보정되므로 data 길이·minRange가 나중에 바뀌어도 range는 항상 유효하다.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  clampRange,
  type Range,
  type RangeConstraints,
} from "../../../entities/range";

export function useRangeState(
  constraints: RangeConstraints,
  defaultRange?: Range,
): {
  /** 렌더용 현재 Range — 항상 관문 통과를 마친 유효값 */
  range: Range;
  /** 이벤트 핸들러 전용 — 리렌더 대기 중인 변경까지 포함한 현재 유효 Range */
  readCurrentRange: () => Range;
  /** 모든 Range 쓰기가 거치는 유일한 setter — raw 저장 (보정은 읽기 시) */
  setRange: (next: Range) => void;
} {
  /**
   * Uncontrolled 상태의 원본.
   * - useState 초기화 함수는 최초 mount에만 실행된다 → 이후 defaultRange 변경은 무시
   * - null = "아직 아무도 range를 정하지 않음" → 렌더 시 fullRange를 따라간다 (data가 비어 있다가 나중에 채워지는 비동기 로딩에서도 전체 범위 유지)
   * - 보정 없이 raw로 저장한다. 유효성 보정은 resolveRange 관문이 전담한다
   */
  const [rawRange, setRawRange] = useState<Range | null>(
    () => defaultRange ?? null,
  );

  /**
   * rawRange의 동기 미러 — 반드시 setRange를 통해서만 함께 갱신한다.
   * 이벤트 핸들러(조작 연산, 세션 begin/end)는 setState가 리렌더에 반영되기 전에도 최신 값을 읽어야 하므로 state 대신 이 ref를 읽는다.
   */
  const rawRangeRef = useRef<Range | null>(rawRange);

  const setRange = useCallback((next: Range) => {
    rawRangeRef.current = next;
    setRawRange(next);
  }, []);

  /** 모든 Range 읽기가 통과하는 단일 관문 (core clampRange) */
  const resolveRange = useCallback(
    (raw: Range | null): Range =>
      clampRange(raw ?? constraints.fullRange, constraints),
    [constraints],
  );

  const range = useMemo<Range>(
    () => resolveRange(rawRange),
    [resolveRange, rawRange],
  );

  const readCurrentRange = useCallback(
    () => resolveRange(rawRangeRef.current),
    [resolveRange],
  );

  return { range, readCurrentRange, setRange };
}
