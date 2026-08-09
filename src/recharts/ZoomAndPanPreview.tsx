/**
 * [TEST] ZoomAndPanPreview — 정적 렌더링만 (조작 없음)
 *
 * 목적: range → % 계산으로 Dim/Window/Handle이 정확히 배치되는지,
 *       controller={zap} 객체 전달 패턴이 자연스러운지 확인.
 *       Pointer 인터랙션은 Handle Resize 작업 때부터. 다듬지 말 것.
 *
 * ⚠️ 체크리스트 3 (가장 중요):
 * Main Chart는 margin + YAxis 폭 때문에 plot 영역이 컨테이너보다 좁다.
 * 이 Preview는 컨테이너 전체 폭 기준 %라서 Main과 시각적으로 어긋날 수 있다.
 * 어긋남을 발견하는 것이 이 테스트의 성공 조건 중 하나.
 */
import type { ZoomAndPanController } from "./useZoomAndPanController";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";

/**
 * controller: Hook이 반환한 객체를 통째로 받음. <ZoomAndPanPreview controller={zap} />
 */
interface ZoomAndPanPreviewProps<T> {
  controller: ZoomAndPanController<T>;
  /** [TEST] Preview 추이 차트에 쓸 y값 추출. 정식 API에선 별도 설계 */
  getY: (datum: T) => number;
  height?: number;
}

export function ZoomAndPanPreview<T>({
  controller,
  getY,
  height = 64,
}: ZoomAndPanPreviewProps<T>) {
  const { range, fullRange } = controller;

  /**
   * 전체에서 내 range가 몇 % 지점부터 몇 % 지점까지인지?
   *
   * ex) 데이터 10개(fullRange = {0, 9}), range = {2, 6}
   * fullSpan       = 9 - 0        = 9      (전체 폭이 인덱스로 9칸)
   * leftPct        = (2 - 0) / 9 × 100 = 22.2%   (창의 왼쪽 끝 위치)
   * rightPct       = (6 - 0) / 9 × 100 = 66.7%   (창의 오른쪽 끝 위치)
   * windowWidthPct = 66.7 - 22.2       = 44.4%   (창의 폭)
   */
  const fullSpan = fullRange.end - fullRange.start || 1;
  const leftPct = ((range.start - fullRange.start) / fullSpan) * 100;
  const rightPct = ((range.end - fullRange.start) / fullSpan) * 100;
  const windowWidthPct = rightPct - leftPct;

  /**
   * 차트용 데이터 반환
   * [TEST] Preview는 항상 전체 데이터. Bucket Index를 __rangeX 숫자축으로 사용.
   *      → 체크리스트 4 발견: Preview가 전체 데이터를 필요로 하므로 정식 API에서는 controller.previewData로 설계해야 함.
   */
  const previewData = controller.__testFullData.map((datum, index) => ({
    __rangeX: index,
    __y: getY(datum),
  }));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        userSelect: "none",
      }}
    >
      {/* Preview 추이 차트 (전체 데이터) — z-index 0 */}
      <div style={{ position: "absolute", inset: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={previewData}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis dataKey="__rangeX" type="number" hide />
            <Area
              dataKey="__y"
              isAnimationActive={false}
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.25}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Left Dim — z-index 10 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${leftPct}%`,
          background: "rgba(0,0,0,0.28)",
          zIndex: 10,
        }}
      />
      {/* Right Dim — z-index 10 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${rightPct}%`,
          right: 0,
          background: "rgba(0,0,0,0.28)",
          zIndex: 10,
        }}
      />
      {/* Window — z-index 20 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${leftPct}%`,
          width: `${windowWidthPct}%`,
          border: "1px solid #4f7cf7",
          boxSizing: "border-box",
          zIndex: 20,
        }}
      />
      {/* Left Handle — z-index 30 (조작 없음) */}
      <button
        type="button"
        aria-label="range start handle (test: not interactive)"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `calc(${leftPct}% - 4px)`,
          width: 8,
          padding: 0,
          border: "none",
          background: "#4f7cf7",
          cursor: "ew-resize",
          zIndex: 30,
        }}
      />
      {/* Right Handle — z-index 30 (조작 없음) */}
      <button
        type="button"
        aria-label="range end handle (test: not interactive)"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `calc(${rightPct}% - 4px)`,
          width: 8,
          padding: 0,
          border: "none",
          background: "#4f7cf7",
          cursor: "ew-resize",
          zIndex: 30,
        }}
      />
    </div>
  );
}
