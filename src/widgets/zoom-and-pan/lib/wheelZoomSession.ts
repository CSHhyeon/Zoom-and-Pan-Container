/**
 * wheelZoomSession — Wheel Zoom 한 세션(연속 휠)의 순수 계산.
 *
 * 휠 시작 시점에 포인터와 가장 가까운 데이터 포인트를 pivot(anchor)으로 고정하고,
 * 세션 내내 그 점의 창 내 비율(= 화면 위치)을 유지한 채 확대·축소한다 (지도 방식).
 *
 * 세션 상태 두 가지가 흔들림(드리프트)을 막는다:
 * - anchor: 소수 포인터 위치가 아니라 가장 가까운 정수 Bucket(Tooltip이 선택한 그 점)으로 세션당 1회 고정.
 *   점 사이 허공을 pivot으로 잡으면 확대할수록 양옆 실제 포인트가 전부 밀려 보인다 — 실제 점이 pivot이면 그 점은 제자리다.
 * - base: snap 전 소수 range를 유지하고 zoom은 항상 그 위에서 이어간다.
 *   snap된 상태에서 매 틱 다시 계산하면 반올림 오차가 같은 방향으로 누적되어 anchor가 흘러간다.
 *
 * snap은 표시용 결과(next)에만 적용된다 — 잔여 진동 최대 0.5칸은 정수 Bucket 렌더의 구조적 한계(비누적).
 * React 상태·세션 생명주기(시작·150ms 정착)는 useZoomAndPanController와 useWheelZoom의 몫이다.
 */
import {
  zoomRange,
  type Range,
  type RangeConstraints,
  type ZoomDirection,
} from "../../../entities/range";
import { snapToBucketGrid } from "./snapToBucketGrid";

/**
 * Wheel Zoom 1틱당 폭 배율 (zoomStep 미지정 시) — 확대 ×0.8 / 축소 ÷0.8.
 * 고정 칸 수 스텝은 대용량에서 수백 틱이 필요해 비율 기반으로 간다 (지도·MUI Charts 방식).
 * 두 방향이 정확히 역연산이라 확대→축소 왕복이 제자리로 돌아오고, 좁은 창에서는 최소 1칸(step 하한)으로 정밀 조작이 유지된다.
 */
const WHEEL_ZOOM_WIDTH_FACTOR = 0.8;

export interface WheelZoomSession {
  /** snap 전 소수 range — zoom은 항상 이 위에서 이어간다 */
  base: Range;
  /** 세션 고정 pivot(정수 Bucket). 포인터 비율을 잴 수 없었으면 undefined — 중앙 기준 zoom */
  anchor: number | undefined;
}

export interface WheelZoomTick {
  /** 다음 틱이 이어받을 세션 상태 */
  session: WheelZoomSession;
  /** 표시용 결과 — 정수 격자로 snap된 range */
  next: Range;
  /**
   * anchor가 next 창에서 렌더되는 비율(0~1) — hover 재전송을 이 위치로 보내 Tooltip 선택을 anchor에 고정한다.
   * anchor가 없으면 undefined.
   */
  anchorDisplayRatio: number | undefined;
}

/** 세션의 첫 틱: 포인터와 가장 가까운 데이터 포인트를 세션 pivot으로 확정한다 */
export function startWheelZoomSession(
  current: Range,
  anchorRatio: number | undefined,
): WheelZoomSession {
  return {
    base: current,
    anchor:
      anchorRatio === undefined
        ? undefined
        : Math.round(
            current.start + anchorRatio * (current.end - current.start),
          ),
  };
}

/**
 * 휠 1틱 적용 — anchor의 창 내 비율을 유지한 채 폭을 바꾼다.
 *
 * zoomStep 지정 시 고정 스텝, 미지정 시 현재 폭 비례(1틱당 폭 ×0.8 / ÷0.8, 최소 1칸).
 * 경계·최소 폭 보정은 core(zoomRange → clampRange)가 담당한다.
 */
export function zoomWheelSession(
  session: WheelZoomSession,
  direction: ZoomDirection,
  constraints: RangeConstraints,
  zoomStep: number | undefined,
): WheelZoomTick {
  // step(한쪽 Handle 이동량) 환산: 폭 ×F는 step (1-F)/2, ÷F는 step (1/F-1)/2 — 왕복이 역연산이 되는 짝
  const span = Math.abs(session.base.end - session.base.start);
  const step =
    zoomStep ??
    Math.max(
      1,
      direction === "in"
        ? span * ((1 - WHEEL_ZOOM_WIDTH_FACTOR) / 2)
        : span * ((1 / WHEEL_ZOOM_WIDTH_FACTOR - 1) / 2),
    );

  const base = zoomRange(
    session.base,
    direction,
    constraints,
    step,
    session.anchor,
  );
  const next = snapToBucketGrid(base, constraints);

  return {
    session: { base, anchor: session.anchor },
    next,
    anchorDisplayRatio: toAnchorDisplayRatio(session.anchor, next),
  };
}

function toAnchorDisplayRatio(
  anchor: number | undefined,
  next: Range,
): number | undefined {
  if (anchor === undefined) return undefined;

  const span = next.end - next.start;
  // 경계 clamp로 창이 밀렸으면 anchor도 창 안으로 — 화면에 남은 위치 기준
  const pinned = Math.min(Math.max(anchor, next.start), next.end);
  return span === 0 ? 0.5 : (pinned - next.start) / span;
}
