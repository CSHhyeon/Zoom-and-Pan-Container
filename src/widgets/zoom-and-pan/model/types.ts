/**
 * zoom-and-pan 위젯의 공개 타입 표면.
 * 여기 JSDoc이 곧 사용자 문서다 — 옵션·반환 필드의 계약을 서술한다.
 */
import type React from "react";
import type { Range } from "../../../entities/range";
import type {
  RangeChangeMeta,
  RangeSnapshot,
  RangeChangeSource,
} from "../../../features/range-callbacks";

// 사용자가 defaultRange·콜백 시그니처를 작성할 때 필요한 타입을 hook과 같은 곳에서 제공한다.
export type { Range } from "../../../entities/range";
export type {
  RangeChangeMeta,
  RangeChangeSource,
  RangeSnapshot,
} from "../../../features/range-callbacks";

/**
 * Main Chart wrapper 안에서 실제 plot 영역(축 안쪽)까지의 좌우 여백(px).
 * 보통 left = YAxis width + margin.left, right = margin.right.
 */
export interface PlotInset {
  left?: number;
  right?: number;
}

/**
 * T: 데이터 한 행의 타입.
 * TX: x값의 타입.
 *
 * getX는 한 행에서 x축에 해당하는 값을 뽑아주는 함수임.
 * 그 x값의 타입이 T를 안다고 해서 자동으로 정해지지 않기 때문에 '행의 타입(T)'과 '그 행에서 뽑은 x값의 타입(TX)'을 별도로 받음.
 */
