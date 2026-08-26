import { cn } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { BrandGlyph } from "../logos";

export function ServiceMark({
  adapter,
  logo,
  size = 26,
}: {
  adapter: string;
  logo?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const classes =
    "relative flex shrink-0 items-center justify-center border border-border bg-surface-raised text-secondary";
  const style = { width: size, height: size };
  if (logo && !failed)
    return (
      <span className={classes} style={style}>
        <img
          src={logo}
          alt=""
          width={size - 8}
          height={size - 8}
          loading="lazy"
          className="object-contain p-1"
          onError={() => setFailed(true)}
        />
      </span>
    );
  const glyph = <BrandGlyph adapter={adapter} size={size - 8} />;
  if (glyph)
    return (
      <span className={cn(classes, "text-accent")} style={style}>
        {glyph}
      </span>
    );
  return (
    <span
      className={cn(classes, "font-mono text-[9.5px] font-semibold")}
      style={style}
    >
      {adapter.slice(0, 2).toUpperCase()}
    </span>
  );
}
