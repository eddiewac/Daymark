// ── Theme manager ──────────────────────────────────────────────────────────
//
// Three theme modes:
//   - 'light'   — default crisp white interface
//   - 'comfort' — warmer cream tones, easier on eyes for long sessions
//   - 'system'  — match the OS preference (light or dark; for now we map any
//                 dark preference to light because dark theme isn't built yet)
//
// The chosen mode is persisted in localStorage and applied immediately on
// app start to avoid a flash of unthemed content. System preference is
// watched live so users who set 'system' get instant updates if they switch
// their OS theme.

const STORAGE_KEY = 'daymark-theme';

// Resolve a stored mode into the actual data-theme value to apply.
function resolveTheme(mode) {
  if (mode === 'kaspa') return 'kaspa';
  if (mode === 'comfort') return 'comfort';
  if (mode === 'light') return 'light';
  // 'system' or unrecognised → consult OS preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Dark theme not yet built; fall back to light when the system says dark.
    return prefersDark ? 'light' : 'light';
  }
  return 'light';
}

export function getStoredThemeMode() {
  // 1. URL param wins — `?theme=kaspa` (or any other registered theme)
  if (typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('theme');
      if (fromUrl === 'kaspa' || fromUrl === 'comfort' || fromUrl === 'light' || fromUrl === 'system') {
        // Persist URL choice so it survives navigation within the app
        try {
          localStorage.setItem(STORAGE_KEY, fromUrl);
        } catch {}
        return fromUrl;
      }
    } catch {}
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'comfort' || v === 'system' || v === 'kaspa') return v;
  } catch {}
  return 'light';
}

export function setStoredThemeMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

export function applyTheme(mode) {
  const resolved = resolveTheme(mode);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
  }
  return resolved;
}

// Call once at app startup to apply the saved theme + start watching system
// preference changes (so a user on 'system' sees live updates).
export function initThemeSystem() {
  const mode = getStoredThemeMode();
  applyTheme(mode);

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Only re-apply if the user has chosen 'system' — manual choices
      // shouldn't get overridden by OS changes.
      if (getStoredThemeMode() === 'system') {
        applyTheme('system');
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else if (mq.addListener) {
      // Safari < 14
      mq.addListener(handler);
    }
  }
}

// Switch to a new mode and persist. Returns the resolved theme name.
export function setThemeMode(mode) {
  setStoredThemeMode(mode);
  return applyTheme(mode);
}
