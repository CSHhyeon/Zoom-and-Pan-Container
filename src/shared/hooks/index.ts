// shared/hooks — 도메인 무지(Range조차 모르는) 범용 React 훅.
// 상위 레이어(entities/features/widgets)를 import할 수 없다.
export { useLatestRef } from "./useLatestRef";
export {
  usePointerDragSession,
  type PointerDragSessionOptions,
} from "./usePointerDragSession";
