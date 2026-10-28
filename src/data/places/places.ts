import type { Place } from './placeIndex.ts';
import type { PlaceRequest, PlaceResponse } from './placeWorker.ts';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (answer: PlaceResponse) => void; reject: (e: Error) => void }
>();
/** Answers by rounded coordinates (about 100 m): photos of one outing share them. */
const answers = new Map<string, Promise<Place | null>>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./placeWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<PlaceResponse>) => {
      const request = pending.get(event.data.requestId);
      if (!request) return;
      pending.delete(event.data.requestId);
      if ('error' in event.data) request.reject(new Error(event.data.error));
      else request.resolve(event.data);
    };
  }
  return worker;
}

function ask(request: PlaceRequest, transfer: Transferable[] = []): Promise<PlaceResponse> {
  return new Promise<PlaceResponse>((resolve, reject) => {
    pending.set(request.requestId, { resolve, reject });
    getWorker().postMessage(request, transfer);
  });
}

/** Rounded coordinates (about 100 m), the key under which a place is looked up and kept. */
export function coordinateKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

/** The place nearest to a photo, found on the device; null in the open sea. */
export function lookupPlace(latitude: number, longitude: number): Promise<Place | null> {
  const key = coordinateKey(latitude, longitude);
  let answer = answers.get(key);
  if (!answer) {
    answer = ask({ requestId: nextId++, latitude, longitude }).then((response) =>
      'place' in response ? response.place : null,
    );
    // A failure (offline before the list was ever loaded) is not remembered.
    answer.catch(() => answers.delete(key));
    answers.set(key, answer);
  }
  return answer;
}

/** The places nearest to many points at once, in their order (search: every geotagged photo). */
export async function lookupPlaces(
  points: readonly (readonly [number, number])[],
): Promise<(Place | null)[]> {
  const flat = new Float64Array(points.length * 2);
  points.forEach(([latitude, longitude], i) => {
    flat[i * 2] = latitude;
    flat[i * 2 + 1] = longitude;
  });
  const response = await ask({ requestId: nextId++, points: flat }, [flat.buffer]);
  return 'places' in response ? response.places : [];
}
