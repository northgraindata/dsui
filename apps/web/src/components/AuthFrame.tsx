import { Surface } from "@northgraindata/dsui-ui";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

export const authCardInput =
  "grid gap-4 border-t border-dashed border-border px-5 py-4";

export function AuthFrame({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Wordmark className="justify-center" />
        <Surface>
          <div className="grid gap-1.5 p-5">
            <p className="m-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Data Stack UI
            </p>
            <h1 className="m-0 text-[16px] font-semibold text-primary">
              {title}
            </h1>
            <p className="m-0 text-[12px] text-secondary">{copy}</p>
          </div>
          {children}
        </Surface>
      </div>
    </div>
  );
}
