// zoom-and-pan 위젯의 공개 API — 패키지 표면(src/index.ts)이 이 파일을 그대로 재수출한다.
// headless 컨트롤러(model)와 Preview UI(ui)가 한 슬라이스인 이유: Preview가 controller 객체를 직접 소비하는 한 몸의 위젯이기 때문 (레이어 내 교차 import 방지).
export { useZoomAndPanController } from "./model/useZoomAndPanController";
export type {
  PlotInset,
  PreviewPoint,
  Range,
  RangeChangeMeta,
  RangeChangeSource,
  RangeSnapshot,
  UseZoomAndPanControllerOptions,
  ZoomAndPanController,
} from "./model/types";
export {
  ZoomAndPanPreview,
  type ZoomAndPanPreviewProps,
} from "./ui/ZoomAndPanPreview";
