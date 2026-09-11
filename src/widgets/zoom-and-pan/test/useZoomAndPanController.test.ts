// @vitest-environment happy-dom
/**
 * useZoomAndPanController 공개 표면 테스트.
 *
 * 내부 hook(useRangeState · useRangeCallbacks)을 직접 찌르지 않고, controller가 돌려주는 값과 연산만 사용한다.
 * 내부 구조가 바뀌어도 이 파일이 그대로 통과해야 "Uncontrolled 회귀 없음"을 보장하는 방어망이 된다.
 *
 * 다루는 것:
 * - 상태: defaultRange 최초 1회 반영 · 관문(clampRange) 통과 · data 변경 추종
 * - 파생값: visibleData · previewData(참조 고정) · mainProps · controller 참조 안정
 * - 조작 연산: resize / pan / center / setRange가 관문을 거친 결과
 * - 콜백: onRangeChange rAF 프레임당 1회 · onRangeCommit 조작당 1회(실제 변경 시에만) · 세션 규칙
 *
 * 다루지 않는 것: Wheel Zoom · Main Drag Pan — DOM 이벤트 배선이라 순수 계산은 wheelZoomSession.test.ts,
 * 인터랙션은 Storybook play(⑰.5b)의 몫.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseZoomAndPanControllerOptions } from "../model/types";
import { useZoomAndPanController } from "../model/useZoomAndPanController";

interface Datum {
  x: string;
  y: number;
}
type Options = UseZoomAndPanControllerOptions<Datum, string>;

const makeData = (length: number): Datum[] =>
  Array.from({ length }, (_, index) => ({ x: `x${index}`, y: index * 10 }));

/** 20개 → fullRange 0~19 */
const DATA = makeData(20);
const getX = (d: Datum) => d.x;
const getY = (d: Datum) => d.y;

/**
 * hook을 마운트하고 검증에 필요한 것만 돌려준다.
 * 콜백은 항상 spy로 꽂아 "호출되지 않음"도 단언할 수 있게 한다.
 */
function setup(overrides: Partial<Options> = {}) {
  const onRangeChange = vi.fn();
  const onRangeCommit = vi.fn();
  const initialProps: Options = {
    data: DATA,
    getX,
    onRangeChange,
    onRangeCommit,
    ...overrides,
  };
  const hook = renderHook(
    (props: Options) => useZoomAndPanController(props),
    { initialProps },
  );

  return {
    onRangeChange,
    onRangeCommit,
    initialProps,
    rerender: hook.rerender,
    unmount: hook.unmount,
    /** 항상 최신 controller — 리렌더 뒤 stale 참조를 붙잡는 실수를 막는다 */
    get ctl() {
      return hook.result.current;
    },
  };
}

/** 예약된 rAF를 한 프레임 진행 — 모아둔 onRangeChange가 이때 나간다 */
const nextFrame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });

