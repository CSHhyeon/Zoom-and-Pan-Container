/**
 * ZoomAndPanPreview — 전체 추이 위에 현재 Window를 표시하는 Preview UI.
 * (P2-⑨ 정적 레이어 + P3-⑩ Right Handle Resize. Left Handle 조작은 P3-⑪)
 *
 * 구조: 위치 기준 컨테이너 위에 절대 위치 레이어 5겹을 겹친다.
 *   추이 차트(0) < Left/Right Dim(10) < Window(20) < Left/Right Handle(30)
 * 이 z-index 계층이 그대로 P3의 이벤트 우선순위(Handle > Window > Dim)가 된다.
 *
 * 좌표계 계약 (PreviewPoint JSDoc 참고):
 * Dim/Window/Handle은 "컨테이너 폭 기준 %"로 배치된다. 따라서 내부 차트의
 * plot 영역이 컨테이너와 정확히 일치해야 한다 — margin 전부 0, 축 hide,
 * XAxis domain을 fullRange로 명시. 이 계약이 깨지면 추이선과 오버레이가 어긋난다.
 *
 * 드래그 역할 분담 (P3-⑩):
 * Preview는 "픽셀 → Bucket Position 번역"까지만 안다 (useHandleDrag).
 * 그 위치로 어느 경계를 어떻게 움직일지(snap·최소 폭·경계 보정)는
 * controller.resizeRight → core resizeRightRange의 몫이다.
 */
import { useMemo, useRef } from "react";
import type { CSSProperties, DOMAttributes, RefObject } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
import type { Range } from "../core";
import type { ZoomAndPanController } from "./useZoomAndPanController";

// ── 스타일 상수 (옵션화는 v1.x에서 검토 — 지금은 한곳에 모아두기만) ──
const AREA_COLOR = "#8884d8";
const WINDOW_COLOR = "#4f7cf7";
const DIM_BACKGROUND = "rgba(0, 0, 0, 0.28)";
const HANDLE_WIDTH = 8;
/** z-index 계층 = P3의 이벤트 우선순위 (Handle > Window > Dim) */
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
  const { range, fullRange, previewData, resizeRight } = controller;

  /** 픽셀 → % → Position 번역의 기준이 되는 레이어 컨테이너 */
  const containerRef = useRef<HTMLDivElement>(null);
  const rightHandleDrag = useHandleDrag(containerRef, fullRange, resizeRight);

  /**
   * range → 컨테이너 폭 기준 % 번역.
   *
   * 전체에서 내 range가 몇 % 지점부터 몇 % 지점까지인가?
   * ex) 데이터 10개(fullRange {0,9}), range {2,6}
   *   fullSpan = 9, leftPct = 2/9 = 22.2%, rightPct = 6/9 = 66.7%, width = 44.4%
   *
   * `|| 1`: 데이터가 1개면 fullSpan이 0 → 0으로 나누면 NaN%가 되어
   * 레이어 전체가 사라진다. 1로 대체하면 모든 pct가 0%로 수렴해 안전하다.
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
      {/* 추이 차트 (전체 데이터) — 좌표계 계약: margin 0 + 축 hide + domain 명시 */}
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

      {/* Left Dim — Window 왼쪽의 흐린 영역 (컨테이너 왼쪽 끝 ~ Window 시작점) */}
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

      {/* Window — 현재 보이는 구간. border-box: 테두리가 폭을 밖으로 밀지 않게 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${leftPct}%`,
          width: `${windowWidthPct}%`,
          border: `1px solid ${WINDOW_COLOR}`,
          boxSizing: "border-box",
          zIndex: Z_INDEX.window,
        }}
      />

      {/* Left Handle — 드래그는 P3-⑪에서 (지금은 고정) */}
      <button
        type="button"
        aria-label="range start handle"
        style={handleStyle(leftPct)}
      />
      {/* Right Handle — 드래그로 end만 이동 (start 고정은 core resizeRightRange가 보장) */}
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
 * (양 끝 range에서 절반이 컨테이너 밖으로 나가는 것은 정적 단계에서 수용,
 *  히트 영역을 잡는 P3에서 재검토)
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

