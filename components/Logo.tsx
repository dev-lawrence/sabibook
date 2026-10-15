/** The SabiBook mark: a record dot, then lines of writing. You say it, it gets written down. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden className={className}>
      <rect width="512" height="512" rx="116" fill="#2b2118" />
      <g transform="translate(256 256) scale(1.15) translate(-256 -256)" fill="#f7f0e1">
        <circle cx="190" cy="190" r="42" fill="#c4472f" />
        <rect x="266" y="175" width="98" height="30" rx="15" />
        <rect x="148" y="255" width="216" height="30" rx="15" />
        <rect x="148" y="335" width="152" height="30" rx="15" />
      </g>
    </svg>
  );
}

/** Mark plus wordmark, for page headers. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-lg font-semibold tracking-[-0.02em] text-ink ${className}`}>
      <LogoMark size={28} />
      SabiBook
    </span>
  );
}
