/**
 * useZoomAndPanController — Zoom & Pan 상태의 유일한 소유자 (headless hook).
 *
 * "현재 보고 있는 구간(range)" 하나를 소유하고(useRangeState), 그로부터 파생되는 것들(visibleData, previewData, 차트에 꽂을 props)을 계산해서 돌려준다.
 * UI는 그리지 않으며, 모든 Range 변경은 core clampRange 단일 관문을 통과한다.
 *
 * 책임 분담: DOM 측정(rect·plot 근사)은 feature hook(wheel-zoom·main-drag-pan)의 몫, 측정값 → Range Position 계산과 상태 갱신은 이 hook의 몫이다.
 */
import { useCallback, useMemo, useState } from "react";
import type React from "react";
import {
  centerRangeAt,
  isSameRange,
  panRange,
  resizeLeftRange,
  resizeRightRange,
  zoomRange,
  type Range,
  type RangeConstraints,
  type ZoomDirection,
} from "../../../entities/range";
import { useMainDragPan } from "../../../features/main-drag-pan";
import {
  useRangeCallbacks,
  type RangeChangeSource,
} from "../../../features/range-callbacks";
import { useWheelZoom } from "../../../features/wheel-zoom";
import { snapToBucketGrid } from "../lib/snapToBucketGrid";
import { useRangeState } from "./useRangeState";
import type {
  PlotInset,
  PreviewPoint,
  UseZoomAndPanControllerOptions,
  ZoomAndPanController,
} from "./types";

// touchAction pan-y: 가로 제스처는 Drag Pan이 소비하고 세로 스와이프는 페이지 스크롤로 남긴다
const MAIN_WRAPPER_STYLE: React.CSSProperties = { touchAction: "pan-y" };

