# ZoomAndPanController

**기존 Recharts 차트 코드를 거의 바꾸지 않고 붙이는 Zoom & Pan 컨트롤러.**

차트를 다시 그려주는 라이브러리가 아닙니다. "지금 보여줄 데이터 조각"과 "차트를 감쌀 이벤트 배선"만 돌려주는 **headless hook**이라, 여러분의 차트(축·색·Tooltip·구성)는 그대로 유지됩니다.

```text
┌─────────────────────────────────────┐
│  Main Chart (여러분의 Recharts 차트)   │  ← 휠 = Zoom, 잡고 끌면 Pan
│                                     │
└─────────────────────────────────────┘
┌────────┬───────────────────┬────────┐
│  Dim   │[     Window      ]│  Dim   │  ← Preview: 전체 추이 + 현재 구간
└────────┴───────────────────┴────────┘
   클릭      잡고 끌면 이동       클릭
          ▐ 양끝 Handle로 폭 조절 ▌
```

## 특징

- **Headless** — 사용자는 자기 차트에 `data`와 `domain`만 hook 반환값으로 교체. 차트 종류(Line·Area·Bar·Composed)를 가리지 않습니다
- **포인터 고정 Wheel Zoom** — 휠을 굴리면 마우스 아래 데이터 포인트가 제자리에 고정된 채 주변이 수축·팽창합니다 (지도 방식). Tooltip도 그 포인트에 고정
- **비율 기반 줌 속도** — 1틱당 폭이 20%씩 변해 데이터가 360개든 36,000개든 휠 몇 번이면 목표 구간에 도달합니다
- **Main Chart Drag Pan** — 지도처럼 차트를 잡고 끌어 이동
- **Preview 미니맵** — 전체 추이 위에 현재 구간(Window)을 표시. Handle 드래그(폭 조절) · Window 드래그(이동) · Dim 클릭(점프) 지원, `renderTrend`로 Main Chart의 미니 버전을 직접 그릴 수 있습니다
- **콜백 설계** — 조작 중 실시간 동기화용 `onRangeChange`(프레임당 최대 1회)와 서버 요청용 `onRangeCommit`(조작당 정확히 1회)을 분리

## 요구사항

| peer dependency   | 버전                 |
| ----------------- | -------------------- |
| react / react-dom | ^18.2.0 또는 ^19.0.0 |
| recharts          | ^3.8.0               |

## 설치

```bash
npm install @soohyeon_choi/zoom-and-pan-controller
```

## 빠른 시작

기존 LineChart에 붙이는 전체 코드입니다. 여러분이 바꾸는 곳은 **주석 친 4줄**뿐입니다.

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useZoomAndPanController,
  ZoomAndPanPreview,
} from "@soohyeon_choi/zoom-and-pan-controller";

const DATA = [
  { time: "09:00", value: 30 },
  { time: "09:30", value: 55 },
  // ... 데이터가 많을수록 진가가 드러납니다
];

