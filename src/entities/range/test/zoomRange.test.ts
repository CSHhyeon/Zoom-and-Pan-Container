import { describe, expect, it } from "vitest";

import { DEFAULT_ZOOM_STEP, zoomRange } from "../model/zoomRange";

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

describe("zoomRange — anchor (포인터 중심 Zoom)", () => {
  it("anchor 지점의 창 내 비율을 줌 전후에 유지한다", () => {
    // {0,10} 폭 10, anchor 8 = 80% 지점. 확대 → 폭 8, start = 8 - 0.8*8 = 1.6
    const result = zoomRange(
      { start: 0, end: 10 },
      "in",
      { fullRange: { start: 0, end: 20 } },
      1,
      8,
    );

    // 부동소수점 오차 허용 (0.8 * 8 = 6.4000…04)
    expect(result.start).toBeCloseTo(1.6);
    expect(result.end).toBeCloseTo(9.6);
    // anchor는 여전히 80% 지점
    expect((8 - result.start) / (result.end - result.start)).toBeCloseTo(0.8);
  });

  it("축소도 anchor 비율을 유지한다", () => {
    // {2,6} 폭 4, anchor 5 = 75% 지점. 축소 → 폭 6, start = 5 - 0.75*6 = 0.5
    const result = zoomRange({ start: 2, end: 6 }, "out", FULL, 1, 5);

    expect(result).toEqual({ start: 0.5, end: 6.5 });
  });

  it("anchor가 창의 중앙이면 중심 기준과 결과가 같다", () => {
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, 1, 4)).toEqual(
      zoomRange({ start: 2, end: 6 }, "in", FULL, 1),
    );
  });

  it("anchor 생략·NaN이면 기존 중심 동작으로 폴백한다", () => {
    const centered = zoomRange({ start: 2, end: 6 }, "in", FULL);

    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, 1, undefined)).toEqual(
      centered,
    );
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, 1, Number.NaN)).toEqual(
      centered,
    );
  });

  it("창 밖 anchor는 가장자리 고정으로 취급한다", () => {
    // anchor 10 > end 6 → 오른쪽 가장자리(6) 고정: 확대 → {4, 6}
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, 1, 10)).toEqual({
      start: 4,
      end: 6,
    });
    // anchor -3 < start 2 → 왼쪽 가장자리(2) 고정: 확대 → {2, 4}
    expect(zoomRange({ start: 2, end: 6 }, "in", FULL, 1, -3)).toEqual({
      start: 2,
      end: 4,
    });
  });

  it("anchor 배치가 경계를 넘으면 반대쪽만 이동한다 (관문 보정)", () => {
    // {0,6} anchor 1(1/6 지점), 축소 → 폭 8, 원하는 start = 1 - 8/6 < 0 → {0, 8}
    expect(zoomRange({ start: 0, end: 6 }, "out", FULL, 1, 1)).toEqual({
      start: 0,
      end: 8,
    });
  });

  it("연속 확대에도 anchor가 (보정 전까지) 계속 고정된다", () => {
    const constraints = { fullRange: { start: 0, end: 20 } };
    const anchor = 12;

    let range = { start: 4, end: 20 };
    for (let i = 0; i < 3; i += 1) {
      const ratioBefore = (anchor - range.start) / (range.end - range.start);
      range = zoomRange(range, "in", constraints, 1, anchor);
      const ratioAfter = (anchor - range.start) / (range.end - range.start);

      expect(ratioAfter).toBeCloseTo(ratioBefore);
    }
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
