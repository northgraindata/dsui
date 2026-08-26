import { cn } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "mx-2.5 mb-8 inline-flex items-baseline text-[19px] font-bold tracking-tight text-primary no-underline",
        className,
      )}
      aria-label="dsui home"
    >
      <span className="text-accent">ds</span>ui
      <span className="animate-blink text-accent">_</span>
    </Link>
  );
}
