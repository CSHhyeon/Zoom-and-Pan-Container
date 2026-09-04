/**
 * Chart 호환 검증 Story (P4-⑯.5)
 *
 * 컨트롤러는 LineChart 기준으로 개발했지만 headless라 차트 타입을 모른다 —
 * data(visibleData)·domain·mainProps만 꽂으면 Area·Bar·Composed에서도 동일하게 동작해야 한다.
 * 배선(컨트롤러·Preview·readout)은 CompatShell 하나가 공통 담당하고, 각 Story는 차트 JSX만 바꿔 끼운다
 * — 검증 대상인 "사용자가 자기 차트를 그대로 유지한다"는 계약을 Story 구조 자체로 보여주기 위함.
 *
 * Bar 계열 주의: 카테고리 축이 point(끝점 정렬)가 아니라 band(칸 중앙 정렬)라서
 * wheel anchor의 wrapper 근사 오차가 최대 반 칸까지 커질 수 있다 (허용 범위 — 정밀화는 v1.x Bridge).
 */
import { useState } from "react";
import type { ReactElement } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useZoomAndPanController,
  ZoomAndPanPreview,
  type ZoomAndPanController,
} from "../index";

// ── 실험 데이터: 48개 (하루 30분 간격) — Line 데모와 같은 시계열 모양에 Bar용 volume을 더했다 ──
interface CompatDatum {
  time: string;
  value: number;
  volume: number;
}

const DATA: CompatDatum[] = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return {
    time: `${hour}:${minute}`,
    value: Math.round(55 + 30 * Math.sin(index / 4) + ((index * 11) % 9)),
    volume: Math.round(40 + 25 * Math.sin(index / 2.6 + 2) + ((index * 7) % 11)),
  };
});

// Main Chart 공통 레이아웃 — YAxis width(40) + margin(left 0, right 10)이 아래 inset과 한 쌍
const MAIN_MARGIN = { top: 5, right: 10, bottom: 5, left: 0 };
const MAIN_INSET = { left: 40, right: 10 };

// Preview 추이(renderTrend) 좌표 계약: margin 전부 0 + 축 미지정 — 오버레이와 정렬 조건
const TREND_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };

interface CompatShellProps {
  /** 이 차트 타입에서 특별히 볼 확인 포인트 (공통 항목 뒤에 붙는다) */
  checkpoints: string[];
  /** controller를 받아 사용자 차트 JSX를 그린다 — 배선은 셸이, 차트는 Story가 */
  renderChart: (zap: ZoomAndPanController<CompatDatum>) => ReactElement;
  /** Preview 추이 = Main Chart의 미니 버전. 참조 고정을 위해 모듈 레벨 함수로 전달 */
  renderTrend: (data: CompatDatum[]) => ReactElement;
}

