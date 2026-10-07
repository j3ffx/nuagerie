import type { Place } from './placeIndex.ts';
import type { PlaceRequest, PlaceResponse } from './placeWorker.ts';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (place: Place | null) => void; reject: (e: Error) => void }
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
      if ('place' in event.data) request.resolve(event.data.place);
      else request.reject(new Error(event.data.error));
    };
  }
  return worker;
}

/** The place nearest to a photo, found on the device; null in the open sea. */
export function lookupPlace(latitude: number, longitude: number): Promise<Place | null> {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  let answer = answers.get(key);
  if (!answer) {
    answer = new Promise<Place | null>((resolve, reject) => {
      const requestId = nextId++;
      pending.set(requestId, { resolve, reject });
      getWorker().postMessage({ requestId, latitude, longitude } satisfies PlaceRequest);
    });
    // A failure (offline before the list was ever loaded) is not remembered.
    answer.catch(() => answers.delete(key));
    answers.set(key, answer);
  }
  return answer;
}
