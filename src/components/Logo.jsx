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

  // In Kaspa theme: text is dark teal (on pale teal bg), accent is deeper Kaspa teal,
  // and the "k" in Daymark is rendered as a backwards K.
  const finalTextColor = isKaspa
    ? '#0f2e2a'
    : inverted
    ? '#fff'
    : textColor;
  const finalAccent = isKaspa ? '#3a9b8e' : (inverted ? '#fff' : color);
  const finalCheckColor = isKaspa ? '#ffffff' : (inverted ? color : checkColor);

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
            Kaspa-style K — MIRRORED orientation (vertical stem on the RIGHT,
            diagonals fanning to the LEFT). This matches the actual Kaspa
            brand identity. Three angular elements forming a stylised
            backwards K with sharp diagonals (suggesting block confirmation).

            Composition (mirrored from a normal K):
              - Vertical stem on the right
              - Upper diagonal "block" angling out to the upper-left
              - Lower diagonal "block" angling out to the lower-left
            Both diagonals have sharp inner edges meeting at a central point.

            Position: pulled in close to "Daymar" so there's no gap.
          */}
          <g transform="translate(395, 22)">
            {/* Right-side vertical stem */}
            <rect x="42" y="0" width="11" height="60" fill={finalTextColor} />

            {/* Upper diagonal — angular, fans up and to the left */}
            <polygon
              points="42,30 42,18 15,0 3,0 31,28"
              fill={finalTextColor}
            />

            {/* Lower diagonal — angular, fans down and to the left */}
            <polygon
              points="42,30 42,42 15,60 3,60 31,32"
              fill={finalTextColor}
            />

            {/* Small teal accent dot at the K's pivot point — block confirmation indicator */}
            <circle cx="39" cy="30" r="3" fill="#3a9b8e" opacity="0.9">
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
