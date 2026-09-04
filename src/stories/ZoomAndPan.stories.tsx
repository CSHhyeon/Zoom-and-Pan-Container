/**
 * ZoomAndPan 통합 데모 — 모든 조작을 한 화면에서 검증한다.
 *
 * 기능별로 나뉘어 있던 Story(Static · HandleResize · WindowPan · DimClick · WheelZoom · DragPan · Callbacks)를 하나로 합쳤다.
 * Main Chart(Wheel Zoom + Drag Pan) + Preview(Handle/Window/Dim) + 콜백 카운터가 같은 화면에 있어 하단 확인 포인트를 위에서부터 하나씩 검증하면 된다.
 *
 * 별도 스토리: LargeDataset(360 포인트 — 대용량에서의 Zoom 깊이·성능), SinglePoint(데이터 1개, fullSpan 0 극단 케이스).
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

// ── 실험 데이터: 20개 (A~T) — 줌 단계와 팬 이동 공간이 충분하도록 ──
interface Datum {
  country: string;
  value: number;
}

const DATA: Datum[] = Array.from({ length: 20 }, (_, index) => ({
  country: String.fromCharCode(65 + index), // A, B, C, ...
  value: Math.round(35 + 28 * Math.sin(index * 1.1) + 8 * ((index * 7) % 5)),
}));

// setRange 검증용 preset — 뒤의 두 개는 clampRange 관문 보정 확인용 (유효하지 않은 입력)
const PRESETS: Array<{ label: string; range: Range }> = [
  { label: "range 2~6", range: { start: 2, end: 6 } },
  { label: "전체 (0~19)", range: { start: 0, end: 19 } },
  { label: "15~25 → 경계 보정(9~19)", range: { start: 15, end: 25 } },
  { label: "8~8 → 최소 폭 보정(8~9)", range: { start: 8, end: 8 } },
];

/** 콜백 페이로드를 화면 표시용 한 줄로 */
function formatPayload(snapshot: RangeSnapshot, meta: RangeChangeMeta): string {
  return `${meta.source} → ${snapshot.range.start}~${snapshot.range.end}`;
}

