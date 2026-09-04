import { describe, expect, it } from "vitest";

import { centerRangeAt } from "../centerRangeAt";

/** 전체 데이터 [0, 10] — 대부분의 테스트가 공유하는 기본 제약 */
const FULL = { fullRange: { start: 0, end: 10 } };

describe("centerRangeAt — 일반 케이스 (폭 유지, 중앙 배치)", () => {
  it("center가 Window 중앙에 오도록 폭을 유지한 채 이동한다", () => {
    // 폭 4: center 7 → {5, 9}
    expect(centerRangeAt({ start: 2, end: 6 }, 7, FULL)).toEqual({
      start: 5,
      end: 9,
    });
  });

  it("왼쪽으로도 이동한다", () => {
    expect(centerRangeAt({ start: 5, end: 9 }, 3, FULL)).toEqual({
      start: 1,
      end: 5,
    });
  });

  it("이미 중앙이면 변화가 없다", () => {
    expect(centerRangeAt({ start: 2, end: 6 }, 4, FULL)).toEqual({
      start: 2,
      end: 6,
    });
  });

  it("홀수 폭은 소수 배치를 그대로 돌려준다 — snap은 hook의 몫", () => {
    // 폭 3: center 6 → {4.5, 7.5}
    expect(centerRangeAt({ start: 1, end: 4 }, 6, FULL)).toEqual({
      start: 4.5,
      end: 7.5,
    });
  });

  it("소수 center도 그대로 배치한다", () => {
    // 폭 4: center 5.5 → {3.5, 7.5}
    expect(centerRangeAt({ start: 0, end: 4 }, 5.5, FULL)).toEqual({
      start: 3.5,
      end: 7.5,
    });
  });
});

describe("centerRangeAt — 경계 준수가 중앙 배치보다 우선", () => {
  it("왼쪽 경계를 넘으면 벽에 붙어 멈춘다 (폭 유지)", () => {
    // 폭 4: center 1 → 원하는 {-1, 3} → 보정 {0, 4}
    expect(centerRangeAt({ start: 4, end: 8 }, 1, FULL)).toEqual({
      start: 0,
      end: 4,
    });
  });

  it("오른쪽 경계를 넘으면 벽에 붙어 멈춘다 (폭 유지)", () => {
    // 폭 4: center 9.5 → 원하는 {7.5, 11.5} → 보정 {6, 10}
    expect(centerRangeAt({ start: 2, end: 6 }, 9.5, FULL)).toEqual({
      start: 6,
      end: 10,
    });
  });

  it("전체 밖 center도 벽에 붙는 것으로 수렴한다", () => {
    expect(centerRangeAt({ start: 2, end: 6 }, -100, FULL)).toEqual({
      start: 0,
      end: 4,
    });
    expect(centerRangeAt({ start: 2, end: 6 }, 100, FULL)).toEqual({
      start: 6,
      end: 10,
    });
  });
});

describe("centerRangeAt — 잘못된 입력", () => {
  it("NaN·Infinity center는 이동하지 않는다 (현재 range 유지)", () => {
    expect(centerRangeAt({ start: 2, end: 6 }, Number.NaN, FULL)).toEqual({
      start: 2,
      end: 6,
    });
    expect(
      centerRangeAt({ start: 2, end: 6 }, Number.POSITIVE_INFINITY, FULL),
    ).toEqual({ start: 2, end: 6 });
  });

  it("뒤집힌 range도 폭을 지켜 배치한다", () => {
    // {6, 2} → 폭 4 → center 5 → {3, 7}
    expect(centerRangeAt({ start: 6, end: 2 }, 5, FULL)).toEqual({
      start: 3,
      end: 7,
    });
  });

  it("전체보다 넓은 range는 fullRange가 된다", () => {
    expect(centerRangeAt({ start: -5, end: 20 }, 5, FULL)).toEqual({
      start: 0,
      end: 10,
    });
  });
});

describe("centerRangeAt — 불변 조건", () => {
  const centers = [-100, -1, 0, 2.5, 5, 9.5, 100];

  it.each(centers)("center %f → 결과는 항상 폭 4 유지 + fullRange 안", (c) => {
    const result = centerRangeAt({ start: 2, end: 6 }, c, FULL);

    expect(result.end - result.start).toBe(4);
    expect(result.start).toBeGreaterThanOrEqual(0);
    expect(result.end).toBeLessThanOrEqual(10);
  });
});
