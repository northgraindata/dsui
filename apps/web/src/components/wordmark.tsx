import { cn } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import logo from "../../../site/public/branding/logo-icon.svg";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "inline-flex items-center gap-2 text-[16px] font-bold tracking-tight text-primary no-underline",
        className,
      )}
      aria-label="dsui home"
    >
      <img src={logo} width="25" height="25" alt="" />
      <span>dsui</span>
    </Link>
  );
}