export interface UseZoomAndPanControllerOptions<T, TX = unknown> {
  /** 전체 원본 데이터. hook은 이 배열을 자르기만 하고 변형하지 않는다 */
  data: readonly T[];
  /** Range 표현 모드. 현재 "bucket"만 지원 */
  rangeMode?: "bucket";
  /**
   * 한 행에서 x값을 뽑는 함수. 아직 소비하지 않는다 — Snap 옵션·경계값 스냅샷·Handle Tooltip이 normalizeBucket과 함께 사용할 예정.
   * (Bucket 모드의 Preview 축은 배열 index 자체이므로 getX가 필요 없다)
   */
  getX: (datum: T, index: number) => TX;
  /**
   * Preview 내장 추이 차트(기본 AreaChart)에 그릴 y값을 뽑는 함수.
   * 생략 시 Preview는 추이 없이 Dim/Window/Handle만 그린다.
   * Preview 추이를 renderTrend로 직접 그린다면 필요 없다 (ZoomAndPanPreviewProps 참고).
   */
  getY?: (datum: T, index: number) => number;
  /**
   * 초기 Range (Uncontrolled). 최초 mount에만 반영되고 이후 변경은 무시된다.
   * 생략 시 전체 범위에서 시작한다.
   */
  defaultRange?: Range;
  /** 최소 범위 폭(`end - start`). 생략 시 core 기본값(1 = 최소 두 포인트) */
  minRange?: number;
  /**
   * Wheel Zoom 1회당 각 Handle이 움직이는 칸 수 (고정 스텝).
   * 생략 시 현재 폭 비례 — 1틱당 폭 ×0.8(확대) / ÷0.8(축소), 최소 1칸씩 — 라 데이터 수와 무관하게 몇 번의 휠로 목표 구간에 도달한다.
   */
  zoomStep?: number;
  /**
   * Main Chart의 plot 여백 — Wheel anchor 보정·Drag Pan 폭 보정·Preview 좌우 정렬이 이 한 값을 공유한다.
   * headless라 사용자 차트의 축 폭을 알 수 없어 값으로 받는다 — 자동화는 v1.x Bridge.
   */
  inset?: PlotInset;
  /**
   * 조작 중 range가 실제로 바뀔 때마다 호출 — rAF throttle로 프레임당 최대 1회.
   * 화면 동기화용(예: 옆 차트 range 맞추기). 서버 요청은 onRangeCommit에서 할 것.
   */
  onRangeChange?: (snapshot: RangeSnapshot, meta: RangeChangeMeta) => void;
  /**
   * 한 번의 조작(Handle Drag 등)이 끝났을 때 1회 호출.
   * 조작 시작 대비 range가 실제로 바뀐 경우에만 호출된다 — 서버 요청은 여기서.
   */
  onRangeCommit?: (snapshot: RangeSnapshot, meta: RangeChangeMeta) => void;
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
  /**
   * Range 변경의 외부 진입점. 어떤 값이 와도 core clampRange를 거쳐 보정된다.
   * 프로그램적 변경이므로 onRangeChange/onRangeCommit을 호출하지 않는다.
   */
  setRange: (next: Range) => void;
  /**
   * 조작 세션 시작 — Preview 등이 pointerdown에 호출한다.
   * 이 시점의 range가 onRangeCommit의 "실제 변경" 비교 기준이 된다.
   */
  beginInteraction: (source: RangeChangeSource) => void;
  /**
   * 조작 세션 종료 — pointerup/lostpointercapture에 호출한다 (중복 호출 무시).
   * 마지막 onRangeChange를 flush한 뒤, 시작 대비 변경 시에만 onRangeCommit 1회.
   */
  endInteraction: () => void;
  /**
   * Left Handle Resize — end는 고정하고 start만 nextStart로 옮긴다.
   * nextStart는 Bucket Position(소수 가능).
   * 반올림 snap 후 core resizeLeftRange를 거치므로 최소 폭(`end - minRange`)과 왼쪽 경계(`fullRange.start`)를 넘지 않는다.
   */
  resizeLeft: (nextStart: number) => void;
  /**
   * Right Handle Resize — start는 고정하고 end만 nextEnd로 옮긴다.
   * nextEnd는 Bucket Position(소수 가능).
   * 반올림 snap 후 core resizeRightRange를 거치므로 최소 폭(`start + minRange`)과 오른쪽 경계(`fullRange.end`)를 넘지 않는다.
   */
  resizeRight: (nextEnd: number) => void;
  /**
   * Window Pan — 폭을 유지한 채 start가 nextStart에 오도록 통째로 이동한다.
   * nextStart는 Bucket Position(소수 가능).
   * 반올림 snap 후 core panRange를 거치므로 경계에 닿으면 벽에 붙어 멈춘다 (폭 불변).
   */
  panTo: (nextStart: number) => void;
  /**
   * Dim Click — 폭을 유지한 채 position이 Window 중앙에 오도록 이동한다.
   * position은 Bucket Position(소수 가능).
   * 중앙 배치 후 시작점을 반올림 snap하며, 중앙 배치보다 전체 경계 준수가 우선이다 (경계를 넘으면 벽에 붙어 멈춤).
   */
  centerAt: (position: number) => void;
  /** 원본 전체 데이터 — 사용자가 index로 원본 datum을 되찾을 때 사용 */
  data: readonly T[];
  /**
   * Preview 추이 차트용 전체 데이터 (`__rangeX` = 배열 index).
   * range와 무관하게 계산되므로 드래그 중에도 배열 참조가 유지된다.
   */
  previewData: PreviewPoint[];
  /** 정규화된 plot 여백(기본 0) — Preview가 Main plot 영역과 정렬할 때 사용 */
  inset: Required<PlotInset>;
  /**
   * Main Chart wrapper div에 스프레드할 props: `<div {...zap.mainProps}>`.
   * Wheel Zoom(ref로 non-passive 리스너 부착)과 Drag Pan(pointer 핸들러, touchAction pan-y)이 들어 있다.
   * ref는 hook이 점유하므로 wrapper에 별도 ref를 직접 달지 말 것.
   */
  mainProps: React.ComponentProps<"div">;
  /** YAxis domain — 아직 항상 undefined (Recharts 오토스케일에 위임) */
  yDomain: [number, number] | undefined;
  /**
   * Main Tooltip의 active — `<Tooltip active={zap.tooltipActive}>`로 연결.
   * Drag 중 false(강제 숨김), 평소 undefined(Recharts가 hover 관리).
   */
  tooltipActive: boolean | undefined;
}
