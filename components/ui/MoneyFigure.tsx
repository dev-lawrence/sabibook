import { formatNaira } from "@/lib/format";

type Tone = "ink" | "money" | "owed";
type Size = "sm" | "md" | "lg";

const tones: Record<Tone, string> = { ink: "text-ink", money: "text-money", owed: "text-owed" };
const sizes: Record<Size, string> = { sm: "text-base", md: "text-xl", lg: "text-3xl" };

/** An amount in naira, bold with aligned digits. Tone: ink, money (in) or owed (amber). */
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
    <span className={`tabular font-bold ${tones[tone]} ${sizes[size]} ${className}`}>
      {formatNaira(amount)}
    </span>
  );
}
