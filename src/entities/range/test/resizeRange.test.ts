import { describe, expect, it } from "vitest";

import { resizeLeftRange, resizeRightRange } from "../model/resizeRange";

/** 전체 데이터 [0, 10] — 대부분의 테스트가 공유하는 기본 제약 */
const FULL = { fullRange: { start: 0, end: 10 } };

describe("resizeLeftRange — 일반 케이스 (end 고정, start만 변경)", () => {
  it("start를 오른쪽으로 옮겨 Window를 좁힌다", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, 4, FULL)).toEqual({
      start: 4,
      end: 6,
    });
  });

  it("start를 왼쪽으로 옮겨 Window를 넓힌다", () => {
    expect(resizeLeftRange({ start: 4, end: 6 }, 1, FULL)).toEqual({
      start: 1,
      end: 6,
    });
  });

  it("소수 위치를 그대로 허용한다 — snap은 hook의 몫", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, 3.5, FULL)).toEqual({
      start: 3.5,
      end: 6,
    });
  });

  it("현재 위치를 그대로 주면 변화가 없다", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, 2, FULL)).toEqual({
      start: 2,
      end: 6,
    });
  });
});

describe("resizeLeftRange — 교차 불가 (상한 = end - minRange 내장)", () => {
  it("end를 넘겨 드래그해도 end - minRange에서 멈춘다", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, 9, FULL)).toEqual({
      start: 5,
      end: 6,
    });
  });

  it("정확히 end 위치를 주어도 교차하지 않는다", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, 6, FULL)).toEqual({
      start: 5,
      end: 6,
    });
  });

  it("정확히 상한(end - minRange)까지는 허용한다", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, 5, FULL)).toEqual({
      start: 5,
      end: 6,
    });
  });

  it("커스텀 minRange만큼 간격을 유지한다", () => {
    expect(
      resizeLeftRange({ start: 2, end: 8 }, 7, { ...FULL, minRange: 3 }),
    ).toEqual({ start: 5, end: 8 });
  });

  it("minRange 0을 명시하면 end까지 이동할 수 있다 (한 포인트)", () => {
    expect(
      resizeLeftRange({ start: 2, end: 6 }, 6, { ...FULL, minRange: 0 }),
    ).toEqual({ start: 6, end: 6 });
  });
});

describe("resizeLeftRange — 전체 범위 경계 준수", () => {
  it("fullRange.start보다 왼쪽으로는 나가지 않는다", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, -3, FULL)).toEqual({
      start: 0,
      end: 6,
    });
  });

  it("fullRange가 0에서 시작하지 않아도 동작한다", () => {
    const constraints = { fullRange: { start: 100, end: 110 } };

    expect(resizeLeftRange({ start: 102, end: 106 }, 95, constraints)).toEqual({
      start: 100,
      end: 106,
    });
  });

  it("end가 이미 최소 폭 위치면 start는 fullRange.start에 고정된다", () => {
    // end=1, minRange=1 → start 상한이 0 = fullRange.start와 동일
    expect(resizeLeftRange({ start: 0, end: 1 }, 0.5, FULL)).toEqual({
      start: 0,
      end: 1,
    });
  });
});

describe("resizeRightRange — 일반 케이스 (start 고정, end만 변경)", () => {
  it("end를 오른쪽으로 옮겨 Window를 넓힌다", () => {
    expect(resizeRightRange({ start: 2, end: 6 }, 8, FULL)).toEqual({
      start: 2,
      end: 8,
    });
  });

  it("end를 왼쪽으로 옮겨 Window를 좁힌다", () => {
    expect(resizeRightRange({ start: 2, end: 8 }, 5, FULL)).toEqual({
      start: 2,
      end: 5,
    });
  });

  it("소수 위치를 그대로 허용한다 — snap은 hook의 몫", () => {
    expect(resizeRightRange({ start: 2, end: 6 }, 4.5, FULL)).toEqual({
      start: 2,
      end: 4.5,
    });
  });

  it("현재 위치를 그대로 주면 변화가 없다", () => {
    expect(resizeRightRange({ start: 2, end: 6 }, 6, FULL)).toEqual({
      start: 2,
      end: 6,
    });
  });
});