function MyChart() {
  const zap = useZoomAndPanController({
    data: DATA,
    getX: (d) => d.time,
    getY: (d) => d.value,
    defaultRange: { start: 10, end: 29 }, // 처음 보여줄 구간 (index 기준)
    inset: { left: 40, right: 10 }, // YAxis 폭 + margin (아래 "inset" 참고)
  });

  return (
    <>
      <div {...zap.mainProps}>
        {" "}
        {/* ① 차트를 감싸는 div에 스프레드 */}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={zap.visibleData} /* ② data만 visibleData로 교체 */
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <XAxis dataKey="time" />
            <YAxis width={40} domain={zap.yDomain} /> {/* ③ */}
            <Tooltip active={zap.tooltipActive} /> {/* ④ */}
            <Line dataKey="value" stroke="#4f7cf7" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ZoomAndPanPreview controller={zap} />
    </>
  );
}
```

이것만으로 휠 줌 · 드래그 팬 · Preview 조작이 전부 동작합니다.

> **팁**: 조작 중에는 리렌더가 잦으므로 시리즈에 `isAnimationActive={false}`를 권장합니다. 포인트가 수백 개라면 `dot={false}`도 함께 쓰세요.

## 핵심 개념: Bucket Range

현재 보이는 구간(range)은 **데이터 배열 index 기준, 양끝 포함(inclusive)** 입니다.

```text
range = { start: 2, end: 6 }  →  index 2~6, 데이터 포인트 5개 표시
```

- `start <= end`가 항상 보장되고, 기본 최소 폭은 `end - start >= 1` (최소 두 포인트)
- 어떤 조작이 와도 range는 단일 보정 관문을 통과하므로 항상 유효한 정수 구간입니다 — 경계를 넘으면 폭을 유지한 채 벽에 붙습니다

## 조작 방법

| 조작          | 위치                | 동작                                                                                                                                                   |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 휠 위/아래    | Main Chart          | 확대/축소. 휠 시작 시 마우스와 가장 가까운 데이터 포인트가 고정점(anchor)이 되어 세션 내내 제자리에 머뭅니다. 차트 위에서는 페이지 스크롤이 차단됩니다 |
| 잡고 끌기     | Main Chart          | 폭 유지 이동 (지도 방향 — 오른쪽으로 끌면 이전 데이터가 드러남). 드래그 중 Tooltip은 숨겨집니다                                                        |
| Handle 드래그 | Preview 양끝        | 한쪽 경계만 이동해 폭 조절                                                                                                                             |
| Window 드래그 | Preview 밝은 영역   | 잡은 지점이 손가락을 따라오는 폭 유지 이동                                                                                                             |
| Dim 클릭      | Preview 어두운 영역 | 클릭 지점이 Window 중앙에 오도록 점프                                                                                                                  |

모든 드래그는 포인터 캡처를 사용하므로 차트 밖으로 나가도 이어집니다.

## API

### `useZoomAndPanController(options)`

**옵션**

| 옵션            | 타입                       | 기본값     | 설명                                                                                                          |
| --------------- | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `data`          | `readonly T[]`             | (필수)     | 전체 원본 데이터. hook은 자르기만 하고 변형하지 않습니다                                                      |
| `getX`          | `(datum, index) => TX`     | (필수)     | 한 행에서 x값을 뽑는 함수                                                                                     |
| `getY`          | `(datum, index) => number` | —          | Preview 내장 추이(AreaChart)의 y값. `renderTrend`를 쓰면 불필요                                               |
| `defaultRange`  | `{ start, end }`           | 전체 범위  | 초기 구간 (Uncontrolled — 최초 mount에만 반영)                                                                |
| `minRange`      | `number`                   | `1`        | 최소 폭(`end - start`). 확대는 여기서 멈춥니다                                                                |
| `zoomStep`      | `number`                   | 비율 기반  | 지정 시 휠 1틱당 각 경계가 움직이는 고정 칸 수. **생략 시 1틱당 폭 ×0.8/÷0.8(최소 1칸)** — 대부분 생략을 권장 |
| `inset`         | `{ left?, right? }`        | `{ 0, 0 }` | Main Chart plot 영역 좌우 여백(px). 아래 "inset" 참고                                                         |
| `onRangeChange` | `(snapshot, meta) => void` | —          | 조작 중 range가 바뀔 때마다 (rAF throttle — 프레임당 최대 1회). 화면 동기화용                                 |
| `onRangeCommit` | `(snapshot, meta) => void` | —          | 한 번의 조작이 끝났을 때 1회. **서버 요청은 여기서**                                                          |

**반환값 (controller)** — 자주 쓰는 것부터:

| 필드                                                                              | 설명                                                                                                                   |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `visibleData`                                                                     | 현재 구간의 데이터 slice → 차트의 `data`에 전달                                                                        |
| `mainProps`                                                                       | Main Chart를 감싸는 div에 스프레드 — 휠·드래그 배선이 들어 있습니다. **이 div에 별도 ref를 달지 마세요** (hook이 점유) |
| `yDomain`                                                                         | `<YAxis domain>`에 전달 (현재는 항상 `undefined` = Recharts 오토스케일)                                                |
| `tooltipActive`                                                                   | `<Tooltip active>`에 전달 — 드래그 중 숨김 처리                                                                        |
| `range` / `fullRange`                                                             | 현재 구간 / 전체 구간 (Bucket index)                                                                                   |
| `setRange(next)`                                                                  | 프로그램적 구간 변경. 보정 관문을 거치며, 콜백은 호출하지 않습니다                                                     |
| `data` / `previewData` / `inset`                                                  | Preview·커스텀 UI가 소비하는 파생값                                                                                    |
| `resizeLeft` `resizeRight` `panTo` `centerAt` `beginInteraction` `endInteraction` | 저수준 조작 연산 — 기본 Preview 대신 자체 UI를 만들 때만 직접 호출합니다                                               |

### `<ZoomAndPanPreview />`

| prop          | 타입                          | 기본값         | 설명                                                         |
| ------------- | ----------------------------- | -------------- | ------------------------------------------------------------ |
| `controller`  | controller                    | (필수)         | hook 반환값 그대로: `<ZoomAndPanPreview controller={zap} />` |
| `height`      | `number`                      | `64`           | Preview 높이(px)                                             |
| `renderTrend` | `(data: T[]) => ReactElement` | 내장 AreaChart | 추이를 Main Chart의 미니 버전으로 직접 렌더 (아래 참고)      |

## inset — Main Chart와 Preview 정렬

Preview의 Window 위치, 휠 줌의 anchor 계산은 **plot 영역(축 안쪽 그림 영역)** 기준입니다. headless 특성상 hook은 여러분 차트의 YAxis 폭을 알 수 없으므로 값으로 받습니다:

```text
inset = { left: YAxis width + margin.left, right: margin.right }
```

빠른 시작 예제라면 YAxis `width={40}` + margin `{ left: 0, right: 10 }` → `inset: { left: 40, right: 10 }`. 생략해도 동작은 하지만 Preview가 plot 영역과 살짝 어긋나고 휠 anchor가 부정확해집니다.

## 콜백 — Change와 Commit의 분리

```tsx
useZoomAndPanController({
  // 조작 중 실시간 — 옆 차트의 range를 맞추는 등 화면 동기화에
  onRangeChange: ({ range }, { source }) => syncSiblingChart(range),

  // 조작이 끝났을 때 1회 — 상세 데이터 fetch 등 비용이 드는 일에
  onRangeCommit: ({ range }, { source }) => fetchDetail(range.start, range.end),
});
```

- `onRangeChange`는 rAF로 묶여 프레임당 최대 1회만 호출됩니다
- `onRangeCommit`은 조작(드래그 한 번, 휠 연타 한 세션)당 1회, **range가 실제로 바뀐 경우에만** 호출됩니다. 휠은 마지막 회전 후 150ms 뒤 확정됩니다
- `meta.source`로 어떤 조작인지 구분할 수 있습니다: `"wheel-zoom" | "main-pan" | "resize-left" | "resize-right" | "window-pan" | "dim-click"`

## Preview 추이 커스텀 — `renderTrend`

기본 Preview 추이는 내장 AreaChart입니다. Main Chart와 같은 타입·색의 미니 버전을 원하면 직접 그려주세요:

```tsx
// 컴포넌트 밖에 선언 — 참조가 고정되어야 드래그 중 추이 차트가 다시 그려지지 않습니다
const renderTrend = (data: MyDatum[]) => (
  <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
    <Bar dataKey="volume" fill="#8b95f6" isAnimationActive={false} />
  </BarChart>
);

