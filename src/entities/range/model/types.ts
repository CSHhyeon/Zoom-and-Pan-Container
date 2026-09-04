/**
 * Core 공통 타입.
 *
 * core는 순수 로직 계층이다 — Recharts/React를 비롯한 어떤 렌더링 지식도 갖지 않는다 (ESLint no-restricted-imports로 강제).
 */

/**
 * Range 표현 모드.
 * - "bucket": 데이터 Index 기준. MVP 구현 대상
 * - "continuous": 연속 값(숫자/시간) 기준. v1.x에서 구현
 */
export type RangeMode = "bucket" | "continuous";

/**
 * 현재 보이는 구간. 데이터 Index 기준, 양끝 포함(inclusive).
 *
 * `{ start: 2, end: 6 }` = Index 2 ~ 6 → 데이터 포인트 5개.
 *
 * 유효한 Range의 불변 조건:
 * - `start <= end`
 * - `end - start >= minRange`
 *   - (기본 {@link DEFAULT_MIN_RANGE} = 최소 두 포인트.
 *   - 한 포인트 허용은 향후 allowSinglePointRange 옵션)
 *
 * 이 불변 조건의 보장은 모든 Range 변경 경로가 통과하는 단일 clampRange의 책임이다.
 */
export interface Range {
  start: number;
  end: number;
}

/**
 * 원본 x값 하나를 내부 숫자축 위에 정규화한 포인트.
 *
 * normalizeBucket이 생성하고 findNearestPoint 등이 소비한다.
 * Index ↔ 원본값 상호 탐색의 최소 단위.
 *
 * core는 사용자 데이터 행(T)을 모른다.
 * index만 결과로 돌려주면 React 계층이 `data[index]`로 원본 datum을 복원한다.
 */
export interface NormalizedPoint<TX = unknown> {
  /** 내부 숫자축 위치. bucket 모드에서는 데이터 배열 index와 같다 */
  index: number;
  /** 사용자 getX가 돌려준 원본 x값 (string | number | Date | ...) */
  value: TX;
}

/** `end - start`의 기본 최소값. 1 = 최소 두 포인트 표시 */
export const DEFAULT_MIN_RANGE = 1;

/**
 * 두 Range가 같은 구간을 가리키는지 값으로 비교한다.
 *
 * 조작 연산의 "변화 없음" 감지(불필요한 리렌더 스킵)와 onRangeCommit의 "Range가 실제 변경된 경우에만 호출" 규칙이 공유하는 기준.
 * (NaN이 섞인 Range는 항상 "다름"이지만, NaN은 clampRange 관문이 걸러낸 뒤라 실사용에선 오지 않는다)
 */
export function isSameRange(a: Range, b: Range): boolean {
  return a.start === b.start && a.end === b.end;
}

/**
 * 모든 Range 연산(clamp/zoom/pan/resize)이 공통으로 받는 제약.
 */
export interface RangeConstraints {
  /** 전체 데이터 범위. 결과 Range는 항상 이 안으로 잘린다 */
  fullRange: Range;
  /** 최소 범위 폭(`end - start`). 생략 시 {@link DEFAULT_MIN_RANGE} */
  minRange?: number;
}
