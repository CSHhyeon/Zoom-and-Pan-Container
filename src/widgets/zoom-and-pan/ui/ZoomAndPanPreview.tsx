/**
 * ZoomAndPanPreview — 전체 추이 위에 현재 Window를 표시하는 Preview UI.
 *
 * 위치 기준 컨테이너 위에 절대 위치 레이어 5겹을 겹친다:
 *   추이 차트(0) < Left/Right Dim(10) < Window(20) < Left/Right Handle(30)
 * 이 z-index 계층이 그대로 이벤트 우선순위(Handle > Window > Dim)다.
 *
 * 추이 차트가 지켜야 할 좌표계 계약은 PreviewPoint JSDoc 참고.
 * 드래그는 "픽셀 → Bucket Position 번역"까지만 담당하고(features/preview-drag), snap·최소 폭·경계 보정은 controller → core의 몫이다.
 */
import { memo, useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  toBucketPosition,
  usePreviewDrag,
} from "../../../features/preview-drag";
import type { ZoomAndPanController } from "../model/types";
import { PreviewTrendChart } from "./PreviewTrendChart";
import { DIM_BASE_STYLE, WINDOW_BASE_STYLE, handleStyle } from "./styles";

export interface ZoomAndPanPreviewProps<T> {
  /** useZoomAndPanController가 반환한 객체 그대로: <ZoomAndPanPreview controller={zap} /> */
  controller: ZoomAndPanController<T>;
  /** Preview 높이(px) */
  height?: number;
}

function ZoomAndPanPreviewImpl<T>({
  controller,
  height = 64,
}: ZoomAndPanPreviewProps<T>) {
  const {
    range,
    fullRange,
    previewData,
    inset,
    resizeLeft,
    resizeRight,
    panTo,
    centerAt,
    beginInteraction,
    endInteraction,
  } = controller;

  /** 픽셀 → % → Position 번역의 기준이 되는 레이어 컨테이너 */
  const containerRef = useRef<HTMLDivElement>(null);

  // 조작 세션 시작을 source와 함께 hook에 알린다 (commit의 비교 기준이 됨)
  const beginLeftResize = useCallback(
    () => beginInteraction("resize-left"),
    [beginInteraction],
  );
  const beginRightResize = useCallback(
    () => beginInteraction("resize-right"),
    [beginInteraction],
  );

  const leftHandleDrag = usePreviewDrag(containerRef, fullRange, {
    onDragTo: resizeLeft,
    onDragStart: beginLeftResize,
    onDragEnd: endInteraction,
  });
  const rightHandleDrag = usePreviewDrag(containerRef, fullRange, {
    onDragTo: resizeRight,
    onDragStart: beginRightResize,
    onDragEnd: endInteraction,
  });

  /**
   * Window를 잡은 지점과 start의 간격.
   * 드래그 내내 이 간격을 유지해야 "잡은 지점이 손가락을 따라오는" 자연스러운 팬이 된다.
   * 렌더에 쓰이지 않는 드래그 작업 메모라 ref에 담는다.
   */
  const grabOffsetRef = useRef(0);

  const beginWindowPan = useCallback(
    (startPosition: number) => {
      grabOffsetRef.current = startPosition - range.start;
      beginInteraction("window-pan");
    },
    [range.start, beginInteraction],
  );
  const panWindowTo = useCallback(
    (position: number) => panTo(position - grabOffsetRef.current),
    [panTo],
  );

  const windowDrag = usePreviewDrag(containerRef, fullRange, {
    onDragTo: panWindowTo,
    onDragStart: beginWindowPan,
    onDragEnd: endInteraction,
  });

  /**
   * Dim Click — 클릭한 지점이 Window 중앙에 오도록 이동.
   * 드래그와 달리 단발 조작이라 시작-이동-종료를 한 번에 처리한다 → onRangeChange와 onRangeCommit이 모두 즉시(동기로) 나간다.
   */
  const handleDimPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary || event.button !== 0) return;
      const container = containerRef.current;
      if (!container) return;

      // 이벤트 우선순위 최하층이지만, 배경(컨테이너)으로의 전파는 여기서 끊는다
      event.stopPropagation();
      const position = toBucketPosition(
        container.getBoundingClientRect(),
        event.clientX,
        fullRange,
      );

      beginInteraction("dim-click");
      centerAt(position);
      endInteraction();
    },
    [fullRange, beginInteraction, centerAt, endInteraction],
  );

  /**
   * range → 컨테이너 폭 기준 % 번역.
   * `|| 1`: 데이터 1개면 fullSpan이 0 → 0 나눗셈으로 모든 레이어가 NaN%가 되는 것을 방지한다 (pct가 전부 0%로 수렴).
   */
  const fullSpan = fullRange.end - fullRange.start || 1;
  const leftPct = ((range.start - fullRange.start) / fullSpan) * 100;
  const rightPct = ((range.end - fullRange.start) / fullSpan) * 100;
  const windowWidthPct = rightPct - leftPct;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height,
        // 좌우 margin으로 컨테이너 자체를 좁혀 Main plot 영역과 정렬한다 (hook의 inset 공유).
        // % 배치·픽셀 번역의 기준(containerRef rect)도 함께 좁아져 좌표계가 유지된다
        marginLeft: inset.left,
        marginRight: inset.right,
        userSelect: "none",
      }}
    >
      <PreviewTrendChart data={previewData} fullRange={fullRange} />

      {/* Left Dim — 클릭하면 그 지점이 Window 중앙에 오도록 이동 */}
      <div
        style={{ ...DIM_BASE_STYLE, left: 0, width: `${leftPct}%` }}
        onPointerDown={handleDimPointerDown}
      />

      {/* Right Dim — left와 right를 동시에 못 박아 폭이 자동 계산된다 */}
      <div
        style={{ ...DIM_BASE_STYLE, left: `${rightPct}%`, right: 0 }}
        onPointerDown={handleDimPointerDown}
      />

      {/* Window — 잡고 끌면 폭을 유지한 채 이동 */}
      <div
        style={{
          ...WINDOW_BASE_STYLE,
          left: `${leftPct}%`,
          width: `${windowWidthPct}%`,
        }}
        {...windowDrag}
      />

      {/* Left Handle — 드래그로 start만 이동 */}
      <button
        type="button"
        aria-label="range start handle"
        style={handleStyle(leftPct)}
        {...leftHandleDrag}
      />
      {/* Right Handle — 드래그로 end만 이동 */}
      <button
        type="button"
        aria-label="range end handle"
        style={handleStyle(rightPct)}
        {...rightHandleDrag}
      />
    </div>
  );
}

export const ZoomAndPanPreview = memo(
  ZoomAndPanPreviewImpl,
) as typeof ZoomAndPanPreviewImpl;