function PlaygroundDemo() {
  const [changeCount, setChangeCount] = useState(0);
  const [commitCount, setCommitCount] = useState(0);
  const [lastChange, setLastChange] = useState("아직 없음");
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
    onRangeChange: (snapshot, meta) => {
      setChangeCount((count) => count + 1);
      setLastChange(formatPayload(snapshot, meta));
    },
    onRangeCommit: (snapshot, meta) => {
      setCommitCount((count) => count + 1);
      setLastCommit(formatPayload(snapshot, meta));
    },
  });

  return (
    <div style={{ maxWidth: 720, fontFamily: "sans-serif" }}>
      <p style={{ color: "#666", fontSize: 12 }}>
        ▼ 차트 위에서 휠 = Zoom (위로 굴림 = 확대), 차트를 잡고 끌면 Pan.
        Preview는 Handle 드래그 · Window 드래그 · Dim 클릭.
      </p>

      {/* YAxis 폭·margin을 명시하고 같은 값을 hook inset으로 — plot 영역과 Preview 좌우 정렬 */}
      <div {...zap.mainProps}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={zap.visibleData}
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <XAxis dataKey="country" />
            <YAxis width={40} domain={zap.yDomain} />
            <Tooltip active={zap.tooltipActive} />
            <Line dataKey="value" stroke="#4f7cf7" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} />

      {/* setRange 검증 — 프로그램적 변경은 관문 보정을 거치고 콜백은 부르지 않는다 */}
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

      <p style={{ fontSize: 13 }}>
        현재 range: <strong>{zap.range.start}</strong> ~{" "}
        <strong>{zap.range.end}</strong> (폭 {zap.range.end - zap.range.start})
        · visible {zap.visibleData.length}개
        <br />
        onRangeChange <strong>{changeCount}</strong>회 — 마지막: {lastChange}
        <br />
        onRangeCommit <strong>{commitCount}</strong>회 — 마지막: {lastCommit}
      </p>

      {/* 확인 포인트 — 위에서부터 하나씩 조작하며 검증한다 */}
      <div style={{ color: "#666", fontSize: 12 }}>
        <strong>Main Chart</strong>
        <ul style={{ paddingLeft: 16, marginTop: 4 }}>
          <li>
            휠 위로 = 확대, 아래로 = 축소 — 1틱당 폭이 현재 폭의 20%씩(×0.8 /
            ÷0.8, 최소 1칸) 변해 데이터가 많아도 몇 번이면 목표 구간에 도달한다.
            차트 위에서는 페이지 스크롤이 차단되고 차트 밖에서는 정상 스크롤 (맨
            아래 여백으로 검증)
          </li>
          <li>
            포인트 고정: 휠 시작 시 마우스와 가장 가까운 데이터 포인트가 세션
            내내 pivot — 그 점이 제자리 근처에 머문 채 주변이 수축·팽창하고,
            확대→축소를 반복해도 제자리로 돌아온다 (Bucket snap 진동 최대
            0.5칸, 누적 없음)
          </li>
          <li>
            경계 근처에서는 포인터 고정보다 경계 준수가 우선 — 벽에 붙어 폭 유지
            평행이동하되 anchor 지점은 화면에 남는다
          </li>
          <li>
            휠 줌 중에도 Tooltip이 계속 보이고, 휠 시작 시 선택된 포인트에
            고정된 채 따라온다 — 세션 중 이웃 점으로 널뛰지 않는다 (매 틱 후
            anchor 표시 위치로 hover 재전송). 150ms 멈춘 뒤 마우스를 움직이면
            평소처럼 최근접 선택으로 복귀
          </li>
          <li>
            차트를 잡고 끌면 지도처럼 Pan — 오른쪽으로 끌면 이전(왼쪽) 데이터가
            드러난다. 폭 불변, 드래그 중 Tooltip 숨김(tooltipActive)·축 라벨
            텍스트 선택 안 됨
          </li>
        </ul>

        <strong>Preview</strong>
        <ul style={{ paddingLeft: 16, marginTop: 4 }}>
          <li>
            Handle 드래그: 반대쪽 Handle 고정, 서로 교차 불가(최소 폭에서 멈춤),
            경계(0·19) 초과 금지, Main Chart 동기 갱신
          </li>
          <li>
            Window 드래그: 폭 유지 이동, 잡은 지점이 손가락을 따라옴(순간이동
            없음), 양 끝에서 벽에 붙어 멈춤
          </li>
          <li>
            Dim 클릭: 클릭 지점이 Window 중앙으로 이동 (경계 부근은 벽에 붙음),
            단발로 change + commit 동시 발생
          </li>
          <li>
            이벤트 우선순위: 같은 지점에서 Handle &gt; Window &gt; Dim 중 정확히
            하나만 반응 — commit source로 확인 (resize-left/right · window-pan ·
            dim-click)
          </li>
        </ul>

        <strong>공통 · 콜백</strong>
        <ul style={{ paddingLeft: 16, marginTop: 4 }}>
          <li>
            range는 항상 정수 (Bucket snap — 위 readout에 소수가 보이면 실패)
          </li>
          <li>
            포인터가 차트·Preview 밖으로 나가도 드래그가 유지된다
            (setPointerCapture)
          </li>
          <li>
            Change는 조작 중 연속(rAF — 프레임당 최대 1회), Commit은 조작당 1회
            — 클릭만 하고 안 움직이거나 제자리로 돌려놓으면 호출되지 않는다
          </li>
          <li>
            휠 직후 150ms 안에 드래그를 시작해도 세션이 섞이지 않는다 (wheel
            commit 먼저 마감)
          </li>
          <li>
            Preset 버튼(setRange)은 clampRange 보정을 거치되 콜백은 부르지
            않는다 — 카운터가 늘면 실패
          </li>
        </ul>
      </div>

      {/* 스크롤 차단 검증용 여백 — 차트 밖에서는 휠로 여기까지 내려올 수 있어야 정상 */}
      <div
        style={{
          height: "100vh",
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

// ── 대용량 데이터: 24시간 × 4분 간격 = 360 포인트 ──
interface TimeDatum {
  time: string;
  value: number;
}

const LARGE_DATA: TimeDatum[] = Array.from({ length: 360 }, (_, index) => {
  const hour = String(Math.floor(index / 15)).padStart(2, "0");
  const minute = String((index % 15) * 4).padStart(2, "0");
  // 완만한 일 주기 + 짧은 파동 + 결정적 잡음 — 랜덤 없이 매 렌더 같은 모양 (줌 검증 시 기준점 유지)
  const value =
    50 +
    25 * Math.sin(index / 12) +
    12 * Math.sin(index / 3.7) +
    ((index * 13) % 7);
  return { time: `${hour}:${minute}`, value: Math.round(value) };
});

/**
 * 대용량 검증: Zoom 깊이(360 → 최소 폭)와 Preview·Tooltip이 데이터 수에 관계없이 동작하는지 본다.
 * 포인트가 많으면 개별 dot 렌더가 병목이라 dot={false} — 사용자 가이드의 대용량 권장 설정과 동일.
 */
function LargeDatasetDemo() {
  const [commitCount, setCommitCount] = useState(0);
  const [lastCommit, setLastCommit] = useState("아직 없음");

  const zap = useZoomAndPanController({
    data: LARGE_DATA,
    rangeMode: "bucket",
    getX: (d) => d.time,
    getY: (d) => d.value,
    // 가운데 1시간(15포인트 × 4구간)쯤을 초기 Window로
    defaultRange: { start: 150, end: 209 },
    inset: { left: 40, right: 10 },
    onRangeCommit: (snapshot, meta) => {
      setCommitCount((count) => count + 1);
      setLastCommit(formatPayload(snapshot, meta));
    },
  });

  return (
    <div style={{ maxWidth: 720, fontFamily: "sans-serif" }}>
      <p style={{ color: "#666", fontSize: 12 }}>
        ▼ 360 포인트 (24시간 × 4분 간격). 휠 = Zoom · 잡고 끌면 Pan · Preview
        조작 동일.
      </p>

      <div {...zap.mainProps}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={zap.visibleData}
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <XAxis dataKey="time" minTickGap={24} />
            <YAxis width={40} domain={zap.yDomain} />
            <Tooltip active={zap.tooltipActive} />
            <Line
              dataKey="value"
              stroke="#4f7cf7"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} />

      <p style={{ fontSize: 13 }}>
        현재 range: <strong>{zap.range.start}</strong> ~{" "}
        <strong>{zap.range.end}</strong> (폭 {zap.range.end - zap.range.start})
        · visible {zap.visibleData.length}개 / 전체 {LARGE_DATA.length}개
        <br />
        onRangeCommit <strong>{commitCount}</strong>회 — 마지막: {lastCommit}
      </p>

      <ul style={{ color: "#666", fontSize: 12, paddingLeft: 16 }}>
        <li>
          휠 확대를 끝까지(최소 폭) 내려가도 포인터 아래 시각이 그대로 유지되고,
          축소로 전체(0~359)까지 부드럽게 복귀한다
        </li>
        <li>
          Tooltip이 휠 중에도 항상 마우스와 가장 가까운 시각을 가리킨다 —
          포인트가 조밀할 때 어긋나면 실패
        </li>
        <li>
          전체 범위 대비 Window가 작을 때(예: 폭 10) Preview Handle·Window
          드래그가 1포인트 단위로 정밀하게 움직인다
        </li>
        <li>드래그 Pan·휠 연타에 프레임 드랍이 체감되지 않는다 (dot 비활성)</li>
      </ul>
    </div>
  );
}

/**
 * 극단 케이스: 데이터 1개 → fullRange {0,0}, fullSpan 0.
 * `fullSpan || 1` 가드 덕에 NaN% 없이 렌더되고, Window 폭 0% + Handle 둘 다 왼쪽 끝(0%)에 겹쳐 보이면 통과.
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

const meta: Meta<typeof PlaygroundDemo> = {
  title: "ZoomAndPan",
  component: PlaygroundDemo,
};
export default meta;

type Story = StoryObj<typeof PlaygroundDemo>;

export const Playground: Story = {};

export const LargeDataset: Story = {
  render: () => <LargeDatasetDemo />,
};

export const SinglePoint: Story = {
  render: () => <SinglePointDemo />,
};
