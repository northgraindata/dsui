import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { TooltipProps } from "../kit";
import { useDialogContainer } from "./dialog-container";

/**
 * Names what an icon means. It opens on hover and keyboard focus. The child
 * still needs its own accessible name: a tooltip only describes it.
 */
export function Tooltip({ label, side = "top", children }: TooltipProps) {
  const { container, ref } = useDialogContainer();
  return (
    <RadixTooltip.Provider delayDuration={250}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild ref={ref}>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal container={container}>
          <RadixTooltip.Content
            className="dsui-tooltip"
            side={side}
            sideOffset={6}
            collisionPadding={8}
          >
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
