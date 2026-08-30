/**
 * useZoomAndPanController — Zoom & Pan 상태의 유일한 소유자 (headless hook).
 *
 * "현재 보고 있는 구간(range)" 하나를 소유하고, 그로부터 파생되는 것들
 * (visibleData, previewData, 차트에 꽂을 props)을 계산해서 돌려준다.
 * UI는 그리지 않으며, 모든 Range 변경은 core clampRange 단일 관문을 통과한다.
 */
import { useCallback, useMemo, useState } from "react";
import type React from "react";
import {
  clampRange,
  resizeLeftRange,
  resizeRightRange,
  type Range,
  type RangeConstraints,
} from "../core";

// 사용자가 defaultRange 등을 작성할 때 필요한 타입을 hook과 같은 곳에서 제공한다.
export type { Range } from "../core";

//   ############## 타입 ##############

/**
 * T: 데이터 한 행의 타입.
 * TX: x값의 타입.
 *
 * getX는 한 행에서 x축에 해당하는 값을 뽑아주는 함수임.
 * 그 x값의 타입이 T를 안다고 해서 자동으로 정해지지 않기 때문에
 * '행의 타입(T)'과 '그 행에서 뽑은 x값의 타입(TX)'을 별도로 받음.
 */
export interface UseZoomAndPanControllerOptions<T, TX = unknown> {
  /** 전체 원본 데이터. hook은 이 배열을 자르기만 하고 변형하지 않는다 */
  data: readonly T[];
  /** Range 표현 모드. 현재 "bucket"만 지원 */
  rangeMode?: "bucket";
  /**
   * 한 행에서 x값을 뽑는 함수. 아직 소비하지 않는다 —
   * Snap 옵션·경계값 스냅샷·Handle Tooltip이 normalizeBucket과 함께 사용할 예정.
   * (Bucket 모드의 Preview 축은 배열 index 자체이므로 getX가 필요 없다)
   */
  getX: (datum: T, index: number) => TX;
  /**
   * Preview 추이 차트에 그릴 y값을 뽑는 함수.
   * 생략 시 Preview는 추이 없이 Dim/Window/Handle만 그린다.
   */
  getY?: (datum: T, index: number) => number;
  /**
   * 초기 Range (Uncontrolled). 최초 mount에만 반영되고 이후 변경은 무시된다.
   * 생략 시 전체 범위에서 시작한다.
   */
  defaultRange?: Range;
  /** 최소 범위 폭(`end - start`). 생략 시 core 기본값(1 = 최소 두 포인트) */
  minRange?: number;
}

/**
 * Preview 추이 차트가 소비하는 한 포인트.
 *
 * 좌표계 계약: Dim/Window/Handle은 컨테이너 폭 기준 %로 배치되므로,
 * 추이 차트는 plot 영역이 컨테이너와 정확히 일치해야 한다 — margin 전부 0,
 * 축 hide, `XAxis type="number"` + `domain={[fullRange.start, fullRange.end]}` 명시.
 * 이 계약이 깨지면 오버레이와 추이선이 어긋난다.
 */
export interface PreviewPoint {
  /** 정규화 X 위치 — Bucket 모드에서는 데이터 배열 index */
  __rangeX: number;
  /** getY가 돌려준 y값. getY 미제공 시 0 */
  __y: number;
}

export interface ZoomAndPanController<T> {
  /** 현재 Window에 포함되는 데이터 slice — 사용자 차트의 data로 전달 */
  visibleData: T[];
  /** 현재 Range (Bucket Index 기준, 양끝 포함) */
  range: Range;
  /** 전체 데이터 범위 */
  fullRange: Range;
  /** Range 변경의 외부 진입점. 어떤 값이 와도 core clampRange를 거쳐 보정된다 */
  setRange: (next: Range) => void;
  /**
   * Left Handle Resize — end는 고정하고 start만 nextStart로 옮긴다.
   * nextStart는 Bucket Position(소수 가능). 반올림 snap 후 core resizeLeftRange를
   * 거치므로 최소 폭(`end - minRange`)과 왼쪽 경계(`fullRange.start`)를 넘지 않는다.
   */
  resizeLeft: (nextStart: number) => void;
  /**
   * Right Handle Resize — start는 고정하고 end만 nextEnd로 옮긴다.
   * nextEnd는 Bucket Position(소수 가능). 반올림 snap 후 core resizeRightRange를
   * 거치므로 최소 폭(`start + minRange`)과 오른쪽 경계(`fullRange.end`)를 넘지 않는다.
   */
  resizeRight: (nextEnd: number) => void;
  /** 원본 전체 데이터 — 사용자가 index로 원본 datum을 되찾을 때 사용 */
  data: readonly T[];
  /**
   * Preview 추이 차트용 전체 데이터 (`__rangeX` = 배열 index).
   * range와 무관하게 계산되므로 드래그 중에도 배열 참조가 유지된다.
   */
  previewData: PreviewPoint[];
  /** Main Chart wrapper div에 스프레드할 이벤트 props. Wheel Zoom·Drag Pan이 여기에 채워질 예정 */
  mainProps: React.HTMLAttributes<HTMLDivElement>;
  /** YAxis domain — 아직 항상 undefined (Recharts 오토스케일에 위임) */
  yDomain: [number, number] | undefined;
  /** Tooltip active — 아직 항상 undefined (Recharts가 관리) */
  tooltipActive: boolean | undefined;
}

