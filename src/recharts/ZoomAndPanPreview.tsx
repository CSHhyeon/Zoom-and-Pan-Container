/**
 * ZoomAndPanPreview — 전체 추이 위에 현재 Window를 표시하는 Preview UI.
 *
 * 위치 기준 컨테이너 위에 절대 위치 레이어 5겹을 겹친다:
 *   추이 차트(0) < Left/Right Dim(10) < Window(20) < Left/Right Handle(30)
 * 이 z-index 계층이 그대로 이벤트 우선순위(Handle > Window > Dim)다.
 *
 * 추이 차트가 지켜야 할 좌표계 계약은 PreviewPoint JSDoc 참고.
 * 드래그는 "픽셀 → Bucket Position 번역"까지만 담당하고(usePreviewDrag),
 * snap·최소 폭·경계 보정은 controller → core의 몫이다.
 */
import { useCallback, useMemo, useRef } from "react";
import type { CSSProperties, DOMAttributes, RefObject } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
import type { Range } from "../core";
import type { ZoomAndPanController } from "./useZoomAndPanController";

// ── 스타일 상수 (옵션화는 v1.x에서 검토 — 지금은 한곳에 모아두기만) ──
const AREA_COLOR = "#8884d8";
const WINDOW_COLOR = "#4f7cf7";
const DIM_BACKGROUND = "rgba(0, 0, 0, 0.28)";
const HANDLE_WIDTH = 8;
/** z-index 계층 = 이벤트 우선순위 (Handle > Window > Dim) */
const Z_INDEX = { dim: 10, window: 20, handle: 30 } as const;

export interface ZoomAndPanPreviewProps<T> {
  /** useZoomAndPanController가 반환한 객체 그대로: <ZoomAndPanPreview controller={zap} /> */
  controller: ZoomAndPanController<T>;
  /** Preview 높이(px) */
  height?: number;
}

export function ZoomAndPanPreview<T>({
  controller,
  height = 64,
}: ZoomAndPanPreviewProps<T>) {
  const {
    range,
    fullRange,
    previewData,
    resizeLeft,
    resizeRight,
    panTo,
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
   * range → 컨테이너 폭 기준 % 번역.
   * `|| 1`: 데이터 1개면 fullSpan이 0 → 0 나눗셈으로 모든 레이어가 NaN%가
   * 되는 것을 방지한다 (pct가 전부 0%로 수렴).
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
        width: "100%",
        height,
        userSelect: "none",
      }}
    >
      {/* 추이 차트 — 좌표계 계약: margin 0 + 축 hide + domain 명시 */}
      <div style={{ position: "absolute", inset: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={previewData}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis
              type="number"
              dataKey="__rangeX"
              domain={[fullRange.start, fullRange.end]}
              hide
            />
            <Area
              dataKey="__y"
              isAnimationActive={false}
              stroke={AREA_COLOR}
              fill={AREA_COLOR}
              fillOpacity={0.25}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Left Dim */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${leftPct}%`,
          background: DIM_BACKGROUND,
          zIndex: Z_INDEX.dim,
        }}
      />

      {/* Right Dim — left와 right를 동시에 못 박아 폭이 자동 계산된다 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${rightPct}%`,
          right: 0,
          background: DIM_BACKGROUND,
          zIndex: Z_INDEX.dim,
        }}
      />

      {/* Window — 잡고 끌면 폭을 유지한 채 이동. border-box: 테두리가 폭을 밀지 않게 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${leftPct}%`,
          width: `${windowWidthPct}%`,
          border: `1px solid ${WINDOW_COLOR}`,
          boxSizing: "border-box",
          cursor: "grab",
          // 터치 기기에서 브라우저 스크롤 제스처가 pointermove를 가로채지 않도록
          touchAction: "none",
          zIndex: Z_INDEX.window,
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

/**
 * Handle 공통 스타일 — 좌우는 위치(pct)만 다르다.
 * calc: 핸들의 "중심"이 경계선 위에 오도록 폭의 절반만큼 왼쪽으로 보정.
 * (양 끝 range에서 절반이 컨테이너 밖으로 나가는 것은 수용 — 히트 영역은 추후 재검토)
 */
function handleStyle(pct: number): CSSProperties {
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: `calc(${pct}% - ${HANDLE_WIDTH / 2}px)`,
    width: HANDLE_WIDTH,
    padding: 0,
    border: "none",
    background: WINDOW_COLOR,
    cursor: "ew-resize",
    // 터치 기기에서 브라우저 스크롤 제스처가 pointermove를 가로채지 않도록
    touchAction: "none",
    zIndex: Z_INDEX.handle,
  };
}

