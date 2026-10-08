/** Height of the sticky screen header (safe area included); content under it is hidden. */
export function stickyHeaderHeight(): number {
  const header = document.querySelector<HTMLElement>('[data-screen-header]');
  return header ? header.getBoundingClientRect().height : 56;
}

/** Top of the bar fixed at the bottom of the screen (navigation on a phone); the window's height when there is none. */
export function bottomBarTop(): number {
  const nav = document.querySelector<HTMLElement>('[data-bottom-bar]');
  if (!nav) return window.innerHeight;
  const top = nav.getBoundingClientRect().top;
  // On a wide screen the navigation is a rail on the left: nothing covers the bottom.
  return top > window.innerHeight / 2 ? top : window.innerHeight;
}
