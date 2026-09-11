/**
 * Vite 플레이그라운드 — README "빠른 시작" 예제(①~④)와 선택 단계 ⑤(renderTrend)를 그대로 띄운다.
 *
 * README 코드가 실제로 컴파일되고 동작하는지 확인하는 자리라 예제와 다르게 손보지 않는다.
 * 데이터만 예제의 "..." 자리를 채우기 위해 생성한다.
 * 조작별 확인 체크리스트·차트 호환 데모는 Storybook(npm run storybook)에 있다.
 */
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useZoomAndPanController, ZoomAndPanPreview } from "../index";

interface Datum {
  time: string;
  value: number;
}

// 09:00부터 5분 간격 120개 — 데이터가 많을수록 줌의 진가가 드러나므로 넉넉히
const DATA: Datum[] = Array.from({ length: 120 }, (_, index) => {
  const minutes = 9 * 60 + index * 5;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return {
    time: `${hh}:${mm}`,
    value: Math.round(
      50 + 30 * Math.sin(index / 7) + 10 * Math.sin(index / 2.3),
    ),
  };
});

// ⑤ (선택) Preview 추이를 Main Chart의 미니 버전으로 — 컴포넌트 밖에 선언해 참조를 고정
// (hook은 사용자 차트 JSX를 보지 못하므로 Main의 타입을 스스로 알 수 없다 → 미니 버전을 직접 그려 준다)
const renderTrend = (data: Datum[]) => (
  <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
    <Line
      dataKey="value"
      stroke="#4f7cf7"
      dot={false}
      isAnimationActive={false}
    />
  </LineChart>
);

function MyChart() {
  const zap = useZoomAndPanController({
    data: DATA,
    getX: (d) => d.time,
    defaultRange: { start: 40, end: 79 }, // 처음 보여줄 구간 (index 기준)
    inset: { left: 40, right: 10 }, // YAxis 폭 + margin
  });

  return (
    <>
      <div {...zap.mainProps}>
        {/* ① 차트를 감싸는 div에 스프레드 */}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={zap.visibleData} /* ② data만 visibleData로 교체 */
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <XAxis dataKey="time" />
            <YAxis width={40} domain={zap.yDomain} /> {/* ③ */}
            <Tooltip active={zap.tooltipActive} /> {/* ④ */}
            <Line
              dataKey="value"
              stroke="#4f7cf7"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} renderTrend={renderTrend} />

      <p style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>
        range {zap.range.start}~{zap.range.end} / 전체 {zap.fullRange.start}~
        {zap.fullRange.end}
      </p>
    </>
  );
}

function App() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      <h1 style={{ fontSize: 22 }}>ZoomAndPanController Playground</h1>
      <p>
        README "빠른 시작" 예제 ①~⑤ 그대로입니다. 차트 위에서 휠은 Zoom, 잡고
        끌면 Pan, 아래 Preview의 Handle·Window·Dim을 조작해 보세요. 조작별 확인
        체크리스트는 Storybook(<code>npm run storybook</code>)에 있습니다.
      </p>
      <MyChart />
    </main>
  );
}

export default App;
