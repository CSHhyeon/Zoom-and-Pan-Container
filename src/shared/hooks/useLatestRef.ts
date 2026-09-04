/**
 * useLatestRef — 렌더마다 최신 값으로 갱신되는 ref (라이브러리 내부 공용).
 *
 * 네이티브 리스너·타이머·rAF처럼 "배선은 고정한 채 실행 시점의 최신 콜백/옵션을 읽어야 하는" 곳에서 쓴다.
 * 사용자가 인라인 함수를 넘겨도 배선이 다시 만들어지지 않고, 실행되는 시점의 최신 값이 호출된다.
 * (렌더 중 ref 쓰기는 concurrent 렌더에서 안전하지 않아 effect에서 갱신한다)
 */
import { useEffect, useRef } from "react";

export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
