import { describe, expect, it } from "vitest";

import { DEFAULT_ZOOM_STEP, zoomRange } from "../zoomRange";

/** 전체 데이터 [0, 10] — 대부분의 테스트가 공유하는 기본 제약 */
const FULL = { fullRange: { start: 0, end: 10 } };

describe("zoomRange — 확대/축소 일반 케이스", () => {
  it("확대 시 양쪽 Handle이 step(기본 1칸)씩 가까워진다", () => {
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL)).toEqual({
      start: 3,
      end: 5,
    });
  });

  it("축소 시 양쪽 Handle이 step(기본 1칸)씩 멀어진다", () => {
    expect(zoomRange({ start: 3, end: 5 }, "out", FULL)).toEqual({
      start: 2,
      end: 6,
    });
  });

  it("확대·축소 모두 Window 중심을 유지한다", () => {
    const range = { start: 2, end: 8 }; // center 5

    const zoomedIn = zoomRange(range, "in", FULL);
    const zoomedOut = zoomRange(range, "out", FULL);

    expect((zoomedIn.start + zoomedIn.end) / 2).toBe(5);
    expect((zoomedOut.start + zoomedOut.end) / 2).toBe(5);
  });

  it("커스텀 step을 적용한다 — 한 번에 여러 칸", () => {
    expect(zoomRange({ start: 1, end: 9 }, "in", FULL, 2)).toEqual({
      start: 3,
      end: 7,
    });
  });

  it("기본 step은 1이다", () => {
    expect(DEFAULT_ZOOM_STEP).toBe(1);

    const withDefault = zoomRange({ start: 2, end: 6 }, "in", FULL);
    const withExplicit = zoomRange({ start: 2, end: 6 }, "in", FULL, 1);
    expect(withDefault).toEqual(withExplicit);
  });
});

describe("zoomRange — 경계 도달 시 반대쪽만 이동", () => {
  it("문서 예시: 전체 [0,10], 현재 [0,6], 축소 → [0,8]", () => {
    // 요청 [-1, 7]이 왼쪽 경계를 넘으므로 왼쪽은 고정, 오른쪽만 이동
    expect(zoomRange({ start: 0, end: 6 }, "out", FULL)).toEqual({
      start: 0,
      end: 8,
    });
  });

  it("오른쪽 경계에 닿아 있으면 축소 시 왼쪽만 이동한다", () => {
    expect(zoomRange({ start: 4, end: 10 }, "out", FULL)).toEqual({
      start: 2,
      end: 10,
    });
  });

  it("경계에 닿아도 폭 변화량(step*2)은 유지된다", () => {
    const result = zoomRange({ start: 0, end: 6 }, "out", FULL);

    expect(result.end - result.start).toBe(6 + DEFAULT_ZOOM_STEP * 2);
  });
});

describe("zoomRange — 최소·최대 Window 준수", () => {
  it("최대: 전체 범위에서 더 축소해도 그대로다", () => {
    expect(zoomRange({ start: 0, end: 10 }, "out", FULL)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("최대: 축소 폭이 전체를 넘으면 fullRange로 캡된다", () => {
    // [1, 9] 폭 8 + step 5*2 = 18 → 전체 폭 10으로 캡
    expect(zoomRange({ start: 1, end: 9 }, "out", FULL, 5)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("최소: minRange 폭에서 더 확대해도 그대로다", () => {
    expect(zoomRange({ start: 3, end: 4 }, "in", FULL)).toEqual({
      start: 3,
      end: 4,
    });
  });

  it("최소: 큰 step으로 확대해도 minRange 아래로 내려가지 않는다", () => {
    // 폭 8 - 3*2 = 2지만 minRange 4가 하한
    const result = zoomRange(
      { start: 1, end: 9 },
      "in",
      { ...FULL, minRange: 4 },
      3,
    );

    expect(result.end - result.start).toBe(4);
    expect((result.start + result.end) / 2).toBe(5); // 중심 유지
  });

  it("최소: 확대가 minRange를 지나치면 minRange 폭에서 멈춘다 (중심 유지)", () => {
    // [2, 6] 폭 4 - 2*2 = 0 → minRange 1로 캡 → 중심 4 기준 {3.5, 4.5}
    // 소수 결과의 snap 처리는 core가 아니라 hook의 몫
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, 2)).toEqual({
      start: 3.5,
      end: 4.5,
    });
  });
});

describe("zoomRange — 잘못된 입력 (단일 관문 통과 확인)", () => {
  it("NaN range는 fullRange로 안전 복귀한다", () => {
    expect(zoomRange({ start: Number.NaN, end: 5 }, "in", FULL)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("NaN·음수 step은 기본값(1)으로 대체한다", () => {
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, Number.NaN)).toEqual({
      start: 3,
      end: 5,
    });
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, -3)).toEqual({
      start: 3,
      end: 5,
    });
  });

  it("뒤집힌 range도 정상 동작한다", () => {
    // {6, 2} → 정규화 {2, 6} → 확대 → {3, 5}
    expect(zoomRange({ start: 6, end: 2 }, "in", FULL)).toEqual({
      start: 3,
      end: 5,
    });
  });
});
