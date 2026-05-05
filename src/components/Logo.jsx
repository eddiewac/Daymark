// ── Daymark logo components ────────────────────────────────────────────────
//
// Hand-built SVGs matching the chosen Sharp-Cut + Subtle-Check direction:
// an asymmetric D (flat back, rounded front, with a sharp diagonal cut on
// the bottom-right corner) in primary purple, with a subtle white check inside.
//
// Three exports for different contexts:
//   <DaymarkSymbol />      — symbol only (the D-shape with check)
//   <DaymarkWordmark />    — symbol + "Daymark" text
//   <DaymarkFavicon />     — symbol optimised for tiny sizes (no check, simpler form)
//
// All are pure SVG — no external dependencies, scale to any size via the
// `size` (or `height`) prop.

const PURPLE = '#534AB7';

// Internal: just the D-with-check shape. viewBox 0 0 100 100.
function DSymbol({ color = PURPLE, checkColor = '#fff', showCheck = true }) {
  return (
    <>
      {/*
        The D shape:
          - Flat left edge (x = 8, y = 8 → 92)
          - Rounded right edge (a half-circle bowing out to the right)
          - Bottom-right corner has a sharp diagonal cut (clipped from
            roughly the bottom-right toward the lower-middle)
      */}
      <path
        d="
          M 12 8
          L 56 8
          C 76 8, 92 24, 92 50
          L 92 64
          L 70 92
          L 12 92
          Z
        "
        fill={color}
      />
      {/* Subtle check, only on the symbol variants (not the favicon) */}
      {showCheck && (
        <path
          d="M 26 54 L 42 70 L 70 36"
          stroke={checkColor}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </>
  );
}

// ── Symbol only — for app icons, avatars, etc. ─────────────────────────────
export function DaymarkSymbol({ size = 32, color, checkColor }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Daymark"
    >
      <DSymbol color={color} checkColor={checkColor} showCheck />
    </svg>
  );
}

// ── Wordmark — D-symbol + "Daymark" text. Width auto from height. ──────────
export function DaymarkWordmark({
  height = 28,
  color = PURPLE,
  textColor = '#0f172a', // dark slate so it works on light bg by default
  checkColor = '#fff',
  inverted = false, // when true, white-on-dark — text becomes white
}) {
  // viewBox is fixed; consumer scales via height.
  // 100 wide D + 16 gap + ~280 wide text → 396 wide for ~100 tall layout
  // We keep some side padding and a baseline-aligned text block.
  const finalTextColor = inverted ? '#fff' : textColor;
  return (
    <svg
      height={height}
      viewBox="0 0 396 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Daymark"
      style={{ display: 'block' }}
    >
      <DSymbol
        color={inverted ? '#fff' : color}
        checkColor={inverted ? color : checkColor}
        showCheck
      />
      <text
        x={120}
        y={74}
        fontFamily="'Roboto Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize={72}
        fontWeight={600}
        fill={finalTextColor}
        letterSpacing={-1}
      >
        Daymark
      </text>
    </svg>
  );
}

// ── Favicon-optimised symbol — slightly thicker, no check (won't read at 16px). ──
export function DaymarkFavicon({ size = 32, color = PURPLE, checkColor = '#fff' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Daymark"
    >
      {/* Square background for app-icon contexts (slight rounding) */}
      <rect width={100} height={100} rx={22} fill={color} />
      {/* The D-shape inverted to white inside the square, no check at this size */}
      <path
        d="
          M 26 22
          L 56 22
          C 70 22, 80 32, 80 48
          L 80 58
          L 66 78
          L 26 78
          Z
        "
        fill={checkColor}
      />
    </svg>
  );
}

export default DaymarkWordmark;
