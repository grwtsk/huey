// Keep the existing admitted reader/evidence runtime isolated from the new
// editorial traversal. No URL chooses an access grant or changes admission.
if (location.pathname === '/huey' || location.pathname.startsWith('/huey/')) {
  await import('./traversal-browser.mjs');
} else {
  const reader = await import('./main.mjs');
  await import('./editor.mjs');
  if (import.meta.env?.MODE === 'editorial') {
    try {
      const response = await fetch('/data/paragraphs.json', { cache: 'no-store', credentials: 'omit' });
      if (response.ok) reader.enableStableParagraphLinks(await response.json());
    } catch { /* Existing admitted evidence remains usable without a reconciled bridge. */ }
  }
}
