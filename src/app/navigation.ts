import type { AroundNavHandler } from 'wouter';

/**
 * Opening a screen starts at the top; going back keeps the browser's own
 * scroll restoration (the index is in memory, so the page renders at once).
 *
 * The scroll is reset right after the URL changes and before React renders
 * the new screen: a photo grid reads the scroll position when it mounts, so
 * a reset made later (in an effect) would be undone by the grid. The old
 * history entry has already kept its position for the way back. Changes of
 * the query alone (the viewer's `?photo=`) keep the scroll.
 */
export const scrollToTopOnNewScreen: AroundNavHandler = (navigate, to, options) => {
  const from = window.location.pathname;
  navigate(to, options);
  if (window.location.pathname !== from) window.scrollTo(0, 0);
};
