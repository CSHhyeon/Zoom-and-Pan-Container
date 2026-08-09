/**
 * useZoomAndPanController — 가짜 구현
 * '현재 보고 있는 구간(range)'이라는 상태 하나를 소유하고,
 * 그로부터 파생되는 것들(잘라낸 데이터, 이벤트 props)을 계산해서 돌려주는 React 커스텀 hook. (UI 없음)
 *
 * 목적: 확정 API 인터페이스가 Recharts에 실제로 조립되는지 검증.
 * 진짜 로직(core zoom/pan/resize, Pointer 처리)은 없음.
 * TODO: 훅 뼈대 구현 시 제대로 재작성할 것.
 */
import { useCallback, useMemo, useState } from "react";
import type React from "react";

//   ############## 타입 ##############

/**
 * 데이터 Index 기준, 포함(inclusive) 범위.
 * 지금 보고 있는 구간을 데이터 배열의 인덱스로 표현함.
 *
 * ex) {start:2, end:6} = 포인트 5개(2, 3, 4, 5, 6)
 * */
export interface Range {
  start: number;
  end: number;
}

/**
 * onRangeCommit 콜백이 받을 페이로드
 */
export interface RangeSnapshot {
  range: Range;
  // TODO: onRangeCommit 구현 시 startValue / endValue / nearestIndex 등 RangeBoundary 추가
}

/**
 * T: 데이터 한 행의 타입.
 * TX: x값의 타입.
 *
 * getX는 한 행에서 x축에 해당하는 값을 뽑아주는 함수임.
 * 그 x값의 타입이 T를 안다고 해서 자동으로 정해지지 않기 때문에 '행의 타입(T)'과 '그 행에서 뽑은 x값의 타입(TX)'을 별도로 받음.
 */
export interface UseZoomAndPanControllerOptions<T, TX = unknown> {
  data: readonly T[];
  rangeMode?: "bucket";
  getX: (datum: T, index: number) => TX;
  defaultRange?: Range;
  onRangeCommit?: (snapshot: RangeSnapshot) => void;
}

export interface ZoomAndPanController<T> {
  /** 현재 Window에 포함되는 데이터 slice — 사용자 차트의 data로 전달 */
  visibleData: T[];
  /** 현재 Range (Bucket Index 기준) */
  range: Range;
  /** 전체 데이터 범위 */
  fullRange: Range;
  /** Main Chart wrapper div에 스프레드할 이벤트 props */
  mainProps: React.HTMLAttributes<HTMLDivElement>;
  /** YAxis domain — 테스트에서는 undefined(Recharts 오토스케일) */
  yDomain: [number, number] | undefined;
  /** Tooltip active — 테스트에서는 undefined(Recharts가 관리) */
  tooltipActive: boolean | undefined;

  // ── Story 버튼용. 정식 API 아님 ──
  /** range 강제 변경 */
  __setRange: (range: Range) => void;
  /** onRangeCommit 시그니처 확인용 강제 호출 */
  __forceCommit: () => void;
  /**
   * [TEST] Preview가 전체 추이를 그리려면 전체 데이터가 필요함(체크리스트 4).
   * TODO: 정식 API에서는 controller.previewData(정규화 __rangeX 포함)로 설계할 것.
   */
  __testFullData: readonly T[];
}

//   ############## 구현 ##############

export function useZoomAndPanController<T, TX = unknown>(
  options: UseZoomAndPanControllerOptions<T, TX>,
): ZoomAndPanController<T> {
  const { data, defaultRange, onRangeCommit } = options;

  const fullRange = useMemo<Range>(
    () => ({ start: 0, end: Math.max(0, data.length - 1) }),
    [data.length],
  );

  // Uncontrolled: defaultRange는 최초 mount에만 사용 (이후 prop 변경 무시)
  const [range, setRange] = useState<Range>(() => defaultRange ?? fullRange);
  const [isDragging, setIsDragging] = useState(false);

  // TODO: 추후 clampRange 제대로 구현할 것.
  // 지금은 경계값 넘어가지 않고, start, end 값이 뒤집히지 않도록만 해둠.
  const clamp = useCallback(
    (next: Range): Range => ({
      start: Math.max(fullRange.start, Math.min(next.start, next.end)),
      end: Math.min(fullRange.end, Math.max(next.start, next.end)),
    }),
    [fullRange],
  );

  const visibleData = useMemo(
    () => data.slice(Math.floor(range.start), Math.ceil(range.end) + 1) as T[],
    [data, range],
  );

  const mainProps = useMemo<React.HTMLAttributes<HTMLDivElement>>(
    () => ({
      // TODO: 추후 Wheel Zoom 구현할 것. 지금은 스프레드가 붙는지만 확인.
      onWheel: (event) => {
        // 이 로그가 찍히면 {...zap.mainProps} 패턴 성립. deltaY: 휠 세로 이동량, 음수 = 위로 굴림 = zoom in.
        console.log("[test] wheel", event.deltaY < 0 ? "in" : "out");
      },
      onPointerDown: (event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
      },
      onPointerUp: () => setIsDragging(false),
      onPointerCancel: () => setIsDragging(false),
    }),
    [],
  );

  const __setRange = useCallback(
    (next: Range) => setRange(clamp(next)),
    [clamp],
  );

  const __forceCommit = useCallback(() => {
    onRangeCommit?.({ range });
  }, [onRangeCommit, range]);

  return {
    visibleData,
    range,
    fullRange,
    mainProps,
    yDomain: undefined, // [TEST] Y Auto는 v1.x
    tooltipActive: isDragging ? false : undefined, // TODO: Main Chart DragAndPan 구현 시 Drag 상태 연결
    __setRange,
    __forceCommit,
    __testFullData: data,
  };
}
