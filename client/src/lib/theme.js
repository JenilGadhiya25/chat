const THEME_KEY = "darkMode";
const THEME_EVENT = "theme:change";

export function isDarkModeEnabled() {
  return localStorage.getItem(THEME_KEY) === "true";
}

export function applyTheme(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem(THEME_KEY, String(isDark));
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { isDark } }));
}

export function initTheme() {
  const isDark = isDarkModeEnabled();
  document.documentElement.classList.toggle("dark", isDark);
  return isDark;
}

export function subscribeTheme(handler) {
  const onThemeEvent = (event) => {
    handler(Boolean(event.detail?.isDark));
  };

  const onStorage = (event) => {
    if (event.key === THEME_KEY) {
      handler(event.newValue === "true");
    }
  };

  window.addEventListener(THEME_EVENT, onThemeEvent);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, onThemeEvent);
    window.removeEventListener("storage", onStorage);
  };
}
