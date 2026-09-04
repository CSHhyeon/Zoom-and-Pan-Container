/**
 * 마지막 Wheel 후 이 시간 동안 조용하면 조작 종료로 간주한다.
 * (Wheel에는 pointerup 같은 "조작 끝" 신호가 없어 debounce로 세션을 닫는다 — CLAUDE.md 확정 결정 8: Wheel commit은 150ms debounce)
 */
export const WHEEL_COMMIT_DELAY_MS = 150;
