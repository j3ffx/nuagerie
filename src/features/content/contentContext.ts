import { createContext, useContext } from 'react';
import type { ContentSearch, ContentState } from '../../data/content/contentSearch.ts';

export interface ContentContextValue {
  state: ContentState;
  search: ContentSearch;
  /** Words can be searched in the photos: turned on, and some photos have a vector. */
  available: boolean;
}

export const ContentContext = createContext<ContentContextValue | null>(null);

export function useContentSearch(): ContentContextValue {
  const value = useContext(ContentContext);
  if (!value) throw new Error('useContentSearch() must be used inside <ContentProvider>');
  return value;
}
