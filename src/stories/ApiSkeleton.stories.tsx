/**
 * [TEST] API Skeleton — walking skeleton 검증 Story
 *
 * 이 Story가 답해야 할 체크리스트:
 *  1. {...zap.mainProps} div 스프레드가 TS에서 깔끔한가 (wheel 로그 확인)
 *  2. visibleData 교체 시 LineChart 리렌더가 기대대로인가 (애니메이션 튐 관찰)
 *  3. Preview % 배치가 Main Chart plot 영역과 어긋나는가
 *     → Main은 margin+YAxis 폭만큼 plot이 좁다. 어긋남 발견 = 테스트 성공
 *  4. controller={zap} 전달 패턴이 자연스러운가 (Preview가 필요한 필드 발견)
 *  5. getX 제네릭 추론이 사용자 입장에서 편한가 (d => d.country에 자동완성 되는지)
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useZoomAndPanController,
  type Range,
} from "../recharts/useZoomAndPanController";
import { ZoomAndPanPreview } from "../recharts/ZoomAndPanPreview";

// ── 실험 데이터: 10개 (A~J) ──────────────
interface Datum {
  country: string;
  value: number;
}

const DATA: Datum[] = [
  { country: "A", value: 12 },
  { country: "B", value: 30 },
  { country: "C", value: 18 },
  { country: "D", value: 44 },
  { country: "E", value: 27 },
  { country: "F", value: 60 },
  { country: "G", value: 35 },
  { country: "H", value: 22 },
  { country: "I", value: 51 },
  { country: "J", value: 40 },
];

const PRESETS: Array<{ label: string; range: Range }> = [
  { label: "range 2~6", range: { start: 2, end: 6 } },
  { label: "range 4~8", range: { start: 4, end: 8 } },
  { label: "전체 (0~9)", range: { start: 0, end: 9 } },
];

// ── 확정 인터페이스 형태 그대로 사용 ─────────────────────────────
function MyChart() {
  const zap = useZoomAndPanController({
    data: DATA,
    rangeMode: "bucket",
    getX: (d) => d.country, // 체크리스트 5: 여기서 d가 Datum으로 추론되는지
    defaultRange: { start: 2, end: 6 },
    onRangeCommit: (snapshot) => {
      // 체크리스트: fetchDetail(snapshot.range) 자리. 로그로 시그니처 확인.
      console.log("[test] onRangeCommit", snapshot.range);
    },
  });

  return (
    <div style={{ maxWidth: 720, fontFamily: "sans-serif" }}>
      {/* Main Chart — 사용자 차트는 그대로 유지 */}
      <div {...zap.mainProps}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={zap.visibleData}>
            <XAxis dataKey="country" />
            <YAxis domain={zap.yDomain} />
            <Tooltip active={zap.tooltipActive} />
            <Line
              dataKey="value"
              stroke="#4f7cf7"
              // 체크리스트 2: 이 값을 true로 바꿔 애니메이션 튐도 관찰해볼 것
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Preview */}
      <ZoomAndPanPreview controller={zap} getY={(d) => d.value} />

      {/* ── 테스트 전용 컨트롤 (조작 기능 대체) ── */}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => zap.__setRange(preset.range)}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" onClick={zap.__forceCommit}>
          [TEST] commit 강제 호출
        </button>
      </div>

      <p style={{ color: "#666", fontSize: 12 }}>
        현재 range: {zap.range.start} ~ {zap.range.end} / visible:{" "}
        {zap.visibleData.map((d) => d.country).join(", ")}
        <br />
        휠을 차트 위에서 굴리면 콘솔에 [test] wheel 로그가 찍혀야 함 (체크리스트
        1).
      </p>
    </div>
  );
}

const meta: Meta<typeof MyChart> = {
  title: "Test/API Skeleton",
  component: MyChart,
};
export default meta;

type Story = StoryObj<typeof MyChart>;

export const Default: Story = {};