/** 컨트롤러 배선 + Preview + readout + 체크리스트 공통 골격 */
function CompatShell({ checkpoints, renderChart, renderTrend }: CompatShellProps) {
  const [commitCount, setCommitCount] = useState(0);
  const [lastCommit, setLastCommit] = useState("아직 없음");

  // getY 없음 — Preview 추이를 renderTrend로 직접 그리므로 내장 추이용 y 추출이 필요 없다
  const zap = useZoomAndPanController({
    data: DATA,
    rangeMode: "bucket",
    getX: (d) => d.time,
    defaultRange: { start: 12, end: 35 },
    inset: MAIN_INSET,
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
        ▼ LineChart로 개발한 컨트롤러를 이 차트에 그대로 배선했다. 휠 = Zoom ·
        잡고 끌면 Pan · Preview 조작 동일.
      </p>

      <div {...zap.mainProps}>
        <ResponsiveContainer width="100%" height={260}>
          {renderChart(zap)}
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} renderTrend={renderTrend} />

      <p style={{ fontSize: 13 }}>
        현재 range: <strong>{zap.range.start}</strong> ~{" "}
        <strong>{zap.range.end}</strong> (폭 {zap.range.end - zap.range.start})
        · visible {zap.visibleData.length}개 · onRangeCommit{" "}
        <strong>{commitCount}</strong>회 — 마지막: {lastCommit}
      </p>

      {/* 확인 포인트 — 공통(모든 차트 타입 동일 동작) + 타입별 */}
      <ul style={{ color: "#666", fontSize: 12, paddingLeft: 16 }}>
        <li>
          휠 줌(포인트 고정·비율 속도)·드래그 Pan·Preview(Handle/Window/Dim)가
          Line 데모와 동일하게 동작하고 range는 항상 정수
        </li>
        <li>
          Tooltip이 휠 중에도 계속 보이며 anchor 포인트에 고정, 드래그 중에는
          숨김
        </li>
        <li>
          Preview 추이가 Main Chart와 같은 타입·색의 미니 버전으로 그려진다
          (renderTrend)
        </li>
        {checkpoints.map((checkpoint) => (
          <li key={checkpoint}>{checkpoint}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Preview 추이 렌더러 — Main Chart와 같은 시리즈·색의 미니 버전 ──
// 모듈 레벨 함수라 참조가 고정된다 → 드래그 중 Preview 추이 차트의 memo가 유지된다

const renderAreaTrend = (data: CompatDatum[]) => (
  <AreaChart data={data} margin={TREND_MARGIN}>
    <Area
      dataKey="value"
      stroke="#4f7cf7"
      fill="#4f7cf7"
      fillOpacity={0.2}
      isAnimationActive={false}
    />
  </AreaChart>
);

const renderBarTrend = (data: CompatDatum[]) => (
  <BarChart data={data} margin={TREND_MARGIN}>
    <Bar dataKey="volume" fill="#8b95f6" isAnimationActive={false} />
  </BarChart>
);

const renderComposedTrend = (data: CompatDatum[]) => (
  <ComposedChart data={data} margin={TREND_MARGIN}>
    <Bar dataKey="volume" fill="#c7cdfb" isAnimationActive={false} />
    <Line
      dataKey="value"
      stroke="#4f7cf7"
      dot={false}
      isAnimationActive={false}
    />
  </ComposedChart>
);

function AreaCompatDemo() {
  return (
    <CompatShell
      renderTrend={renderAreaTrend}
      checkpoints={[
        "영역 fill이 Window 경계에서 잘려도 Y 오토스케일이 함께 따라온다 (빈 여백·튐 없음)",
        "Line과 같은 point 축이라 좌우 끝 포인트가 plot 가장자리에 붙는다 — Preview와 경계 정렬 유지",
      ]}
      renderChart={(zap) => (
        <AreaChart data={zap.visibleData} margin={MAIN_MARGIN}>
          <XAxis dataKey="time" />
          <YAxis width={40} domain={zap.yDomain} />
          <Tooltip active={zap.tooltipActive} />
          <Area
            dataKey="value"
            stroke="#4f7cf7"
            fill="#4f7cf7"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
        </AreaChart>
      )}
    />
  );
}

function BarCompatDemo() {
  return (
    <CompatShell
      renderTrend={renderBarTrend}
      checkpoints={[
        "Zoom·Pan에 따라 막대 개수와 폭이 자연스럽게 변한다 (Window 폭 = 막대 수)",
        "band 축(칸 중앙 정렬)이라 wheel anchor·Preview 정렬이 최대 반 칸 어긋날 수 있다 — 허용 범위, 세션 내 anchor 고정은 유지 (정밀화는 v1.x Bridge)",
        "드래그 Pan 이동량이 손끝과 근사 일치한다 (plot 폭 근사 오차 이내)",
      ]}
      renderChart={(zap) => (
        <BarChart data={zap.visibleData} margin={MAIN_MARGIN}>
          <XAxis dataKey="time" />
          <YAxis width={40} domain={zap.yDomain} />
          <Tooltip active={zap.tooltipActive} />
          <Bar dataKey="volume" fill="#8b95f6" isAnimationActive={false} />
        </BarChart>
      )}
    />
  );
}

function ComposedCompatDemo() {
  return (
    <CompatShell
      renderTrend={renderComposedTrend}
      checkpoints={[
        "Bar·Line 두 시리즈가 하나의 visibleData로 잘려 항상 같은 구간을 그린다 (서로 어긋나지 않음)",
        "Line의 점이 항상 Bar 중앙 위에 온다 — band 축 공유(중앙 정렬 우선 확정). 그래서 Line 양끝이 plot 가장자리에서 반 칸 안쪽에서 시작·끝나는 것이 정상이다",
        "Tooltip에 두 시리즈 값이 함께 표시되고, 휠 중에도 anchor 포인트에 고정",
        "Bar Story와 같은 반 칸 근사 허용 (wheel anchor·Preview 정렬)",
      ]}
      renderChart={(zap) => (
        <ComposedChart data={zap.visibleData} margin={MAIN_MARGIN}>
          {/*
           * Bar·Line이 band 축 하나를 공유한다 — Line의 점이 정확히 Bar 중앙에 오는 것(값 대응)이
           * 우선이라, Line 양끝이 plot 가장자리에서 반 칸 안쪽에 머무는 것은 의도된 모습이다.
           * (Line 전용 point 축으로 끝까지 잇는 시안은 Bar 중앙과 최대 반 칸 어긋나 폐기 — 2026-09-05)
           */}
          <XAxis dataKey="time" />
          <YAxis width={40} domain={zap.yDomain} />
          <Tooltip active={zap.tooltipActive} />
          <Bar dataKey="volume" fill="#c7cdfb" isAnimationActive={false} />
          <Line
            dataKey="value"
            stroke="#4f7cf7"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      )}
    />
  );
}

const meta: Meta<typeof AreaCompatDemo> = {
  title: "ChartCompat",
  component: AreaCompatDemo,
};
export default meta;

type Story = StoryObj<typeof AreaCompatDemo>;

export const AreaCompat: Story = {
  render: () => <AreaCompatDemo />,
};

export const BarCompat: Story = {
  render: () => <BarCompatDemo />,
};

export const ComposedCompat: Story = {
  render: () => <ComposedCompatDemo />,
};
