import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useLocation, useSearchParams } from 'wouter';
import { useMediaIndex } from '../../data/dataContext.ts';
import type { MediaItem } from '../../data/model.ts';
import type { PhotoPlaces } from '../../data/places/photoPlaces.ts';
import { parseQuery } from '../../data/search/query.ts';
import {
  placesOf,
  searchItems,
  suggest,
  yearsOf,
  type PlaceHit,
  type SearchIndex,
  type SearchPlace,
} from '../../data/search/search.ts';
import { formatCount, formatItemCount } from '../../lib/format.ts';
import common from '../../ui/common.module.css';
import { CalendarIcon, ClockIcon, CloseIcon, MapIcon, SearchIcon } from '../../ui/icons.tsx';
import { IndexStatus } from '../../ui/IndexStatus.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';
import { Thumbnail } from '../../ui/Thumbnail.tsx';
import { PhotoBrowser } from '../viewer/PhotoBrowser.tsx';
import { useRecentSearches } from './recent.ts';
import styles from './SearchScreen.module.css';
import {
  describeTarget,
  isEmptyTarget,
  readTarget,
  targetHref,
  type SearchTarget,
} from './searchParams.ts';
import { useSearchIndex } from './useSearchIndex.ts';

type Go = (target: SearchTarget) => void;

/**
 * Finds photos by album, place and date. The search is in the URL
 * (`/recherche?q=…&album=…&lieu=…`), so Android's back button returns from
 * the results to the search, and the viewer opens on top as anywhere else.
 * While a new search is typed, suggestions replace the results.
 */
export function SearchScreen() {
  const index = useMediaIndex();
  const { search, places } = useSearchIndex();
  const [params] = useSearchParams();
  const target = readTarget(params);
  const href = targetHref(target);
  const [, navigate] = useLocation();
  const { recent, remember, forget } = useRecentSearches();

  // The field shows the search in the URL, until something else is typed.
  const [draft, setDraft] = useState(target.q);
  const [shown, setShown] = useState(href);
  if (shown !== href) {
    setShown(href);
    setDraft(target.q);
  }
  const typed = useDeferredValue(draft.trim());
  const input = useRef<HTMLInputElement>(null);

  const go = useCallback<Go>(
    (next) => {
      remember(next);
      navigate(targetHref(next));
      // A new search starts at the top, before the grid reads the scroll position.
      window.scrollTo(0, 0);
      input.current?.blur();
    },
    [navigate, remember],
  );

  const showResults = !isEmptyTarget(target) && draft.trim() === target.q;

  return (
    <>
      <ScreenHeader title="Recherche" />
      <IndexStatus />
      {index && search && (
        <>
          <form
            role="search"
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const q = draft.trim();
              if (q) go({ q, album: null, place: null });
            }}
          >
            <SearchIcon className={styles.formIcon} />
            <input
              ref={input}
              className={styles.input}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              // Opened from the bar to search: the keyboard comes up at once.
              autoFocus={isEmptyTarget(target)}
              aria-label="Rechercher un album, un lieu ou une date"
              placeholder="Album, lieu, date…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {draft && (
              <button
                type="button"
                className={styles.clear}
                aria-label="Effacer la recherche"
                onClick={() => {
                  setDraft('');
                  input.current?.focus();
                }}
              >
                <CloseIcon width={20} height={20} />
              </button>
            )}
          </form>
          <PlacesStatus places={places} items={index.items} />
          {showResults ? (
            <Results key={href} search={search} target={target} go={go} />
          ) : typed ? (
            <Suggestions search={search} text={typed} go={go} />
          ) : (
            <Start search={search} recent={recent} forget={forget} go={go} />
          )}
        </>
      )}
    </>
  );
}

/** The places are found on the device the first time: say so, and when they cannot be. */
function PlacesStatus({ places, items }: { places: PhotoPlaces; items: readonly MediaItem[] }) {
  if (places.pending) {
    return (
      <p className={`${common.muted} ${styles.status}`} role="status">
        Recherche des lieux de tes photos…
      </p>
    );
  }
  if (places.failed && places.known.size === 0 && items.some((item) => item.latitude !== null)) {
    return (
      <p className={`${common.muted} ${styles.status}`} role="status">
        Lieux indisponibles hors connexion : les albums et les dates marchent quand même.
      </p>
    );
  }
  return null;
}

/** A link to a search: navigates in place (scroll, recent searches), opens like a link otherwise. */
function TargetLink({
  target,
  go,
  className,
  label,
  children,
}: {
  target: SearchTarget;
  go: Go;
  className: string | undefined;
  label?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={targetHref(target)}
      className={className}
      aria-label={label}
      draggable={false}
      onClick={(event: MouseEvent) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        go(target);
      }}
    >
      {children}
    </a>
  );
}

