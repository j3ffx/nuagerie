/** Height of the sticky screen header (safe area included); content under it is hidden. */
export function stickyHeaderHeight(): number {
  const header = document.querySelector<HTMLElement>('[data-screen-header]');
  return header ? header.getBoundingClientRect().height : 56;
}
