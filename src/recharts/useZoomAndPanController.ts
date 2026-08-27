/**
 * useZoomAndPanController — Zoom & Pan 상태의 유일한 소유자 (headless hook).
 *
 * "현재 보고 있는 구간(range)" 하나를 소유하고, 그로부터 파생되는 것들
 * (visibleData, fullRange, 차트에 꽂을 props)을 계산해서 돌려준다. UI는 그리지 않는다.
 *
 * 이 파일의 범위 (P2-⑧ 뼈대):
 * - Uncontrolled 상태: defaultRange는 최초 mount에만 반영 (이후 prop 변경 무시)
 * - 모든 Range 변경이 core clampRange 단일 관문을 통과
 * - visibleData(Visible Data Slice) 계산/
 *
 * 이후 태스크가 여기에 살을 붙인다:
 * - P3-⑫ onRangeChange · onRangeCommit
 * - P4-⑮ Wheel Zoom, P4-⑯ Drag Pan → mainProps에 이벤트 추가
 * - Controlled range · Y Auto · Tooltip 세부는 v1.x
 */
import { useCallback, useMemo, useState } from "react";
import type React from "react";
import { clampRange, type Range, type RangeConstraints } from "../core";

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
  /** Range 표현 모드. MVP는 "bucket"만 지원 (Continuous는 v1.x) */
  rangeMode?: "bucket";
  /**
   * 한 행에서 x값을 뽑는 함수.
   * 뼈대 단계에서는 아직 소비하지 않는다 — Snap·RangeSnapshot 경계값(P3-⑫),
   * Handle Tooltip이 normalizeBucket과 함께 사용한다.
   * (Bucket 모드의 Preview 축은 배열 index 자체이므로 getX가 필요 없다)
   */
  getX: (datum: T, index: number) => TX;
  /**
   * 한 행에서 Preview 추이 차트에 그릴 y값을 뽑는 함수.
   *
   * Preview는 라이브러리 소유 UI이므로 그릴 값을 hook이 알아야 한다.
   * 사용자가 이미 controller를 넘기는데 Preview에 getY를 또 넘기는 것은 어색하고,
   * 향후 Y Auto Scale(v1.x)도 같은 추출 함수를 쓰므로 옵션 계층에 둔다.
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
 * Preview의 좌표계 계약:
 * - X는 정규화 숫자축 `__rangeX`를 쓴다 (Bucket 모드에서는 배열 index와 같다).
 *   Preview는 `XAxis type="number"` + `domain={[fullRange.start, fullRange.end]}`로
 *   그려야 첫·마지막 포인트가 정확히 0%·100%에 앉는다.
 * - 차트 margin은 상하좌우 전부 0이고 축은 hide여야 한다.
 *   Dim/Window/Handle은 컨테이너 폭 기준 %로 배치되므로, plot 영역이 컨테이너보다
 *   좁아지는 순간(margin·축 표시) 오버레이와 추이선이 어긋난다.
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
  /**
   * Range 변경의 단일 진입점.
   * 어떤 값이 와도 core clampRange를 거쳐 유효한 Range로 보정된다.
   * 이후 조작 기능(Handle Resize·Window Pan·Wheel Zoom·Drag Pan)도 전부 이 함수로 상태를 바꾼다.
   */
  setRange: (next: Range) => void;
  /** 원본 전체 데이터 — 사용자가 index로 원본 datum을 되찾을 때 사용 */
  data: readonly T[];
  /**
   * Preview 추이 차트용 전체 데이터.
   *
   * Bucket 모드의 Preview X축은 배열 index 자체이므로 `__rangeX = index`다.
   * range가 아니라 data에만 의존해 계산되므로, 드래그로 range가 초당 수십 번
   * 바뀌어도 배열 참조가 유지된다 → Recharts가 추이 차트를 다시 그리지 않는다.
   */
  previewData: PreviewPoint[];
  /** Main Chart wrapper div에 스프레드할 이벤트 props. P4(Wheel Zoom·Drag Pan)에서 이벤트가 채워진다 */
  mainProps: React.HTMLAttributes<HTMLDivElement>;
  /** YAxis domain — Y Auto/Fixed는 v1.x. 지금은 항상 undefined(Recharts 오토스케일) */
  yDomain: [number, number] | undefined;
  /** Tooltip active — Drag 중 숨김은 v1.x. 지금은 항상 undefined(Recharts가 관리) */
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
   * - useState 초기화 함수는 최초 mount에 한 번만 실행된다
   *   → 이후 defaultRange prop이 바뀌어도 상태가 초기화되지 않는다.
   * - null = "아직 아무도 range를 정하지 않음" → 렌더 시 fullRange를 따라간다.
   *   (mount 시점에 data가 비어 있다가 나중에 채워지는 비동기 로딩에서도 전체 범위가 유지된다)
   * - 보정 없이 raw로 저장한다. 유효성 보정은 아래 clampRange 관문이 전담한다.
   */
  const [rawRange, setRawRange] = useState<Range | null>(
    () => defaultRange ?? null,
  );

  /**
   * 모든 Range 변경 경로가 통과하는 단일 관문 (core clampRange).
   * raw 값이 어디서 왔든(defaultRange / setRange) 렌더마다 여기서 한 번만 보정되므로,
   * data 길이·minRange가 나중에 바뀌어도 range는 항상 유효하다.
   */
  const range = useMemo<Range>(
    () => clampRange(rawRange ?? constraints.fullRange, constraints),
    [rawRange, constraints],
  );

  const setRange = useCallback((next: Range) => setRawRange(next), []);

  /**
   * Visible Data Slice — range에 걸치는 포인트를 양끝 포함으로 잘라낸다.
   * floor/ceil: 소수 Position(향후 snap=false)에서도 걸친 Bucket을 놓치지 않기 위함.
   */
  const visibleData = useMemo<T[]>(
    () => data.slice(Math.floor(range.start), Math.ceil(range.end) + 1),
    [data, range],
  );

  /**
   * Preview 추이 데이터 — range와 무관하게 data·getY에만 의존한다.
   * 덕분에 Handle을 드래그해 range가 초당 수십 번 바뀌어도 배열 참조가 유지되고,
   * Preview 추이 차트는 다시 계산되지 않는다.
   *
   * 단, getY를 인라인 함수(`getY: (d) => d.value`)로 넘기면 매 렌더 새 함수가 되어
   * 이 memo가 무효화된다. 대용량 데이터에서는 useCallback으로 고정하거나
   * 컴포넌트 밖에 선언할 것을 권장한다.
   */
  const previewData = useMemo<PreviewPoint[]>(
    () =>
      data.map((datum, index) => ({
        __rangeX: index,
        __y: getY?.(datum, index) ?? 0,
      })),
    [data, getY],
  );

  // P4-⑮ Wheel Zoom · P4-⑯ Drag Pan이 여기에 이벤트를 추가한다.
  // 사용자는 처음부터 {...zap.mainProps}로 감싸두면 이후 기능이 코드 수정 없이 켜진다.
  const mainProps = useMemo<React.HTMLAttributes<HTMLDivElement>>(
    () => ({}),
    [],
  );

  return {
    visibleData,
    range,
    fullRange: constraints.fullRange,
    setRange,
    data,
    previewData,
    mainProps,
    yDomain: undefined, // Y Auto/Fixed는 v1.x
    tooltipActive: undefined, // Drag 중 Tooltip 숨김은 v1.x
  };
}
