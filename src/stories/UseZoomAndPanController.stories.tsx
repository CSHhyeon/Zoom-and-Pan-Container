/**
 * useZoomAndPanController 뼈대 검증 Story
 * (API Skeleton 스파이크를 hook 기반으로 교체)
 *
 * [Uncontrolled] 완료 기준:
 * 1. 버튼으로 range를 바꾸면 Main Chart가 갱신된다 (preset 버튼)
 * 2. defaultRange prop이 나중에 바뀌어도 range가 초기화되지 않는다 ("defaultRange 변경" 버튼을 눌러도 차트 range 유지)
 *
 * 추가 관찰 포인트: 잘못된 range를 넣어도 clampRange 단일 관문이 보정한다 (경계 초과 → 폭 유지 평행이동, 최소 폭 미달 → end 확장)
 *
 * [Callbacks] onRangeChange · onRangeCommit (P3-⑫) 완료 기준:
 * - Handle Drag 중 Change가 연속 출력된다 (rAF throttle — 프레임당 최대 1회)
 * - Pointer Up 시 Commit이 정확히 1회 출력된다
 * - 클릭만 하고 안 움직이면 Commit이 호출되지 않는다
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
import {
  useZoomAndPanController,
  ZoomAndPanPreview,
  type Range,
  type RangeChangeMeta,
  type RangeSnapshot,
} from "../index";

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
  // clampRange 관문 확인용 — 유효하지 않은 입력이 보정되는지
  { label: "7~12 → 경계 보정(4~9)", range: { start: 7, end: 12 } },
  { label: "5~5 → 최소 폭 보정(5~6)", range: { start: 5, end: 5 } },
];

// ── 확정 인터페이스 형태 그대로 사용 ─────────────────────────────
function ZoomAndPanChart({ defaultRange }: { defaultRange: Range }) {
  const zap = useZoomAndPanController({
    data: DATA,
    rangeMode: "bucket",
    getX: (d) => d.country, // d가 Datum으로 추론되는지 (스파이크 체크리스트 5 유지)
    getY: (d) => d.value, // Preview 추이 y값
    defaultRange,
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
            <Line dataKey="value" stroke="#4f7cf7" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Preview */}
      <ZoomAndPanPreview controller={zap} />

      {/* 완료 기준 1: 버튼으로 range 변경 → Main Chart 갱신 */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => zap.setRange(preset.range)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p style={{ color: "#666", fontSize: 12 }}>
        현재 range: {zap.range.start} ~ {zap.range.end} / visible:{" "}
        {zap.visibleData.map((d) => d.country).join(", ")}
      </p>
    </div>
  );
}

/**
 * 완료 기준 2 검증 래퍼.
 * defaultRange를 부모 상태로 들고 있다가 버튼으로 바꾼다.
 * Uncontrolled이므로 hook은 최초 mount 값만 쓰고, 이후 변경은 무시해야 한다.
 */
function UncontrolledDemo() {
  const [defaultRange, setDefaultRange] = useState<Range>({ start: 2, end: 6 });

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <ZoomAndPanChart defaultRange={defaultRange} />

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px dashed #bbb",
          maxWidth: 720,
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={() => setDefaultRange({ start: 0, end: 3 })}
        >
          defaultRange를 0~3으로 변경
        </button>
        <p style={{ color: "#666", fontSize: 12 }}>
          현재 defaultRange prop: {defaultRange.start} ~ {defaultRange.end}
          <br />이 버튼을 눌러도 위 차트의 range가 바뀌지 않으면 통과 (완료 기준
          2).
        </p>
      </div>
    </div>
  );
}

/** 콜백 페이로드를 화면 표시용 한 줄로 */
function formatPayload(snapshot: RangeSnapshot, meta: RangeChangeMeta): string {
  return `range ${snapshot.range.start}~${snapshot.range.end} (source: ${meta.source})`;
}

/**
 * P3-⑫ 콜백 검증. Handle을 드래그하며 카운터를 관찰한다:
 * - Change: 드래그 중 연속 증가 (프레임당 최대 1회)
 * - Commit: Pointer Up마다 +1, 단 range가 실제로 바뀐 드래그만
 */
function CallbacksDemo() {
  const [changeCount, setChangeCount] = useState(0);
  const [commitCount, setCommitCount] = useState(0);
  const [lastChange, setLastChange] = useState("아직 없음");
  const [lastCommit, setLastCommit] = useState("아직 없음");

  const zap = useZoomAndPanController({
    data: DATA,
    rangeMode: "bucket",
    getX: (d) => d.country,
    getY: (d) => d.value,
    defaultRange: { start: 2, end: 6 },
    onRangeChange: (snapshot, meta) => {
      console.log("[story] onRangeChange", snapshot.range, meta.source);
      setChangeCount((count) => count + 1);
      setLastChange(formatPayload(snapshot, meta));
    },
    onRangeCommit: (snapshot, meta) => {
      console.log("[story] onRangeCommit", snapshot.range, meta.source);
      setCommitCount((count) => count + 1);
      setLastCommit(formatPayload(snapshot, meta));
    },
  });

  return (
    <div style={{ maxWidth: 720, fontFamily: "sans-serif" }}>
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

      <p style={{ fontSize: 13 }}>
        <strong>onRangeChange {changeCount}회</strong> — 마지막: {lastChange}
        <br />
        <strong>onRangeCommit {commitCount}회</strong> — 마지막: {lastCommit}
      </p>

      {/* 완료 기준 체크리스트 — 콘솔 로그로도 동일하게 출력된다 */}
      <ul style={{ color: "#666", fontSize: 12, paddingLeft: 16 }}>
        <li>Handle 드래그 중 Change가 연속 증가한다 (프레임당 최대 1회)</li>
        <li>드래그를 놓는 순간 Commit이 정확히 1만 늘어난다</li>
        <li>Handle을 클릭만 하고 안 움직이면 Change·Commit 모두 그대로다</li>
        <li>드래그로 움직였다가 제자리에 돌려놓고 놓아도 Commit은 그대로다</li>
        <li>
          setRange 버튼(Uncontrolled Story)과 달리 프로그램적 변경은 콜백을
          부르지 않는다
        </li>
      </ul>
    </div>
  );
}

const meta: Meta<typeof UncontrolledDemo> = {
  title: "Hook/useZoomAndPanController",
  component: UncontrolledDemo,
};
export default meta;

type Story = StoryObj<typeof UncontrolledDemo>;

export const Uncontrolled: Story = {};

export const Callbacks: Story = {
  render: () => <CallbacksDemo />,
};
