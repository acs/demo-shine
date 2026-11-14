// User preferences persisted to localStorage.

const KEY = { theme: 'orbit_theme' } as const;

export interface Prefs {
  theme: string | null;
}

export function savePrefs(): void {
  try {
    localStorage.setItem(KEY.theme, document.documentElement.dataset.theme ?? 'dark');
  } catch { /* storage unavailable */ }
}

export function loadPrefs(): Prefs {
  try {
    return { theme: localStorage.getItem(KEY.theme) };
  } catch {
    return { theme: null };
  }
}
