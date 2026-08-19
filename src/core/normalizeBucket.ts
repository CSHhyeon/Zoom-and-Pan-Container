/**
 * Bucket 정규화
 * : 원본 x값(string/number/timestamp/Date)을 입력 순서 기준의 순서형 위치(Ordinal Bucket)로 정규화한다.
 *
 * Bucket 모드의 숫자축은 데이터 배열 index 그 자체이므로 값을 숫자로 변환하지 않고 원본 그대로 보존한다.
 * (서버 집계의 시간 버킷과는 다른 개념)
 */
import type { NormalizedPoint } from "./types";

/**
 * 데이터 배열을 NormalizedPoint 배열로 정규화한다.
 * 데이터를 "번호표 붙은 목록"으로 변환하는 것이다.
 *
 * - `index`: 입력 순서(배열 index). 값 크기로 정렬하지 않는다
 * - `value`: getX가 돌려준 원본 x값 그대로
 *
 * core는 T의 구조를 모른다 — getX로 x값만 뽑고,
 * recharts 계층이 index로 `data[index]`에서 원본 datum을 복원한다.
 */
export function normalizeBucket<T, TX = unknown>(
  data: readonly T[],
  getX: (datum: T, index: number) => TX,
): NormalizedPoint<TX>[] {
  return data.map((datum, index) => ({ index, value: getX(datum, index) }));
}

/**
 * Index → 원본값 탐색.
 *
 * `points`는 normalizeBucket 결과(= index가 배열 위치와 같음)를 전제로 O(1) 접근한다.
 * 정수가 아니거나 범위 밖인 index는 null.
 * 소수 Position(snap=false Handle 위치)의 최근접 탐색은 findNearestPoint의 몫.
 */
export function findPointByIndex<TX>(
  points: readonly NormalizedPoint<TX>[],
  index: number,
): NormalizedPoint<TX> | null {
  if (!Number.isInteger(index)) return null;
  return points[index] ?? null;
}

/**
 * 원본값 → Index 탐색.
 *
 * - Date는 참조가 아니라 시각(getTime) 기준으로 비교한다
 * - 그 외 값은 SameValueZero 비교 (NaN도 자기 자신과 매칭)
 * - 중복 값은 첫 번째 포인트를 돌려준다
 *   (동일 X값 전체 매칭은 recharts 계층 Click Payload의 몫)
 */
export function findPointByValue<TX>(
  points: readonly NormalizedPoint<TX>[],
  value: TX,
): NormalizedPoint<TX> | null {
  return points.find((point) => isSameXValue(point.value, value)) ?? null;
}

/** SameValueZero + Date는 getTime 기준 비교 */
function isSameXValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return sameValueZero(a.getTime(), b.getTime());
  }
  return sameValueZero(a, b);
}

function sameValueZero(a: unknown, b: unknown): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}
