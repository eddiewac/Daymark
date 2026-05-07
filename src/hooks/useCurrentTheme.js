import { useState, useEffect } from 'react';

// ── useCurrentTheme ─────────────────────────────────────────────────────────
// Reads the current data-theme attribute from <html> and re-renders when it
// changes. Use sparingly — most theme styling should go through CSS variables
// rather than JS-level theme detection. Reserved for cases where the JSX
// structure itself differs by theme (e.g. Kaspa's BlockDAG vs. light's train).

export function useCurrentTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  useEffect(() => {
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
