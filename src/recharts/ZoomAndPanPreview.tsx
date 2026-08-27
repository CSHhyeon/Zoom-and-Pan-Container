/**
 * ZoomAndPanPreview — 전체 추이 위에 현재 Window를 표시하는 Preview UI.
 * (P2-⑨: 정적 렌더링만. Pointer 조작은 P3에서 이 레이어들 위에 얹는다)
 *
 * 구조: 위치 기준 컨테이너 위에 절대 위치 레이어 5겹을 겹친다.
 *   추이 차트(0) < Left/Right Dim(10) < Window(20) < Left/Right Handle(30)
 * 이 z-index 계층이 그대로 P3의 이벤트 우선순위(Handle > Window > Dim)가 된다.
 *
 * 좌표계 계약 (PreviewPoint JSDoc 참고):
 * Dim/Window/Handle은 "컨테이너 폭 기준 %"로 배치된다. 따라서 내부 차트의
 * plot 영역이 컨테이너와 정확히 일치해야 한다 — margin 전부 0, 축 hide,
 * XAxis domain을 fullRange로 명시. 이 계약이 깨지면 추이선과 오버레이가 어긋난다.
 */
import type { CSSProperties } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
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
  const { range, fullRange, previewData } = controller;

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

      {/* Handle — button: P3 포커스·접근성 대비. 정적 단계라 onClick은 아직 없다 */}
      <button
        type="button"
        aria-label="range start handle"
        style={handleStyle(leftPct)}
      />
      <button
        type="button"
        aria-label="range end handle"
        style={handleStyle(rightPct)}
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
    zIndex: Z_INDEX.handle,
  };
}
