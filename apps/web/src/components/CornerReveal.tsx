import { cn } from "@northgraindata/dsui-ui";

const corner =
  "pointer-events-none absolute z-10 size-2.5 opacity-0 transition-[translate,opacity] duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:translate-x-0 motion-reduce:translate-y-0 motion-reduce:transition-none group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100";

export function CornerReveal({
  className,
  placement = "inside",
}: {
  className?: string;
  placement?: "inside" | "outside";
}) {
  const position =
    placement === "outside"
      ? {
          topLeft: "-top-[5px] -left-[5px]",
          topRight: "-top-[5px] -right-[5px]",
          bottomLeft: "-bottom-[5px] -left-[5px]",
          bottomRight: "-right-[5px] -bottom-[5px]",
        }
      : {
          topLeft: "top-0 left-0",
          topRight: "top-0 right-0",
          bottomLeft: "bottom-0 left-0",
          bottomRight: "right-0 bottom-0",
        };

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          corner,
          className,
          position.topLeft,
          "origin-top-left translate-x-[60%] translate-y-[60%] border-t border-l",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          corner,
          className,
          position.topRight,
          "origin-top-right -translate-x-[60%] translate-y-[60%] border-t border-r",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          corner,
          className,
          position.bottomLeft,
          "origin-bottom-left translate-x-[60%] -translate-y-[60%] border-b border-l",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          corner,
          className,
          position.bottomRight,
          "origin-bottom-right -translate-x-[60%] -translate-y-[60%] border-r border-b",
        )}
      />
    </>
  );
}
