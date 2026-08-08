import type { Meta, StoryObj } from "@storybook/react-vite";

// Storybook 실행 여부 확인용
function SetupSmoke() {
  return <p>Storybook이 정상 동작합니다.</p>;
}

const meta = {
  title: "Setup/Smoke",
  component: SetupSmoke,
} satisfies Meta<typeof SetupSmoke>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