beforeEach(() => {
  // rAF는 기본 페이크 대상이 아니라 명시한다. wheel 정착 타이머(setTimeout)도 함께 잡아 실제 대기를 없앤다
  vi.useFakeTimers({
    toFake: [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "setTimeout",
      "clearTimeout",
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("초기 상태 — defaultRange와 관문", () => {
  it("defaultRange가 없으면 전체 범위에서 시작한다", () => {
    const { ctl } = setup();

    expect(ctl.fullRange).toEqual({ start: 0, end: 19 });
    expect(ctl.range).toEqual({ start: 0, end: 19 });
    expect(ctl.visibleData).toHaveLength(20);
  });

  it("defaultRange는 최초 mount에만 반영되고 이후 변경은 무시한다 (Uncontrolled)", () => {
    const s = setup({ defaultRange: { start: 2, end: 6 } });
    expect(s.ctl.range).toEqual({ start: 2, end: 6 });

    s.rerender({ ...s.initialProps, defaultRange: { start: 10, end: 15 } });

    expect(s.ctl.range).toEqual({ start: 2, end: 6 });
  });

  it("defaultRange도 관문을 통과한다 — 경계 밖은 폭을 유지한 채 안쪽으로, 최소 폭 미달은 늘린다", () => {
    expect(setup({ defaultRange: { start: 15, end: 25 } }).ctl.range).toEqual({
      start: 9,
      end: 19,
    });
    expect(setup({ defaultRange: { start: 8, end: 8 } }).ctl.range).toEqual({
      start: 8,
      end: 9,
    });
  });

  it("data가 비어 있다가 채워지면 전체 범위를 따라간다 (비동기 로딩)", () => {
    const s = setup({ data: [] });
    expect(s.ctl.range).toEqual({ start: 0, end: 0 });
    expect(s.ctl.visibleData).toEqual([]);

    s.rerender({ ...s.initialProps, data: DATA });

    expect(s.ctl.range).toEqual({ start: 0, end: 19 });
  });

  it("data가 줄어들면 현재 range를 새 경계로 clamp한다", () => {
    const s = setup({ defaultRange: { start: 10, end: 19 } });

    s.rerender({ ...s.initialProps, data: makeData(12) });
    expect(s.ctl.range).toEqual({ start: 2, end: 11 }); // 폭 9 유지, 벽에 붙음

    s.rerender({ ...s.initialProps, data: makeData(5) });
    expect(s.ctl.range).toEqual({ start: 0, end: 4 }); // 폭이 전체보다 넓으면 전체
  });

  it("minRange 옵션은 모든 연산의 최소 폭이 된다", () => {
    const s = setup({ minRange: 3 });

    act(() => s.ctl.setRange({ start: 4, end: 5 }));

    expect(s.ctl.range).toEqual({ start: 4, end: 7 });
  });
});

describe("파생값", () => {
  it("visibleData는 range를 양끝 포함으로 자른 slice다", () => {
    const { ctl } = setup({ defaultRange: { start: 2, end: 6 } });

    expect(ctl.visibleData).toHaveLength(5);
    expect(ctl.visibleData[0]).toBe(DATA[2]);
    expect(ctl.visibleData[4]).toBe(DATA[6]);
  });

  it("previewData는 index를 __rangeX로, getY 결과를 __y로 갖는다 (getY 없으면 0)", () => {
    expect(setup({ getY }).ctl.previewData[3]).toEqual({
      __rangeX: 3,
      __y: 30,
    });
    expect(setup().ctl.previewData[3]).toEqual({ __rangeX: 3, __y: 0 });
    expect(setup().ctl.previewData).toHaveLength(20);
  });

  it("previewData 참조는 range가 바뀌어도 유지된다 — Preview 추이 차트가 다시 그려지지 않는 조건", () => {
    const s = setup({ getY });
    const before = s.ctl.previewData;

    act(() => s.ctl.setRange({ start: 3, end: 7 }));

    expect(s.ctl.previewData).toBe(before);
  });

  it("mainProps는 wrapper div에 그대로 스프레드할 수 있는 배선이다", () => {
    const { mainProps } = setup().ctl;

    expect(mainProps.ref).toBeTypeOf("function"); // wheel 리스너 부착용 ref callback
    expect(mainProps.onPointerDown).toBeTypeOf("function");
    expect(mainProps.onPointerMove).toBeTypeOf("function");
    expect(mainProps.onLostPointerCapture).toBeTypeOf("function");
    expect(mainProps.style).toMatchObject({ touchAction: "pan-y" });
  });

  it("yDomain은 아직 항상 undefined, tooltipActive는 드래그 중이 아니면 undefined", () => {
    const { ctl } = setup();

    expect(ctl.yDomain).toBeUndefined();
    expect(ctl.tooltipActive).toBeUndefined();
  });

  it("controller 참조는 값이 바뀌지 않은 리렌더에서 유지되고, range가 바뀌면 새로 만들어진다", () => {
    const s = setup();
    const first = s.ctl;

    s.rerender(s.initialProps);
    expect(s.ctl).toBe(first);

    act(() => s.ctl.setRange({ start: 3, end: 7 }));
    expect(s.ctl).not.toBe(first);
  });
});

describe("조작 연산은 전부 관문을 거친다 (현재 5~9, 전체 0~19)", () => {
  const start = () => setup({ defaultRange: { start: 5, end: 9 } });

  it("resizeLeft — end 고정, 소수 목표는 반올림 snap, 이동 구간은 [0, end - minRange]", () => {
    const s = start();

    act(() => s.ctl.resizeLeft(2.4));
    expect(s.ctl.range).toEqual({ start: 2, end: 9 });

    act(() => s.ctl.resizeLeft(9)); // end를 넘으려 함 → 최소 폭 앞에서 멈춤
    expect(s.ctl.range).toEqual({ start: 8, end: 9 });

    act(() => s.ctl.resizeLeft(-5));
    expect(s.ctl.range).toEqual({ start: 0, end: 9 });
  });

  it("resizeRight — start 고정, 이동 구간은 [start + minRange, fullRange.end]", () => {
    const s = start();

    act(() => s.ctl.resizeRight(30));
    expect(s.ctl.range).toEqual({ start: 5, end: 19 });

    act(() => s.ctl.resizeRight(5));
    expect(s.ctl.range).toEqual({ start: 5, end: 6 });
  });

  it("panTo — 폭 유지, 경계에서는 벽에 붙는다", () => {
    const s = start();

    act(() => s.ctl.panTo(7.6));
    expect(s.ctl.range).toEqual({ start: 8, end: 12 });

    act(() => s.ctl.panTo(17));
    expect(s.ctl.range).toEqual({ start: 15, end: 19 });

    act(() => s.ctl.panTo(-3));
    expect(s.ctl.range).toEqual({ start: 0, end: 4 });
  });

  it("centerAt — 폭 유지, 중앙 배치보다 경계 준수가 우선", () => {
    const s = start();

    act(() => s.ctl.centerAt(10));
    expect(s.ctl.range).toEqual({ start: 8, end: 12 });

    act(() => s.ctl.centerAt(0));
    expect(s.ctl.range).toEqual({ start: 0, end: 4 });

    act(() => s.ctl.centerAt(19));
    expect(s.ctl.range).toEqual({ start: 15, end: 19 });
  });

  it("setRange — 뒤집힌 입력도 관문이 바로잡는다", () => {
    const s = start();

    act(() => s.ctl.setRange({ start: 7, end: 3 }));

    expect(s.ctl.range).toEqual({ start: 3, end: 7 });
  });

  it("깨진 조작량(NaN)은 무시된다", () => {
    const s = start();

    act(() => {
      s.ctl.resizeLeft(Number.NaN);
      s.ctl.panTo(Number.NaN);
    });

    expect(s.ctl.range).toEqual({ start: 5, end: 9 });
  });
});

describe("onRangeChange — rAF throttle", () => {
  it("한 프레임의 연속 변경은 프레임 끝에 마지막 값으로 1회만 알린다", () => {
    const s = setup({ defaultRange: { start: 5, end: 9 } });

    act(() => {
      s.ctl.beginInteraction("resize-left");
      s.ctl.resizeLeft(1);
      s.ctl.resizeLeft(2);
      s.ctl.resizeLeft(3);
    });
    expect(s.onRangeChange).not.toHaveBeenCalled(); // 아직 프레임 전

    nextFrame();

    expect(s.onRangeChange).toHaveBeenCalledTimes(1);
    expect(s.onRangeChange).toHaveBeenLastCalledWith(
      { range: { start: 3, end: 9 } },
      { source: "resize-left" },
    );
  });

  it("다음 프레임의 변경은 다시 1회 — 프레임마다 최대 한 번", () => {
    const s = setup({ defaultRange: { start: 5, end: 9 } });

    act(() => s.ctl.resizeLeft(3));
    nextFrame();
    act(() => s.ctl.resizeLeft(4));
    nextFrame();

    expect(s.onRangeChange).toHaveBeenCalledTimes(2);
  });

  it("range가 실제로 바뀌지 않으면 예약조차 하지 않는다", () => {
    const s = setup({ defaultRange: { start: 5, end: 9 } });

    act(() => s.ctl.resizeLeft(5)); // 현재 start와 같음
    nextFrame();

    expect(s.onRangeChange).not.toHaveBeenCalled();
  });

  it("setRange는 프로그램적 변경이라 어떤 콜백도 부르지 않는다", () => {
    const s = setup();

    act(() => s.ctl.setRange({ start: 3, end: 7 }));
    nextFrame();
    act(() => s.ctl.endInteraction());

    expect(s.ctl.range).toEqual({ start: 3, end: 7 });
    expect(s.onRangeChange).not.toHaveBeenCalled();
    expect(s.onRangeCommit).not.toHaveBeenCalled();
  });

  it("언마운트되면 예약된 알림은 취소된다", () => {
    const s = setup({ defaultRange: { start: 5, end: 9 } });

    act(() => s.ctl.resizeLeft(3));
    s.unmount();
    nextFrame();

    expect(s.onRangeChange).not.toHaveBeenCalled();
  });
});

describe("onRangeCommit — 조작 세션", () => {
  const start = () => setup({ defaultRange: { start: 5, end: 9 } });

  it("한 번의 조작(begin~end)당 1회, 확정 range와 source를 전달한다", () => {
    const s = start();

    act(() => {
      s.ctl.beginInteraction("resize-left");
      s.ctl.resizeLeft(2);
      s.ctl.endInteraction();
    });

    expect(s.onRangeCommit).toHaveBeenCalledTimes(1);
    expect(s.onRangeCommit).toHaveBeenCalledWith(
      { range: { start: 2, end: 9 } },
      { source: "resize-left" },
    );
  });

  it("end 시점에 대기 중인 change를 먼저 flush한다 — change가 commit보다 늦게 도착하는 역전 방지", () => {
    const s = start();

    act(() => {
      s.ctl.beginInteraction("resize-left");
      s.ctl.resizeLeft(2);
      s.ctl.endInteraction(); // 프레임을 기다리지 않았는데도
    });

    expect(s.onRangeChange).toHaveBeenCalledTimes(1);
    expect(s.onRangeChange.mock.invocationCallOrder[0]).toBeLessThan(
      s.onRangeCommit.mock.invocationCallOrder[0],
    );
  });

  it("시작 대비 range가 같으면 commit하지 않는다 (움직였다 제자리로 돌아온 조작)", () => {
    const s = start();

    act(() => {
      s.ctl.beginInteraction("resize-left");
      s.ctl.resizeLeft(2);
      s.ctl.resizeLeft(5);
      s.ctl.endInteraction();
    });

    expect(s.onRangeCommit).not.toHaveBeenCalled();
    expect(s.onRangeChange).toHaveBeenCalledTimes(1); // 조작 중 알림은 나간다
  });

  it("조작 없이 begin/end만 하면 아무것도 부르지 않는다", () => {
    const s = start();

    act(() => {
      s.ctl.beginInteraction("window-pan");
      s.ctl.endInteraction();
    });

    expect(s.onRangeChange).not.toHaveBeenCalled();
    expect(s.onRangeCommit).not.toHaveBeenCalled();
  });

  it("endInteraction 중복 호출은 무시된다 (pointerup + lostpointercapture)", () => {
    const s = start();

    act(() => {
      s.ctl.beginInteraction("resize-left");
      s.ctl.resizeLeft(2);
      s.ctl.endInteraction();
      s.ctl.endInteraction();
    });

    expect(s.onRangeCommit).toHaveBeenCalledTimes(1);
  });

  it("진행 중인 세션이 있으면 새 begin은 무시되고, 먼저 시작한 조작의 source와 기준으로 commit한다", () => {
    const s = start();

    act(() => {
      s.ctl.beginInteraction("resize-left");
      s.ctl.resizeLeft(2);
      s.ctl.beginInteraction("window-pan"); // 무시
      s.ctl.panTo(3);
      s.ctl.endInteraction();
    });

    expect(s.onRangeCommit).toHaveBeenCalledTimes(1);
    expect(s.onRangeCommit).toHaveBeenCalledWith(
      { range: { start: 3, end: 10 } },
      { source: "resize-left" },
    );
  });

  it("세션이 끝나면 다음 조작은 새 세션이다", () => {
    const s = start();

    act(() => {
      s.ctl.beginInteraction("resize-left");
      s.ctl.resizeLeft(2);
      s.ctl.endInteraction();
      s.ctl.beginInteraction("window-pan");
      s.ctl.panTo(4);
      s.ctl.endInteraction();
    });

    expect(s.onRangeCommit).toHaveBeenCalledTimes(2);
    expect(s.onRangeCommit).toHaveBeenLastCalledWith(
      { range: { start: 4, end: 11 } },
      { source: "window-pan" },
    );
  });
});
