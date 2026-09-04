/**
 * Main Chart Drag Pan 검증 Story (P4-⑯)
 *
 * 완료 기준:
 * - Window 너비 유지, Preview 동기화
 * - 경계 제한 준수
 * - Drag 종료 후 Commit 1회
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useZoomAndPanController, ZoomAndPanPreview } from "../index";

// ── 실험 데이터: 30개 — 팬으로 돌아다닐 공간이 넉넉하도록 ──
const DATA = Array.from({ length: 30 }, (_, index) => ({
  time: `${String(9 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`,
  value: Math.round(40 + 30 * Math.sin(index * 0.7) + 6 * ((index * 5) % 4)),
}));

function DragPanDemo() {
  const [commitCount, setCommitCount] = useState(0);
  const [lastCommit, setLastCommit] = useState("아직 없음");

  const zap = useZoomAndPanController({
    data: DATA,
    rangeMode: "bucket",
    getX: (d) => d.time,
    getY: (d) => d.value,
    defaultRange: { start: 10, end: 19 },
    inset: { left: 40, right: 10 },
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
        ▼ 차트를 잡고 좌우로 끌어보세요 (지도처럼). 휠 줌과 함께 동작합니다.
      </p>

      <div {...zap.mainProps}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={zap.visibleData}
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <XAxis dataKey="time" />
            <YAxis width={40} domain={zap.yDomain} />
            <Tooltip active={zap.tooltipActive} />
            <Line dataKey="value" stroke="#4f7cf7" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} />

      <p style={{ fontSize: 13 }}>
        현재 range: {zap.range.start} ~ {zap.range.end} (폭{" "}
        {zap.range.end - zap.range.start} — 드래그 내내 불변) · onRangeCommit{" "}
        <strong>{commitCount}</strong>회 · 마지막: {lastCommit}
      </p>

      {/* 완료 기준 체크리스트 */}
      <ul style={{ color: "#666", fontSize: 12, paddingLeft: 16 }}>
        <li>
          오른쪽으로 끌면 이전(왼쪽) 데이터가 드러난다 — 콘텐츠가 손가락을
          따라오는 지도 방향
        </li>
        <li>드래그 내내 폭이 변하지 않고, Preview Window가 실시간 동기화</li>
        <li>양쪽 끝에서 벽에 붙어 멈춘다 (경계 준수, 폭 유지)</li>
        <li>차트 밖·브라우저 가장자리로 나가도 드래그가 유지된다 (캡처)</li>
        <li>range는 항상 정수 (Bucket snap)</li>
        <li>
          놓는 순간 Commit이 1회만 늘어난다 (source: main-pan). 클릭만 하고 안
          움직이면 그대로
        </li>
        <li>
          <strong>드래그 중 Tooltip이 숨는다</strong> — 놓으면 hover 시 다시
          표시 (tooltipActive)
        </li>
        <li>드래그 중 차트의 텍스트(축 라벨)가 선택되지 않는다</li>
        <li>
          휠 줌 직후 바로 드래그해도 세션이 섞이지 않는다 — wheel commit 먼저,
          main-pan commit 따로
        </li>
      </ul>
    </div>
  );
}

const meta: Meta<typeof DragPanDemo> = {
  title: "Main/DragPan",
  component: DragPanDemo,
};
export default meta;

type Story = StoryObj<typeof DragPanDemo>;

export const DragPan: Story = {};