export function useZoomAndPanController<T, TX = unknown>(
  options: UseZoomAndPanControllerOptions<T, TX>,
): ZoomAndPanController<T> {
  const {
    data,
    defaultRange,
    minRange,
    zoomStep,
    inset,
    getY,
    onRangeChange,
    onRangeCommit,
  } = options;

  // 값 기준 memo — 사용자가 inset을 인라인 객체로 넘겨도 참조가 안정된다
  const plotInset = useMemo<Required<PlotInset>>(
    () => ({ left: inset?.left ?? 0, right: inset?.right ?? 0 }),
    [inset?.left, inset?.right],
  );

  const constraints = useMemo<RangeConstraints>(
    () => ({
      fullRange: { start: 0, end: Math.max(0, data.length - 1) },
      minRange,
    }),
    [data.length, minRange],
  );

  const { range, readCurrentRange, setRange } = useRangeState(
    constraints,
    defaultRange,
  );

  const {
    notifyChange,
    beginInteraction: beginSession,
    endInteraction: endSession,
  } = useRangeCallbacks({ onRangeChange, onRangeCommit });

  /**
   * 조작 연산(Handle Resize 등)의 공통 경로.
   * 실제로 바뀐 경우에만 상태를 쓰고(불필요한 리렌더 차단) onRangeChange를 예약한다.
   * 콜백 호출은 부수효과라 setState updater 밖에서 처리한다 (updater는 순수해야 함).
   */
  const applyRangeOperation = useCallback(
    (source: RangeChangeSource, compute: (current: Range) => Range) => {
      const current = readCurrentRange();
      const next = compute(current);
      if (isSameRange(next, current)) return;
      setRange(next);
      notifyChange(next, source);
    },
    [readCurrentRange, setRange, notifyChange],
  );

  // Handle 드래그가 pointermove마다 호출한다. Math.round = Bucket snap.
  const resizeLeft = useCallback(
    (nextStart: number) =>
      applyRangeOperation("resize-left", (current) =>
        resizeLeftRange(current, Math.round(nextStart), constraints),
      ),
    [applyRangeOperation, constraints],
  );

  const resizeRight = useCallback(
    (nextEnd: number) =>
      applyRangeOperation("resize-right", (current) =>
        resizeRightRange(current, Math.round(nextEnd), constraints),
      ),
    [applyRangeOperation, constraints],
  );

  // panRange는 delta 기반 — 목표 start와 현재 start의 차로 환산해 넘긴다.
  // NaN 목표는 delta도 NaN이 되어 core가 no-op 처리한다.
  // Preview Window Pan과 Main Drag Pan이 source만 다르고 같은 이동이라 공유한다.
  const panToward = useCallback(
    (source: RangeChangeSource, nextStart: number) =>
      applyRangeOperation(source, (current) =>
        panRange(current, Math.round(nextStart) - current.start, constraints),
      ),
    [applyRangeOperation, constraints],
  );
  const panTo = useCallback(
    (nextStart: number) => panToward("window-pan", nextStart),
    [panToward],
  );
  const mainPanTo = useCallback(
    (nextStart: number) => panToward("main-pan", nextStart),
    [panToward],
  );

  // 중앙 배치(폭 유지·경계 우선) 후 정수 격자에 snap한다.
  // 홀수 폭·소수 position이면 배치 결과가 소수라 배치만으로는 snap이 안 된다.
  const centerAt = useCallback(
    (position: number) =>
      applyRangeOperation("dim-click", (current) =>
        snapToBucketGrid(
          centerRangeAt(current, position, constraints),
          constraints,
        ),
      ),
    [applyRangeOperation, constraints],
  );

  const endInteraction = useCallback(
    () => endSession(readCurrentRange()),
    [endSession, readCurrentRange],
  );

  // Wheel Zoom — 포인터 아래 지점(anchor)을 고정한 채 확대·축소한다.
  // anchorRatio(plot 영역 안 포인터 비율) 측정은 useWheelZoom의 몫 — 여기서는 현재 range 위의 Position으로 번역해 core zoomRange에 넘긴다 (없으면 중앙 기준 폴백).
  // preventDefault용 non-passive 리스너와 150ms 정착 타이머도 useWheelZoom이 담당.
  const wheelZoomBy = useCallback(
    (direction: ZoomDirection, anchorRatio: number | undefined) =>
      applyRangeOperation("wheel-zoom", (current) => {
        const anchor =
          anchorRatio === undefined
            ? undefined
            : current.start + anchorRatio * (current.end - current.start);
        const zoomed = zoomRange(
          current,
          direction,
          constraints,
          zoomStep,
          anchor,
        );
        // anchor 배치 결과는 소수 — 정수 격자로 snap (이동 최대 0.5칸)
        return snapToBucketGrid(zoomed, constraints);
      }),
    [applyRangeOperation, constraints, zoomStep],
  );
  const beginWheelSession = useCallback(
    () => beginSession("wheel-zoom", readCurrentRange()),
    [beginSession, readCurrentRange],
  );
  const { mainRef: attachWheel, settle: settleWheel } = useWheelZoom({
    onZoom: wheelZoomBy,
    onSessionStart: beginWheelSession,
    onSessionEnd: endInteraction,
    inset: plotInset,
  });

  const beginInteraction = useCallback(
    (source: RangeChangeSource) => {
      // 정착 대기 중인 wheel 조작을 먼저 마감 — 두 조작의 세션이 섞이지 않게
      settleWheel();
      beginSession(source, readCurrentRange());
    },
    [settleWheel, beginSession, readCurrentRange],
  );

  // Main Drag Pan — 지도처럼 잡고 끄는 이동. 드래그 중에는 Main Tooltip을 숨긴다
  const [isDragging, setIsDragging] = useState(false);

  const beginMainPan = useCallback(() => {
    setIsDragging(true);
    beginInteraction("main-pan");
  }, [beginInteraction]);

  const endMainPan = useCallback(() => {
    setIsDragging(false);
    endInteraction();
  }, [endInteraction]);

  const mainDragHandlers = useMainDragPan({
    onPanTo: mainPanTo,
    onDragStart: beginMainPan,
    onDragEnd: endMainPan,
    readRange: readCurrentRange,
    inset: plotInset,
  });

  /**
   * Visible Data Slice — range에 걸치는 포인트를 양끝 포함으로 잘라낸다.
   * floor/ceil: 소수 Position(향후 snap=false)에서도 걸친 Bucket을 놓치지 않기 위함.
   */
  const visibleData = useMemo<T[]>(
    () => data.slice(Math.floor(range.start), Math.ceil(range.end) + 1),
    [data, range.start, range.end],
  );

  /**
   * range와 무관하게 data·getY에만 의존한다 → 드래그로 range가 바뀌어도 배열 참조가 유지되어 Preview 추이 차트가 다시 그려지지 않는다.
   * (getY를 인라인 함수로 넘기면 매 렌더 이 memo가 무효화되니 대용량 데이터에서는 getY 참조를 고정할 것)
   */
  const previewData = useMemo<PreviewPoint[]>(
    () =>
      data.map((datum, index) => ({
        __rangeX: index,
        __y: getY?.(datum, index) ?? 0,
      })),
    [data, getY],
  );

  // ref: React onWheel은 passive라 preventDefault가 무시된다 — useWheelZoom이 네이티브 non-passive wheel 리스너를 달기 위해 wrapper 요소를 점유한다.
  const mainProps = useMemo<React.ComponentProps<"div">>(
    () => ({
      ref: attachWheel,
      style: MAIN_WRAPPER_STYLE,
      ...mainDragHandlers,
    }),
    [attachWheel, mainDragHandlers],
  );

  // 반환 객체 참조 안정화 — 값이 바뀐 게 없는 리렌더에서는 이전 controller를 그대로 돌려준다.
  // controller를 props로 받는 React.memo 소비자(예: ZoomAndPanPreview)가 부모의 무관한 리렌더를 실제로 스킵하는 조건이다.
  return useMemo<ZoomAndPanController<T>>(
    () => ({
      visibleData,
      range,
      fullRange: constraints.fullRange,
      setRange,
      resizeLeft,
      resizeRight,
      panTo,
      centerAt,
      beginInteraction,
      endInteraction,
      data,
      previewData,
      inset: plotInset,
      mainProps,
      yDomain: undefined,
      tooltipActive: isDragging ? false : undefined,
    }),
    [
      visibleData,
      range,
      constraints.fullRange,
      setRange,
      resizeLeft,
      resizeRight,
      panTo,
      centerAt,
      beginInteraction,
      endInteraction,
      data,
      previewData,
      plotInset,
      mainProps,
      isDragging,
    ],
  );
}
