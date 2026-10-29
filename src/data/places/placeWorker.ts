import {
  buildPlaceIndex,
  nearestPlace,
  parsePlaceNames,
  PLACE_NAME_LANGUAGES,
  placeNamesUrl,
  PLACES_URL,
  type Place,
  type PlaceIndex,
} from './placeIndex.ts';

/** Loads and indexes the place list off the main thread (half a second on a phone). */

export type PlaceRequest =
  | { requestId: number; latitude: number; longitude: number }
  /** Many photos at once: latitude, longitude, latitude, longitude… */
  | { requestId: number; points: Float64Array };

export type PlaceResponse =
  | { requestId: number; place: Place | null }
  | { requestId: number; places: (Place | null)[] }
  | { requestId: number; error: string };

// Typed by hand: the app is compiled with the DOM library, not the worker one.
const scope = self as unknown as {
  /** The interface's language, given as the worker's name (src/data/places/places.ts). */
  name: string;
  onmessage: ((event: MessageEvent<PlaceRequest>) => void) | null;
  postMessage(message: PlaceResponse): void;
};

/** Names in the language; without them (English, offline), the list's own names. */
const localNames = async (): Promise<Map<number, string>> => {
  if (!PLACE_NAME_LANGUAGES.includes(scope.name)) return new Map();
  try {
    const response = await fetch(placeNamesUrl(scope.name));
    return response.ok ? parsePlaceNames(await response.text()) : new Map();
  } catch {
    return new Map();
  }
};

let index: Promise<PlaceIndex> | null = null;
const load = () =>
  (index ??= Promise.all([fetch(PLACES_URL), localNames()]).then(async ([response, names]) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return buildPlaceIndex(await response.text(), names);
  }));

scope.onmessage = (event) => {
  const request = event.data;
  const { requestId } = request;
  load().then(
    (places) => {
      if ('points' in request) {
        const { points } = request;
        const found: (Place | null)[] = [];
        for (let i = 0; i + 1 < points.length; i += 2) {
          found.push(nearestPlace(places, points[i] ?? 0, points[i + 1] ?? 0));
        }
        scope.postMessage({ requestId, places: found });
      } else {
        scope.postMessage({
          requestId,
          place: nearestPlace(places, request.latitude, request.longitude),
        });
      }
    },
    (error: unknown) => {
      index = null; // try again next time (offline now, maybe not later)
      scope.postMessage({ requestId, error: String(error) });
    },
  );
};
