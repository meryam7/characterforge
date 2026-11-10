// Applies the saved theme before the first paint (no flash). External file because the CSP forbids inline scripts.
// Must stay in sync with src/lib/theme.ts (storage key + values).
;(function () {
  var mode = 'dark'
  try {
    mode = localStorage.getItem('charaforge_theme') || 'dark'
  } catch (e) {}
  var light = mode === 'light' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark')
})()
