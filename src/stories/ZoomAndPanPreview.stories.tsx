/**
 * ZoomAndPanPreview 정적 렌더링 검증 Story (P2-⑨)
 *
 * 완료 기준: 버튼으로 range를 바꿀 때마다 Dim/Window/Handle이
 * "기대 위치" 표기와 정확히 일치하게 따라온다.
 *
 * 이 Story는 3단계(오버레이 레이어) 구현의 채점표다:
 * 컴포넌트 하단의 임시 % 표시와 실제 레이어 위치가 어긋나면 오버레이 구현 문제,
 * % 표시 자체가 이상하면 계산부 문제로 원인을 분리할 수 있다.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  useZoomAndPanController,
  ZoomAndPanPreview,
  type Range,
} from "../recharts";

// ── 실험 데이터: 10개 (A~J) — fullRange {0, 9}, fullSpan 9 ──
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

/**
 * 완료 기준 검증 시나리오.
 * expected는 fullSpan 9 기준 수기 검산 값 — 화면과 대조한다.
 */
const SCENARIOS: Array<{ label: string; range: Range; expected: string }> = [
  {
    label: "① 전체 (0~9)",
    range: { start: 0, end: 9 },
    expected: "Dim 없음, Handle이 양 끝 (left 0% · right 100%)",
  },
  {
    label: "② 중간 (2~6)",
    range: { start: 2, end: 6 },
    expected: "left 22.2% · right 66.7% · width 44.4%",
  },
  {
    label: "③ 최소 폭 (4~5)",
    range: { start: 4, end: 5 },
    expected: "left 44.4% · right 55.6% — Handle 두 개가 겹치지 않고 구분",
  },
  {
    label: "④ 왼쪽 끝 (0~2)",
    range: { start: 0, end: 2 },
    expected: "left 0% — Left Handle이 컨테이너 밖에서 이상하게 잘리지 않는지",
  },
  {
    label: "⑤ 경계 밖 (-5~3)",
    range: { start: -5, end: 3 },
    expected: "clampRange가 폭 8 유지 보정 → 0~8 (left 0% · right 88.9%)",
  },
];

function PreviewStaticDemo() {
  const zap = useZoomAndPanController({
    data: DATA,
    rangeMode: "bucket",
    getX: (d) => d.country,
    getY: (d) => d.value,
    defaultRange: { start: 2, end: 6 },
  });

  return (
    <div style={{ maxWidth: 720, fontFamily: "sans-serif" }}>
      {/* Main Chart — Preview와 같은 range를 보고 있는지 함께 확인 */}
      <div {...zap.mainProps}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={zap.visibleData}>
            <XAxis dataKey="country" />
            <YAxis domain={zap.yDomain} />
            <Line dataKey="value" stroke="#4f7cf7" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} />

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.label}
            type="button"
            onClick={() => zap.setRange(scenario.range)}
          >
            {scenario.label}
          </button>
        ))}
      </div>

      {/* 수기 검산표 — 각 버튼을 누르고 Preview 하단 % 표시·레이어 위치와 대조 */}
      <ul style={{ color: "#666", fontSize: 12, paddingLeft: 16 }}>
        {SCENARIOS.map((scenario) => (
          <li key={scenario.label}>
            <strong>{scenario.label}</strong>: {scenario.expected}
          </li>
        ))}
      </ul>

      <p style={{ color: "#666", fontSize: 12 }}>
        현재 range: {zap.range.start} ~ {zap.range.end}
      </p>
    </div>
  );
}

/**
 * 극단 케이스: 데이터 1개 → fullRange {0,0}, fullSpan 0.
 * `fullSpan || 1` 가드 덕에 NaN% 없이 렌더되고,
 * Window 폭 0% + Handle 둘 다 왼쪽 끝(0%)에 겹쳐 보이면 통과.
 */
function SinglePointDemo() {
  const zap = useZoomAndPanController({
    data: [DATA[0]],
    rangeMode: "bucket",
    getX: (d) => d.country,
    getY: (d) => d.value,
  });

  return (
    <div style={{ maxWidth: 720, fontFamily: "sans-serif" }}>
      <ZoomAndPanPreview controller={zap} />
      <p style={{ color: "#666", fontSize: 12 }}>
        데이터 1개: NaN 없이 렌더되고 Handle 둘 다 0% 위치면 통과.
      </p>
    </div>
  );
}

const meta: Meta<typeof PreviewStaticDemo> = {
  title: "Preview/ZoomAndPanPreview",
  component: PreviewStaticDemo,
};
export default meta;

type Story = StoryObj<typeof PreviewStaticDemo>;

export const Static: Story = {};

export const SinglePoint: Story = {
  render: () => <SinglePointDemo />,
};
