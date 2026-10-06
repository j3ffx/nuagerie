import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

/**
 * Opening a screen starts at the top; going back keeps the browser's own
 * scroll restoration (the index is in memory, so the page renders at once).
 */
export function useScrollToTop() {
  const [location] = useLocation();
  const back = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      back.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (back.current) back.current = false;
    else window.scrollTo(0, 0);
  }, [location]);
}
