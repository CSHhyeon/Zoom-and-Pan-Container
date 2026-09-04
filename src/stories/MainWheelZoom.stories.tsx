/**
 * Main Chart Wheel Zoom 검증 Story (P4-⑮)
 *
 * 완료 기준:
 * - 확대/축소 시 폭이 step*2씩 변하고, 경계 도달 시 반대쪽만 이동
 * - 포인터 중심 Zoom: 마우스 아래 지점이 (근사적으로) 고정된다
 * - Preview Window가 실시간 동기화
 * - Wheel 종료 후 Commit 1회만 호출 (150ms debounce)
 *
 * 페이지를 일부러 길게 만들었다 — 차트 위에서 휠은 Zoom만 되고(스크롤 차단),
 * 차트 밖에서는 평소처럼 페이지가 스크롤되어야 한다 (preventDefault 검증).
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useZoomAndPanController, ZoomAndPanPreview } from "../recharts";

// ── 실험 데이터: 20개 — 줌 단계가 충분히 나오도록 A~T ──
const DATA = Array.from({ length: 20 }, (_, index) => ({
  country: String.fromCharCode(65 + index), // A, B, C, ...
  value: Math.round(35 + 28 * Math.sin(index * 1.1) + 8 * ((index * 7) % 5)),
}));

function WheelZoomDemo() {
  const [changeCount, setChangeCount] = useState(0);
  const [commitCount, setCommitCount] = useState(0);
  const [lastCommit, setLastCommit] = useState("아직 없음");

  const zap = useZoomAndPanController({
    data: DATA,
    rangeMode: "bucket",
    getX: (d) => d.country,
    getY: (d) => d.value,
    defaultRange: { start: 5, end: 14 },
    // Main Chart의 YAxis width(40) + margin(left 0, right 10)과 일치시킨 plot 여백.
    // Wheel anchor 보정과 Preview 좌우 정렬이 이 한 값을 공유한다
    inset: { left: 40, right: 10 },
    onRangeChange: () => setChangeCount((count) => count + 1),
    onRangeCommit: (snapshot, meta) => {
      setCommitCount((count) => count + 1);
      setLastCommit(
        `${meta.source} → ${snapshot.range.start}~${snapshot.range.end}`,
      );
    },
  });

  return (
    <div style={{ maxWidth: 720, fontFamily: "sans-serif" }}>
      <p style={{ color: "#666", fontSize: 12 }}>
        ▼ 차트 위에서 휠: Zoom만 된다 (페이지 스크롤 차단). 위로 굴림 = 확대.
      </p>

      {/* YAxis 폭·margin을 명시하고 같은 값을 Preview inset으로 — plot 영역과 좌우 정렬 */}
      <div {...zap.mainProps}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={zap.visibleData}
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <XAxis dataKey="country" />
            <YAxis width={40} domain={zap.yDomain} />
            <Line dataKey="value" stroke="#4f7cf7" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} />

      <p style={{ fontSize: 13 }}>
        현재 range: {zap.range.start} ~ {zap.range.end} (폭{" "}
        {zap.range.end - zap.range.start}) · onRangeChange{" "}
        <strong>{changeCount}</strong>회 · onRangeCommit{" "}
        <strong>{commitCount}</strong>회 · 마지막: {lastCommit}
      </p>

      {/* 완료 기준 체크리스트 */}
      <ul style={{ color: "#666", fontSize: 12, paddingLeft: 16 }}>
        <li>위로 굴림 = 확대(폭 −2), 아래로 굴림 = 축소(폭 +2)</li>
        <li>
          <strong>포인터 중심</strong>: 마우스 아래 데이터가 (근사적으로)
          제자리에 고정된 채 주변이 수축·팽창한다 — 차트 오른쪽 끝에 커서를 두고
          확대해도 그 지점이 화면에 남는다 (wrapper 폭 근사라 YAxis 폭만큼
          오차는 수용)
        </li>
        <li>
          휠을 아무리 굴려도 range는 <strong>항상 정수</strong> (Bucket snap —
          위 readout에 소수가 보이면 실패)
        </li>
        <li>Preview Window·Main Chart가 휠마다 실시간 동기화</li>
        <li>
          Preview의 시작·끝이 Main Chart plot 영역(축 안쪽)과 정렬되고, 같은
          inset이 wheel anchor 보정에도 쓰여 포인터 고정이 더 정확하다 — hook
          옵션{" "}
          <code>
            inset: {"{ left: YAxis폭+margin.left, right: margin.right }"}
          </code>
        </li>
        <li>축소 중 한쪽이 경계(0 또는 19)에 닿으면 반대쪽만 계속 벌어진다</li>
        <li>최소 폭(2포인트)·전체 범위에서 더 이상 변하지 않는다</li>
        <li>
          연타로 굴려도 Commit은 멈춘 뒤 150ms 후 <strong>1회만</strong> 늘고,
          source는 wheel-zoom
        </li>
        <li>전체 범위에서 축소 연타 → 변화가 없으므로 Change·Commit 그대로</li>
        <li>휠 직후 150ms 안에 Handle을 잡으면 wheel commit이 먼저 마감된다</li>
      </ul>

      {/* 스크롤 차단 검증용 여백 — 차트 밖에서는 휠로 여기까지 내려올 수 있어야 정상 */}
      <div
        style={{
          height: "120vh",
          display: "flex",
          alignItems: "flex-end",
          color: "#999",
          fontSize: 12,
        }}
      >
        페이지 맨 아래 — 차트 "밖"에서 휠을 굴려 여기까지 내려왔다면
        preventDefault가 차트 위에서만 동작한다는 뜻 (통과).
      </div>
    </div>
  );
}

const meta: Meta<typeof WheelZoomDemo> = {
  title: "Main/WheelZoom",
  component: WheelZoomDemo,
};
export default meta;

type Story = StoryObj<typeof WheelZoomDemo>;

export const WheelZoom: Story = {};
