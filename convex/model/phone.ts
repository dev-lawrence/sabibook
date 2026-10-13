/**
 * Turn what a trader types into international Nigerian digits, for wa.me links.
 * "0803 123 4567" -> "2348031234567". Returns null when it cannot be a phone number.
 */
export function normalizeNigerianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("234")) {
    // "+234 (0) 803..." typed with the trunk zero still in
    if (digits.startsWith("2340") && digits.length === 14) digits = "234" + digits.slice(4);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = "234" + digits.slice(1);
  } else if (digits.length === 10) {
    digits = "234" + digits;
  }
  // Other countries' numbers pass through if they look plausible.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}