describe("resizeRightRange — 교차 불가 (하한 = start + minRange 내장)", () => {
  it("start를 넘겨 드래그해도 start + minRange에서 멈춘다", () => {
    expect(resizeRightRange({ start: 2, end: 6 }, 0, FULL)).toEqual({
      start: 2,
      end: 3,
    });
  });

  it("정확히 start 위치를 주어도 교차하지 않는다", () => {
    expect(resizeRightRange({ start: 2, end: 6 }, 2, FULL)).toEqual({
      start: 2,
      end: 3,
    });
  });

  it("정확히 하한(start + minRange)까지는 허용한다", () => {
    expect(resizeRightRange({ start: 2, end: 6 }, 3, FULL)).toEqual({
      start: 2,
      end: 3,
    });
  });

  it("커스텀 minRange만큼 간격을 유지한다", () => {
    expect(
      resizeRightRange({ start: 2, end: 8 }, 3, { ...FULL, minRange: 3 }),
    ).toEqual({ start: 2, end: 5 });
  });

  it("minRange 0을 명시하면 start까지 이동할 수 있다 (한 포인트)", () => {
    expect(
      resizeRightRange({ start: 2, end: 6 }, 2, { ...FULL, minRange: 0 }),
    ).toEqual({ start: 2, end: 2 });
  });
});

describe("resizeRightRange — 전체 범위 경계 준수", () => {
  it("fullRange.end보다 오른쪽으로는 나가지 않는다", () => {
    expect(resizeRightRange({ start: 2, end: 6 }, 15, FULL)).toEqual({
      start: 2,
      end: 10,
    });
  });

  it("start가 이미 최소 폭 위치면 end는 fullRange.end에 고정된다", () => {
    // start=9, minRange=1 → end 하한이 10 = fullRange.end와 동일
    expect(resizeRightRange({ start: 9, end: 10 }, 9.5, FULL)).toEqual({
      start: 9,
      end: 10,
    });
  });
});

describe("resize — 잘못된 입력과 극단 케이스", () => {
  it("NaN·Infinity 목표 위치는 이동하지 않는다 (현재 range 유지)", () => {
    expect(resizeLeftRange({ start: 2, end: 6 }, Number.NaN, FULL)).toEqual({
      start: 2,
      end: 6,
    });
    expect(
      resizeRightRange({ start: 2, end: 6 }, Number.POSITIVE_INFINITY, FULL),
    ).toEqual({ start: 2, end: 6 });
  });

  it("음수·NaN minRange는 기본값(1)으로 동작한다", () => {
    expect(
      resizeLeftRange({ start: 2, end: 6 }, 9, { ...FULL, minRange: -5 }),
    ).toEqual({ start: 5, end: 6 });
    expect(
      resizeRightRange({ start: 2, end: 6 }, 0, {
        ...FULL,
        minRange: Number.NaN,
      }),
    ).toEqual({ start: 2, end: 3 });
  });

  it("minRange가 전체 폭보다 크면 전체 폭 기준으로 동작한다", () => {
    const constraints = { fullRange: { start: 0, end: 2 }, minRange: 5 };

    // 실효 minRange = 2(전체 폭) → start 상한 = end - 2 = 0
    expect(resizeLeftRange({ start: 0, end: 2 }, 1, constraints)).toEqual({
      start: 0,
      end: 2,
    });
  });

  it("데이터가 한 포인트뿐이면(전체 폭 0) 항상 그 지점이다", () => {
    const constraints = { fullRange: { start: 0, end: 0 } };

    expect(resizeLeftRange({ start: 0, end: 0 }, 5, constraints)).toEqual({
      start: 0,
      end: 0,
    });
    expect(resizeRightRange({ start: 0, end: 0 }, -5, constraints)).toEqual({
      start: 0,
      end: 0,
    });
  });
});

describe("resize — 고정 경계 불변 조건", () => {
  // 유효한 입력 range에서, 어떤 목표 위치를 주어도 반대쪽 경계는 절대 움직이지 않는다
  const targets = [-100, -1, 0, 2.5, 5, 6, 9.5, 100, Number.NaN];

  it.each(targets)("resizeLeftRange(목표 %f): end는 항상 6 그대로", (next) => {
    const result = resizeLeftRange({ start: 2, end: 6 }, next, FULL);

    expect(result.end).toBe(6);
    expect(result.start).toBeLessThanOrEqual(result.end - 1); // minRange 1
    expect(result.start).toBeGreaterThanOrEqual(0);
  });

  it.each(targets)(
    "resizeRightRange(목표 %f): start는 항상 2 그대로",
    (next) => {
      const result = resizeRightRange({ start: 2, end: 6 }, next, FULL);

      expect(result.start).toBe(2);
      expect(result.end).toBeGreaterThanOrEqual(result.start + 1); // minRange 1
      expect(result.end).toBeLessThanOrEqual(10);
    },
  );
});