//   ############## 구현 ##############

export function useZoomAndPanController<T, TX = unknown>(
  options: UseZoomAndPanControllerOptions<T, TX>,
): ZoomAndPanController<T> {
  const { data, defaultRange, minRange, getY } = options;

  const constraints = useMemo<RangeConstraints>(
    () => ({
      fullRange: { start: 0, end: Math.max(0, data.length - 1) },
      minRange,
    }),
    [data.length, minRange],
  );

  /**
   * Uncontrolled 상태의 원본.
   * - useState 초기화 함수는 최초 mount에만 실행된다 → 이후 defaultRange 변경은 무시
   * - null = "아직 아무도 range를 정하지 않음" → 렌더 시 fullRange를 따라간다
   *   (data가 비어 있다가 나중에 채워지는 비동기 로딩에서도 전체 범위 유지)
   * - 보정 없이 raw로 저장한다. 유효성 보정은 resolveRange 관문이 전담한다
   */
  const [rawRange, setRawRange] = useState<Range | null>(
    () => defaultRange ?? null,
  );

  /**
   * 모든 Range 변경 경로가 통과하는 단일 관문 (core clampRange).
   * raw 값이 어디서 왔든 여기서 한 번만 보정되므로
   * data 길이·minRange가 나중에 바뀌어도 range는 항상 유효하다.
   */
  const resolveRange = useCallback(
    (raw: Range | null): Range =>
      clampRange(raw ?? constraints.fullRange, constraints),
    [constraints],
  );

  const range = useMemo<Range>(
    () => resolveRange(rawRange),
    [resolveRange, rawRange],
  );

  const setRange = useCallback((next: Range) => setRawRange(next), []);

  /**
   * 조작 연산(Handle Resize 등)의 공통 규칙으로 range를 갱신한다.
   * - 함수형 업데이트: move가 리렌더보다 촘촘해도 항상 최신 상태 기준으로 계산
   * - 결과가 그대로면 이전 참조를 반환해 리렌더 자체를 건너뛴다
   */
  const applyRangeOperation = useCallback(
    (compute: (current: Range) => Range) =>
      setRawRange((prev) => {
        const current = resolveRange(prev);
        const next = compute(current);
        return isSameRange(next, current) ? prev : next;
      }),
    [resolveRange],
  );

  // Handle 드래그가 pointermove마다 호출한다. Math.round = Bucket snap.
  const resizeLeft = useCallback(
    (nextStart: number) =>
      applyRangeOperation((current) =>
        resizeLeftRange(current, Math.round(nextStart), constraints),
      ),
    [applyRangeOperation, constraints],
  );

  const resizeRight = useCallback(
    (nextEnd: number) =>
      applyRangeOperation((current) =>
        resizeRightRange(current, Math.round(nextEnd), constraints),
      ),
    [applyRangeOperation, constraints],
  );

  /**
   * Visible Data Slice — range에 걸치는 포인트를 양끝 포함으로 잘라낸다.
   * floor/ceil: 소수 Position(향후 snap=false)에서도 걸친 Bucket을 놓치지 않기 위함.
   */
  const visibleData = useMemo<T[]>(
    () => data.slice(Math.floor(range.start), Math.ceil(range.end) + 1),
    [data, range],
  );

  /**
   * range와 무관하게 data·getY에만 의존한다 → 드래그로 range가 바뀌어도
   * 배열 참조가 유지되어 Preview 추이 차트가 다시 그려지지 않는다.
   * (getY를 인라인 함수로 넘기면 매 렌더 이 memo가 무효화되니
   *  대용량 데이터에서는 getY 참조를 고정할 것)
   */
  const previewData = useMemo<PreviewPoint[]>(
    () =>
      data.map((datum, index) => ({
        __rangeX: index,
        __y: getY?.(datum, index) ?? 0,
      })),
    [data, getY],
  );

  // Wheel Zoom·Drag Pan이 여기에 이벤트를 채운다.
  // 미리 {...zap.mainProps}로 감싸두면 이후 기능이 사용자 코드 수정 없이 켜진다.
  const mainProps = useMemo<React.HTMLAttributes<HTMLDivElement>>(
    () => ({}),
    [],
  );

  return {
    visibleData,
    range,
    fullRange: constraints.fullRange,
    setRange,
    resizeLeft,
    resizeRight,
    data,
    previewData,
    mainProps,
    yDomain: undefined,
    tooltipActive: undefined,
  };
}

/** 조작 연산이 "실제 변화 없음"을 감지해 불필요한 리렌더를 막는 데 쓴다 */
function isSameRange(a: Range, b: Range): boolean {
  return a.start === b.start && a.end === b.end;
}
