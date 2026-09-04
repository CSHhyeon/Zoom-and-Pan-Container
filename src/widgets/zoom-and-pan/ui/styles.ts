/**
 * Preview UI 스타일 상수 (옵션화는 v1.x에서 검토 — 지금은 한곳에 모아두기만).
 * z-index 계층이 그대로 이벤트 우선순위다: Handle(30) > Window(20) > Dim(10).
 */
import type { CSSProperties } from "react";

const AREA_COLOR = "#8884d8";
const WINDOW_COLOR = "#4f7cf7";
const DIM_BACKGROUND = "rgba(0, 0, 0, 0.28)";
const HANDLE_WIDTH = 8;
/** z-index 계층 = 이벤트 우선순위 (Handle > Window > Dim) */
const Z_INDEX = { dim: 10, window: 20, handle: 30 } as const;

/** 추이선·면 색 (Preview 추이 차트 전용) */
export const TREND_AREA_COLOR = AREA_COLOR;

/** 좌표계 계약: plot 영역 = 컨테이너 → margin 전부 0 */
export const TREND_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };

export const TREND_LAYER_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
};

/** Dim 공통 — 왼쪽(left/width)·오른쪽(left/right) 배치만 개별 지정 */
export const DIM_BASE_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  background: DIM_BACKGROUND,
  cursor: "pointer",
  zIndex: Z_INDEX.dim,
};

/** Window 공통 — border-box: 테두리가 폭을 밀지 않게 */
export const WINDOW_BASE_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  border: `1px solid ${WINDOW_COLOR}`,
  boxSizing: "border-box",
  cursor: "grab",
  // 터치 기기에서 브라우저 스크롤 제스처가 pointermove를 가로채지 않도록
  touchAction: "none",
  zIndex: Z_INDEX.window,
};

const HANDLE_BASE_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: HANDLE_WIDTH,
  padding: 0,
  border: "none",
  background: WINDOW_COLOR,
  cursor: "ew-resize",
  // 터치 기기에서 브라우저 스크롤 제스처가 pointermove를 가로채지 않도록
  touchAction: "none",
  zIndex: Z_INDEX.handle,
};

/**
 * Handle 스타일 — 좌우는 위치(pct)만 다르다.
 * calc: 핸들의 "중심"이 경계선 위에 오도록 폭의 절반만큼 왼쪽으로 보정.
 * (양 끝 range에서 절반이 컨테이너 밖으로 나가는 것은 수용 — 히트 영역은 추후 재검토)
 */
export function handleStyle(pct: number): CSSProperties {
  return {
    ...HANDLE_BASE_STYLE,
    left: `calc(${pct}% - ${HANDLE_WIDTH / 2}px)`,
  };
}
