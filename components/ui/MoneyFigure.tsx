import { formatNaira } from "@/lib/format";

type Tone = "ink" | "money" | "owed";
type Size = "sm" | "row" | "md" | "lg" | "xl";

const tones: Record<Tone, string> = { ink: "text-ink", money: "text-money", owed: "text-owed" };
const sizes: Record<Size, string> = {
  sm: "text-base",
  row: "text-[1.0625rem]",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-[2.5rem] leading-none tracking-[-0.02em]",
};

/** An amount in naira, semibold with aligned digits. Tone: ink, money (in) or owed (amber). */
export function MoneyFigure({
  amount,
  tone = "ink",
  size = "md",
  className = "",
}: {
  amount: number | null | undefined;
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  return (
    <span className={`tabular font-semibold transition-colors duration-150 ${tones[tone]} ${sizes[size]} ${className}`}>
      {formatNaira(amount)}
    </span>
  );
}
