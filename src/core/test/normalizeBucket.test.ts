import { describe, expect, expectTypeOf, it } from "vitest";

import {
  findPointByIndex,
  findPointByValue,
  normalizeBucket,
} from "../normalizeBucket";
import type { NormalizedPoint } from "../types";

describe("normalizeBucket", () => {
  it("string x값을 입력 순서대로 Ordinal Bucket으로 정규화한다", () => {
    const data = [
      { country: "Korea", value: 10 },
      { country: "Japan", value: 20 },
      { country: "USA", value: 30 },
    ];

    const points = normalizeBucket(data, (d) => d.country);

    expect(points).toEqual([
      { index: 0, value: "Korea" },
      { index: 1, value: "Japan" },
      { index: 2, value: "USA" },
    ]);

    // 제네릭 추론: getX가 string을 돌려주면 NormalizedPoint<string>[]
    expectTypeOf(points).toEqualTypeOf<NormalizedPoint<string>[]>();
  });

  it("number x값은 정렬하지 않고 입력 순서를 그대로 유지한다", () => {
    // Bucket은 값 크기가 아니라 "입력 순서"에 따른 순서형 위치다
    const data = [{ x: 30 }, { x: 10 }, { x: 20 }];

    const points = normalizeBucket(data, (d) => d.x);

    expect(points.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(points.map((p) => p.value)).toEqual([30, 10, 20]);
  });

  it("timestamp(number) x값을 원본 그대로 보존한다", () => {
    const t0 = 1_700_000_000_000;
    const data = [{ t: t0 }, { t: t0 + 60_000 }, { t: t0 + 120_000 }];

    const points = normalizeBucket(data, (d) => d.t);

    expect(points[1]).toEqual({ index: 1, value: t0 + 60_000 });
  });

  it("Date x값은 숫자로 변환하지 않고 인스턴스 그대로 보존한다", () => {
    const dates = [
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-02T00:00:00Z"),
    ];
    const data = dates.map((date) => ({ date }));

    const points = normalizeBucket(data, (d) => d.date);

    // Bucket 모드의 숫자축은 index이므로 value는 원본 Date 그대로다
    expect(points[0].value).toBe(dates[0]);
    expect(points[1].value).toBe(dates[1]);
  });

  it("getX에 (datum, index)를 전달한다", () => {
    const data = ["a", "b", "c"];
    const received: Array<[string, number]> = [];

    normalizeBucket(data, (datum, index) => {
      received.push([datum, index]);
      return datum;
    });

    expect(received).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("빈 데이터는 빈 배열을 돌려주고, 원본 배열은 변경하지 않는다", () => {
    expect(normalizeBucket([], (d) => d)).toEqual([]);

    const data = Object.freeze([{ x: "A" }, { x: "B" }]);
    // freeze된 배열에서도 동작 = 순수 함수(원본 미변경) 보장
    expect(normalizeBucket(data, (d) => d.x)).toHaveLength(2);
  });
});

describe("findPointByIndex — Index → 원본값 탐색", () => {
  const points = normalizeBucket(
    [{ x: "A" }, { x: "B" }, { x: "C" }],
    (d) => d.x,
  );

  it("유효한 index의 포인트를 돌려준다", () => {
    expect(findPointByIndex(points, 1)).toEqual({ index: 1, value: "B" });
  });

  it("범위 밖 index는 null을 돌려준다", () => {
    expect(findPointByIndex(points, -1)).toBeNull();
    expect(findPointByIndex(points, 3)).toBeNull();
    expect(findPointByIndex([], 0)).toBeNull();
  });

  it("정수가 아닌 index는 null을 돌려준다 — Bucket Index는 정수다", () => {
    // 소수 Position(snap=false Handle 위치)의 최근접 탐색은 findNearestPoint의 몫
    expect(findPointByIndex(points, 1.5)).toBeNull();
    expect(findPointByIndex(points, Number.NaN)).toBeNull();
  });
});

describe("findPointByValue — 원본값 → Index 탐색", () => {
  it("string 값으로 index를 찾는다", () => {
    const points = normalizeBucket(
      [{ x: "Korea" }, { x: "Japan" }, { x: "USA" }],
      (d) => d.x,
    );

    expect(findPointByValue(points, "USA")).toEqual({
      index: 2,
      value: "USA",
    });
  });

  it("timestamp(number) 값으로 index를 찾는다", () => {
    const t0 = 1_700_000_000_000;
    const points = normalizeBucket([{ t: t0 }, { t: t0 + 1 }], (d) => d.t);

    expect(findPointByValue(points, t0 + 1)?.index).toBe(1);
  });

  it("Date는 다른 인스턴스라도 같은 시각이면 찾는다", () => {
    const points = normalizeBucket(
      [
        { date: new Date("2026-08-01T00:00:00Z") },
        { date: new Date("2026-08-02T00:00:00Z") },
      ],
      (d) => d.date,
    );

    // 참조가 아니라 시각(getTime) 기준 — 사용자는 보통 새 Date 인스턴스로 조회한다
    const found = findPointByValue(points, new Date("2026-08-02T00:00:00Z"));
    expect(found?.index).toBe(1);
  });

  it("중복 값은 첫 번째 index를 돌려준다", () => {
    // ScatterChart처럼 동일 X값이 여러 개인 경우 — 전체 매칭은 recharts 계층(Click Payload)의 몫
    const points = normalizeBucket(
      [{ x: "A" }, { x: "B" }, { x: "A" }],
      (d) => d.x,
    );

    expect(findPointByValue(points, "A")?.index).toBe(0);
  });

  it("없는 값은 null을 돌려준다", () => {
    const points = normalizeBucket([{ x: "A" }], (d) => d.x);

    expect(findPointByValue(points, "Z")).toBeNull();
    expect(findPointByValue([], "A")).toBeNull();
  });

  it("NaN 값도 자기 자신을 찾는다 (SameValueZero 비교)", () => {
    const points = normalizeBucket([{ x: 1 }, { x: Number.NaN }], (d) => d.x);

    expect(findPointByValue(points, Number.NaN)?.index).toBe(1);
  });
});

describe("Index ↔ 원본값 상호 탐색 (roundtrip) — 4가지 X 타입", () => {
  // 완료 기준: string / number / timestamp / Date 전부에서 상호 탐색이 성립한다
  const cases: Array<{ type: string; xValues: unknown[] }> = [
    { type: "string", xValues: ["Korea", "Japan", "USA", "China"] },
    { type: "number", xValues: [30, 10, 20] }, // 정렬 안 된 숫자도 입력 순서 기준
    {
      type: "timestamp",
      xValues: [1_700_000_000_000, 1_700_000_060_000, 1_700_000_120_000],
    },
    {
      type: "Date",
      xValues: [
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-08-02T00:00:00Z"),
        new Date("2026-08-03T00:00:00Z"),
      ],
    },
  ];

  it.each(cases)(
    "$type: 모든 포인트에서 Index → 원본값, 원본값 → Index가 일치한다",
    ({ xValues }) => {
      const points = normalizeBucket(xValues, (x) => x);

      for (const point of points) {
        // Index → 원본값
        expect(findPointByIndex(points, point.index)?.value).toBe(point.value);
        // 원본값 → Index
        expect(findPointByValue(points, point.value)?.index).toBe(point.index);
      }
    },
  );
});