const placeLabel = (place: SearchPlace) =>
  place.country ? `${place.name}, ${place.country}` : place.name;

function Row({
  target,
  go,
  cover,
  icon,
  title,
  detail,
}: {
  target: SearchTarget;
  go: Go;
  cover?: MediaItem | null;
  icon?: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <li>
      <TargetLink target={target} go={go} className={styles.row}>
        {cover ? (
          <Thumbnail item={cover} size="small" className={styles.rowCover} decorative />
        ) : (
          <span className={styles.rowIcon} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>
            {title}
            <span className="hidden-inline">, </span>
          </span>
          <span className={styles.rowDetail}>{detail}</span>
        </span>
      </TargetLink>
    </li>
  );
}

function Chip({
  target,
  go,
  text,
  count,
}: {
  target: SearchTarget;
  go: Go;
  text: string;
  count: number;
}) {
  return (
    <li>
      {/* Read as "Lyon, 821 éléments": what is read is what is shown, and a little more. */}
      <TargetLink target={target} go={go} className={styles.chip}>
        {/* The comma sits inside the name: between two flex items, a space would come first. */}
        <span>
          {text}
          <span className="hidden-inline">, </span>
        </span>
        <span className={styles.chipCount}>
          {formatCount(count)}
          <span className="hidden-inline"> {count > 1 ? 'éléments' : 'élément'}</span>
        </span>
      </TargetLink>
    </li>
  );
}

const MAX_CHIPS = 12;

function PlaceChips({
  hits,
  go,
  base,
  title,
  scroll,
}: {
  hits: readonly PlaceHit[];
  go: Go;
  base: SearchTarget;
  title: string;
  scroll: boolean;
}) {
  if (hits.length === 0) return null;
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <ul className={scroll ? styles.chipScroller : styles.chips}>
        {hits.slice(0, MAX_CHIPS).map((hit) => (
          <Chip
            key={hit.place.key}
            target={{ ...base, place: hit.place.key }}
            go={go}
            text={hit.place.name}
            count={hit.count}
          />
        ))}
      </ul>
    </section>
  );
}

/** Before anything is typed: the last searches, then places and years to start from. */
function Start({
  search,
  recent,
  forget,
  go,
}: {
  search: SearchIndex;
  recent: readonly SearchTarget[];
  forget: () => void;
  go: Go;
}) {
  const { items } = search.index;
  const { towns, countries } = useMemo(() => placesOf(search, items), [search, items]);
  const years = useMemo(() => yearsOf(items), [items]);
  const labelled = recent
    .map((target) => ({ target, label: describeTarget(search, target) }))
    .filter((entry) => entry.label !== '');
  const none: SearchTarget = { q: '', album: null, place: null };

  return (
    <div className={styles.start}>
      {labelled.length > 0 ? (
        <section className={styles.section} aria-labelledby="search-recent">
          <div className={styles.sectionHeader}>
            <h2 id="search-recent" className={styles.sectionTitle}>
              Récentes
            </h2>
            <button type="button" className={styles.forget} onClick={forget}>
              Effacer
            </button>
          </div>
          <ul className={styles.rows}>
            {labelled.map(({ target, label }) => (
              <Row
                key={targetHref(target)}
                target={target}
                go={go}
                icon={<ClockIcon />}
                title={label}
                detail="Recherche récente"
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className={`${common.muted} ${styles.hint}`}>
          Cherche un album, une ville, un pays ou une date : « Lyon », « juillet 2024 », « été 2023
          »… Tu peux les combiner.
        </p>
      )}
      <PlaceChips hits={towns} go={go} base={none} title="Lieux" scroll={false} />
      <PlaceChips hits={countries} go={go} base={none} title="Pays" scroll={false} />
      {years.length > 0 && (
        <section className={styles.section} aria-label="Années">
          <h2 className={styles.sectionTitle}>Années</h2>
          <ul className={styles.chips}>
            {years.map(({ year, count }) => (
              <Chip
                key={year}
                target={{ ...none, q: String(year) }}
                go={go}
                text={String(year)}
                count={count}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** While typing: everything that fits, then the albums and places whose name fits. */
function Suggestions({ search, text, go }: { search: SearchIndex; text: string; go: Go }) {
  const query = useMemo(() => parseQuery(text), [text]);
  const found = useMemo(() => suggest(search, query), [search, query]);
  const total = useMemo(() => searchItems(search, query), [search, query]);
  const period = found.inPeriod && query.date ? query.date : null;
  const within = (count: number) =>
    period ? `${period.label} · ${formatItemCount(count)}` : formatItemCount(count);
  const onlyDate = query.date !== null && query.terms.length === 0;
  const places = [...found.towns, ...found.countries];

  if (total.length === 0 && found.albums.length === 0 && places.length === 0) {
    return (
      <div className={styles.start}>
        <p className={`${common.muted} ${styles.hint}`} role="status">
          Rien ne correspond à « {text} ». Essaie un album, une ville, un pays ou une date («
          juillet 2024 », « été 2023 »).
        </p>
      </div>
    );
  }

  return (
    <div className={styles.start}>
      {total.length > 0 && (
        <ul className={styles.rows}>
          <Row
            target={{ q: text, album: null, place: null }}
            go={go}
            icon={onlyDate ? <CalendarIcon /> : <SearchIcon />}
            title={onlyDate && query.date ? query.date.label : `Tout pour « ${text} »`}
            detail={formatItemCount(total.length)}
          />
        </ul>
      )}
      {found.albums.length > 0 && (
        <section className={styles.section} aria-labelledby="search-albums">
          <h2 id="search-albums" className={styles.sectionTitle}>
            Albums
          </h2>
          <ul className={styles.rows}>
            {found.albums.map((hit) => (
              <Row
                key={hit.id}
                target={{ q: period?.query ?? '', album: hit.id, place: null }}
                go={go}
                cover={hit.cover}
                title={hit.name}
                detail={
                  hit.parents.length > 0
                    ? `${hit.parents.join(' › ')} · ${within(hit.count)}`
                    : within(hit.count)
                }
              />
            ))}
          </ul>
        </section>
      )}
      {places.length > 0 && (
        <section className={styles.section} aria-labelledby="search-places">
          <h2 id="search-places" className={styles.sectionTitle}>
            Lieux
          </h2>
          <ul className={styles.rows}>
            {places.map((hit) => (
              <Row
                key={hit.place.key}
                target={{ q: period?.query ?? '', album: null, place: hit.place.key }}
                go={go}
                cover={hit.cover}
                title={placeLabel(hit.place)}
                detail={within(hit.count)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The items of a search, with what narrows it: its album and place, and the places in it. */
function Results({ search, target, go }: { search: SearchIndex; target: SearchTarget; go: Go }) {
  const query = useMemo(() => parseQuery(target.q), [target.q]);
  const items = useMemo(
    () => searchItems(search, query, { albumId: target.album, place: target.place }),
    [search, query, target.album, target.place],
  );
  const inside = useMemo(() => placesOf(search, items), [search, items]);
  const albumName = target.album ? search.index.folders.get(target.album)?.name : null;
  const place = target.place ? search.places.get(target.place) : null;
  // Countries when the results span several, then the towns of the one chosen.
  const narrowing =
    !target.place && inside.countries.length > 1
      ? { hits: inside.countries, title: 'Pays dans ces résultats' }
      : !target.place || (target.place.startsWith('p:') && inside.towns.length > 1)
        ? { hits: inside.towns, title: 'Lieux dans ces résultats' }
        : null;

  return (
    <>
      {(albumName || target.place) && (
        <ul className={styles.filters} aria-label="Filtres de la recherche">
          {albumName && (
            <li>
              <TargetLink
                target={{ ...target, album: null }}
                go={go}
                className={styles.filter}
                label={`Retirer l’album ${albumName}`}
              >
                <span className={styles.filterText}>{albumName}</span>
                <CloseIcon width={16} height={16} />
              </TargetLink>
            </li>
          )}
          {target.place && (
            <li>
              <TargetLink
                target={{ ...target, place: null }}
                go={go}
                className={styles.filter}
                label={`Retirer le lieu ${place ? placeLabel(place) : ''}`}
              >
                <MapIcon width={16} height={16} />
                <span className={styles.filterText}>{place ? placeLabel(place) : 'Lieu'}</span>
                <CloseIcon width={16} height={16} />
              </TargetLink>
            </li>
          )}
        </ul>
      )}
      <p className={`${common.muted} ${styles.summary}`}>
        {formatItemCount(items.length)}
        {query.date && ` · ${query.date.label}`}
      </p>
      {narrowing && (
        <PlaceChips hits={narrowing.hits} go={go} base={target} title={narrowing.title} scroll />
      )}
      {items.length === 0 ? (
        <div className={common.page}>
          <div className={`${common.card} ${common.stack}`}>
            <p>Aucune photo ne correspond.</p>
            <p className={common.muted}>Retire un filtre ou essaie d’autres mots.</p>
          </div>
        </div>
      ) : (
        <PhotoBrowser items={items} label="Résultats de la recherche" />
      )}
    </>
  );
}
