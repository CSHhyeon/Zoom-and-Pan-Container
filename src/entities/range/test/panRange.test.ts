import { describe, expect, it } from "vitest";

import { panRange } from "../model/panRange";

/** 전체 데이터 [0, 10] — 대부분의 테스트가 공유하는 기본 제약 */
const FULL = { fullRange: { start: 0, end: 10 } };

describe("panRange — 이동 일반 케이스", () => {
  it("양수 delta는 오른쪽(큰 index)으로 이동한다", () => {
    expect(panRange({ start: 2, end: 5 }, 2, FULL)).toEqual({
      start: 4,
      end: 7,
    });
  });

  it("음수 delta는 왼쪽(작은 index)으로 이동한다", () => {
    expect(panRange({ start: 4, end: 7 }, -2, FULL)).toEqual({
      start: 2,
      end: 5,
    });
  });

  it("이동해도 Window 폭은 변하지 않는다", () => {
    const result = panRange({ start: 2, end: 5 }, 2.5, FULL);

    expect(result.end - result.start).toBe(3);
  });

  it("소수 delta도 그대로 적용한다 — snap은 hook의 몫", () => {
    expect(panRange({ start: 2, end: 5 }, 0.5, FULL)).toEqual({
      start: 2.5,
      end: 5.5,
    });
  });

  it("delta 0이면 그대로다", () => {
    expect(panRange({ start: 2, end: 5 }, 0, FULL)).toEqual({
      start: 2,
      end: 5,
    });
  });
});

describe("panRange — 경계 도달 시 벽에 멈춤 (폭 유지)", () => {
  it("오른쪽 경계를 넘는 이동은 경계에 붙어 멈춘다", () => {
    // [7,9] + 5 = [12,14] → 폭 2 유지, 오른쪽 벽에 정렬 → [8,10]
    expect(panRange({ start: 7, end: 9 }, 5, FULL)).toEqual({
      start: 8,
      end: 10,
    });
  });

  it("왼쪽 경계를 넘는 이동은 경계에 붙어 멈춘다", () => {
    expect(panRange({ start: 1, end: 3 }, -5, FULL)).toEqual({
      start: 0,
      end: 2,
    });
  });

  it("이미 경계에 붙어 있으면 더 밀어도 움직이지 않는다", () => {
    expect(panRange({ start: 8, end: 10 }, 3, FULL)).toEqual({
      start: 8,
      end: 10,
    });
    expect(panRange({ start: 0, end: 2 }, -3, FULL)).toEqual({
      start: 0,
      end: 2,
    });
  });

  it("fullRange가 0에서 시작하지 않아도 동작한다", () => {
    const constraints = { fullRange: { start: 100, end: 110 } };

    expect(panRange({ start: 101, end: 104 }, -5, constraints)).toEqual({
      start: 100,
      end: 103,
    });
  });
});

describe("panRange — 잘못된 입력 (단일 관문 통과 확인)", () => {
  it("NaN·Infinity delta는 이동하지 않는다 (현재 range 유지)", () => {
    expect(panRange({ start: 2, end: 5 }, Number.NaN, FULL)).toEqual({
      start: 2,
      end: 5,
    });
    expect(
      panRange({ start: 2, end: 5 }, Number.POSITIVE_INFINITY, FULL),
    ).toEqual({ start: 2, end: 5 });
  });

  it("NaN range는 fullRange로 안전 복귀한다", () => {
    expect(panRange({ start: Number.NaN, end: 5 }, 1, FULL)).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("뒤집힌 range도 정규화 후 이동한다", () => {
    // {5, 2} → 정규화 {2, 5} → +2 → {4, 7}
    expect(panRange({ start: 5, end: 2 }, 2, FULL)).toEqual({
      start: 4,
      end: 7,
    });
  });
});
