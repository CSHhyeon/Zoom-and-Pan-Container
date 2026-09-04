/**
 * PreviewTrendChart — 전체 추이 차트 레이어.
 *
 * 기본은 내장 AreaChart(previewData·fullRange 기반)이고, renderTrend가 오면 사용자 차트
 * (Main Chart의 미니 버전)를 대신 그린다 — 어느 쪽이든 오버레이(Dim/Window/Handle) 아래 깔린다.
 *
 * data·previewData·fullRange 모두 controller가 range와 무관하게 참조를 고정해 주므로,
 * 드래그로 range가 바뀌는 동안 오버레이만 다시 그려지고 이 memo 컴포넌트(Recharts 차트)는 스킵된다.
 * renderTrend도 같은 이유로 참조가 고정되어야 한다 (prop JSDoc 참고).
 * 패키지에서 Recharts를 직접 import하는 유일한 파일이다.
 *
 * 좌표계 계약: margin 0 + 축 hide + domain 명시 (PreviewPoint JSDoc 참고).
 */
import { memo } from "react";
import type { ReactElement } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
import type { Range } from "../../../entities/range";
import type { PreviewPoint } from "../model/types";
import { TREND_AREA_COLOR, TREND_LAYER_STYLE, TREND_MARGIN } from "./styles";

interface PreviewTrendChartProps<T> {
  /** 원본 전체 데이터 — renderTrend에 그대로 전달 */
  data: readonly T[];
  /** 내장 기본 추이(AreaChart)용 정규화 데이터 */
  previewData: PreviewPoint[];
  fullRange: Range;
  /** Main Chart 미니 버전 렌더러 — 생략 시 내장 AreaChart */
  renderTrend?: (data: T[]) => ReactElement;
}

function PreviewTrendChartImpl<T>({
  data,
  previewData,
  fullRange,
  renderTrend,
}: PreviewTrendChartProps<T>) {
  return (
    <div style={TREND_LAYER_STYLE}>
      <ResponsiveContainer width="100%" height="100%">
        {renderTrend ? (
          // readonly 배열은 사용자가 hook에 넘긴 그 배열이다 — 사용자 차트(recharts data: any[])로 되돌려주기 위한 캐스팅
          renderTrend(data as T[])
        ) : (
          <AreaChart data={previewData} margin={TREND_MARGIN}>
            <XAxis
              type="number"
              dataKey="__rangeX"
              domain={[fullRange.start, fullRange.end]}
              hide
            />
            <Area
              dataKey="__y"
              isAnimationActive={false}
              stroke={TREND_AREA_COLOR}
              fill={TREND_AREA_COLOR}
              fillOpacity={0.25}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// memo가 제네릭 시그니처를 지우므로 원래 타입으로 되돌린다 (ZoomAndPanPreview와 같은 패턴)
export const PreviewTrendChart = memo(
  PreviewTrendChartImpl,
) as typeof PreviewTrendChartImpl;
