// Theme management utility for light/dark mode switching

const THEME_STORAGE_KEY = 'hilm-theme';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

export type Theme = typeof THEME_DARK | typeof THEME_LIGHT;

/**
 * Get the current theme from localStorage or default to dark
 */
export function getTheme(): Theme {
  if (typeof window === 'undefined') return THEME_DARK;
  
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === THEME_LIGHT || stored === THEME_DARK) {
    return stored;
  }
  
  // Default to dark mode
  return THEME_DARK;
}

/**
 * Set the theme and save to localStorage
 */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Apply the theme to the HTML element
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  if (theme === THEME_DARK) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  
  // Update meta theme-color for mobile browsers
  updateThemeColor(theme);
}

/**
 * Update the meta theme-color tag
 */
function updateThemeColor(theme: Theme): void {
  if (typeof document === 'undefined') return;
  
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    document.head.appendChild(metaThemeColor);
  }
  
  metaThemeColor.setAttribute('content', theme === THEME_DARK ? '#000000' : '#ffffff');
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): Theme {
  const currentTheme = getTheme();
  const newTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  setTheme(newTheme);
  return newTheme;
}

/**
 * Initialize theme on page load (should be called inline in <head>)
 */
export function initTheme(): void {
  if (typeof document === 'undefined') return;
  
  const theme = getTheme();
  applyTheme(theme);
}

