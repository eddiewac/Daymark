// ── Daymark logo components ────────────────────────────────────────────────
//
// Hand-built SVGs matching the chosen Sharp-Cut + Subtle-Check direction:
// an asymmetric D (flat back, rounded front, with a sharp diagonal cut on
// the bottom-right corner) in primary purple, with a check that bleeds out
// past the right edge of the D.
//
// Three exports for different contexts:
//   <DaymarkSymbol />      — symbol only (the D-shape with check)
//   <DaymarkWordmark />    — symbol + "Daymark" text
//   <DaymarkFavicon />     — symbol optimised for tiny sizes (no check, simpler form)

const PURPLE = 'var(--accent)';

// Internal: the D-with-check shape inside an svg.
// The check's tail extends past the D's right edge into negative space — to
// achieve that visually, we draw two layered checks:
//   1. the white check inside the D (shows on top of the purple fill)
//   2. a coloured continuation of the check OUTSIDE the D (shows on the bg)
// Both halves are part of one path — the bit inside the D is white, the bit
// outside is in the same purple as the D, so it reads as one continuous tick
// on a white page.
function DSymbol({ color = PURPLE, checkColor = '#fff', showCheck = true }) {
  return (
    <>
      {/*
        The D shape:
          - Flat left edge (x = 8, y = 8 → 92)
          - Rounded right edge (a half-circle bowing out to the right)
          - Bottom-right corner has a sharp diagonal cut
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
      {/*
        White check inside the D. Lower position, thinner stroke, shorter
        left arm, longer right arm reaching to the D's edge.
      */}
      {showCheck && (
        <path
          d="M 32 64 L 44 76 L 88 32"
          stroke={checkColor}
          strokeWidth={6}
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
      style={{ overflow: 'visible' }}
    >
      <DSymbol color={color} checkColor={checkColor} showCheck />
    </svg>
  );
}

// ── Hook: read current data-theme and re-render on changes ────────────────
import { useCurrentTheme } from '../hooks/useCurrentTheme.js';

// ── Wordmark — D-symbol + "Daymark" text. Width auto from height. ──────────
export function DaymarkWordmark({
  height = 28,
  color = PURPLE,
  textColor = '#0f172a',
  checkColor = '#fff',
  inverted = false,
}) {
  const theme = useCurrentTheme();
  const isKaspa = theme === 'kaspa';

  // In Kaspa theme: text is light (on dark bg), accent is Kaspa teal,
  // and the "k" in Daymark is rendered as a backwards K.
  const finalTextColor = isKaspa
    ? '#e6edf3'
    : inverted
    ? '#fff'
    : textColor;
  const finalAccent = isKaspa ? '#70c7ba' : (inverted ? '#fff' : color);
  const finalCheckColor = isKaspa ? '#0d1117' : (inverted ? color : checkColor);

  return (
    <svg
      height={height}
      viewBox="0 0 540 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Daymark"
      style={{ display: 'block' }}
    >
      <DSymbol
        color={finalAccent}
        checkColor={finalCheckColor}
        showCheck
      />
      {isKaspa ? (
        // "Daymar" as text, then a Kaspa-style angular K
        <>
          <text
            x={120}
            y={74}
            fontFamily="'Roboto Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontSize={72}
            fontWeight={600}
            fill={finalTextColor}
            letterSpacing={-1}
          >
            Daymar
          </text>
          {/*
            Kaspa-style K — three angular elements forming a stylised K with
            sharp diagonals (suggesting block confirmation). Drawn as filled
            shapes with a teal gradient feel, matching Kaspa's branding.

            Composition:
              - Vertical stem on the left
              - Upper-right diagonal "block" angling out and up
              - Lower-right diagonal "block" angling out and down
            Both diagonals have sharp inner edges that meet at a central point.
          */}
          <g transform="translate(440, 22)">
            {/* Left vertical stem */}
            <rect x="0" y="0" width="11" height="60" fill={finalTextColor} />

            {/* Upper diagonal — angular, like a confirmed block */}
            <polygon
              points="11,30 11,18 38,0 50,0 22,28"
              fill={finalTextColor}
            />

            {/* Lower diagonal — angular, mirroring the upper */}
            <polygon
              points="11,30 11,42 38,60 50,60 22,32"
              fill={finalTextColor}
            />

            {/* Small teal accent dot at the K's pivot point — block confirmation indicator */}
            <circle cx="14" cy="30" r="3" fill="#70c7ba" opacity="0.9">
              <animate
                attributeName="opacity"
                values="0.9;0.4;0.9"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </>
      ) : (
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
      )}
    </svg>
  );
}

// ── Favicon-optimised symbol — simpler, no check (won't read at 16px). ──
export function DaymarkFavicon({ size = 32, color = PURPLE, checkColor = '#fff' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Daymark"
    >
      <rect width={100} height={100} rx={22} fill={color} />
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