// ── Preview 드래그 (Handle·Window 공용) ──────────────────────────

/** 진행 중인 드래그 세션. 렌더에 쓰이는 값이 아니라 state가 아닌 ref에 담는다 */
interface DragSession {
  /** 이 드래그를 시작한 포인터 — 다른 손가락·마우스의 move를 무시하기 위해 기억 */
  pointerId: number;
  /**
   * pointerdown 시점에 1회 측정한 컨테이너 rect.
   * move마다 재측정하면 매번 강제 layout이 일어난다.
   * (드래그 중 컨테이너 크기 불변 전제 — Chart Resize 대응은 범위 제외)
   */
  rect: DOMRect;
}

/** Preview 드래그의 수신자 — 번역된 위치와 드래그 생명주기를 받는다 */
interface PreviewDragCallbacks {
  /** 번역된 Bucket Position — pointermove마다 호출 */
  onDragTo: (position: number) => void;
  /** 드래그 시작 (pointerdown, 캡처 직후). 잡은 지점의 Position을 함께 준다 */
  onDragStart?: (startPosition: number) => void;
  /** 드래그 종료 — up/cancel 어느 경로로 끝나든 정확히 1회 */
  onDragEnd?: () => void;
}

/**
 * Preview 위 드래그를 "픽셀 → Bucket Position 번역"까지만 담당하는 내부 hook.
 * 반환한 이벤트 props를 드래그 대상(Handle button·Window div)에 스프레드한다.
 *
 * 컨테이너 밖 위치([0,1] 밖 비율)도 자르지 않고 그대로 onDragTo로 넘긴다 —
 * 경계 보정 규칙을 UI에 중복 구현하지 않기 위해서다.
 */
function usePreviewDrag(
  containerRef: RefObject<HTMLDivElement | null>,
  fullRange: Range,
  { onDragTo, onDragStart, onDragEnd }: PreviewDragCallbacks,
): DOMAttributes<HTMLElement> {
  const sessionRef = useRef<DragSession | null>(null);

  // 핸들러 묶음의 참조를 고정해 대상 요소가 매 렌더 새 props를 받지 않게 한다.
  // (콜백 묶음 객체는 매 렌더 새로 만들어지므로 개별 함수를 deps로 쓴다)
  return useMemo<DOMAttributes<HTMLElement>>(() => {
    const toPosition = (rect: DOMRect, clientX: number) => {
      // 컨테이너 왼쪽 끝 기준 가로 비율 → Bucket Position.
      // 좌표계 계약(plot 영역 = 컨테이너) 덕분에 선형 변환만으로 충분하다.
      const ratio = (clientX - rect.left) / rect.width;
      return fullRange.start + ratio * (fullRange.end - fullRange.start);
    };

    return {
      onPointerDown: (event) => {
        // 주 포인터의 주 버튼만 드래그로 취급 (우클릭, 멀티터치 두 번째 손가락 제외)
        if (!event.isPrimary || event.button !== 0) return;
        const container = containerRef.current;
        if (!container) return;

        // 이벤트 우선순위 Handle > Window > Dim — 아래 레이어로 전파 차단
        event.stopPropagation();
        // 캡처: 포인터가 대상 밖·Preview 밖으로 나가도 move/up이 계속 이 요소로 온다
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = container.getBoundingClientRect();
        sessionRef.current = { pointerId: event.pointerId, rect };
        onDragStart?.(toPosition(rect, event.clientX));
      },

      onPointerMove: (event) => {
        const session = sessionRef.current;
        if (!session || event.pointerId !== session.pointerId) return;
        onDragTo(toPosition(session.rect, event.clientX));
      },

      // 드래그 종료를 한 곳으로 수렴: 캡처된 포인터는 up/cancel 시 자동으로
      // 캡처가 풀리며 이 이벤트가 항상 발생한다. 세션이 있을 때만 종료 처리하므로
      // pointerup과 겹쳐 들어와도 onDragEnd는 드래그당 1회만 나간다.
      onLostPointerCapture: () => {
        if (sessionRef.current === null) return;
        sessionRef.current = null;
        onDragEnd?.();
      },
    };
  }, [containerRef, fullRange, onDragTo, onDragStart, onDragEnd]);
}
