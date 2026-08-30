import { cn } from "@northgraindata/dsui-ui";
import { useState } from "react";
import clickhouseLogo from "../assets/brands/clickhouse.svg";
import dockerLogo from "../assets/brands/docker.svg";
import flinkLogo from "../assets/brands/flink.svg";
import kafkaLogo from "../assets/brands/kafka.svg";
import polarisLogo from "../assets/brands/polaris.svg";
import s3Logo from "../assets/brands/s3.svg";
import sparkLogo from "../assets/brands/spark.svg";
import trinoLogo from "../assets/brands/trino.svg";
import { BrandGlyph } from "../logos";

const localBrandLogos: Record<string, string> = {
  clickhouse: clickhouseLogo,
  docker: dockerLogo,
  flink: flinkLogo,
  kafka: kafkaLogo,
  polaris: polarisLogo,
  s3: s3Logo,
  spark: sparkLogo,
  trino: trinoLogo,
};

export function ServiceMark({
  adapter,
  logo,
  size = 26,
  variant = "contained",
}: {
  adapter: string;
  logo?: string;
  size?: number;
  variant?: "contained" | "bare";
}) {
  const [failed, setFailed] = useState(false);
  const brandColors: Record<string, string> = {
    clickhouse: "#ffcc01",
    docker: "#2496ed",
    flink: "#e6526f",
    kafka: "#ffffff",
    polaris: "#a78bfa",
    s3: "#569a31",
    spark: "#e25a1c",
    trino: "#dd00a1",
  };
  const classes = cn(
    "relative flex shrink-0 items-center justify-center",
    variant === "contained"
      ? "border border-border bg-surface-raised text-secondary"
      : "text-primary",
  );
  const style = {
    width: size,
    height: size,
    ...(variant === "bare" && { color: brandColors[adapter] }),
  };
  const imageLogo = logo ?? localBrandLogos[adapter];
  if (imageLogo && !failed)
    return (
      <span className={classes} style={style}>
        <img
          src={imageLogo}
          alt=""
          width={size - 8}
          height={size - 8}
          loading="lazy"
          className={cn("object-contain", variant === "contained" && "p-1")}
          onError={() => setFailed(true)}
        />
      </span>
    );
  const glyph = <BrandGlyph adapter={adapter} size={size - 8} />;
  if (glyph)
    return (
      <span
        className={cn(classes, variant === "contained" && "text-accent")}
        style={style}
      >
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
