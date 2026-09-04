import { describe, expect, it } from "vitest";

import type { ZoomDirection } from "../../../entities/range";
import {
  startWheelZoomSession,
  zoomWheelSession,
  type WheelZoomSession,
} from "../lib/wheelZoomSession";

/** 전체 데이터 360개 (LargeDataset 스케일) — 비율 스텝이 의미 있게 드러나는 크기 */
const FULL = { fullRange: { start: 0, end: 359 } };

/** 연속 틱 적용 — 매 틱 이전 tick.session을 이어받는다 (controller의 ref 역할) */
function runTicks(
  session: WheelZoomSession,
  directions: ZoomDirection[],
  zoomStep?: number,
) {
  let current = session;
  let last = zoomWheelSession(current, directions[0], FULL, zoomStep);
  for (const direction of directions.slice(1)) {
    current = last.session;
    last = zoomWheelSession(current, direction, FULL, zoomStep);
  }
  return last;
}

describe("startWheelZoomSession — 세션 pivot 확정", () => {
  it("포인터 비율을 가장 가까운 정수 Bucket으로 확정한다", () => {
    // [150, 209] 폭 59, 비율 0.68 → position 190.12 → 포인트 190
    const session = startWheelZoomSession(
      { start: 150, end: 209 },
      (190.12 - 150) / 59,
    );
    expect(session.anchor).toBe(190);
  });

  it("비율이 없으면(plot 폭 측정 불가) anchor도 없다 — 중앙 기준 폴백", () => {
    const session = startWheelZoomSession({ start: 150, end: 209 }, undefined);
    expect(session.anchor).toBeUndefined();
  });
});

describe("zoomWheelSession — 비율 기반 스텝 (zoomStep 미지정)", () => {
  it("확대 1틱은 폭을 ×0.8로 줄인다", () => {
    const tick = zoomWheelSession(
      startWheelZoomSession({ start: 100, end: 200 }, 0.5),
      "in",
      FULL,
      undefined,
    );
    expect(tick.session.base.end - tick.session.base.start).toBeCloseTo(80);
  });

  it("축소 1틱은 폭을 ÷0.8로 늘린다 — 확대의 정확한 역연산", () => {
    const tick = zoomWheelSession(
      startWheelZoomSession({ start: 100, end: 180 }, 0.5),
      "out",
      FULL,
      undefined,
    );
    expect(tick.session.base.end - tick.session.base.start).toBeCloseTo(100);
  });

  it("확대 n틱 → 축소 n틱이면 제자리로 돌아온다 (왕복 복귀)", () => {
    const start = { start: 150, end: 209 };
    const tick = runTicks(startWheelZoomSession(start, 0.68), [
      ...Array<ZoomDirection>(8).fill("in"),
      ...Array<ZoomDirection>(8).fill("out"),
    ]);
    expect(tick.next).toEqual(start);
  });

  it("좁은 폭에서는 최소 1칸씩 움직인다 (비율 스텝 하한)", () => {
    // 폭 6 → 비율 스텝은 0.6칸이지만 하한 1칸이 적용되어 폭 4가 된다
    const tick = zoomWheelSession(
      startWheelZoomSession({ start: 10, end: 16 }, 0.5),
      "in",
      FULL,
      undefined,
    );
    expect(tick.next.end - tick.next.start).toBe(4);
  });
});

describe("zoomWheelSession — 고정 스텝 (zoomStep 지정)", () => {
  it("폭과 무관하게 zoomStep칸씩 양쪽이 움직인다", () => {
    const tick = zoomWheelSession(
      startWheelZoomSession({ start: 100, end: 200 }, 0.5),
      "in",
      FULL,
      3,
    );
    expect(tick.next).toEqual({ start: 103, end: 197 });
  });
});

describe("zoomWheelSession — anchor 고정 (흔들림 방지)", () => {
  it("연속 확대 내내 anchor 데이터가 창 안에서 같은 비율 근처에 머문다 (드리프트 없음)", () => {
    const start = { start: 150, end: 209 };
    const anchorRatio = 0.68;
    let session = startWheelZoomSession(start, anchorRatio);
    const anchor = session.anchor as number;

    for (let i = 0; i < 12; i += 1) {
      const tick = zoomWheelSession(session, "in", FULL, undefined);
      session = tick.session;

      const span = tick.next.end - tick.next.start;
      const renderedRatio = (anchor - tick.next.start) / span;
      // snap 진동은 최대 0.5칸 — 비율 오차 한도는 0.5/span (누적되면 이 한도를 넘는다)
      expect(Math.abs(renderedRatio - anchorRatio)).toBeLessThanOrEqual(
        0.5 / span + 0.02,
      );
    }
  });

  it("표시용 next는 항상 정수 격자에 있다 (base는 소수 유지)", () => {
    const tick = runTicks(
      startWheelZoomSession({ start: 150, end: 209 }, 0.68),
      Array<ZoomDirection>(5).fill("in"),
    );
    expect(Number.isInteger(tick.next.start)).toBe(true);
    expect(Number.isInteger(tick.next.end)).toBe(true);
  });

  it("anchorDisplayRatio는 anchor가 next 창에서 렌더되는 비율이다", () => {
    const session = startWheelZoomSession({ start: 150, end: 209 }, 0.68);
    const tick = zoomWheelSession(session, "in", FULL, undefined);

    const anchor = session.anchor as number;
    const expected =
      (anchor - tick.next.start) / (tick.next.end - tick.next.start);
    expect(tick.anchorDisplayRatio).toBeCloseTo(expected);
  });

  it("anchor가 없으면 anchorDisplayRatio도 없다", () => {
    const tick = zoomWheelSession(
      startWheelZoomSession({ start: 150, end: 209 }, undefined),
      "in",
      FULL,
      undefined,
    );
    expect(tick.anchorDisplayRatio).toBeUndefined();
  });
});

describe("zoomWheelSession — 경계·최소 폭 (core 관문 위임)", () => {
  it("축소가 전체 경계를 넘으면 벽에 붙는다 (폭 유지 평행이동)", () => {
    const tick = zoomWheelSession(
      startWheelZoomSession({ start: 0, end: 99 }, 0.1),
      "out",
      FULL,
      undefined,
    );
    expect(tick.next.start).toBe(0);
    expect(tick.next.end).toBeGreaterThan(99);
  });

  it("경계 clamp로 anchor가 창 밖이 되면 표시 비율은 창 안으로 pin된다", () => {
    // 오른쪽 끝 anchor로 계속 확대 — 창이 어떻게 밀리든 비율은 [0, 1]을 벗어나지 않는다
    const tick = runTicks(
      startWheelZoomSession({ start: 300, end: 359 }, 1),
      Array<ZoomDirection>(10).fill("in"),
    );
    expect(tick.anchorDisplayRatio).toBeGreaterThanOrEqual(0);
    expect(tick.anchorDisplayRatio).toBeLessThanOrEqual(1);
  });

  it("최소 폭(minRange)에서 확대가 멈춘다", () => {
    const constraints = { ...FULL, minRange: 4 };
    const session = startWheelZoomSession({ start: 100, end: 106 }, 0.5);
    let tick = zoomWheelSession(session, "in", constraints, undefined);
    tick = zoomWheelSession(tick.session, "in", constraints, undefined);
    expect(tick.next.end - tick.next.start).toBe(4);
  });
});
