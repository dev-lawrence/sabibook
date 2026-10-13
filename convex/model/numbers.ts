// Pulls every number a trader said out of a transcript, whether it was
// spoken ("forty five thousand"), shortened ("45k", "two k") or written
// ("45,000", "₦5000"). Used to check that the model never invents amounts.

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, a: 1, an: 1,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

const SCALES: Record<string, number> = {
  thousand: 1_000, k: 1_000, million: 1_000_000, m: 1_000_000,
  milli: 1_000_000, billion: 1_000_000_000,
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/[₦]/g, " ")
    .replace(/\bn(?=\d)/g, " ")
    .replace(/(\d)(k|m)\b/g, "$1 $2")
    .replace(/[^a-z0-9.\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/\.$/, ""))
    .filter(Boolean);
}

/** Every distinct number spoken or written in the text, in order. */
export function extractSpokenNumbers(text: string): number[] {
  const tokens = tokenize(text);
  const found: number[] = [];

  let total = 0;
  let current = 0;
  let active = false;
  let lastWasScale = false;
  let lastScale = 0;

  const flush = () => {
    if (active) found.push(total + current);
    total = 0;
    current = 0;
    active = false;
    lastWasScale = false;
    lastScale = 0;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];

    if (/^\d+(\.\d+)?$/.test(tok)) {
      // "45 thousand" continues, "45 50" starts a new number.
      if (active && !lastWasScale) flush();
      current += parseFloat(tok);
      active = true;
      lastWasScale = false;
      continue;
    }

    // "a" and "an" only count as one before a scale word: "a thousand".
    if ((tok === "a" || tok === "an") && !(next && (next === "hundred" || next in SCALES))) {
      flush();
      continue;
    }

    if (tok in UNITS) {
      if (active && !lastWasScale && current % 10 !== 0) flush();
      current += UNITS[tok];
      active = true;
      lastWasScale = false;
      continue;
    }
    if (tok in TENS) {
      if (active && !lastWasScale && current % 100 !== 0) flush();
      current += TENS[tok];
      active = true;
      lastWasScale = false;
      continue;
    }
    if (tok === "hundred" && active) {
      current = (current || 1) * 100;
      lastWasScale = true;
      lastScale = 100;
      continue;
    }
    const afterNext = tokens[i + 2];
    if (
      tok === "half" &&
      next &&
      (next in SCALES || ((next === "a" || next === "an") && afterNext in SCALES))
    ) {
      if (!(next in SCALES)) i++;
      current += 0.5;
      active = true;
      lastWasScale = false;
      continue;
    }
    if (tok === "point" && active && next && (next in UNITS || /^\d+$/.test(next))) {
      const digit = next in UNITS ? UNITS[next] : parseInt(next, 10);
      current += digit / Math.pow(10, String(digit).length);
      i++;
      continue;
    }
    if (tok in SCALES && active) {
      // "m" alone is too ambiguous unless it follows a number directly.
      total += (current || 1) * SCALES[tok];
      current = 0;
      lastWasScale = true;
      lastScale = SCALES[tok];
      continue;
    }
    // "one hundred and five" and "one thousand and five hundred" are one
    // number, but "fifty thousand and two jerrycans" is two things.
    if (tok === "and" && active && (lastScale === 100 || afterNext === "hundred")) continue;

    flush();
  }
  flush();

  return [...new Set(found.map((n) => Math.round(n * 100) / 100))];
}

/**
 * True when `amount` can be traced back to what was said: it was spoken
 * directly, or it is a spoken quantity times a spoken unit price, or a sum
 * or difference of other grounded amounts.
 */
export function isGrounded(
  amount: number,
  heard: number[],
  derived: number[] = [],
): boolean {
  // Traders often drop the scale on a second figure: "forty five thousand,
  // she paid thirty five" means 35,000. Accept that reading when a larger
  // figure was spoken in the same breath.
  const hasThousands = heard.some((n) => n >= 1000);
  const spoken = hasThousands
    ? [...heard, ...heard.filter((n) => n < 1000).map((n) => n * 1000)]
    : heard;
  const pool = [...spoken, ...derived];
  if (pool.includes(amount)) return true;
  for (const a of spoken) {
    for (const b of spoken) {
      if (a * b === amount) return true;
    }
  }
  for (const a of pool) {
    for (const b of pool) {
      if (a + b === amount || a - b === amount) return true;
    }
  }
  return false;
}