// ── Handle 드래그 (P3-⑩) ────────────────────────────────────────

/** 진행 중인 드래그 세션. 렌더에 영향을 주지 않는 값이라 state가 아닌 ref에 담는다 */
interface DragSession {
  /** 이 드래그를 시작한 포인터 — 다른 손가락·마우스의 move를 무시하기 위해 기억 */
  pointerId: number;
  /**
   * pointerdown 시점에 1회 측정한 컨테이너 rect.
   * move마다 getBoundingClientRect를 다시 부르면 매번 강제 layout이 일어나므로
   * 시작할 때 한 번만 잰다 (드래그 중 컨테이너 크기는 변하지 않는다는 전제 —
   * Chart Resize 대응은 프로젝트 범위 제외).
   */
  rect: DOMRect;
}

/**
 * Handle 드래그를 "픽셀 → Bucket Position 번역"까지만 담당하는 내부 hook.
 *
 * 번역한 위치를 onDragTo로 넘길 뿐, 그 위치의 의미(어느 경계를 움직일지)와
 * snap·최소 폭·경계 보정은 전부 controller → core의 몫이다.
 * 그래서 컨테이너 밖으로 나간 위치([0,1] 밖 비율)도 자르지 않고 그대로 넘긴다 —
 * 경계 보정 규칙을 UI에 중복 구현하지 않기 위해서다.
 *
 * 반환한 이벤트 props를 Handle button에 스프레드한다.
 * (P3-⑪ Left Handle이 onDragTo만 바꿔 그대로 재사용할 예정)
 */
function useHandleDrag(
  containerRef: RefObject<HTMLDivElement | null>,
  fullRange: Range,
  onDragTo: (position: number) => void,
): DOMAttributes<HTMLButtonElement> {
  const sessionRef = useRef<DragSession | null>(null);

  // 핸들러 묶음의 참조를 고정해 button이 매 렌더 새 props를 받지 않게 한다.
  // fullRange·onDragTo 모두 hook에서 참조가 안정적이라 실질적으로 1회 생성된다.
  return useMemo<DOMAttributes<HTMLButtonElement>>(
    () => ({
      onPointerDown: (event) => {
        // 주 포인터의 주 버튼만 드래그로 취급 (우클릭, 멀티터치 두 번째 손가락 제외)
        if (!event.isPrimary || event.button !== 0) return;
        const container = containerRef.current;
        if (!container) return;

        // 이벤트 우선순위 Handle > Window > Dim — 아래 레이어로 전파 차단 (확정 결정 10)
        event.stopPropagation();
        // 캡처: 포인터가 Handle 밖·Preview 밖으로 나가도 move/up이 계속 이 버튼으로 온다
        event.currentTarget.setPointerCapture(event.pointerId);
        sessionRef.current = {
          pointerId: event.pointerId,
          rect: container.getBoundingClientRect(),
        };
      },

      onPointerMove: (event) => {
        const session = sessionRef.current;
        if (!session || event.pointerId !== session.pointerId) return;

        // 컨테이너 왼쪽 끝 기준 가로 비율 → Bucket Position.
        // Preview 좌표계 계약(plot 영역 = 컨테이너) 덕분에 이 선형 변환만으로 충분하다.
        const ratio =
          (event.clientX - session.rect.left) / session.rect.width;
        onDragTo(fullRange.start + ratio * (fullRange.end - fullRange.start));
      },

      // 드래그 종료를 한 곳으로 수렴: 캡처된 포인터는 up/cancel 시
      // 자동으로 캡처가 풀리며 이 이벤트가 항상 발생한다.
      onLostPointerCapture: () => {
        sessionRef.current = null;
      },
    }),
    [containerRef, fullRange, onDragTo],
  );
}
