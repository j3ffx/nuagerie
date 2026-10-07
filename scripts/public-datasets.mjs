// Third-party public datasets, not scanned for private patterns by check-tracked
// and check-dist: the world's place names (GeoNames) include everyone's town,
// and listing them reveals nothing. Keep this to generated, public data only.
export const PUBLIC_DATASETS = /^(public|dist)\/places\//;

/** Whether a path (either separator) is inside a public dataset. */
export const isPublicDataset = (path) => PUBLIC_DATASETS.test(path.split('\\').join('/'));
