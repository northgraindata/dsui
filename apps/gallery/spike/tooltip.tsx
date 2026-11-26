import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactElement } from "react";

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            className="z-50 rounded-md border border-control-border bg-surface-raised px-2 py-1 text-[11px] text-text-bright shadow-lg"
          >
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
