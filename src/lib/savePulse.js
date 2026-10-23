// Top-bar save pill. Chase, resolve, advance, comms, and convert dispatch this
// so “Saving… / Saved” sits in the top bar — never under the floating notepad.

export function pulseSave() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('daymark-save', { detail: { phase: 'saving' } }));
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('daymark-save', { detail: { phase: 'saved' } }));
  }, 520);
}
