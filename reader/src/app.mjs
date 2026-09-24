// Keep the existing admitted reader/evidence runtime isolated from the new
// editorial traversal. No URL chooses an access grant or changes admission.
if (location.pathname === '/huey' || location.pathname.startsWith('/huey/')) {
  await import('./traversal-browser.mjs');
} else {
  await import('./main.mjs');
  await import('./editor.mjs');
}
