import { describe, expect, it } from "vitest";

import { clampRange } from "../model/clampRange";
import type { Range } from "../model/types";

/** 전체 데이터 [0, 10] — 대부분의 테스트가 공유하는 기본 제약 */
const FULL = { fullRange: { start: 0, end: 10 } };

describe("clampRange — 유효한 입력", () => {
  it("이미 유효한 range는 값을 바꾸지 않는다", () => {
    expect(clampRange({ start: 2, end: 6 }, FULL)).toEqual({
      start: 2,
      end: 6,
    });
  });

  it("전체 경계에 정확히 걸친 range는 그대로 유지한다", () => {
    expect(clampRange({ start: 0, end: 10 }, FULL)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("소수 range도 그대로 허용한다 — snap은 clamp의 몫이 아니다", () => {
    expect(clampRange({ start: 1.5, end: 4.5 }, FULL)).toEqual({
      start: 1.5,
      end: 4.5,
    });
  });

  it("입력 객체를 변경하지 않는다 (순수 함수)", () => {
    const input: Range = { start: -3, end: 2 };
    clampRange(input, FULL);

    expect(input).toEqual({ start: -3, end: 2 });
  });
});

describe("clampRange — 경계 초과 보정 (너비 유지)", () => {
  it("왼쪽 경계 초과 시 너비를 유지한 채 오른쪽으로 밀어 넣는다", () => {
    // 너비 5 유지: [-2, 3] → [0, 5]
    expect(clampRange({ start: -2, end: 3 }, FULL)).toEqual({
      start: 0,
      end: 5,
    });
  });

  it("오른쪽 경계 초과 시 너비를 유지한 채 왼쪽으로 밀어 넣는다", () => {
    // 너비 5 유지: [8, 13] → [5, 10]
    expect(clampRange({ start: 8, end: 13 }, FULL)).toEqual({
      start: 5,
      end: 10,
    });
  });

  it("소수 range의 경계 보정도 너비를 유지한다", () => {
    // 너비 4 유지: [-1.5, 2.5] → [0, 4]
    expect(clampRange({ start: -1.5, end: 2.5 }, FULL)).toEqual({
      start: 0,
      end: 4,
    });
  });

  it("양쪽 모두 초과(전체보다 넓은 range)는 fullRange로 잘린다", () => {
    expect(clampRange({ start: -5, end: 20 }, FULL)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("전체 밖으로 완전히 벗어난 range도 너비를 유지해 들어온다", () => {
    // 너비 3 유지: [20, 23] → [7, 10]
    expect(clampRange({ start: 20, end: 23 }, FULL)).toEqual({
      start: 7,
      end: 10,
    });
  });

  it("fullRange가 0에서 시작하지 않아도 동작한다", () => {
    const constraints = { fullRange: { start: 100, end: 110 } };

    expect(clampRange({ start: 95, end: 99 }, constraints)).toEqual({
      start: 100,
      end: 104,
    });
  });
});

describe("clampRange — 최소 폭(minRange) 보장", () => {
  it("기본 최소 폭은 1 — 폭 0 range는 end를 늘려 확보한다", () => {
    expect(clampRange({ start: 3, end: 3 }, FULL)).toEqual({
      start: 3,
      end: 4,
    });
  });

  it("최소 폭 확장이 오른쪽 경계를 넘으면 왼쪽으로 밀어 확보한다", () => {
    // {10, 10} → end 확장 시 11 → 경계 보정 → {9, 10}
    expect(clampRange({ start: 10, end: 10 }, FULL)).toEqual({
      start: 9,
      end: 10,
    });
  });

  it("커스텀 minRange를 적용한다", () => {
    expect(clampRange({ start: 4, end: 5 }, { ...FULL, minRange: 3 })).toEqual({
      start: 4,
      end: 7,
    });
  });

  it("minRange보다 넓은 range는 건드리지 않는다", () => {
    expect(clampRange({ start: 2, end: 8 }, { ...FULL, minRange: 3 })).toEqual({
      start: 2,
      end: 8,
    });
  });

  it("minRange가 전체 폭보다 크면 fullRange가 된다", () => {
    const constraints = { fullRange: { start: 0, end: 2 }, minRange: 5 };

    expect(clampRange({ start: 1, end: 1 }, constraints)).toEqual({
      start: 0,
      end: 2,
    });
  });

  it("minRange 0을 명시하면 한 포인트 range를 허용한다", () => {
    // allowSinglePointRange의 기반 — 명시적 0만 허용
    expect(clampRange({ start: 3, end: 3 }, { ...FULL, minRange: 0 })).toEqual({
      start: 3,
      end: 3,
    });
  });

  it("데이터가 한 포인트뿐이면(전체 폭 0) 항상 그 지점으로 수렴한다", () => {
    const constraints = { fullRange: { start: 0, end: 0 } };

    expect(clampRange({ start: 3, end: 7 }, constraints)).toEqual({
      start: 0,
      end: 0,
    });
  });
});

describe("clampRange — 잘못된 입력 처리", () => {
  it("start > end로 뒤집힌 range는 순서를 바로잡는다", () => {
    expect(clampRange({ start: 6, end: 2 }, FULL)).toEqual({
      start: 2,
      end: 6,
    });
  });

  it("뒤집힌 range도 경계 보정을 함께 통과한다", () => {
    // {13, 8} → 정렬 {8, 13} → 경계 보정 {5, 10}
    expect(clampRange({ start: 13, end: 8 }, FULL)).toEqual({
      start: 5,
      end: 10,
    });
  });

  it("NaN이 섞인 range는 fullRange로 안전 복귀한다", () => {
    expect(clampRange({ start: Number.NaN, end: 5 }, FULL)).toEqual({
      start: 0,
      end: 10,
    });
    expect(clampRange({ start: 2, end: Number.NaN }, FULL)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("Infinity가 섞인 range는 fullRange로 안전 복귀한다", () => {
    expect(
      clampRange({ start: Number.NEGATIVE_INFINITY, end: 5 }, FULL),
    ).toEqual({ start: 0, end: 10 });
    expect(
      clampRange({ start: 2, end: Number.POSITIVE_INFINITY }, FULL),
    ).toEqual({ start: 0, end: 10 });
  });

  it("음수·NaN minRange는 기본값(1)으로 대체한다", () => {
    expect(clampRange({ start: 3, end: 3 }, { ...FULL, minRange: -5 })).toEqual(
      { start: 3, end: 4 },
    );
    expect(
      clampRange({ start: 3, end: 3 }, { ...FULL, minRange: Number.NaN }),
    ).toEqual({ start: 3, end: 4 });
  });
});

describe("clampRange — 불변 조건 (모든 변경 경로의 단일 관문)", () => {
  // 어떤 입력이 들어와도 결과는 항상 유효한 Range여야 한다
  const inputs: Range[] = [
    { start: 2, end: 6 },
    { start: -100, end: -50 },
    { start: 50, end: 100 },
    { start: 7, end: 3 },
    { start: 5, end: 5 },
    { start: -0.5, end: 10.5 },
    { start: Number.NaN, end: Number.NaN },
  ];

  it.each(inputs)(
    "입력 $start~$end → 결과는 항상 start<=end, minRange 이상, fullRange 안",
    (input) => {
      const constraints = { fullRange: { start: 0, end: 10 }, minRange: 2 };
      const result = clampRange(input, constraints);

      expect(result.start).toBeLessThanOrEqual(result.end);
      expect(result.end - result.start).toBeGreaterThanOrEqual(2);
      expect(result.start).toBeGreaterThanOrEqual(0);
      expect(result.end).toBeLessThanOrEqual(10);
    },
  );
});