<ZoomAndPanPreview controller={zap} renderTrend={renderTrend} />;
```

**좌표 계약**: 반환하는 차트는 `margin` 전부 0, 축은 미지정(또는 `hide`)이어야 Window/Handle 오버레이와 정렬됩니다.

## 차트 호환

| 차트                     | 지원 | 참고                                                                                                                            |
| ------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| LineChart / AreaChart    | ✅   | 포인트가 plot 양끝에 정렬 (point 축)                                                                                            |
| BarChart                 | ✅   | 막대가 칸 중앙에 정렬 (band 축) — 휠 anchor·Preview 정렬에 최대 반 칸 근사 오차가 있습니다 (설계된 허용 범위)                   |
| ComposedChart            | ✅   | Bar가 있으면 band 축 공유 — Line의 점이 Bar 중앙 위에 오고, 양끝이 plot 가장자리에서 반 칸 안쪽에서 시작·끝나는 것이 정상입니다 |
| Scatter / Pie / Radar 등 | ❌   | v1.x 이후 검토                                                                                                                  |

## 알려진 한계 (MVP)

- **Uncontrolled 전용** — range를 외부 state로 제어하는 Controlled 모드는 v1.x
- **Bucket 모드 전용** — range가 항상 정수 index라, 깊게 확대하면 고정점이 최대 반 칸 진동합니다 (연속값 축 Continuous 모드는 v1.x)
- **plot 영역은 `inset` 근사** — 자동 측정(Bridge)은 v1.x
- Chart Resize 추적, Pinch Zoom, 키보드 조작은 범위 외

## 데모

```bash
git clone https://github.com/CSHhyeon/Zoom-and-Pan-Container.git
cd Zoom-and-Pan-Container
npm install
npm run storybook   # http://localhost:6006
```

- **ZoomAndPan / Playground** — 모든 조작 + 확인 포인트 체크리스트
- **ZoomAndPan / LargeDataset** — 360 포인트에서의 줌 깊이·성능
- **ChartCompat** — Area · Bar · Composed 호환 데모

## 개발

```bash
npm run dev         # Vite 플레이그라운드
npm test            # Vitest (core·widget 순수 로직 단위 테스트)
npm run lint        # ESLint (FSD 레이어 경계 검사 포함)
npm run build       # 라이브러리 빌드 (ESM + 타입 선언 → dist/)
```

내부 구조는 FSD 축소판 4레이어(`shared ← entities ← features ← widgets`)를 따르며, 모든 range 보정은 `entities/range`의 `clampRange` 단일 관문을 통과합니다.
