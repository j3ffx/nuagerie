import {
  buildPlaceIndex,
  nearestPlace,
  PLACES_URL,
  type Place,
  type PlaceIndex,
} from './placeIndex.ts';

/** Loads and indexes the place list off the main thread (half a second on a phone). */

export interface PlaceRequest {
  requestId: number;
  latitude: number;
  longitude: number;
}

export type PlaceResponse =
  { requestId: number; place: Place | null } | { requestId: number; error: string };

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
  const { requestId, latitude, longitude } = event.data;
  load().then(
    (places) => scope.postMessage({ requestId, place: nearestPlace(places, latitude, longitude) }),
    (error: unknown) => {
      index = null; // try again next time (offline now, maybe not later)
      scope.postMessage({ requestId, error: String(error) });
    },
  );
};
