export type ThemeMode = 'light' | 'dark' | 'system'

export function getThemePreference(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('parlour_theme') as ThemeMode
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'dark'
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return
  localStorage.setItem('parlour_theme', theme)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
