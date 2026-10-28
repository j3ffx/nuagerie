import {
  buildPlaceIndex,
  nearestPlace,
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
  onmessage: ((event: MessageEvent<PlaceRequest>) => void) | null;
  postMessage(message: PlaceResponse): void;
};

let index: Promise<PlaceIndex> | null = null;
const load = () =>
  (index ??= fetch(PLACES_URL).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return buildPlaceIndex(await response.text());
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
