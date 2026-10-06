/** Well-known public places used to scatter synthetic GPS coordinates. */
export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

const place = (name: string, latitude: number, longitude: number): Place => ({
  name,
  latitude,
  longitude,
});

/** The synthetic "home" around which most everyday photos are taken. */
export const HOME = place('Lyon', 45.764, 4.8357);

export const REGIONAL: readonly Place[] = [
  place('Paris', 48.8566, 2.3522),
  place('Marseille', 43.2965, 5.3698),
  place('Annecy', 45.8992, 6.1294),
  place('Bordeaux', 44.8378, -0.5792),
  place('Nantes', 47.2184, -1.5536),
  place('Brest', 48.3904, -4.4861),
  place('Nice', 43.7102, 7.262),
  place('Chamonix', 45.9237, 6.8694),
  place('Biarritz', 43.4832, -1.5586),
  place('Strasbourg', 48.5734, 7.7521),
  place('Grenoble', 45.1885, 5.7245),
  place('Montpellier', 43.6108, 3.8767),
];

export const ABROAD: readonly Place[] = [
  place('Barcelone', 41.3874, 2.1686),
  place('Rome', 41.9028, 12.4964),
  place('Lisbonne', 38.7223, -9.1393),
  place('Londres', 51.5072, -0.1276),
  place('Amsterdam', 52.3676, 4.9041),
  place('Berlin', 52.52, 13.405),
  place('Athènes', 37.9838, 23.7275),
  place('Santorin', 36.3932, 25.4615),
  place('Reykjavik', 64.1466, -21.9426),
  place('New York', 40.7128, -74.006),
  place('Montréal', 45.5019, -73.5674),
  place('Tokyo', 35.6762, 139.6503),
  place('Kyoto', 35.0116, 135.7681),
  place('Marrakech', 31.6295, -7.9811),
  place('Le Cap', -33.9249, 18.4241),
  place('Sydney', -33.8688, 151.2093),
];

export function findPlace(name: string): Place {
  const found = [HOME, ...REGIONAL, ...ABROAD].find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Unknown demo place: ${name}`);
  return found;
}
