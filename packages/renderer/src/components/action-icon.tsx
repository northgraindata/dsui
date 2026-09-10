import type { ActionIcon as ActionIconName } from "@northgraindata/dsui-core";
import type { ReactNode } from "react";

const paths: Record<ActionIconName, ReactNode> = {
  play: <path d="m8 5 11 7-11 7Z" />,
  pause: (
    <>
      <path d="M8 5v14" />
      <path d="M16 5v14" />
    </>
  ),
  resume: (
    <>
      <path d="M7 5v14" />
      <path d="m11 6 8 6-8 6Z" />
    </>
  ),
  retry: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M19 12a7 7 0 1 0-2 5" />
    </>
  ),
  clear: (
    <>
      <path d="m4 15 8-8 6 6-7 7H7Z" />
      <path d="M14 20h6" />
    </>
  ),
};

export function ActionIcon({
  name,
  size = 14,
}: {
  name: ActionIconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
