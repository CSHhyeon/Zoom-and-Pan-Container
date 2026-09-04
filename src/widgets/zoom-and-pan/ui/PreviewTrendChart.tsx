/**
 * PreviewTrendChart — 전체 추이 차트. previewData·fullRange에만 의존하는 memo 컴포넌트.
 *
 * 두 참조 모두 controller가 range와 무관하게 고정해 주므로, 드래그로 range가 바뀌는 동안 오버레이(Dim/Window/Handle)만 다시 그려지고 Recharts 차트는 스킵된다.
 * 패키지에서 Recharts를 직접 import하는 유일한 파일이다.
 *
 * 좌표계 계약: margin 0 + 축 hide + domain 명시 (PreviewPoint JSDoc 참고).
 */
import { memo } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
import type { Range } from "../../../entities/range";
import type { PreviewPoint } from "../model/types";
import { TREND_AREA_COLOR, TREND_LAYER_STYLE, TREND_MARGIN } from "./styles";

export const PreviewTrendChart = memo(function PreviewTrendChart({
  data,
  fullRange,
}: {
  data: PreviewPoint[];
  fullRange: Range;
}) {
  return (
    <div style={TREND_LAYER_STYLE}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={TREND_MARGIN}>
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
      </ResponsiveContainer>
    </div>
  );
});
