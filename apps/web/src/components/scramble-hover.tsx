import { cn } from "@northgraindata/dsui-ui";
import { useEffect, useRef, useState } from "react";

type ScrambleHoverProps = {
  text: string;
  active?: boolean;
  scrambleSpeed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  scrambledClassName?: string;
};

function scramble(text: string, characters: string) {
  return [...text]
    .map((character) =>
      character === " "
        ? character
        : characters[Math.floor(Math.random() * characters.length)],
    )
    .join("");
}

export default function ScrambleHover({
  text,
  active,
  scrambleSpeed = 25,
  maxIterations = 8,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  className,
  scrambledClassName,
}: ScrambleHoverProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrambling, setIsScrambling] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const hovering = active ?? isHovering;
  const previousHovering = useRef(hovering);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const wasHovering = previousHovering.current;
    previousHovering.current = hovering;
    const shouldScramble = hovering || wasHovering;

    if (!shouldScramble || reducedMotion) {
      setDisplayText(text);
      setIsScrambling(false);
      return;
    }

    let iteration = 0;
    setIsScrambling(true);
    const timer = window.setInterval(() => {
      iteration += 1;
      setDisplayText(scramble(text, characters));
      if (iteration >= maxIterations) {
        window.clearInterval(timer);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, scrambleSpeed);

    return () => window.clearInterval(timer);
  }, [characters, hovering, maxIterations, reducedMotion, scrambleSpeed, text]);

  return (
    <span
      className={cn(
        "inline-block whitespace-pre-wrap",
        isScrambling ? scrambledClassName : className,
      )}
      onPointerEnter={() => active === undefined && setIsHovering(true)}
      onPointerLeave={() => active === undefined && setIsHovering(false)}
      aria-hidden={active !== undefined}
    >
      {displayText}
    </span>
  );
}
