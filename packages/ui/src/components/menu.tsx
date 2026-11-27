import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type { MenuItem, MenuProps } from "../kit";
import { useDialogContainer } from "./dialog-container";

function Item({ item }: { item: MenuItem }) {
  return (
    <RadixMenu.Item
      className="dsui-menu-item"
      data-tone={item.tone ?? "default"}
      disabled={item.disabled}
      onSelect={item.onSelect}
    >
      {item.icon && (
        <span className="dsui-menu-icon" aria-hidden="true">
          {item.icon}
        </span>
      )}
      {item.label}
    </RadixMenu.Item>
  );
}

/**
 * Secondary actions. Destructive ones are always listed last, below a
 * separator, whatever order the caller gives them in.
 */
export function Menu({ trigger, items, align = "end" }: MenuProps) {
  const { container, ref } = useDialogContainer();
  const safe = items.filter((item) => item.tone !== "danger");
  const danger = items.filter((item) => item.tone === "danger");
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild ref={ref}>
        {trigger}
      </RadixMenu.Trigger>
      <RadixMenu.Portal container={container}>
        <RadixMenu.Content
          className="dsui-menu"
          align={align}
          sideOffset={6}
          collisionPadding={8}
        >
          {safe.map((item) => (
            <Item key={item.label} item={item} />
          ))}
          {safe.length > 0 && danger.length > 0 && (
            <RadixMenu.Separator className="dsui-menu-separator" />
          )}
          {danger.map((item) => (
            <Item key={item.label} item={item} />
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
