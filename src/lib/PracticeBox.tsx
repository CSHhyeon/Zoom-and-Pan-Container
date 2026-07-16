import type { HTMLAttributes, PropsWithChildren } from "react";

export type PracticeBoxProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement>
>;

export function PracticeBox({
  children,
  style,
  ...divProps
}: PracticeBoxProps) {
  return (
    <div
      {...divProps}
      style={{
        boxSizing: "border-box",
        padding: 16,
        border: "1px solid currentColor",
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
