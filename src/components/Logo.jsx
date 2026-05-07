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

const PURPLE = '#534AB7';

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
import { useState as useStateHook, useEffect as useEffectHook } from 'react';

function useCurrentTheme() {
  const [theme, setTheme] = useStateHook(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  useEffectHook(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(html.getAttribute('data-theme') || 'light');
    });
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

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
        // "Daymar" as text, then a hand-drawn backwards K
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
            Backwards K — drawn as a single filled path on the right.
            Composed of three strokes, mirrored horizontally vs a normal K:
              - vertical stem on the RIGHT (instead of left)
              - upper diagonal going from top-right down to mid-right
              - lower diagonal going from mid-right down to bottom-right
            Positioning: place after "Daymar" which ends at roughly x=440 at 72px.
          */}
          <g transform="translate(440, 22)">
            {/* Right-side vertical stem of the K */}
            <rect x="42" y="0" width="10" height="60" fill={finalTextColor} />
            {/* Upper diagonal — top-left to middle-right */}
            <polygon
              points="42,30 12,0 0,0 36,30"
              fill={finalTextColor}
            />
            {/* Lower diagonal — middle-right to bottom-left */}
            <polygon
              points="42,30 12,60 0,60 36,30"
              fill={finalTextColor}
            />
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
