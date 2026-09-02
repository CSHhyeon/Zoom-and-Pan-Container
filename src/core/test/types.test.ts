import { describe, expect, expectTypeOf, it } from "vitest";

import {
  DEFAULT_MIN_RANGE,
  isSameRange,
  type NormalizedPoint,
  type Range,
  type RangeConstraints,
  type RangeMode,
} from "../types";

describe("core types", () => {
  it("Range는 Index 기준 포함(inclusive) 범위다 — {2,6} = 포인트 5개", () => {
    const range: Range = { start: 2, end: 6 };

    // 확정 결정 2의 문서화: 포함 범위이므로 포인트 개수 = end - start + 1
    expect(range.end - range.start + 1).toBe(5);

    expectTypeOf(range.start).toEqualTypeOf<number>();
    expectTypeOf(range.end).toEqualTypeOf<number>();
  });

  it("기본 최소 범위 폭은 1 — 최소 두 포인트 표시", () => {
    expect(DEFAULT_MIN_RANGE).toBe(1);

    // 최소 폭 Range의 예: {3, 4} → end - start = 1, 포인트 2개
    const minimal: Range = { start: 3, end: 3 + DEFAULT_MIN_RANGE };
    expect(minimal.end - minimal.start).toBe(DEFAULT_MIN_RANGE);
  });

  it("RangeMode는 bucket | continuous 두 가지만 허용한다", () => {
    expectTypeOf<RangeMode>().toEqualTypeOf<"bucket" | "continuous">();

    const mode: RangeMode = "bucket";
    expect(mode).toBe("bucket");

    // @ts-expect-error - "scatter"는 RangeMode가 아니다
    const invalid: RangeMode = "scatter";
    void invalid;
  });

  it("NormalizedPoint는 TX 제네릭으로 원본 x값의 타입을 보존한다", () => {
    // 사용자 x가 문자열(country)인 경우
    const byCountry: NormalizedPoint<string> = { index: 0, value: "A" };
    expectTypeOf(byCountry.value).toEqualTypeOf<string>();

    // 사용자 x가 숫자(timestamp)인 경우
    const byTime: NormalizedPoint<number> = { index: 3, value: 1_700_000_000 };
    expectTypeOf(byTime.value).toEqualTypeOf<number>();

    // 제네릭 생략 시 기본값은 unknown (가장 안전한 타입)
    expectTypeOf<NormalizedPoint["value"]>().toEqualTypeOf<unknown>();

    expect(byCountry.index).toBe(0);
    expect(byTime.index).toBe(3);
  });

  it("isSameRange는 값이 같으면 참조가 달라도 같은 Range로 본다", () => {
    expect(isSameRange({ start: 2, end: 6 }, { start: 2, end: 6 })).toBe(true);
    expect(isSameRange({ start: 2, end: 6 }, { start: 2, end: 7 })).toBe(false);
    expect(isSameRange({ start: 2, end: 6 }, { start: 3, end: 6 })).toBe(false);

    // 소수 Position(향후 snap=false)도 값 그대로 비교한다
    expect(
      isSameRange({ start: 1.5, end: 4.5 }, { start: 1.5, end: 4.5 }),
    ).toBe(true);

    // NaN Range는 항상 "다름" — 단, 실사용에선 clampRange 관문이 걸러낸 뒤라 오지 않는다
    expect(isSameRange({ start: NaN, end: 6 }, { start: NaN, end: 6 })).toBe(
      false,
    );
  });

  it("RangeConstraints는 fullRange 필수, minRange는 생략 가능", () => {
    const constraints: RangeConstraints = {
      fullRange: { start: 0, end: 9 },
    };

    expect(constraints.minRange).toBeUndefined();
    expectTypeOf<RangeConstraints["fullRange"]>().toEqualTypeOf<Range>();
    expectTypeOf<RangeConstraints["minRange"]>().toEqualTypeOf<
      number | undefined
    >();
  });
});
